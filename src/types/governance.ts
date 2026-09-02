// ============================================================================
// FLOE GOVERNANCE ARCHITECTURE — Types
// ----------------------------------------------------------------------------
// Governance is architecture, not a plugin. These types model the three tiers:
//   1. Hard floors        — human-only, unconditional, mode-independent.
//   2. Ladder of autonomy  — one-off approval -> standing rule -> allowlist,
//                            with a reviewer model + circuit breaker in
//                            auto-approve mode.
//   3. Audit trail          — every decision recorded with provenance.
// ============================================================================

/** Operating mode the caller was in when the tool call was evaluated. */
export type GovernanceMode = 'manual' | 'auto_approve';

/** Final disposition of a tool-call evaluation. */
export type GovernanceDecision = 'AUTO_APPROVED' | 'USER_APPROVED' | 'DENIED' | 'ESCALATED';

/** Where in the three-tier model the decision was produced. */
export type ApprovalSource =
  | 'hard_floor'          // Tier 1 — always escalates to a human, no exceptions.
  | 'circuit_breaker'     // Reviewer paused after repeated denials; forced escalation.
  | 'allowlist'           // Tier 2, top rung — config-level, standing, revocable.
  | 'standing_rule'       // Tier 2, middle rung — graduated from a one-off approval.
  | 'reviewer_model'      // Tier 2 — auto-approve mode reviewer verdict (routine action).
  | 'one_off_approval'    // Tier 2, base rung — explicit human approval for this call only.
  | 'user_denial';        // Explicit human denial.

export interface ToolCallActor {
  id: string;
  name: string;
  role: string;
}

/**
 * A single tool/action invocation submitted for governance evaluation.
 * `actionType` MUST be a stable, dotted identifier (e.g. 'deployment.promote_production')
 * so hard floors and allowlists can pattern-match reliably.
 */
export interface ToolCallRequest {
  id: string;
  actionType: string;
  actor: ToolCallActor;
  summary: string;
  payload?: Record<string, unknown>;
  context?: {
    appId?: string;
    domain?: string;
    conversationId?: string;
  };
  mode: GovernanceMode;
}

export interface ReviewerVerdict {
  verdict: 'ROUTINE' | 'UNCERTAIN' | 'SUSPICIOUS';
  reasoning: string;
  confidence: number; // 0..1 — judgment, not a guarantee.
}

/**
 * Immutable audit record. Every evaluated tool call produces exactly one of
 * these, regardless of decision. This is the backstop when reviewer verdicts
 * or ladder state are wrong.
 */
export interface GovernanceAuditEntry {
  id: string;
  timestamp: string;
  toolCall: ToolCallRequest;
  decision: GovernanceDecision;
  approvalSource: ApprovalSource;
  reviewerVerdict?: ReviewerVerdict;
  reasoning: string;
  circuitBreakerTripped?: boolean;
  decidedBy?: string; // human actor id, when a human made or confirmed the call
}

/** Ladder trust state for a given (actor, actionType) pair. */
export type LadderRung = 'none' | 'standing_rule' | 'allowlisted';

export interface LadderEntry {
  actorId: string;
  actionType: string;
  rung: LadderRung;
  grantedBy?: string;
  grantedAt?: string;
  reason?: string;
  history: Array<{ rung: LadderRung; changedBy: string; changedAt: string; reason?: string }>;
}

export interface CircuitBreakerState {
  actorId: string;
  consecutiveDenials: number;
  tripped: boolean;
  trippedAt?: string;
  resetBy?: string;
  resetAt?: string;
}

export interface PendingApproval {
  toolCall: ToolCallRequest;
  reason: string;
  approvalSource: ApprovalSource;
  reviewerVerdict?: ReviewerVerdict;
  createdAt: string;
}

export interface GovernanceEvaluationResult {
  decision: GovernanceDecision;
  approvalSource: ApprovalSource;
  reasoning: string;
  reviewerVerdict?: ReviewerVerdict;
  requiresHumanDecision: boolean;
  auditEntry: GovernanceAuditEntry;
}
