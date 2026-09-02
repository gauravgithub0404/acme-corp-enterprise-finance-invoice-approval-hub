import crypto from 'crypto';
import { Router } from 'express';
import { savePipelineRunToDb, getPipelineRunsFromDb } from '../db';

// Shared in-process store — exported so deployments router can seed it if needed
export const pipelineRunsStore = new Map<string, any>();

const router = Router();

const DEFAULT_POLICY_CONFIG = {
  blockOnCritical: true,
  blockOnHigh: true,
  blockOnMedium: false,
  allowWarnOnLow: true,
  requireSbom: true,
  requireZeroSecrets: true,
  requireMinTestCoveragePct: 80,
  requireDastClean: true,
  policyVersion: '2026.1'
};

// POST /api/pipeline/run
router.post('/run', async (req, res) => {
  try {
    const { appId, appName, domain, ir, policyConfig } = req.body;
    if (!ir) return res.status(400).json({ error: 'Missing intermediate representation (ir)' });

    const pipelineId = `pipe-${(ir.app_id || domain || 'app')}-${Date.now().toString(36)}`;
    const commitSha = `git-${crypto.createHash('sha256').update(JSON.stringify(ir) + Date.now()).digest('hex').substring(0, 8)}`;

    const initialRun = {
      id: pipelineId,
      appId: ir.app_id || appId || 'app-default',
      appName: ir.name || appName || 'Business Application',
      domain: ir.domain || domain || 'enterprise',
      irVersion: ir.ir_version || '1.0.0',
      commitSha,
      status: 'running',
      currentStageId: 'stage_1_spec',
      policyConfig: policyConfig || DEFAULT_POLICY_CONFIG,
      stages: {},
      evidenceStore: {},
      artifact: {
        imageDigest: undefined,
        imageTag: `${ir.domain || 'app'}:v${ir.ir_version || '1.0.0'}`,
        registryUrl: `registry.floe.internal/apps/${ir.domain || 'app'}`,
        sbomDigest: undefined,
        promotedToProduction: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    pipelineRunsStore.set(pipelineId, initialRun);
    // Issue 8: await persistence so in-flight state is not silently lost on DB lag
    await savePipelineRunToDb(initialRun);

    res.status(202).json({ pipelineId, status: 'running', message: 'Floe 10-stage evaluation and delivery pipeline initialized' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/list
router.get('/list', async (req, res) => {
  const dbRuns = await getPipelineRunsFromDb();
  if (dbRuns.length > 0) return res.status(200).json({ runs: dbRuns, count: dbRuns.length });
  const list = Array.from(pipelineRunsStore.values());
  res.status(200).json({ runs: list, count: list.length });
});

// GET /api/pipeline/:id
router.get('/:id', async (req, res) => {
  let run = pipelineRunsStore.get(req.params.id);
  if (!run) {
    const dbRuns = await getPipelineRunsFromDb();
    run = dbRuns.find(r => r.id === req.params.id);
  }
  if (!run) return res.status(404).json({ error: `Pipeline run ${req.params.id} not found` });
  res.status(200).json(run);
});

// PUT /api/pipeline/:id
router.put('/:id', async (req, res) => {
  const existing = pipelineRunsStore.get(req.params.id) || {};
  const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  pipelineRunsStore.set(req.params.id, updated);
  await savePipelineRunToDb(updated);
  res.status(200).json(updated);
});

export default router;
