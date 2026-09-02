/**
 * Unit tests for src/server/authService.ts
 * Tests the cryptographic hashing, verification, registration and authentication logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// We need to mock the DB import to avoid a real PostgreSQL connection in tests
import { vi } from 'vitest';
vi.mock('../src/server/db', () => ({
  saveUserToDb: vi.fn().mockResolvedValue(undefined),
  loadUsersFromDb: vi.fn().mockResolvedValue([]),
  getPool: vi.fn().mockReturnValue(null)
}));

import { hashPassword, verifyPassword, registerUser, authenticateUser } from '../src/server/authService';

describe('hashPassword', () => {
  it('produces a combined string in scrypt:v1:<salt>:<hash> format', () => {
    const { combined } = hashPassword('MySecretPass#2026');
    const parts = combined.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toBe('v1');
    expect(parts[2]).toHaveLength(32); // 16-byte hex salt
    expect(parts[3]).toHaveLength(128); // 64-byte hex key
  });

  it('produces a different salt for each call', () => {
    const a = hashPassword('SamePassword#123');
    const b = hashPassword('SamePassword#123');
    expect(a.salt).not.toBe(b.salt);
    expect(a.combined).not.toBe(b.combined);
  });

  it('produces a deterministic hash when given a fixed salt', () => {
    const salt = 'deadbeefcafe1234deadbeefcafe1234';
    const a = hashPassword('StablePass#456', salt);
    const b = hashPassword('StablePass#456', salt);
    expect(a.combined).toBe(b.combined);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct password', () => {
    const { combined } = hashPassword('CorrectHorse#Battery9');
    expect(verifyPassword('CorrectHorse#Battery9', combined)).toBe(true);
  });

  it('returns false for an incorrect password', () => {
    const { combined } = hashPassword('CorrectHorse#Battery9');
    expect(verifyPassword('WrongPassword#123', combined)).toBe(false);
  });

  it('returns false for an empty password', () => {
    const { combined } = hashPassword('SomePass#2026');
    expect(verifyPassword('', combined)).toBe(false);
  });

  it('returns false for a tampered hash', () => {
    const { combined } = hashPassword('TamperedPass#789');
    const tampered = combined.slice(0, -4) + '0000';
    expect(verifyPassword('TamperedPass#789', tampered)).toBe(false);
  });

  it('returns false for an empty stored hash', () => {
    expect(verifyPassword('AnyPassword#1', '')).toBe(false);
  });
});

describe('registerUser and authenticateUser', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword#2026!';

  it('successfully registers a new user', () => {
    const cred = registerUser({ email: testEmail, password: testPassword, name: 'Test User' });
    expect(cred.email).toBe(testEmail.toLowerCase());
    expect(cred.name).toBe('Test User');
    expect(cred.role).toBe('application_builder');
    // Password hash should not expose the plaintext
    expect(cred.passwordHash).not.toContain(testPassword);
  });

  it('authenticates with the correct password after registration', () => {
    registerUser({ email: testEmail, password: testPassword, name: 'Test User' });
    const result = authenticateUser(testEmail, testPassword);
    expect(result.success).toBe(true);
    expect(result.user?.email).toBe(testEmail.toLowerCase());
  });

  it('rejects authentication with a wrong password', () => {
    registerUser({ email: testEmail, password: testPassword, name: 'Test User' });
    const result = authenticateUser(testEmail, 'WrongPassword#987!');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects authentication for an unknown email', () => {
    const result = authenticateUser('nobody@nowhere.invalid', 'AnyPass#123');
    expect(result.success).toBe(false);
  });

  it('is case-insensitive on email', () => {
    const email = `mixed-${Date.now()}@Example.COM`;
    registerUser({ email, password: testPassword, name: 'Case Test' });
    const result = authenticateUser(email.toUpperCase(), testPassword);
    expect(result.success).toBe(true);
  });
});
