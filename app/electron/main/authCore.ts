/**
 * Pure authentication primitives (no Electron imports) so they can be
 * unit-tested with vitest in a plain Node environment.
 *
 * Passwords are never stored in plain text: we derive a scrypt hash with a
 * per-user random salt and compare with a constant-time comparison.
 */
import crypto from 'node:crypto'

export const SCRYPT_KEY_LENGTH = 64
export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
export const MAX_EMAIL_LENGTH = 254
export const MAX_NAME_LENGTH = 80

// Intentionally conservative: this is a desktop app, not a web service, but
// we still reject obviously malformed input before it hits the account store.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

export function validateEmail(email: string): ValidationResult {
  const normalized = normalizeEmail(email)
  if (!normalized) {
    return { valid: false, error: 'Email is required.' }
  }
  if (normalized.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: 'Email is too long.' }
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return { valid: false, error: 'Please enter a valid email address.' }
  }
  return { valid: true }
}

export function validatePassword(password: string): ValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    }
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: 'Password is too long.' }
  }
  return { valid: true }
}

export function validateDisplayName(name: string): ValidationResult {
  const trimmed = String(name || '').trim()
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { valid: false, error: 'Name is too long.' }
  }
  return { valid: true }
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashPassword(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex')
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 128 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r * 2,
  })
  return derived.toString('hex')
}

export function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): boolean {
  if (!password || !saltHex || !expectedHashHex) {
    return false
  }
  try {
    const candidate = Buffer.from(hashPassword(password, saltHex), 'hex')
    const expected = Buffer.from(expectedHashHex, 'hex')
    if (candidate.length !== expected.length) {
      return false
    }
    return crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export interface SessionPayload {
  userId: string
  email: string
  name: string
  issuedAt: number
  remember: boolean
}

/**
 * Build the session payload that gets persisted (encrypted with the OS
 * keychain via Electron safeStorage when "remember me" is enabled).
 */
export function buildSessionPayload(
  user: { id: string; email: string; name: string },
  remember: boolean
): SessionPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    issuedAt: Date.now(),
    remember,
  }
}

export function parseSessionPayload(raw: unknown): SessionPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const candidate = raw as Record<string, unknown>
  if (
    typeof candidate.userId !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.issuedAt !== 'number'
  ) {
    return null
  }
  return {
    userId: candidate.userId,
    email: candidate.email,
    name: typeof candidate.name === 'string' ? candidate.name : '',
    issuedAt: candidate.issuedAt,
    remember: Boolean(candidate.remember),
  }
}
