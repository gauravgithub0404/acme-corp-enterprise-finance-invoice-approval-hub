"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jszip_1 = __importDefault(require("jszip"));
const docker_1 = require("./docker");
const health_1 = require("./health");
class DeploymentManager {
    baseDir;
    deployments = new Map();
    constructor(baseDir) {
        this.baseDir = baseDir || path_1.default.join(process.cwd(), 'deployed_apps');
        if (!fs_1.default.existsSync(this.baseDir)) {
            fs_1.default.mkdirSync(this.baseDir, { recursive: true });
        }
    }
    /**
     * Restrict appId/domain to a safe filesystem-segment charset. These values
     * come directly from the HTTP request body and are used to build a
     * directory path, so without this a request like
     * `{ domain: "../../../../etc", appId: "cron.d" }` could escape `baseDir`.
     */
    sanitizeSegment(value, fallback) {
        const cleaned = (value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+/, '').slice(0, 60);
        return cleaned || fallback;
    }
    resolveAppDir(domain, appId) {
        const safeDomain = this.sanitizeSegment(domain, 'app');
        const safeAppId = this.sanitizeSegment(appId, 'default');
        const appDir = path_1.default.resolve(this.baseDir, `${safeDomain}_${safeAppId}`);
        // Defense in depth: even with sanitized segments, verify the resolved
        // path is still contained within baseDir before ever touching disk.
        const resolvedBase = path_1.default.resolve(this.baseDir);
        if (appDir !== resolvedBase && !appDir.startsWith(resolvedBase + path_1.default.sep)) {
            throw new Error(`Resolved app directory "${appDir}" escapes the sandboxed base directory.`);
        }
        return appDir;
    }
    getDeployment(id) {
        return this.deployments.get(id);
    }
    getAllDeployments() {
        return Array.from(this.deployments.values());
    }
    async createDeployment(appId, domain, version, zipBuffer, healthContract) {
        const deploymentId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const task = {
            id: deploymentId,
            appId,
            domain,
            version,
            stage: 'deployment_requested',
            logs: [],
            startedAt: new Date().toISOString(),
            healthContract: healthContract || { path: '/api/health', port: 4000, timeoutSeconds: 45 }
        };
        this.deployments.set(deploymentId, task);
        // Launch async execution of deployment state machine
        this.executeDeploymentPipeline(task, zipBuffer).catch((err) => {
            task.stage = 'failed';
            task.error = err.message;
            task.logs.push(`[Fatal] Pipeline error: ${err.message}`);
        });
        return task;
    }
    addLog(task, message) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logLine = `[${timestamp}] ${message}`;
        task.logs.push(logLine);
        console.log(`[Dep:${task.id}] ${logLine}`);
    }
    async executeDeploymentPipeline(task, zipBuffer) {
        const appDir = this.resolveAppDir(task.domain, task.appId);
        // Stage 1: Artifact Uploaded & Extracted
        task.stage = 'artifact_uploaded';
        this.addLog(task, `Artifact received (${(zipBuffer.length / 1024).toFixed(1)} KB). Unpacking to ${appDir}...`);
        if (fs_1.default.existsSync(appDir)) {
            this.addLog(task, `Cleaning previous deployment directory...`);
            fs_1.default.rmSync(appDir, { recursive: true, force: true });
        }
        fs_1.default.mkdirSync(appDir, { recursive: true });
        const zip = await jszip_1.default.loadAsync(zipBuffer);
        const resolvedAppDir = path_1.default.resolve(appDir);
        let skippedEntries = 0;
        for (const [relativePath, file] of Object.entries(zip.files)) {
            // Zip-slip guard: reject absolute paths and any entry whose resolved
            // path would land outside the sandboxed app directory (e.g.
            // "../../../etc/cron.d/evil" or a Windows drive-letter path).
            const destPath = path_1.default.resolve(appDir, relativePath);
            if (path_1.default.isAbsolute(relativePath) || (destPath !== resolvedAppDir && !destPath.startsWith(resolvedAppDir + path_1.default.sep))) {
                skippedEntries += 1;
                this.addLog(task, `[SECURITY] Rejected unsafe zip entry outside sandbox: "${relativePath}"`);
                continue;
            }
            if (file.dir) {
                fs_1.default.mkdirSync(destPath, { recursive: true });
            }
            else {
                const content = await file.async('nodebuffer');
                fs_1.default.mkdirSync(path_1.default.dirname(destPath), { recursive: true });
                fs_1.default.writeFileSync(destPath, content);
            }
        }
        if (skippedEntries > 0) {
            this.addLog(task, `[SECURITY] Skipped ${skippedEntries} unsafe zip entr${skippedEntries === 1 ? 'y' : 'ies'} during extraction.`);
        }
        this.addLog(task, `Extracted ${Object.keys(zip.files).length - skippedEntries} files successfully.`);
        // Stage 2: Container Building & Starting
        task.stage = 'container_building';
        this.addLog(task, `Launching Docker Compose orchestrator...`);
        await (0, docker_1.runDockerComposeBuildAndUp)(appDir, (msg) => {
            this.addLog(task, msg);
        });
        task.stage = 'services_started';
        this.addLog(task, `Docker Compose services are up. Awaiting health probe...`);
        // Stage 3: Health Verification Contract
        task.stage = 'health_check_running';
        const contract = task.healthContract;
        const isHealthy = await (0, health_1.pollHealthCheckEndpoint)({
            host: 'localhost',
            port: contract.port,
            path: contract.path,
            timeoutSeconds: contract.timeoutSeconds
        }, (msg) => this.addLog(task, msg));
        if (isHealthy) {
            task.stage = 'healthy';
            task.completedAt = new Date().toISOString();
            task.deployedUrl = `http://${process.env.TAILSCALE_IP || 'localhost'}:${contract.port}`;
            this.addLog(task, `[SUCCESS] Deployment is healthy and serving at ${task.deployedUrl}`);
        }
        else {
            task.stage = 'failed';
            task.completedAt = new Date().toISOString();
            task.error = `Service failed mandatory health check on ${contract.path}`;
            this.addLog(task, `[FAILED] ${task.error}`);
        }
    }
    async stopApp(appId, domain) {
        const appDir = this.resolveAppDir(domain, appId);
        if (fs_1.default.existsSync(appDir)) {
            await (0, docker_1.stopDockerApp)(appDir);
        }
    }
}
exports.DeploymentManager = DeploymentManager;
