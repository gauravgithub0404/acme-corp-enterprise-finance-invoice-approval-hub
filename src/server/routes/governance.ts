import crypto from 'crypto';
import { Router } from 'express';
import { governanceEngine } from '../../engine/governance/GovernanceEngine';
import { saveGovernanceLadderEntryToDb, saveGovernanceCircuitBreakerToDb } from '../db';
import { requireStudioSession, deriveActor } from '../session';

const router = Router();

// GET /api/governance/hard-floors
router.get('/hard-floors', (req, res) => {
  res.status(200).json({ floors: governanceEngine.listHardFloors() });
});

// POST /api/governance/evaluate
router.post('/evaluate', (req, res) => {
  try {
    const { actionType, actor, summary, payload, context, mode } = req.body || {};
    if (!actionType || !actor?.id) {
      return res.status(400).json({ error: 'actionType and actor.id are required' });
    }
    const toolCall = {
      id: `tc_${crypto.randomBytes(6).toString('hex')}`,
      actionType,
      actor: { id: actor.id, name: actor.name || actor.id, role: actor.role || 'unknown' },
      summary: summary || actionType,
      payload: payload || {},
      context: context || {},
      mode: mode === 'auto_approve' ? 'auto_approve' : 'manual'
    };
    const result = governanceEngine.evaluate(toolCall as any);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/governance/pending
router.get('/pending', (req, res) => {
  res.status(200).json({ pending: governanceEngine.getPendingApprovals() });
});

// POST /api/governance/decisions/:toolCallId
router.post('/decisions/:toolCallId', requireStudioSession, (req, res) => {
  const { toolCallId } = req.params;
  const { decision, reasoning } = req.body || {};
  const decidedBy = (req as any).studioActor.id;
  if (decision !== 'approve' && decision !== 'deny') {
    return res.status(400).json({ error: "decision must be 'approve' or 'deny'" });
  }
  try {
    const entry = governanceEngine.recordHumanDecision(toolCallId, decision, decidedBy, reasoning || '');
    if (!entry) return res.status(404).json({ error: 'No pending approval found for that tool call id' });
    res.status(200).json({ entry });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Self-approval of a hard-floor action is not permitted.' });
  }
});

// GET /api/governance/audit
router.get('/audit', async (req, res) => {
  const { actorId, appId, limit } = req.query as Record<string, string>;
  const inMemory = governanceEngine.auditTrail.list({
    actorId: actorId || undefined,
    appId: appId || undefined,
    limit: limit ? parseInt(limit, 10) : undefined
  });
  res.status(200).json({ entries: inMemory, total: governanceEngine.auditTrail.count() });
});

// GET /api/governance/ladder
router.get('/ladder', (req, res) => {
  res.status(200).json({ entries: governanceEngine.ladder.listAll() });
});

// POST /api/governance/ladder/graduate
router.post('/ladder/graduate', requireStudioSession, (req, res) => {
  try {
    const { actorId, actionType, toRung, reason } = req.body || {};
    const grantedBy = (req as any).studioActor.id;
    if (!actorId || !actionType || !toRung) {
      return res.status(400).json({ error: 'actorId, actionType, and toRung are required' });
    }
    const entry = governanceEngine.graduateLadder(actorId, actionType, toRung, grantedBy, reason);
    saveGovernanceLadderEntryToDb(entry).catch(() => {});
    res.status(200).json({ entry });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/governance/ladder/revoke
router.post('/ladder/revoke', requireStudioSession, (req, res) => {
  const { actorId, actionType, reason } = req.body || {};
  const revokedBy = (req as any).studioActor.id;
  if (!actorId || !actionType) {
    return res.status(400).json({ error: 'actorId and actionType are required' });
  }
  const entry = governanceEngine.revokeLadder(actorId, actionType, revokedBy, reason);
  if (entry) saveGovernanceLadderEntryToDb(entry).catch(() => {});
  res.status(200).json({ entry: entry || null });
});

// GET /api/governance/circuit-breaker
router.get('/circuit-breaker', (req, res) => {
  res.status(200).json({ states: governanceEngine.circuitBreaker.listAll() });
});

// POST /api/governance/circuit-breaker/:actorId/reset
router.post('/circuit-breaker/:actorId/reset', requireStudioSession, (req, res) => {
  const { actorId } = req.params;
  const resetBy = (req as any).studioActor.id;
  const state = governanceEngine.resetCircuitBreaker(actorId, resetBy);
  saveGovernanceCircuitBreakerToDb(state).catch(() => {});
  res.status(200).json({ state });
});

export default router;
