import { Router } from 'express';
import { authenticateUser, registerUser } from '../authService';
import { validateBodyFields } from '../rateLimit';
import { signStudioSession, verifyStudioSession, SESSION_TTL_MS, StudioSessionPayload } from '../session';
import { createRateLimiter } from '../rateLimit';

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many authentication attempts. Please wait 60 seconds before trying again.'
});

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Verify email + password against the scrypt credential store.
// ---------------------------------------------------------------------------
router.post('/login', authRateLimiter, validateBodyFields(['email', 'password']), (req, res) => {
  const { email, password } = req.body;
  const authResult = authenticateUser(email, password);

  if (!authResult.success || !authResult.user) {
    return res.status(401).json({
      error: authResult.error || 'Invalid credentials. Password verification failed.',
      statusCode: 401
    });
  }

  const user = authResult.user;
  const now = Date.now();
  const payload: StudioSessionPayload = {
    id: user.id,
    name: user.name,
    role: user.role,
    organization: user.organization,
    iat: now,
    exp: now + SESSION_TTL_MS
  };

  const token = signStudioSession(payload);
  res.status(200).json({
    success: true,
    token,
    expiresAt: new Date(payload.exp).toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleTitle: user.roleTitle,
      organization: user.organization,
      permissions: user.permissions
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// Create a new user account with a cryptographic salted hash.
// Minimum password length: 12 characters (NIST 800-63B).
// ---------------------------------------------------------------------------
router.post('/register', authRateLimiter, validateBodyFields(['email', 'password', 'name']), (req, res) => {
  const { email, password, name, role, roleTitle, organization, permissions } = req.body;

  if (password.length < 12) {
    return res.status(400).json({
      error: 'Password must be at least 12 characters in length (NIST 800-63B minimum).'
    });
  }

  const created = registerUser({ email, password, name, role, roleTitle, organization, permissions });

  const now = Date.now();
  const payload: StudioSessionPayload = {
    id: created.id,
    name: created.name,
    role: created.role,
    organization: created.organization,
    iat: now,
    exp: now + SESSION_TTL_MS
  };

  const token = signStudioSession(payload);
  res.status(201).json({
    success: true,
    token,
    expiresAt: new Date(payload.exp).toISOString(),
    user: {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
      roleTitle: created.roleTitle,
      organization: created.organization,
      permissions: created.permissions
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/session
// Mint a session token for a known persona (used by the Studio UI on warm-start).
// ---------------------------------------------------------------------------
router.post('/session', authRateLimiter, (req, res) => {
  const { id, name, role, organization } = req.body || {};
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required to mint a Studio session.' });
  }
  const now = Date.now();
  const payload: StudioSessionPayload = { id, name, role: role || 'unknown', organization, iat: now, exp: now + SESSION_TTL_MS };
  const token = signStudioSession(payload);
  res.status(200).json({ token, expiresAt: new Date(payload.exp).toISOString() });
});

// ---------------------------------------------------------------------------
// GET /api/auth/verify
// Validate a Bearer token and return the decoded actor.
// ---------------------------------------------------------------------------
router.get('/verify', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const session = verifyStudioSession(token);
  if (!session) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired session token' });
  }
  res.status(200).json({ valid: true, actor: session });
});

export default router;
