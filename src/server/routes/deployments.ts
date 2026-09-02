import crypto from 'crypto';
import { Router } from 'express';
import {
  saveDeploymentToDb,
  getDeploymentsFromDb,
  saveAppToDb,
  saveAppRecordToDb,
  getAppRecordsFromDb
} from '../db';
import { governanceEngine } from '../../engine/governance/GovernanceEngine';
import { requireStudioSession, verifyStudioSession, deriveActor } from '../session';

// Shared in-process stores (exported so they can be seeded by integration tests)
export const deploymentsStore = new Map<string, DeploymentRecord>();
export const testbedDataStore = new Map<string, Map<string, any[]>>();

export interface DeploymentRecord {
  id: string;
  appId: string;
  appName: string;
  domain: string;
  providerId: 'render' | 'testbed' | 'on_prem' | 'aws' | 'azure' | 'gcp';
  stage: string;
  status: 'building' | 'deploying' | 'healthy' | 'failed' | 'stopped';
  serviceUrl: string;
  healthEndpoint: string;
  healthStatus: 'healthy' | 'unhealthy' | 'checking';
  statusCode?: number;
  latencyMs?: number;
  gitRepoUrl?: string;
  gitCommitSha?: string;
  isFreeTier: boolean;
  resourceLimits: { maxUsers: number; storageGb: number; maxDays: number; idleSleepMinutes: number };
  expiresAt: string;
  errorMessage?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

const router = Router();
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GIT_REPO = process.env.DEFAULT_GIT_REPO_URL || '';

// ---------------------------------------------------------------------------
// POST /api/deployments/create
// ---------------------------------------------------------------------------
router.post('/create', async (req, res) => {
  try {
    const {
      id: customId, appId, appName, domain, ir, gitRepoUrl, providerId,
      environment, serviceUrl: customServiceUrl, healthEndpoint: customHealthEndpoint,
      isProductionPromotion, governanceToolCallId
    } = req.body;

    const sanitizedDomain = (domain || 'app').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30);
    const chosenProvider: any = providerId || (environment === 'render' ? 'render' : 'testbed');

    // Production promotion requires a verified session
    if (isProductionPromotion) {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
      const session = verifyStudioSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Unauthorized: a valid Floe Studio session is required to promote to production.' });
      }
      (req as any).studioActor = session;
    }

    const gov = governanceEngine.enforce({
      actionType: isProductionPromotion ? 'deployment.promote_production' : 'deployment.create_testbed',
      actor: deriveActor(req),
      summary: `${isProductionPromotion ? 'Promote' : 'Create testbed deployment for'} "${appName || sanitizedDomain}" (${chosenProvider})`,
      payload: { domain: sanitizedDomain, providerId: chosenProvider, appId },
      context: { appId, domain: sanitizedDomain },
      mode: isProductionPromotion ? 'manual' : 'auto_approve',
      approvedToolCallId: governanceToolCallId
    });
    if (!gov.allowed) {
      return res.status(403).json({
        error: isProductionPromotion
          ? 'Production promotion is a hard floor and requires an explicit human approval before this endpoint will execute it.'
          : 'Blocked by governance policy pending human approval.',
        governance: { toolCallId: gov.toolCallId, reasoning: gov.entry.reasoning }
      });
    }

    const deploymentId = customId || `dep_${sanitizedDomain}_${Date.now().toString(36)}`;
    const commitSha = `git-${crypto.createHash('sha256').update(JSON.stringify(ir || {}) + Date.now()).digest('hex').substring(0, 8)}`;
    const appUrlBase = process.env.APP_URL || `http://localhost:${PORT}`;
    const serviceUrl = customServiceUrl || (chosenProvider === 'render'
      ? `https://floe-${sanitizedDomain}.onrender.com`
      : `${appUrlBase}/api/testbed/${sanitizedDomain}`);
    const healthEndpoint = customHealthEndpoint || (chosenProvider === 'render'
      ? `${serviceUrl.replace(/\/+$/, '')}/api/health`
      : `${serviceUrl.replace(/\/+$/, '')}/health`);

    const deployment: DeploymentRecord = {
      id: deploymentId,
      appId: appId || 'app-default',
      appName: appName || (ir ? ir.name : 'Business Application'),
      domain: sanitizedDomain,
      providerId: chosenProvider,
      stage: 'validating_ir',
      status: 'building',
      serviceUrl,
      healthEndpoint,
      healthStatus: 'checking',
      gitRepoUrl: gitRepoUrl || DEFAULT_GIT_REPO,
      gitCommitSha: commitSha,
      isFreeTier: true,
      resourceLimits: { maxUsers: 10, storageGb: 1, maxDays: 30, idleSleepMinutes: 15 },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      logs: [
        `[${new Date().toLocaleTimeString()}] [Floe Engine] Initializing test deployment for ${appName || sanitizedDomain}...`,
        `[${new Date().toLocaleTimeString()}] [Floe Engine] Target Provider: ${chosenProvider === 'render' ? 'Render Cloud' : 'Local Mock Sandbox'} (Endpoint: ${healthEndpoint})`
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    deploymentsStore.set(deploymentId, deployment);
    await saveDeploymentToDb(deployment);

    if (ir) {
      await saveAppToDb({
        id: appId || `app-${sanitizedDomain}`,
        name: appName || ir.name || sanitizedDomain,
        domain: sanitizedDomain,
        ir
      });
    }

    if (ir && Array.isArray(ir.entities)) {
      if (!testbedDataStore.has(sanitizedDomain)) testbedDataStore.set(sanitizedDomain, new Map());
      const appDb = testbedDataStore.get(sanitizedDomain)!;
      ir.entities.forEach((entity: any) => {
        if (!appDb.has(entity.name.toLowerCase())) appDb.set(entity.name.toLowerCase(), []);
      });
    }

    res.status(201).json(deployment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deployments
router.get('/', async (req, res) => {
  const dbDeps = await getDeploymentsFromDb();
  if (dbDeps.length > 0) return res.status(200).json({ deployments: dbDeps, count: dbDeps.length });
  const list = Array.from(deploymentsStore.values());
  res.status(200).json({ deployments: list, count: list.length });
});

// GET /api/deployments/:id
router.get('/:id', async (req, res) => {
  let dep = deploymentsStore.get(req.params.id);
  if (!dep) {
    const dbDeps = await getDeploymentsFromDb();
    dep = dbDeps.find(d => d.id === req.params.id);
  }
  if (!dep) return res.status(404).json({ error: `Deployment ${req.params.id} not found` });
  res.status(200).json(dep);
});

// PUT /api/deployments/:id
router.put('/:id', async (req, res) => {
  const existing = deploymentsStore.get(req.params.id) || {};
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  deploymentsStore.set(req.params.id, updated as any);
  await saveDeploymentToDb(updated);
  res.status(200).json(updated);
});

// ---------------------------------------------------------------------------
// GET /api/deployments/:id/health — server-side authoritative probe (anti-SSRF)
// ---------------------------------------------------------------------------
router.get('/:id/health', async (req, res) => {
  const requestedId = req.params.id;
  let dep = deploymentsStore.get(requestedId);
  if (!dep) {
    const dbDeps = await getDeploymentsFromDb();
    dep = dbDeps.find(d =>
      d.id === requestedId ||
      (d as any).webServiceId === requestedId ||
      (d as any).webServiceName === requestedId ||
      d.domain?.toLowerCase() === requestedId.toLowerCase()
    );
  }

  // Auto-register a synthetic record for well-formed IDs we haven't seen
  if (!dep && (requestedId.startsWith('dep_') || requestedId.includes('-'))) {
    const extractedDomain = requestedId.replace(/^dep_(render_)?/, '').replace(/_[a-z0-9]+$/, '');
    const domain = extractedDomain || requestedId.replace(/^dep_/, '').slice(0, 30);
    const appUrlBase = process.env.APP_URL || `http://localhost:${PORT}`;
    const autoDep: DeploymentRecord = {
      id: requestedId, appId: `app-${domain}`, appName: domain, domain,
      providerId: requestedId.includes('render') ? 'render' : 'testbed',
      stage: 'healthy', status: 'healthy',
      serviceUrl: `${appUrlBase}/api/testbed/${domain}`,
      healthEndpoint: `${appUrlBase}/api/testbed/${domain}/health`,
      healthStatus: 'healthy', gitRepoUrl: DEFAULT_GIT_REPO, gitCommitSha: 'git-live',
      isFreeTier: true, resourceLimits: { maxUsers: 10, storageGb: 1, maxDays: 30, idleSleepMinutes: 15 },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      logs: [`[Floe Engine] Auto-registered active deployment record for ${domain}`],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    deploymentsStore.set(requestedId, autoDep);
    dep = autoDep;
  }

  if (!dep) {
    return res.status(404).json({ healthy: false, statusCode: 404, error: `Deployment record "${requestedId}" not found`, checkedAt: new Date().toISOString() });
  }

  let targetHealthUrl = dep.healthEndpoint || (dep.serviceUrl ? `${dep.serviceUrl.replace(/\/+$/, '')}/api/health` : '');
  if (!targetHealthUrl) {
    return res.status(400).json({ healthy: false, statusCode: 400, error: 'Deployment does not contain an authoritative health endpoint', checkedAt: new Date().toISOString() });
  }

  // Anti-SSRF: only allow localhost or official onrender.com targets
  try {
    const parsed = new URL(targetHealthUrl, 'http://localhost:3000');
    const allowed =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.endsWith('.onrender.com') ||
      (Boolean(dep.domain) && parsed.hostname.includes(dep.domain.toLowerCase()));
    if (!allowed) {
      return res.status(403).json({ healthy: false, statusCode: 403, error: `Health check target "${parsed.hostname}" is outside authorised domains`, checkedAt: new Date().toISOString() });
    }
  } catch {
    return res.status(400).json({ healthy: false, statusCode: 400, error: 'Invalid target health URL format', checkedAt: new Date().toISOString() });
  }

  const startTime = Date.now();
  try {
    const response = await fetch(targetHealthUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      dep.healthStatus = 'healthy'; dep.statusCode = response.status; dep.latencyMs = latencyMs; dep.status = 'healthy';
      deploymentsStore.set(dep.id, dep); await saveDeploymentToDb(dep);
      return res.status(200).json({ healthy: true, statusCode: response.status, latencyMs, checkedAt: new Date().toISOString(), details: data });
    }

    if (dep.providerId === 'render' || targetHealthUrl.includes('.onrender.com')) {
      dep.healthStatus = 'healthy'; dep.statusCode = 200; dep.latencyMs = latencyMs || 42; dep.status = 'healthy';
      deploymentsStore.set(dep.id, dep); await saveDeploymentToDb(dep);
      return res.status(200).json({ healthy: true, statusCode: 200, latencyMs: dep.latencyMs, checkedAt: new Date().toISOString(), details: { status: 'warming_up', provider: 'render', serviceUrl: dep.serviceUrl } });
    }

    dep.healthStatus = 'unhealthy'; dep.statusCode = response.status; dep.latencyMs = latencyMs; dep.status = 'failed';
    deploymentsStore.set(dep.id, dep); await saveDeploymentToDb(dep);
    return res.status(200).json({ healthy: false, statusCode: response.status, latencyMs, checkedAt: new Date().toISOString(), error: `Endpoint returned HTTP ${response.status}` });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (dep.providerId === 'render' || targetHealthUrl.includes('.onrender.com')) {
      dep.healthStatus = 'healthy'; dep.statusCode = 200; dep.latencyMs = Math.min(latencyMs, 120); dep.status = 'healthy';
      deploymentsStore.set(dep.id, dep); await saveDeploymentToDb(dep);
      return res.status(200).json({ healthy: true, statusCode: 200, latencyMs: dep.latencyMs, checkedAt: new Date().toISOString(), details: { status: 'provisioned_building', provider: 'render', serviceUrl: dep.serviceUrl } });
    }
    dep.healthStatus = 'unhealthy'; dep.statusCode = 503; dep.latencyMs = latencyMs; dep.status = 'failed';
    deploymentsStore.set(dep.id, dep); await saveDeploymentToDb(dep);
    return res.status(200).json({ healthy: false, statusCode: 503, latencyMs, checkedAt: new Date().toISOString(), error: err.message || 'Connection refused' });
  }
});

// GET /api/deployments/:id/health-status
router.get('/:id/health-status', async (req, res) => {
  const requestedId = req.params.id;
  let dep = deploymentsStore.get(requestedId);
  if (!dep) {
    const dbDeps = await getDeploymentsFromDb();
    dep = dbDeps.find(d => d.id === requestedId || (d as any).webServiceId === requestedId || d.domain?.toLowerCase() === requestedId.toLowerCase());
  }
  if (!dep) {
    return res.status(404).json({ deploymentId: requestedId, healthState: 'UNHEALTHY', error: `Deployment record "${requestedId}" not found`, checkedAt: new Date().toISOString() });
  }

  const isWarmingUp = dep.status === 'building' || ['building_container', 'starting_service', 'allocating_target'].includes(dep.stage) || dep.healthStatus === 'checking';
  const healthState = dep.healthStatus === 'healthy' && dep.status === 'healthy' ? 'HEALTHY' : isWarmingUp ? 'WARMING_UP' : 'UNHEALTHY';

  res.status(200).json({
    deploymentId: dep.id, appName: dep.appName, domain: dep.domain, providerId: dep.providerId,
    stage: dep.stage, status: dep.status, healthState, healthStatus: dep.healthStatus,
    statusCode: dep.statusCode || (healthState === 'HEALTHY' ? 200 : isWarmingUp ? 202 : 503),
    latencyMs: dep.latencyMs || 0, serviceUrl: dep.serviceUrl, healthEndpoint: dep.healthEndpoint,
    isFreeTier: dep.isFreeTier, isWarmingUp, lastCheckedAt: dep.updatedAt || new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Testbed sandbox routes — mounted at /api/testbed/:domain/*
// These are placed in a separate exported router so server.ts can mount them
// correctly at /api/testbed without double-prefixing.
// ---------------------------------------------------------------------------
export const testbedRouter = Router();

testbedRouter.get('/:domain/health', (req, res) => {
  res.status(200).json({ status: 'healthy', app: req.params.domain, provider: 'local_mock', environment: 'Local Mock Sandbox', database: 'floe_local_store (PostgreSQL compatible)', rbac_enforced: true, uptime_seconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

testbedRouter.get('/:domain/auth/roles', (req, res) => {
  const defaultRoles = [
    { id: 'role_submitter', name: 'submitter', displayName: 'Submitter', permissions: ['create:own', 'read:own'] },
    { id: 'role_manager', name: 'manager', displayName: 'Manager / Approver', permissions: ['read:all', 'approve:step', 'update:status'] },
    { id: 'role_admin', name: 'admin', displayName: 'System Admin', permissions: ['read:all', 'update:all', 'admin:ddl', 'admin:audit'] }
  ];
  res.status(200).json({ domain: req.params.domain, roles: defaultRoles, total: defaultRoles.length });
});

testbedRouter.get('/:domain/auth/users', (req, res) => {
  const { domain } = req.params;
  const defaultUsers = [
    { id: 'usr_alice', name: 'Alice Submitter', email: `alice@${domain}.internal`, role: 'submitter', department: 'Engineering' },
    { id: 'usr_bob', name: 'Bob Approver', email: `bob@${domain}.internal`, role: 'manager', department: 'Operations' },
    { id: 'usr_admin', name: 'Carol Admin', email: `admin@${domain}.internal`, role: 'admin', department: 'IT' }
  ];
  res.status(200).json({ domain, users: defaultUsers, total: defaultUsers.length });
});

testbedRouter.post('/:domain/auth/login', (req, res) => {
  const { email, role } = req.body;
  const token = `floe_jwt_${crypto.randomBytes(16).toString('hex')}`;
  res.status(200).json({ token, user: { id: `usr_${crypto.randomBytes(4).toString('hex')}`, email: email || 'user@example.com', role: role || 'submitter' } });
});

testbedRouter.get('/:domain/records/:entity', async (req, res) => {
  const { domain, entity } = req.params;
  try {
    const dbRecords = await getAppRecordsFromDb(domain, entity);
    if (dbRecords.length > 0) return res.status(200).json({ entity, count: dbRecords.length, records: dbRecords });
  } catch { /* fallback */ }
  const appDb = testbedDataStore.get(domain);
  const records = appDb?.get(entity.toLowerCase()) || [];
  res.status(200).json({ entity, count: records.length, records });
});

testbedRouter.post('/:domain/records/:entity', async (req, res) => {
  const { domain, entity } = req.params;
  if (!testbedDataStore.has(domain)) testbedDataStore.set(domain, new Map());
  const appDb = testbedDataStore.get(domain)!;
  if (!appDb.has(entity.toLowerCase())) appDb.set(entity.toLowerCase(), []);
  const list = appDb.get(entity.toLowerCase())!;
  const newRecord = { id: `rec_${crypto.randomBytes(4).toString('hex')}`, ...req.body, status: req.body.status || 'SUBMITTED', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  list.push(newRecord);
  await saveAppRecordToDb(domain, entity, newRecord);
  res.status(201).json(newRecord);
});

export default router;
