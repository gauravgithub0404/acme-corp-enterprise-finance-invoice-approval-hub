/**
 * Floe Studio — cryptographic session token utilities.
 *
 * Shared by server.ts and all Express routers so the sign/verify/guard
 * logic lives in exactly one place.
 */
import crypto from 'crypto';
import express from 'express';

// ---------------------------------------------------------------------------
// Production Hard Floor: SESSION_SECRET is mandatory in production mode.
// In development an ephemeral secret is generated at boot with a loud warning.
// ---------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('[FATAL] SESSION_SECRET is required in production mode. Set SESSION_SECRET to a secure random 32+ byte string.');
  process.exit(1);
}

export const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn(
    '[Floe Studio] SESSION_SECRET is not set; using an ephemeral secret generated at process boot. ' +
    'All Studio session tokens will be invalidated on restart. Set SESSION_SECRET in .env for persistent sessions.'
  );
}

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface StudioSessionPayload {
  id: string;
  name: string;
  role: string;
  organization?: string;
  iat: number;
  exp: number;
}

export function signStudioSession(payload: StudioSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyStudioSession(token: string): StudioSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload: StudioSessionPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Route guard — attaches verified session to req.studioActor. */
export function requireStudioSession(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const session = verifyStudioSession(token);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized: a valid Floe Studio session is required for this action. Log in and retry.'
    });
    return;
  }
  (req as any).studioActor = session;
  next();
}

/**
 * Extract a governance actor for audit-trail attribution.
 * Prefers the cryptographically verified session identity over any
 * self-attested body value.
 */
export function deriveActor(req: express.Request): { id: string; name: string; role: string } {
  const verified = (req as any).studioActor as StudioSessionPayload | undefined;
  if (verified) {
    return { id: verified.id, name: verified.name, role: verified.role };
  }
  const actor = req.body?.actor || {};
  return {
    id: actor.id || 'unauthenticated-caller',
    name: actor.name || actor.id || 'Unauthenticated Caller',
    role: actor.role || 'unknown'
  };
}
