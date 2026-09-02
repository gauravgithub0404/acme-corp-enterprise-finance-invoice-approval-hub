// ============================================================================
// FLOE GOVERNANCE — Hard Floors (Tier 1)
// ----------------------------------------------------------------------------
// A fixed, code-owned list of dangerous/irreversible action patterns that are
// ALWAYS human-only. This module has no configuration surface reachable from
// user input, prompts, or the reviewer model: nothing in the request payload
// can add, remove, or weaken an entry here. To change a hard floor requires
// a code change + code review, not a runtime setting.
//
// IMPORTANT: This list is intentionally NOT exported as mutable state, and is
// NOT read from any config file, database, or environment variable. That is
// the point — a compromised or over-eager agent cannot grant itself new
// permissions by editing a settings row, because there is no settings row.
// ============================================================================

export interface HardFloorRule {
  id: string;
  /** Matches ToolCallRequest.actionType. Supports trailing '*' wildcard. */
  pattern: string;
  description: string;
}

const HARD_FLOOR_RULES: readonly HardFloorRule[] = Object.freeze([
  {
    id: 'floor.production_promotion',
    pattern: 'deployment.promote_production*',
    description: 'Promoting any artifact to a live production environment.'
  },
  {
    id: 'floor.production_rollback_destructive',
    pattern: 'deployment.rollback_destructive*',
    description: 'Rolling back production in a way that discards data (not a simple redeploy).'
  },
  {
    id: 'floor.data_deletion_irreversible',
    pattern: 'data.delete_irreversible*',
    description: 'Permanently deleting records, databases, backups, or tenants with no recovery path.'
  },
  {
    id: 'floor.secret_reveal',
    pattern: 'secret.reveal*',
    description: 'Displaying, exporting, or decrypting a stored secret/credential in plaintext.'
  },
  {
    id: 'floor.secret_rotate_or_revoke',
    pattern: 'secret.rotate*',
    description: 'Rotating or revoking production credentials, API keys, or signing keys.'
  },
  {
    id: 'floor.permission_self_grant',
    pattern: 'rbac.grant_self*',
    description: 'Any action where an actor grants itself (the agent or its own account) new or elevated permissions.'
  },
  {
    id: 'floor.rbac_role_elevation',
    pattern: 'rbac.elevate_role*',
    description: 'Elevating any account to production_approver, account_owner, security_admin, or equivalent.'
  },
  {
    id: 'floor.governance_policy_weaken',
    pattern: 'governance.policy.weaken*',
    description: 'Lowering a governance/security policy threshold (e.g. disabling blockOnCritical, requireSbom).'
  },
  {
    id: 'floor.hard_floor_modify',
    pattern: 'governance.hard_floor.modify*',
    description: 'Any attempted modification of the hard-floor rule set itself.'
  },
  {
    id: 'floor.billing_or_ownership_change',
    pattern: 'account.billing*',
    description: 'Billing changes, plan changes, or transfer of account ownership.'
  },
  {
    id: 'floor.audit_trail_modify',
    pattern: 'governance.audit.delete*',
    description: 'Deleting, truncating, or rewriting audit trail entries.'
  },
  {
    id: 'floor.external_network_egress_unreviewed',
    pattern: 'network.external_egress_unreviewed*',
    description: 'Sending data to a previously unreviewed external endpoint/third party.'
  }
]);

function matchesPattern(actionType: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    return actionType.startsWith(pattern.slice(0, -1));
  }
  return actionType === pattern;
}

/**
 * Returns the first hard-floor rule matching the given action type, or null
 * if the action does not touch a hard floor. This check MUST run before any
 * ladder/reviewer-model logic, and its result cannot be overridden by mode,
 * standing rules, or allowlists.
 */
export function checkHardFloor(actionType: string): HardFloorRule | null {
  for (const rule of HARD_FLOOR_RULES) {
    if (matchesPattern(actionType, rule.pattern)) {
      return rule;
    }
  }
  return null;
}

/** Read-only view of the hard floor list, for display in the UI/audit only. */
export function listHardFloors(): readonly HardFloorRule[] {
  return HARD_FLOOR_RULES;
}
