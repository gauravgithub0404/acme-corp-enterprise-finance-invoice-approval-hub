// ============================================================================
// FLOE GOVERNANCE ENGINE — Composition Root (Tiers 1 + 2 + 3)
// ----------------------------------------------------------------------------
// This is the ONLY entry point application code should call to gate a tool
// call. It composes, in strict order:
//
//   1. Hard floor check      — unconditional, mode-independent, wins always.
//   2. Circuit breaker check — if tripped for this actor, force escalation.
//   3. Ladder check           — allowlisted / standing_rule short-circuits to
//                               auto-approval (still logged) for non-floor
//                               actions.
//   4. Mode branch:
//        manual        -> always requires an explicit human decision.
//        auto_approve  -> reviewer model classifies; ROUTINE auto-approves,
//                          anything else escalates.
//   5. Audit trail        — every path above ends by writing exactly one
//                            audit entry with full provenance.
//
// No step here reads mutable state that a tool call itself could have just
// written (e.g. a hard floor cannot be disabled by a payload flag), and no
// self-grant is possible: `recordHumanDecision` and ladder graduations
// require a `decidedBy` human actor id which the caller must supply from an
// authenticated session — the engine does not infer it from the tool call.
// ============================================================================

import {
  ApprovalSource,
  CircuitBreakerState,
  GovernanceAuditEntry,
  GovernanceDecision,
  GovernanceEvaluationResult,
  GovernanceMode,
  LadderEntry,
  LadderRung,
  PendingApproval,
  ToolCallRequest
} from '../../types/governance';
import { checkHardFloor, listHardFloors } from './hardFloors';
import { ApprovalLadder } from './approvalLadder';
import { CircuitBreaker } from './circuitBreaker';
import { ReviewerModel } from './reviewerModel';
import { AuditTrail } from './auditTrail';

let entryCounter = 0;
function nextId(prefix: string): string {
  entryCounter += 1;
  return `${prefix}-${Date.now()}-${entryCounter}`;
}

export class GovernanceEngine {
  readonly ladder = new ApprovalLadder();
  readonly circuitBreaker = new CircuitBreaker();
  readonly auditTrail = new AuditTrail();
  private reviewer = new ReviewerModel();
  private pending = new Map<string, PendingApproval>();

  /**
   * Evaluate a tool call. Returns immediately with a decision; when
   * `requiresHumanDecision` is true, the call is queued (see `getPendingApprovals`)
   * and the caller must present it to a human and later invoke
   * `recordHumanDecision`.
   */
  evaluate(toolCall: ToolCallRequest): GovernanceEvaluationResult {
    // ---- Tier 1: Hard floors — checked first, always, no exceptions. ----
    const floor = checkHardFloor(toolCall.actionType);
    if (floor) {
      // queueForHuman=true is required here: without it, this action would
      // report ESCALATED but never actually be queryable via
      // getPendingApprovals()/recordHumanDecision(), so a human could never
      // approve or deny it and the "awaiting human" UI would 404 forever.
      return this.finalize(toolCall, 'ESCALATED', 'hard_floor',
        `Hard floor "${floor.id}" (${floor.description}) — human decision required regardless of mode.`,
        undefined, true);
    }

    // ---- Circuit breaker — trumps ladder + reviewer if tripped. ----
    if (this.circuitBreaker.isTripped(toolCall.actor.id)) {
      return this.finalize(toolCall, 'ESCALATED', 'circuit_breaker',
        `Circuit breaker is tripped for actor "${toolCall.actor.id}" after repeated denials; reviewer paused, escalating to human.`,
        undefined, true);
    }

    // ---- Tier 2, top of ladder: allowlist / standing rule. ----
    const rung = this.ladder.getRung(toolCall.actor.id, toolCall.actionType);
    if (rung === 'allowlisted') {
      return this.finalize(toolCall, 'AUTO_APPROVED', 'allowlist',
        `Actor "${toolCall.actor.id}" is allowlisted for "${toolCall.actionType}" (config-level, standing, revocable grant).`);
    }
    if (rung === 'standing_rule') {
      return this.finalize(toolCall, 'AUTO_APPROVED', 'standing_rule',
        `Actor "${toolCall.actor.id}" has a standing rule for "${toolCall.actionType}" graduated from a prior one-off approval.`);
    }

    // ---- Manual mode: always requires an explicit human decision. ----
    if (toolCall.mode === 'manual') {
      return this.finalize(toolCall, 'ESCALATED', 'one_off_approval',
        'Manual mode: action is approval-gated by default and has not yet earned a standing rule or allowlist entry.',
        undefined, true);
    }

    // ---- Auto-approve mode: reviewer model classifies. ----
    const verdict = this.reviewer.evaluate(toolCall);
    if (verdict.verdict === 'ROUTINE') {
      return this.finalize(toolCall, 'AUTO_APPROVED', 'reviewer_model',
        `Reviewer model classified this as routine: ${verdict.reasoning}`, verdict);
    }

    return this.finalize(toolCall, 'ESCALATED', 'reviewer_model',
      `Reviewer model could not confidently approve (${verdict.verdict}): ${verdict.reasoning}`, verdict, true);
  }

