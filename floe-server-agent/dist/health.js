"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollHealthCheckEndpoint = pollHealthCheckEndpoint;
const http_1 = __importDefault(require("http"));
async function pollHealthCheckEndpoint(options, onLog) {
    const { host, port, path, timeoutSeconds, expectedStatus = 200 } = options;
    const targetUrl = `http://${host}:${port}${path}`;
    const startTime = Date.now();
    const maxTimeMs = timeoutSeconds * 1000;
    onLog(`[HealthCheck] Starting health probe against ${targetUrl} (Timeout: ${timeoutSeconds}s)`);
    let attempt = 0;
    while (Date.now() - startTime < maxTimeMs) {
        attempt++;
        try {
            onLog(`[HealthCheck] Attempt #${attempt}: Probing ${targetUrl}...`);
            const status = await checkHttp(host, port, path);
            if (status === expectedStatus) {
                onLog(`[HealthCheck] SUCCESS: Service responded with HTTP ${status}`);
                return true;
            }
            else {
                onLog(`[HealthCheck] Service responded with HTTP ${status} (waiting for ${expectedStatus})`);
            }
        }
        catch (err) {
            onLog(`[HealthCheck] Probe failed: ${err.message || 'Connection refused (service initializing)'}`);
        }
        // Wait 2.5 seconds before next retry
        await new Promise(r => setTimeout(r, 2500));
    }
    onLog(`[HealthCheck] FAILED: Service did not pass health check within ${timeoutSeconds}s`);
    return false;
}
function checkHttp(host, port, path) {
    return new Promise((resolve, reject) => {
        const req = http_1.default.get({ host, port, path, timeout: 3000 }, (res) => {
            resolve(res.statusCode || 0);
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
    });
}
