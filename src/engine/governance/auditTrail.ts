// ============================================================================
// FLOE GOVERNANCE — Audit Trail
// ----------------------------------------------------------------------------
// Every evaluated tool call produces exactly one immutable audit entry,
// answering "who did this, and why?": actor, action, decision, approval
// provenance (auto-approved / user-approved / denied / escalated), and the
// reviewer's reasoning where applicable.
//
// This in-memory store is the runtime source of truth and is mirrored to
// Postgres by src/server/db.ts (see saveGovernanceAuditEntry). There is no
// deletion API by design — see hardFloors.ts 'floor.audit_trail_modify'.
// ============================================================================

import { GovernanceAuditEntry } from '../../types/governance';

export class AuditTrail {
  private entries: GovernanceAuditEntry[] = [];
  private onPersist?: (entry: GovernanceAuditEntry) => void;

  /** Register a sink (e.g. a DB writer) invoked every time an entry is appended. */
  setPersistHandler(handler: (entry: GovernanceAuditEntry) => void) {
    this.onPersist = handler;
  }

  append(entry: GovernanceAuditEntry): void {
    this.entries.push(entry);
    if (this.onPersist) {
      try {
        this.onPersist(entry);
      } catch (err) {
        // Persistence failures must never silently drop the in-memory record,
        // nor block the governance decision path.
        console.error('[Governance][AuditTrail] persist handler failed:', (err as Error).message);
      }
    }
  }

  list(filter?: { actorId?: string; decision?: string; appId?: string; limit?: number }): GovernanceAuditEntry[] {
    let out = this.entries;
    if (filter?.actorId) out = out.filter(e => e.toolCall.actor.id === filter.actorId);
    if (filter?.decision) out = out.filter(e => e.decision === filter.decision);
    if (filter?.appId) out = out.filter(e => e.toolCall.context?.appId === filter.appId);
    out = out.slice().reverse(); // most recent first
    return filter?.limit ? out.slice(0, filter.limit) : out;
  }

  /**
   * Returns the most recent audit entry for a given tool-call id (a tool call
   * may have more than one entry: the initial evaluation, then a later
   * `recordHumanDecision` entry once a human acts on it). Used by API routes
   * that must verify server-side whether a specific tool call was actually
   * approved before letting the real underlying action execute -- so
   * approval can never be satisfied by a client simply claiming it happened.
   */
  latestEntryForToolCall(toolCallId: string): GovernanceAuditEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].toolCall.id === toolCallId) return this.entries[i];
    }
    return undefined;
  }

  count(): number {
    return this.entries.length;
  }
}