  /**
   * Server-side enforcement entry point for real, mutating endpoints (e.g.
   * actually provisioning cloud infrastructure or promoting to production).
   * Unlike `evaluate()` (which a client can call "politely" but is not
   * obligated to), this is meant to be invoked BY the route handler that
   * performs the dangerous action itself, so the gate cannot be bypassed by
   * a direct API call that skips the UI.
   *
   * If `approvedToolCallId` is supplied, it must reference a tool call that
   * was already evaluated for this exact `actionType` and resulted in
   * AUTO_APPROVED or USER_APPROVED -- letting a caller redeem an approval a
   * human already granted via the normal evaluate/decide flow, without
   * asking for a second redundant approval. Any other reference (wrong,
   * unapproved, or for a different action type) is ignored and a fresh
   * evaluation runs instead -- it is never silently trusted.
   */
  enforce(input: {
    actionType: string;
    actor: ToolCallRequest['actor'];
    summary: string;
    payload?: Record<string, unknown>;
    context?: ToolCallRequest['context'];
    mode: GovernanceMode;
    approvedToolCallId?: string;
  }): { allowed: boolean; toolCallId: string; entry: GovernanceAuditEntry } {
    if (input.approvedToolCallId) {
      const priorEntry = this.auditTrail.latestEntryForToolCall(input.approvedToolCallId);
      const isApproved = priorEntry && (priorEntry.decision === 'AUTO_APPROVED' || priorEntry.decision === 'USER_APPROVED');
      if (priorEntry && isApproved && priorEntry.toolCall.actionType === input.actionType) {
        return { allowed: true, toolCallId: input.approvedToolCallId, entry: priorEntry };
      }
      // Reference missing, denied, still-pending, or for a different action
      // type -- fall through to a fresh evaluation rather than trusting it.
    }

    const toolCall: ToolCallRequest = {
      id: nextId('tc'),
      actionType: input.actionType,
      actor: input.actor,
      summary: input.summary,
      payload: input.payload || {},
      context: input.context || {},
      mode: input.mode
    };
    const result = this.evaluate(toolCall);
    return {
      allowed: result.decision === 'AUTO_APPROVED' || result.decision === 'USER_APPROVED',
      toolCallId: toolCall.id,
      entry: result.auditEntry
    };
  }

