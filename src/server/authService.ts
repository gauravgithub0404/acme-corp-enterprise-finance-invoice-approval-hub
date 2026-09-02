import crypto from 'crypto';
import { FloeStudioUser, FLOE_STUDIO_PERSONAS, PRESET_USERS } from '../types/auth';
import { saveUserToDb, loadUsersFromDb } from './db';

/**
 * Enterprise Password Hashing & Verification Engine
 * Implements salted scrypt key derivation (NIST/OWASP recommended) with constant-time verification.
 */

export interface StoredUserCredential {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role: string;
  roleTitle: string;
  organization: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

const HASH_ALGORITHM = 'scrypt:v1';
const SCRYPT_KEYLEN = 64;

/**
 * Derives a salted cryptographic hash for a plaintext password.
 */
export function hashPassword(password: string, customSalt?: string): { hash: string; salt: string; combined: string } {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const hashHex = derivedKey.toString('hex');
  const combined = `${HASH_ALGORITHM}:${salt}:${hashHex}`;
  return { hash: hashHex, salt, combined };
}

/**
 * Verifies a plaintext password against a stored salted hash using constant-time comparison.
 */
export function verifyPassword(password: string, storedCombinedHash: string): boolean {
  if (!password || !storedCombinedHash) return false;

  try {
    const parts = storedCombinedHash.split(':');
    if (parts.length === 4 && parts[0] === 'scrypt' && parts[1] === 'v1') {
      const salt = parts[2];
      const expectedHash = parts[3];
      const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
      const derivedBuf = Buffer.from(derivedKey.toString('hex'), 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');

      if (derivedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, expectedBuf);
    }

    // Legacy fallback format (salt:hash)
    if (parts.length === 2) {
      const [salt, expectedHash] = parts;
      const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
      const derivedBuf = Buffer.from(derivedKey.toString('hex'), 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      if (derivedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(derivedBuf, expectedBuf);
    }

    return false;
  } catch (err) {
    console.error('[Auth Service] Password verification exception:', err);
    return false;
  }
}

// In-Memory & Seeded Credentials Store
const userCredentialsStore = new Map<string, StoredUserCredential>();

/**
 * Initialize pre-seeded studio personas and application users with cryptographically secure salted hashes.
 */
export function initializeAuthStore(): void {
  // 1. Seed Floe Studio Personas
  FLOE_STUDIO_PERSONAS.forEach(p => {
    const defaultPassword = p.password || 'FloeArchitect#2026';
    const { salt, combined } = hashPassword(defaultPassword);
    userCredentialsStore.set(p.email.toLowerCase(), {
      id: p.id,
      email: p.email.toLowerCase(),
      passwordHash: combined,
      salt,
      name: p.name,
      role: p.role,
      roleTitle: p.roleTitle,
      organization: p.organization,
      permissions: p.permissions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // 2. Seed Preset App Users
  Object.values(PRESET_USERS).forEach(u => {
    const defaultPassword = u.password || 'SecurePass#2026';
    const { salt, combined } = hashPassword(defaultPassword);
    const emailKey = u.email.toLowerCase();
    if (!userCredentialsStore.has(emailKey)) {
      userCredentialsStore.set(emailKey, {
        id: u.id,
        email: emailKey,
        passwordHash: combined,
        salt,
        name: u.name,
        role: u.role,
        roleTitle: u.roleTitle,
        organization: 'Floe Enterprise Sandbox',
        permissions: u.permissions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });

  console.log(`[Auth Service] ✓ Initialized cryptographic credentials store (${userCredentialsStore.size} accounts salted & scrypt-hashed)`);
}

// Initialize on module load
initializeAuthStore();

/**
 * Authenticate user with email and plaintext password against stored salted hash.
 */
export function authenticateUser(email: string, password: string): {
  success: boolean;
  user?: StoredUserCredential;
  error?: string;
} {
  const normEmail = (email || '').trim().toLowerCase();
  const stored = userCredentialsStore.get(normEmail);

  if (!stored) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const isValid = verifyPassword(password, stored.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password.' };
  }

  return { success: true, user: stored };
}

/**
 * Register or update a user's credential in the secure store and persist to PostgreSQL.
 */
export function registerUser(params: {
  email: string;
  password: string;
  name: string;
  role?: string;
  roleTitle?: string;
  organization?: string;
  permissions?: string[];
}): StoredUserCredential {
  const normEmail = params.email.trim().toLowerCase();
  const { salt, combined } = hashPassword(params.password);

  const cred: StoredUserCredential = {
    id: `usr-${Date.now().toString(36)}`,
    email: normEmail,
    passwordHash: combined,
    salt,
    name: params.name.trim(),
    role: params.role || 'application_builder',
    roleTitle: params.roleTitle || 'Application Builder',
    organization: params.organization || 'Floe Enterprise Workspace',
    permissions: params.permissions || ['requirements:create', 'release:test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  userCredentialsStore.set(normEmail, cred);

  // Persist to PostgreSQL asynchronously — failure is non-fatal since the
  // in-memory store is still updated and the user can operate this session.
  saveUserToDb({
    id: cred.id,
    email: cred.email,
    passwordHash: cred.passwordHash,
    salt: cred.salt,
    name: cred.name,
    role: cred.role,
    roleTitle: cred.roleTitle,
    organization: cred.organization,
    permissions: cred.permissions
  }).catch(err => {
    console.warn('[Auth Service] Background DB persistence failed for user registration:', err.message);
  });

  return cred;
}

export function getUserCredential(email: string): StoredUserCredential | undefined {
  return userCredentialsStore.get((email || '').trim().toLowerCase());
}

/**
 * Hydrate the in-memory credential store from PostgreSQL.
 * Call this once after initDatabase() succeeds at server startup.
 * DB rows win over the default seeded passwords so any password updated via
 * registerUser() persists across restarts.
 */
export async function hydrateAuthStoreFromDb(): Promise<void> {
  try {
    const dbUsers = await loadUsersFromDb();
    if (dbUsers.length === 0) {
      // No rows yet — seed the DB with the in-memory defaults
      const seedPromises = Array.from(userCredentialsStore.values()).map(cred =>
        saveUserToDb({
          id: cred.id,
          email: cred.email,
          passwordHash: cred.passwordHash,
          salt: cred.salt,
          name: cred.name,
          role: cred.role,
          roleTitle: cred.roleTitle,
          organization: cred.organization,
          permissions: cred.permissions
        })
      );
      await Promise.allSettled(seedPromises);
      console.log(`[Auth Service] ✓ Seeded ${userCredentialsStore.size} default accounts into PostgreSQL users table.`);
      return;
    }

    // Overlay DB rows onto the in-memory cache.  DB is authoritative for any
    // email that exists in both places (e.g. after a password reset).
    let hydrated = 0;
    for (const dbUser of dbUsers) {
      const normEmail = dbUser.email.toLowerCase();
      userCredentialsStore.set(normEmail, {
        id: dbUser.id,
        email: normEmail,
        passwordHash: dbUser.passwordHash,
        salt: dbUser.salt,
        name: dbUser.name,
        role: dbUser.role,
        roleTitle: dbUser.roleTitle,
        organization: dbUser.organization,
        permissions: dbUser.permissions,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt
      });
      hydrated++;
    }
    console.log(`[Auth Service] ✓ Hydrated ${hydrated} user credentials from PostgreSQL into memory cache.`);
  } catch (err: any) {
    console.warn('[Auth Service] DB hydration failed — continuing with seeded in-memory store:', err.message);
  }
}
