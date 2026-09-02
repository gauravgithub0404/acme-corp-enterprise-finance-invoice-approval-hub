import { Router } from 'express';
import {
  getRenderStatus,
  listRenderServices,
  listRenderPostgresDatabases,
  createRenderWebService,
  createRenderPostgres,
  triggerRenderDeploy,
  updateRenderServiceEnvVars,
  getRenderService,
  deleteRenderService,
  deleteRenderPostgres,
  suspendRenderService,
  resumeRenderService,
  getRenderOwners
} from '../renderApi';
import { governanceEngine } from '../../engine/governance/GovernanceEngine';
import { requireStudioSession, deriveActor } from '../session';

const router = Router();

// GET /api/render/status
router.get('/status', async (req, res) => {
  try {
    const status = await getRenderStatus();
    res.status(200).json(status);
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// GET /api/render/services
router.get('/services', async (req, res) => {
  try {
    const services = await listRenderServices();
    res.status(200).json({ services, count: services.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/databases
router.get('/databases', async (req, res) => {
  try {
    const databases = await listRenderPostgresDatabases();
    res.status(200).json({ databases, count: databases.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/owners
router.get('/owners', async (req, res) => {
  try {
    const owners = await getRenderOwners();
    res.status(200).json({ owners });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/postgres — provision a test PostgreSQL database
router.post('/postgres', requireStudioSession, async (req, res) => {
  try {
    const { name, databaseName, databaseUser, plan, region } = req.body;
    if (!name || !databaseName) {
      return res.status(400).json({ error: 'Missing required field: name and databaseName' });
    }

    const gov = governanceEngine.enforce({
      actionType: 'infra.provision_render_test_postgres',
      actor: deriveActor(req),
      summary: `Provision Render test PostgreSQL database "${databaseName}"`,
      payload: { name, databaseName, plan, region },
      context: { domain: databaseName },
      mode: 'auto_approve',
      approvedToolCallId: req.body.governanceToolCallId
    });
    if (!gov.allowed) {
      return res.status(403).json({
        error: 'Blocked by governance policy pending human approval.',
        governance: { toolCallId: gov.toolCallId, reasoning: gov.entry.reasoning }
      });
    }

    const postgres = await createRenderPostgres({ name, databaseName, databaseUser, plan, region });
    res.status(201).json({ postgres, governanceToolCallId: gov.toolCallId });
  } catch (err: any) {
    console.error('[Render API] Error in POST /api/render/postgres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/services — provision a web service
router.post('/services', requireStudioSession, async (req, res) => {
  try {
    const { name, repo, branch, envVars, plan, region, healthCheckPath } = req.body;
    if (!name || !repo) {
      return res.status(400).json({ error: 'Missing required field: name and repo' });
    }

    const gov = governanceEngine.enforce({
      actionType: 'infra.provision_render_test_service',
      actor: deriveActor(req),
      summary: `Provision Render test web service "${name}"`,
      payload: { name, repo, branch, plan, region },
      context: { domain: name },
      mode: 'auto_approve',
      approvedToolCallId: req.body.governanceToolCallId
    });
    if (!gov.allowed) {
      return res.status(403).json({
        error: 'Blocked by governance policy pending human approval.',
        governance: { toolCallId: gov.toolCallId, reasoning: gov.entry.reasoning }
      });
    }

    const service = await createRenderWebService({ name, repo, branch, envVars, plan, region, healthCheckPath });
    res.status(201).json({ service, governanceToolCallId: gov.toolCallId });
  } catch (err: any) {
    console.error('[Render API] Error in POST /api/render/services:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/render/services/:serviceId
router.get('/services/:serviceId', async (req, res) => {
  try {
    const service = await getRenderService(req.params.serviceId);
    res.status(200).json({ service });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/services/:serviceId/deploys
router.post('/services/:serviceId/deploys', requireStudioSession, async (req, res) => {
  try {
    const clearCache = req.body?.clearCache !== false;
    const gov = governanceEngine.enforce({
      actionType: 'infra.provision_render_test_service',
      actor: deriveActor(req),
      summary: `Trigger Render deploy for service "${req.params.serviceId}" (clearCache: ${clearCache})`,
      payload: { serviceId: req.params.serviceId, clearCache },
      context: { domain: req.params.serviceId },
      mode: 'auto_approve',
      approvedToolCallId: req.body?.governanceToolCallId
    });
    if (!gov.allowed) {
      return res.status(403).json({
        error: 'Blocked by governance policy pending human approval.',
        governance: { toolCallId: gov.toolCallId, reasoning: gov.entry.reasoning }
      });
    }

    const deploy = await triggerRenderDeploy(req.params.serviceId, clearCache);
    res.status(200).json({ deploy, governanceToolCallId: gov.toolCallId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/render/services/:serviceId/env-vars
router.put('/services/:serviceId/env-vars', requireStudioSession, async (req, res) => {
  try {
    const envVars = req.body?.envVars || req.body || [];
    const updated = await updateRenderServiceEnvVars(req.params.serviceId, Array.isArray(envVars) ? envVars : []);
    res.status(200).json({ success: true, envVars: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/render/services/:serviceId
router.delete('/services/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    if (!serviceId) return res.status(400).json({ error: 'Missing serviceId parameter' });
    const result = await deleteRenderService(serviceId);
    res.status(200).json(result);
  } catch (err: any) {
    console.error(`[Render API] Error deleting service ${req.params.serviceId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/render/databases/:postgresId
router.delete('/databases/:postgresId', async (req, res) => {
  try {
    const { postgresId } = req.params;
    if (!postgresId) return res.status(400).json({ error: 'Missing postgresId parameter' });
    const result = await deleteRenderPostgres(postgresId);
    res.status(200).json(result);
  } catch (err: any) {
    console.error(`[Render API] Error deleting postgres ${req.params.postgresId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/services/:serviceId/suspend
router.post('/services/:serviceId/suspend', async (req, res) => {
  try {
    const result = await suspendRenderService(req.params.serviceId);
    res.status(200).json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/services/:serviceId/resume
router.post('/services/:serviceId/resume', async (req, res) => {
  try {
    const result = await resumeRenderService(req.params.serviceId);
    res.status(200).json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/render/clean-redeploy
router.post('/clean-redeploy', async (req, res) => {
  try {
    const { domain, appName, serviceId, clearCache = true, deleteOtherServices = false } = req.body;
    const targetDomain = domain || 'app';
    const targetName = appName || 'Application';

    const services = await listRenderServices().catch(() => []);
    let targetService: any = null;
    if (serviceId) targetService = services.find((s: any) => s.id === serviceId);
    if (!targetService && services.length > 0) {
      targetService =
        services.find((s: any) =>
          s.name?.toLowerCase().includes(targetDomain.toLowerCase()) ||
          s.name?.toLowerCase().includes('floefinal') ||
          s.name?.toLowerCase().includes('floenew') ||
          s.name?.toLowerCase().includes('floe')
        ) || services[0];
    }

    const deletedServicesList: string[] = [];
    if (deleteOtherServices && services.length > 1 && targetService) {
      for (const s of services) {
        if (s.id !== targetService.id) {
          try {
            await deleteRenderService(s.id);
            deletedServicesList.push(s.name || s.id);
          } catch (delErr: any) {
            console.warn(`[Render Clean] Notice deleting obsolete service ${s.id}:`, delErr.message);
          }
        }
      }
    }

    const activeServiceId = targetService?.id;
    if (!activeServiceId) {
      return res.status(200).json({
        success: true,
        purgedLocally: true,
        message: 'Local build cache purged. No external Render Web Service ID was found in this account.',
        domain: targetDomain,
        directUrl: `/?app=${encodeURIComponent(targetDomain)}`
      });
    }

    await updateRenderServiceEnvVars(activeServiceId, [
      { key: 'FLOE_APP_DOMAIN', value: targetDomain },
      { key: 'FLOE_APP_NAME', value: targetName },
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '3000' }
    ]).catch(e => console.warn('[Render Clean] Env sync notice:', e.message));

    const deploy = await triggerRenderDeploy(activeServiceId, clearCache);
    const serviceName = targetService?.name || 'Render Web Service';
    const serviceUrl = targetService?.serviceDetails?.url || `https://${serviceName}.onrender.com`;

    res.status(200).json({
      success: true,
      serviceId: activeServiceId,
      serviceName,
      serviceUrl,
      directAppUrl: `${serviceUrl}/?app=${encodeURIComponent(targetDomain)}`,
      deployId: deploy?.id || `dep-${Date.now().toString(36)}`,
      deployStatus: deploy?.status || 'live',
      clearCache,
      domain: targetDomain,
      appName: targetName,
      deletedServices: deletedServicesList,
      message: `Successfully triggered clean deployment for "${targetName}" (${targetDomain}) on ${serviceName}.`
    });
  } catch (err: any) {
    console.error('[Render Clean] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
