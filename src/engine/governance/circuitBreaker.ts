// ============================================================================
// FLOE GOVERNANCE — Circuit Breaker
// ----------------------------------------------------------------------------
// In auto-approve mode, the reviewer model is allowed to let routine actions
// through. If a given actor racks up repeated denials/escalations that are
// then rejected by a human, that is a signal the reviewer is miscalibrated
// (or the actor/agent is behaving unexpectedly). The circuit breaker trips,
// forcing ALL subsequent actions for that actor to escalate to a human,
// regardless of what the reviewer model would otherwise say, until a human
// explicitly resets it.
// ============================================================================

import { CircuitBreakerState } from '../../types/governance';

const DEFAULT_TRIP_THRESHOLD = 3;

export class CircuitBreaker {
  private states = new Map<string, CircuitBreakerState>();
  private tripThreshold: number;

  constructor(tripThreshold: number = DEFAULT_TRIP_THRESHOLD) {
    this.tripThreshold = tripThreshold;
  }

  private getOrCreate(actorId: string): CircuitBreakerState {
    let state = this.states.get(actorId);
    if (!state) {
      state = { actorId, consecutiveDenials: 0, tripped: false };
      this.states.set(actorId, state);
    }
    return state;
  }

  isTripped(actorId: string): boolean {
    return this.getOrCreate(actorId).tripped;
  }

  getState(actorId: string): CircuitBreakerState {
    return { ...this.getOrCreate(actorId) };
  }

  listAll(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /** Record a human denial for this actor. Trips the breaker once threshold is reached. */
  recordDenial(actorId: string): CircuitBreakerState {
    const state = this.getOrCreate(actorId);
    state.consecutiveDenials += 1;
    if (state.consecutiveDenials >= this.tripThreshold && !state.tripped) {
      state.tripped = true;
      state.trippedAt = new Date().toISOString();
    }
    return { ...state };
  }

  /** Record a human approval — resets the denial streak (but not a trip; that needs an explicit reset). */
  recordApproval(actorId: string): CircuitBreakerState {
    const state = this.getOrCreate(actorId);
    state.consecutiveDenials = 0;
    return { ...state };
  }

  /** Explicit human reset. Required to resume normal reviewer operation after a trip. */
  reset(actorId: string, resetBy: string): CircuitBreakerState {
    const state = this.getOrCreate(actorId);
    state.tripped = false;
    state.consecutiveDenials = 0;
    state.resetBy = resetBy;
    state.resetAt = new Date().toISOString();
    return { ...state };
  }
}
