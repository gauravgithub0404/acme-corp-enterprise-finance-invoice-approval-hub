// ============================================================================
// FLOE STUDIO SESSION HELPER (client side)
// ----------------------------------------------------------------------------
// Floe Studio's login screens are demo-grade (no real password verification
// against a stored hash) -- that is a separate, tracked limitation. What
// this module does is mint and carry a server-signed session token once a
// client presents itself as a given persona, so subsequent sensitive/
// administrative requests (governance decisions, real cloud infrastructure
// provisioning, production promotion) can be verified server-side instead
// of trusting a self-attested JSON body on every call. See server.ts
// `requireStudioSession` / `signStudioSession` / `verifyStudioSession`.
// ============================================================================

const SESSION_TOKEN_KEY = 'floe_studio_session_token';

export interface StudioSessionActor {
  id: string;
  name: string;
  role?: string;
  organization?: string;
}

export interface AuthLoginResponse {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}

/** Authenticate with email & password against server's salted cryptographic hash store. */
export async function loginWithCredentials(email: string, password: string): Promise<AuthLoginResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
      } catch {
        // ignore storage errors
      }
      return { success: true, token: data.token, user: data.user };
    }
    return { success: false, error: data.error || 'Authentication failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during login' };
  }
}

/** Register new user with password hashing on the server. */
export async function registerWithCredentials(params: {
  email: string;
  password: string;
  name: string;
  role?: string;
  roleTitle?: string;
  organization?: string;
}): Promise<AuthLoginResponse> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (res.ok && data.token) {
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
      } catch {
        // ignore storage errors
      }
      return { success: true, token: data.token, user: data.user };
    }
    return { success: false, error: data.error || 'Registration failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during registration' };
  }
}

/** Request a signed session token from the server for the given actor identity. */
export async function mintStudioSession(actor: StudioSessionActor): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actor)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
      } catch {
        // ignore storage errors (e.g. private browsing)
      }
      return data.token as string;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStudioSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearStudioSession(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Standard fetch headers for a sensitive/administrative request: JSON + bearer token (if any). */
export function studioAuthHeaders(): Record<string, string> {
  const token = getStudioSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}
