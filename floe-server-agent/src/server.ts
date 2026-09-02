import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import os from 'os';
import crypto from 'crypto';
import si from 'systeminformation';
import { DeploymentManager } from './deployment';
import { checkDockerAvailability, getRunningContainers } from './docker';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------
// This daemon extracts uploaded artifacts to disk and runs
// `docker compose up --build` on them -- i.e. it is a remote build/execute
// service by design. It MUST NOT be reachable without a shared secret, even
// on a private Tailscale network, because anything on that network (or
// anything that later bridges/forwards this port) would otherwise get
// unauthenticated host-level code execution.
const AGENT_SHARED_SECRET = process.env.AGENT_SHARED_SECRET || '';
const ALLOW_INSECURE_AGENT = process.env.ALLOW_INSECURE_AGENT === 'true';

if (!AGENT_SHARED_SECRET && !ALLOW_INSECURE_AGENT) {
  console.error(
    '[Floe Server Agent] FATAL: AGENT_SHARED_SECRET is not set. Refusing to start, because this ' +
    'daemon builds and runs arbitrary uploaded artifacts and must not be reachable without a shared ' +
    'secret. Set AGENT_SHARED_SECRET to a long random value, or set ALLOW_INSECURE_AGENT=true to run ' +
    'unauthenticated on localhost only for local development (never do this on a shared/Tailscale host).'
  );
  process.exit(1);
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Every route requires `Authorization: Bearer <AGENT_SHARED_SECRET>` unless
// the operator explicitly opted into insecure local-only mode. The health
// endpoint is intentionally still gated -- there is nothing here that needs
// to be reachable by an unauthenticated caller.
app.use((req, res, next) => {
  if (!AGENT_SHARED_SECRET) {
    // ALLOW_INSECURE_AGENT=true path -- already logged loudly at startup,
    // and the server only binds to 127.0.0.1 in that mode (see listen call).
    return next();
  }
  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!presented || !timingSafeEquals(presented, AGENT_SHARED_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid Authorization: Bearer <secret> header.' });
  }
  next();
});

const deploymentManager = new DeploymentManager();
const AGENT_VERSION = '1.0.0';

// -------------------------------------------------------------
// AGENT HEALTH & SYSTEM METRICS
// -------------------------------------------------------------

app.get('/api/v1/health', async (req, res) => {
  const docker = await checkDockerAvailability();
  res.json({
    status: 'online',
    agent_version: AGENT_VERSION,
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    docker_ready: docker.available,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/system', async (req, res) => {
  try {
    const [cpu, mem, fsSize, docker] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      checkDockerAvailability()
    ]);

    const primaryDisk = fsSize[0] || { size: 0, available: 0 };
    const containers = await getRunningContainers();

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpu: {
        current_load_pct: Math.round(cpu.currentLoad),
        cores: os.cpus().length
      },
      memory: {
        total_mb: Math.round(mem.total / (1024 * 1024)),
        used_mb: Math.round(mem.used / (1024 * 1024)),
        free_mb: Math.round(mem.free / (1024 * 1024)),
        usage_pct: Math.round((mem.used / mem.total) * 100)
      },
      disk: {
        total_gb: Math.round((primaryDisk.size || 0) / (1024 * 1024 * 1024)),
        free_gb: Math.round((primaryDisk.available || 0) / (1024 * 1024 * 1024))
      },
      docker: {
        available: docker.available,
        version: docker.version,
        running_containers_count: containers.length,
        containers
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DEPLOYMENT LIFECYCLE ENDPOINTS
// -------------------------------------------------------------

// Deploy via multipart upload or JSON base64
app.post('/api/v1/deploy', upload.single('artifact'), async (req, res) => {
  try {
    let zipBuffer: Buffer;
    let appId: string;
    let domain: string;
    let version: string;
    let healthContract: any;

    if (req.file) {
      zipBuffer = req.file.buffer;
      appId = req.body.appId || 'app-' + Date.now();
      domain = req.body.domain || 'app';
      version = req.body.version || '1.0';
      if (req.body.healthContract) {
        healthContract = JSON.parse(req.body.healthContract);
      }
    } else if (req.body.artifactBase64) {
      zipBuffer = Buffer.from(req.body.artifactBase64, 'base64');
      appId = req.body.appId || 'app-' + Date.now();
      domain = req.body.domain || 'app';
      version = req.body.version || '1.0';
      healthContract = req.body.healthContract;
    } else {
      return res.status(400).json({ error: 'Missing artifact file or artifactBase64' });
    }

    const task = await deploymentManager.createDeployment(appId, domain, version, zipBuffer, healthContract);

    res.status(202).json({
      message: 'Deployment initiated successfully',
      deploymentId: task.id,
      stage: task.stage,
      statusUrl: `/api/v1/deployments/${task.id}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Query deployment status & logs
app.get('/api/v1/deployments/:id', (req, res) => {
  const task = deploymentManager.getDeployment(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  res.json(task);
});

// Query deployment logs only
app.get('/api/v1/deployments/:id/logs', (req, res) => {
  const task = deploymentManager.getDeployment(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  res.json({ id: task.id, logs: task.logs, stage: task.stage });
});

// List all deployments
app.get('/api/v1/deployments', (req, res) => {
  res.json(deploymentManager.getAllDeployments());
});

// Stop an app
app.post('/api/v1/apps/:appId/stop', async (req, res) => {
  try {
    const { domain } = req.body;
    await deploymentManager.stopApp(req.params.appId, domain || 'app');
    res.json({ message: `App ${req.params.appId} stopped successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.AGENT_PORT) || 4000;
// In insecure/no-secret mode, only ever bind to loopback so the daemon can't
// be reached over Tailscale or any other network interface. Authenticated
// mode (the expected production path) binds to all interfaces as before.
const BIND_HOST = AGENT_SHARED_SECRET ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, BIND_HOST, () => {
  if (!AGENT_SHARED_SECRET) {
    console.warn(
      `[Floe Server Agent] WARNING: running with ALLOW_INSECURE_AGENT=true and no AGENT_SHARED_SECRET. ` +
      `Bound to 127.0.0.1 only -- this instance is NOT reachable over Tailscale/LAN. Do not use this mode ` +
      `outside local development.`
    );
  }
  console.log(`Floe Server Agent daemon listening on http://${BIND_HOST}:${PORT}`);
  console.log(`Health endpoint: http://${BIND_HOST}:${PORT}/api/v1/health`);
  console.log(`System metrics: http://${BIND_HOST}:${PORT}/api/v1/system`);
});