  /** List tool calls currently awaiting an explicit human decision. */
  getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pending.values());
  }

  /**
   * Record a human's decision on a previously escalated tool call.
   * `decidedBy` MUST be the id of an authenticated human actor distinct from
   * the tool call's own actor whenever the escalation stems from a hard
   * floor — this is enforced here, not merely documented, so a requester can
   * never approve their own irreversible action under any mode.
   */
  recordHumanDecision(toolCallId: string, decision: 'approve' | 'deny', decidedBy: string, reasoning: string): GovernanceAuditEntry | undefined {
    const pending = this.pending.get(toolCallId);
    if (!pending) return undefined;

    const isHardFloor = !!checkHardFloor(pending.toolCall.actionType);
    if (isHardFloor && decidedBy === pending.toolCall.actor.id) {
      throw new Error(
        `Governance violation: "${pending.toolCall.actionType}" is a hard floor and requires a human decision from ` +
        `someone other than the requesting actor ("${pending.toolCall.actor.id}"). Self-approval is not permitted.`
      );
    }

    this.pending.delete(toolCallId);

    const finalDecision: GovernanceDecision = decision === 'approve' ? 'USER_APPROVED' : 'DENIED';
    if (decision === 'approve') {
      this.circuitBreaker.recordApproval(pending.toolCall.actor.id);
    } else {
      this.circuitBreaker.recordDenial(pending.toolCall.actor.id);
    }
    const breakerState = this.circuitBreaker.getState(pending.toolCall.actor.id);

    const entry: GovernanceAuditEntry = {
      id: nextId('audit'),
      timestamp: new Date().toISOString(),
      toolCall: pending.toolCall,
      decision: finalDecision,
      approvalSource: decision === 'deny' ? 'user_denial' : 'one_off_approval',
      reviewerVerdict: pending.reviewerVerdict,
      reasoning,
      circuitBreakerTripped: breakerState.tripped,
      decidedBy
    };
    this.auditTrail.append(entry);
    return entry;
  }

  /**
   * Graduate an actor/action pair up the approval ladder. Refuses self-grants:
   * a human cannot graduate trust for their own actorId via this path when it
   * would touch a hard-floor-adjacent action; ordinary self one-off approvals
   * of one's own routine work are fine, but ladder graduations always require
   * `grantedBy !== actorId` to keep the "no self-granted permissions" rule real.
   */
  graduateLadder(actorId: string, actionType: string, toRung: LadderRung, grantedBy: string, reason?: string): LadderEntry {
    if (grantedBy === actorId) {
      throw new Error('Governance violation: an actor cannot graduate its own ladder rung. A distinct human approver is required.');
    }
    if (checkHardFloor(actionType)) {
      throw new Error(`Governance violation: "${actionType}" matches a hard floor and can never be added to the approval ladder.`);
    }
    return this.ladder.graduate(actorId, actionType, toRung, grantedBy, reason);
  }

  revokeLadder(actorId: string, actionType: string, revokedBy: string, reason?: string): LadderEntry | undefined {
    return this.ladder.revoke(actorId, actionType, revokedBy, reason);
  }

  resetCircuitBreaker(actorId: string, resetBy: string): CircuitBreakerState {
    return this.circuitBreaker.reset(actorId, resetBy);
  }

  listHardFloors() {
    return listHardFloors();
  }

  private finalize(
    toolCall: ToolCallRequest,
    decision: GovernanceDecision,
    approvalSource: ApprovalSource,
    reasoning: string,
    reviewerVerdict?: import('../../types/governance').ReviewerVerdict,
    queueForHuman: boolean = false
  ): GovernanceEvaluationResult {
    const entry: GovernanceAuditEntry = {
      id: nextId('audit'),
      timestamp: new Date().toISOString(),
      toolCall,
      decision,
      approvalSource,
      reviewerVerdict,
      reasoning,
      circuitBreakerTripped: this.circuitBreaker.isTripped(toolCall.actor.id)
    };
    this.auditTrail.append(entry);

    if (queueForHuman) {
      this.pending.set(toolCall.id, {
        toolCall,
        reason: reasoning,
        approvalSource,
        reviewerVerdict,
        createdAt: entry.timestamp
      });
    }

    return {
      decision,
      approvalSource,
      reasoning,
      reviewerVerdict,
      requiresHumanDecision: queueForHuman,
      auditEntry: entry
    };
  }
}

/** Process-wide singleton — one governance ledger per running instance. */
export const governanceEngine = new GovernanceEngine();
