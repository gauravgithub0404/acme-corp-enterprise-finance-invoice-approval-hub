// ============================================================================
// FLOE GOVERNANCE — Reviewer Model
// ----------------------------------------------------------------------------
// Only consulted in auto-approve mode, and only for actions that have ALREADY
// cleared the hard-floor check (Tier 1 always wins regardless of what this
// model says). Classifies a tool call as routine / uncertain / suspicious.
// Routine actions are auto-approved; anything else escalates to a human.
//
// This is a deliberately simple, deterministic, auditable heuristic engine —
// not an opaque black box. Every verdict carries its reasoning so the audit
// trail can show *why* a call was let through. It is explicitly a judgment,
// not a guarantee: the hard floors and the audit trail are the backstop.
// ============================================================================

import { ReviewerVerdict, ToolCallRequest } from '../../types/governance';

/** Action-type prefixes considered inherently routine when nothing else flags them. */
const ROUTINE_PREFIXES = [
  'requirements.',
  'docs.generate',
  'codegen.',
  'test.run',
  'sandbox.',
  'read.',
  'ir.validate',
  // Free, reversible, in-process/local testbed deployments carry no real
  // infra cost or blast radius -- unlike 'deployment.promote_production*'
  // (a hard floor) or 'deployment.redeploy_production'/'infra.provision_*'
  // (real cloud resources), which are deliberately NOT listed here and so
  // default to escalation until a human graduates a specific actor.
  'deployment.create_testbed',
  // Free-tier Render test-environment provisioning (see server.ts). This is
  // routine by policy today, but because it is now routed through the
  // governance engine (rather than bypassing it entirely, as before), a
  // hard floor or ladder revocation added later would immediately start
  // enforcing without any further code changes here.
  'infra.provision_render_test_postgres',
  'infra.provision_render_test_service'
];

/** Signals in a payload/summary that should force escalation even for an otherwise-routine action type. */
const RISK_KEYWORDS = [
  'production', 'prod', 'delete', 'drop table', 'truncate', 'revoke', 'rotate',
  'grant', 'elevate', 'bypass', 'disable policy', 'ignore governance', 'override gate'
];

export class ReviewerModel {
  /**
   * Evaluate a tool call already known NOT to touch a hard floor.
   * Never returns an approval for anything matching a risk keyword — those
   * always escalate, keeping the reviewer's blast radius limited to genuinely
   * routine, low-stakes actions.
   */
  evaluate(toolCall: ToolCallRequest): ReviewerVerdict {
    const haystack = `${toolCall.actionType} ${toolCall.summary} ${JSON.stringify(toolCall.payload ?? {})}`.toLowerCase();

    const matchedRisk = RISK_KEYWORDS.find(k => haystack.includes(k));
    if (matchedRisk) {
      return {
        verdict: 'SUSPICIOUS',
        reasoning: `Action or payload contains risk keyword "${matchedRisk}"; escalating regardless of action-type classification.`,
        confidence: 0.95
      };
    }

    const isRoutinePrefix = ROUTINE_PREFIXES.some(p => toolCall.actionType.startsWith(p));
    if (isRoutinePrefix) {
      return {
        verdict: 'ROUTINE',
        reasoning: `Action type "${toolCall.actionType}" matches known low-risk category and no risk keywords were found in the payload.`,
        confidence: 0.85
      };
    }

    return {
      verdict: 'UNCERTAIN',
      reasoning: `Action type "${toolCall.actionType}" is not in the recognized routine set; deferring to a human reviewer rather than guessing.`,
      confidence: 0.4
    };
  }
}
