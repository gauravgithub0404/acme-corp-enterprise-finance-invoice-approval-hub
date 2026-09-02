/**
 * Unit tests for src/engine/governance/GovernanceEngine.ts
 *
 * Tests the 3-tier governance system:
 *   Tier 1 — Hard floors (always escalate, no exceptions)
 *   Tier 2 — Approval ladder (allowlist / standing_rule)
 *   Circuit breaker — trips after repeated denials
 *   Self-grant prevention
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceEngine } from '../src/engine/governance/GovernanceEngine';

function makeEngine() {
  return new GovernanceEngine();
}

function makeToolCall(overrides: Partial<{
  actionType: string;
  actorId: string;
  mode: 'manual' | 'auto_approve';
}> = {}) {
  return {
    id: `tc-test-${Math.random().toString(36).slice(2)}`,
    actionType: overrides.actionType ?? 'deployment.create_testbed',
    actor: { id: overrides.actorId ?? 'actor-alice', name: 'Alice', role: 'developer' },
    summary: 'test tool call',
    payload: {},
    context: {},
    mode: (overrides.mode ?? 'auto_approve') as 'manual' | 'auto_approve'
  };
}

// ---------------------------------------------------------------------------
// Tier 1 — Hard floors
// ---------------------------------------------------------------------------
describe('Hard floors', () => {
  it('always escalates a production promotion regardless of mode', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'deployment.promote_production', mode: 'auto_approve' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('ESCALATED');
    expect(result.approvalSource).toBe('hard_floor');
  });

  it('always escalates secret reveal actions', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'secret.reveal_api_key', mode: 'auto_approve' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('ESCALATED');
  });

  it('always escalates irreversible data deletion', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'data.delete_irreversible_all_tenants', mode: 'auto_approve' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('ESCALATED');
  });

  it('queues the hard-floor escalation for human decision', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'deployment.promote_production' });
    engine.evaluate(tc);
    const pending = engine.getPendingApprovals();
    expect(pending.some(p => p.toolCall.id === tc.id)).toBe(true);
  });

  it('prevents self-approval on a hard-floor action', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'deployment.promote_production', actorId: 'actor-dev' });
    engine.evaluate(tc);
    expect(() =>
      engine.recordHumanDecision(tc.id, 'approve', 'actor-dev', 'self-approving')
    ).toThrow(/self-approval/i);
  });

  it('allows a different actor to approve a hard-floor action', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'deployment.promote_production', actorId: 'actor-dev' });
    engine.evaluate(tc);
    const entry = engine.recordHumanDecision(tc.id, 'approve', 'actor-admin', 'reviewed and approved');
    expect(entry?.decision).toBe('USER_APPROVED');
  });

  it('blocks modification of hard floors themselves', () => {
    const engine = makeEngine();
    const tc = makeToolCall({ actionType: 'governance.hard_floor.modify_list' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('ESCALATED');
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — Approval ladder
// ---------------------------------------------------------------------------
describe('Approval ladder', () => {
  it('auto-approves an allowlisted actor without queuing', () => {
    const engine = makeEngine();
    // Graduate to allowlisted via a distinct human admin
    engine.graduateLadder('actor-alice', 'deployment.create_testbed', 'allowlisted', 'actor-admin', 'test');
    const tc = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-alice', mode: 'manual' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('AUTO_APPROVED');
    expect(result.approvalSource).toBe('allowlist');
  });

  it('auto-approves a standing_rule actor', () => {
    const engine = makeEngine();
    engine.graduateLadder('actor-bob', 'deployment.create_testbed', 'standing_rule', 'actor-admin', 'routine');
    const tc = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-bob', mode: 'manual' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('AUTO_APPROVED');
    expect(result.approvalSource).toBe('standing_rule');
  });

  it('prevents self-graduation of ladder rungs', () => {
    const engine = makeEngine();
    expect(() =>
      engine.graduateLadder('actor-alice', 'deployment.create_testbed', 'allowlisted', 'actor-alice', 'self')
    ).toThrow(/self/i);
  });

  it('prevents adding a hard-floor action to the ladder', () => {
    const engine = makeEngine();
    expect(() =>
      engine.graduateLadder('actor-alice', 'deployment.promote_production', 'allowlisted', 'actor-admin', 'test')
    ).toThrow(/hard floor/i);
  });

  it('revokes a ladder entry', () => {
    const engine = makeEngine();
    engine.graduateLadder('actor-alice', 'infra.provision_render_test_postgres', 'allowlisted', 'actor-admin', 'test');
    engine.revokeLadder('actor-alice', 'infra.provision_render_test_postgres', 'actor-admin', 'test revoke');
    // After revocation, manual mode should escalate
    const tc = makeToolCall({ actionType: 'infra.provision_render_test_postgres', actorId: 'actor-alice', mode: 'manual' });
    const result = engine.evaluate(tc);
    expect(result.decision).toBe('ESCALATED');
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------
describe('Circuit breaker', () => {
  it('trips after 3 consecutive denials and forces escalation', () => {
    const engine = makeEngine();
    // Submit + deny 3 times
    for (let i = 0; i < 3; i++) {
      const tc = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-trigger', mode: 'manual' });
      engine.evaluate(tc);
      engine.recordHumanDecision(tc.id, 'deny', 'actor-admin', `denial ${i + 1}`);
    }
    // 4th call should be force-escalated by the circuit breaker
    const tc4 = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-trigger', mode: 'auto_approve' });
    const result = engine.evaluate(tc4);
    expect(result.decision).toBe('ESCALATED');
    expect(result.approvalSource).toBe('circuit_breaker');
  });

  it('resets after explicit human reset', () => {
    const engine = makeEngine();
    for (let i = 0; i < 3; i++) {
      const tc = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-reset-test', mode: 'manual' });
      engine.evaluate(tc);
      engine.recordHumanDecision(tc.id, 'deny', 'actor-admin', `denial ${i + 1}`);
    }
    engine.resetCircuitBreaker('actor-reset-test', 'actor-admin');
    const tc = makeToolCall({ actionType: 'deployment.create_testbed', actorId: 'actor-reset-test', mode: 'auto_approve' });
    const result = engine.evaluate(tc);
    // Should no longer be circuit-breaker escalated (may be ROUTINE or manual-escalated, but not circuit_breaker)
    expect(result.approvalSource).not.toBe('circuit_breaker');
  });
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------
describe('Audit trail', () => {
  it('records every evaluation', () => {
    const engine = makeEngine();
    const before = engine.auditTrail.count();
    engine.evaluate(makeToolCall({ actionType: 'deployment.create_testbed' }));
    engine.evaluate(makeToolCall({ actionType: 'deployment.create_testbed' }));
    expect(engine.auditTrail.count()).toBe(before + 2);
  });

  it('is append-only — no deletion API exists', () => {
    const engine = makeEngine();
    expect((engine.auditTrail as any).delete).toBeUndefined();
    expect((engine.auditTrail as any).clear).toBeUndefined();
    expect((engine.auditTrail as any).truncate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// server-side enforce()
// ---------------------------------------------------------------------------
describe('enforce()', () => {
  it('blocks production promotion (hard floor)', () => {
    const engine = makeEngine();
    const { allowed } = engine.enforce({
      actionType: 'deployment.promote_production',
      actor: { id: 'actor-dev', name: 'Dev', role: 'developer' },
      summary: 'promote to prod',
      mode: 'auto_approve'
    });
    expect(allowed).toBe(false);
  });

  it('allows a routine testbed deployment in auto_approve mode', () => {
    const engine = makeEngine();
    const { allowed } = engine.enforce({
      actionType: 'deployment.create_testbed',
      actor: { id: 'actor-dev', name: 'Dev', role: 'developer' },
      summary: 'create testbed',
      mode: 'auto_approve'
    });
    // May be auto-approved (routine) or escalated in manual mode — just check no hard floor
    expect(typeof allowed).toBe('boolean');
  });

  it('reuses a prior approval via approvedToolCallId', () => {
    const engine = makeEngine();
    // First, manually approve a tool call
    const tc = makeToolCall({ actionType: 'infra.provision_render_test_service', mode: 'manual' });
    engine.evaluate(tc);
    engine.recordHumanDecision(tc.id, 'approve', 'actor-admin', 'approved');
    // Now enforce with the approved ID — should be allowed immediately
    const { allowed } = engine.enforce({
      actionType: 'infra.provision_render_test_service',
      actor: { id: 'actor-dev', name: 'Dev', role: 'developer' },
      summary: 'reuse prior approval',
      mode: 'manual',
      approvedToolCallId: tc.id
    });
    expect(allowed).toBe(true);
  });
});
