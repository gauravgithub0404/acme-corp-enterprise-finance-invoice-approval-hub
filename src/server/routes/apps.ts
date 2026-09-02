import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import {
  saveAppToDb,
  getAppFromDb,
  getAllAppsFromDb,
  deleteAppFromDb,
  getDbStatus
} from '../db';
import { getRenderStatus } from '../renderApi';

const router = Router();

// ---------------------------------------------------------------------------
// Deployed-app flat-file helpers (fallback when DB is unavailable)
// ---------------------------------------------------------------------------
const DEPLOYED_IR_FILE = path.join(process.cwd(), 'deployed_app_ir.json');

export function getActiveDeployedApp(): any | null {
  try {
    if (fs.existsSync(DEPLOYED_IR_FILE)) {
      const raw = fs.readFileSync(DEPLOYED_IR_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && (data.domain || data.name || data.ir)) return data;
    }
  } catch (err) {
    console.warn('[Server] Error reading deployed_app_ir.json:', err);
  }
  return null;
}

export function setActiveDeployedApp(appData: any): void {
  try {
    fs.writeFileSync(DEPLOYED_IR_FILE, JSON.stringify(appData, null, 2), 'utf-8');
    console.log(`[Server] Active deployed app saved to disk (${appData.domain || appData.name})`);
  } catch (err) {
    console.warn('[Server] Error writing deployed_app_ir.json:', err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/app-info — primary entry-point for the SPA to discover its domain
// ---------------------------------------------------------------------------
router.get('/app-info', async (req, res) => {
  const host = (req.headers.host || '').toLowerCase();
  const renderServiceName = (process.env.RENDER_SERVICE_NAME || '').toLowerCase();
  const renderExternalHost = (process.env.RENDER_EXTERNAL_HOSTNAME || '').toLowerCase();

  let resolvedDomain = process.env.FLOE_APP_DOMAIN || '';
  let resolvedAppName = process.env.FLOE_APP_NAME || '';
  let activeIr: any = null;

  const deployedFileApp = getActiveDeployedApp();
  if (deployedFileApp) {
    if (!resolvedDomain) resolvedDomain = deployedFileApp.domain || deployedFileApp.ir?.domain || '';
    if (!resolvedAppName) resolvedAppName = deployedFileApp.appName || deployedFileApp.name || deployedFileApp.ir?.name || '';
    activeIr = deployedFileApp.ir || deployedFileApp;
  }

  const hostToTest = host || renderExternalHost || renderServiceName;
  if (!resolvedDomain && hostToTest) {
    const renderMatch =
      hostToTest.match(/^floe-([a-z0-9-]+)\.onrender\.com/i) ||
      hostToTest.match(/^([a-z0-9-]+)\.onrender\.com/i);
    if (renderMatch && renderMatch[1] && !renderMatch[1].startsWith('dashboard') && !renderMatch[1].startsWith('floe-studio')) {
      resolvedDomain = renderMatch[1];
    } else if (hostToTest.includes('finance') || hostToTest.includes('invoice')) {
      resolvedDomain = 'finance-invoice-approval';
      resolvedAppName = 'Acme Finance & Invoice Approval';
    } else if (hostToTest.includes('crm') || hostToTest.includes('sales')) {
      resolvedDomain = 'crm-sales-pipeline';
      resolvedAppName = 'Acme Sales & CRM Hub';
    } else if (hostToTest.includes('payroll')) {
      resolvedDomain = 'payroll-processing';
      resolvedAppName = 'Acme Global Payroll & Compliance';
    } else if (hostToTest.includes('equipment') || hostToTest.includes('hardware')) {
      resolvedDomain = 'it-equipment-request';
      resolvedAppName = 'Acme IT Equipment Desk';
    } else if (hostToTest.includes('expense')) {
      resolvedDomain = 'expense-reimbursement';
      resolvedAppName = 'Acme Expense & Reimbursement';
    } else if (hostToTest.includes('service') || hostToTest.includes('ticket') || hostToTest.includes('itsm')) {
      resolvedDomain = 'it-service-desk';
      resolvedAppName = 'Acme Enterprise IT Service Desk';
    }
  }

  if (!resolvedDomain) {
    try {
      const allApps = await getAllAppsFromDb();
      if (allApps.length > 0) {
        const latest = allApps[allApps.length - 1];
        resolvedDomain = latest.domain;
        resolvedAppName = latest.name;
        activeIr = latest.ir;
      }
    } catch { /* swallow */ }
  }

  const isStandalone =
    host.includes('.onrender.com') ||
    host.includes('render.app') ||
    Boolean(process.env.RENDER) ||
    Boolean(process.env.IS_STANDALONE);

  const defaultGitRepo = process.env.DEFAULT_GIT_REPO_URL || '';

  res.status(200).json({
    domain: resolvedDomain,
    appName: resolvedAppName || process.env.FLOE_APP_NAME || '',
    appId: process.env.FLOE_APP_ID || '',
    gitRepoUrl: process.env.GIT_REPO_URL || defaultGitRepo,
    renderUrl: process.env.RENDER_EXTERNAL_URL || '',
    isStandalone,
    environment: process.env.NODE_ENV || 'development',
    activeIr: activeIr || null
  });
});

// ---------------------------------------------------------------------------
// GET /api/deployed-app — read the flat-file persisted active app
// ---------------------------------------------------------------------------
router.get('/deployed-app', (req, res) => {
  const deployed = getActiveDeployedApp();
  if (!deployed) {
    return res.status(200).json({ exists: false, message: 'No active deployed application persisted on disk' });
  }
  res.status(200).json({ exists: true, ...deployed });
});

// ---------------------------------------------------------------------------
// POST /api/deployed-app — persist the active app to disk + DB
// ---------------------------------------------------------------------------
router.post('/deployed-app', async (req, res) => {
  try {
    const { ir, domain, appName, customerName } = req.body;
    const targetDomain = domain || ir?.domain || 'app';
    const targetName = appName || ir?.name || 'Generated Application';

    const payload = {
      domain: targetDomain,
      name: targetName,
      appName: targetName,
      customerName: customerName || 'Acme Corp',
      updatedAt: new Date().toISOString(),
      ir: ir || null
    };

    setActiveDeployedApp(payload);

    if (ir) {
      await saveAppToDb({ id: `app-${targetDomain}`, name: targetName, domain: targetDomain, ir }).catch(
        e => console.warn('[Server] Notice saving to DB:', e.message)
      );
    }

    res.status(200).json({ success: true, message: `Active app set to "${targetName}" (${targetDomain})`, app: payload });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// CRUD for application records
// ---------------------------------------------------------------------------
router.get('/apps', async (req, res) => {
  try {
    const apps = await getAllAppsFromDb();
    res.status(200).json({ apps, count: apps.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/apps/:domainOrId', async (req, res) => {
  try {
    const appRecord = await getAppFromDb(req.params.domainOrId);
    if (!appRecord) {
      return res.status(404).json({ error: `Application "${req.params.domainOrId}" not found` });
    }
    res.status(200).json(appRecord);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apps', async (req, res) => {
  try {
    const { id, name, domain, ir } = req.body;
    if (!domain || !ir) {
      return res.status(400).json({ error: 'Missing domain or ir in body' });
    }
    const appRecord = {
      id: id || `app-${domain}-${Date.now().toString(36)}`,
      name: name || ir.name || domain,
      domain: domain.toLowerCase(),
      ir
    };
    await saveAppToDb(appRecord);
    res.status(201).json(appRecord);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/apps/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    if (!domain) return res.status(400).json({ error: 'Missing domain parameter' });
    await deleteAppFromDb(domain);
    res.status(200).json({ success: true, message: `Application ${domain} deleted from database` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/app/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const ok = await deleteAppFromDb(identifier);
    if (ok) {
      res.json({ success: true, message: `Application '${identifier}' deleted.` });
    } else {
      res.status(500).json({ success: false, error: `Failed to delete application '${identifier}'.` });
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message ?? 'Unexpected error.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
router.get('/health', async (req, res) => {
  const [dbStatus, renderStatus] = await Promise.all([
    getDbStatus().catch(err => ({ connected: false, error: err.message })),
    getRenderStatus().catch(err => ({ valid: false, error: err.message }))
  ]);
  res.status(200).json({
    status: 'healthy',
    platform: 'Floe Application Platform',
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    memory_usage: process.memoryUsage(),
    database: dbStatus,
    render_api: renderStatus,
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// GET /api/database/status
// ---------------------------------------------------------------------------
router.get('/database/status', async (req, res) => {
  try {
    const status = await getDbStatus();
    res.status(200).json(status);
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

export default router;
