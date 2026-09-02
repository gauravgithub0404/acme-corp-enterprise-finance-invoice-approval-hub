// ============================================================================
// FLOE GOVERNANCE — Approval Ladder (Tier 2)
// ----------------------------------------------------------------------------
// Actions are approval-gated by default. Trust is earned explicitly:
//
//   none  --(human approves once)-->  (no lasting change; a one-off approval
//                                       is just a single decision, see below)
//   none  --(human graduates)-->  standing_rule  --(human graduates)-->  allowlisted
//
// Every graduation and every revocation is an explicit human action, is
// visible (kept in `history`), and is revocable. Nothing in this module lets
// an actor grant trust to itself: `grantedBy` must be a human actor id
// distinct from the actor the rung applies to, enforced at the call site in
// GovernanceEngine (an agent cannot call `graduate()` on its own behalf).
// ============================================================================

import { LadderEntry, LadderRung } from '../../types/governance';

function ladderKey(actorId: string, actionType: string): string {
  return `${actorId}::${actionType}`;
}

export class ApprovalLadder {
  private entries = new Map<string, LadderEntry>();

  getRung(actorId: string, actionType: string): LadderRung {
    return this.entries.get(ladderKey(actorId, actionType))?.rung ?? 'none';
  }

  getEntry(actorId: string, actionType: string): LadderEntry | undefined {
    return this.entries.get(ladderKey(actorId, actionType));
  }

  listAll(): LadderEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Graduate an actor/action pair up the ladder (none -> standing_rule ->
   * allowlisted). `grantedBy` must be a human decision-maker; the caller
   * (GovernanceEngine) is responsible for refusing self-grants.
   */
  graduate(actorId: string, actionType: string, toRung: LadderRung, grantedBy: string, reason?: string): LadderEntry {
    const key = ladderKey(actorId, actionType);
    const existing = this.entries.get(key);
    const now = new Date().toISOString();
    const entry: LadderEntry = existing ?? {
      actorId,
      actionType,
      rung: 'none',
      history: []
    };
    entry.history.push({ rung: toRung, changedBy: grantedBy, changedAt: now, reason });
    entry.rung = toRung;
    entry.grantedBy = grantedBy;
    entry.grantedAt = now;
    entry.reason = reason;
    this.entries.set(key, entry);
    return entry;
  }

  /** Revoke back to 'none'. Always available, always explicit, always logged. */
  revoke(actorId: string, actionType: string, revokedBy: string, reason?: string): LadderEntry | undefined {
    const key = ladderKey(actorId, actionType);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = new Date().toISOString();
    entry.history.push({ rung: 'none', changedBy: revokedBy, changedAt: now, reason });
    entry.rung = 'none';
    entry.grantedBy = revokedBy;
    entry.grantedAt = now;
    entry.reason = reason;
    return entry;
  }
}
