"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDockerAvailability = checkDockerAvailability;
exports.runDockerComposeBuildAndUp = runDockerComposeBuildAndUp;
exports.stopDockerApp = stopDockerApp;
exports.getRunningContainers = getRunningContainers;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function checkDockerAvailability() {
    try {
        const { stdout } = await execAsync('docker --version');
        return {
            available: true,
            version: stdout.trim()
        };
    }
    catch (err) {
        return {
            available: false,
            error: err.message || 'Docker command failed'
        };
    }
}
async function runDockerComposeBuildAndUp(projectDir, onLog) {
    return new Promise((resolve, reject) => {
        onLog(`[Docker] Executing: docker compose up --build -d in ${projectDir}`);
        // Support both `docker compose` (v2) and `docker-compose` (v1)
        const proc = (0, child_process_1.exec)('docker compose up --build -d', { cwd: projectDir });
        proc.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((l) => {
                if (l.trim())
                    onLog(`[Docker Stdout] ${l}`);
            });
        });
        proc.stderr?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((l) => {
                if (l.trim())
                    onLog(`[Docker] ${l}`);
            });
        });
        proc.on('close', (code) => {
            if (code === 0) {
                onLog(`[Docker] Containers started successfully.`);
                resolve();
            }
            else {
                reject(new Error(`Docker Compose exited with non-zero exit code: ${code}`));
            }
        });
        proc.on('error', (err) => {
            reject(err);
        });
    });
}
async function stopDockerApp(projectDir) {
    await execAsync('docker compose down', { cwd: projectDir });
}
async function getRunningContainers() {
    try {
        const { stdout } = await execAsync('docker ps --format "{{.Names}}"');
        return stdout.split('\n').map(s => s.trim()).filter(Boolean);
    }
    catch {
        return [];
    }
}
