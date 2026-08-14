import { describe, expect, it } from 'vitest'
import {
  buildSessionPayload,
  generateSalt,
  hashPassword,
  normalizeEmail,
  parseSessionPayload,
  validateEmail,
  validatePassword,
  verifyPassword,
} from '../../electron/main/authCore'

describe('authCore password hashing', () => {
  it('hashes deterministically with a given salt', () => {
    const salt = generateSalt()
    const first = hashPassword('correct-horse-battery', salt)
    const second = hashPassword('correct-horse-battery', salt)
    expect(first).toBe(second)
    expect(first).toHaveLength(128) // 64 bytes hex
    expect(first).not.toContain('correct-horse-battery')
  })

  it('produces different hashes for different salts', () => {
    const saltA = generateSalt()
    const saltB = generateSalt()
    expect(saltA).not.toBe(saltB)
    expect(hashPassword('same-password', saltA)).not.toBe(
      hashPassword('same-password', saltB)
    )
  })

  it('verifies correct passwords and rejects wrong ones', () => {
    const salt = generateSalt()
    const hash = hashPassword('s3cure-passphrase', salt)
    expect(verifyPassword('s3cure-passphrase', salt, hash)).toBe(true)
    expect(verifyPassword('wrong-password', salt, hash)).toBe(false)
    expect(verifyPassword('', salt, hash)).toBe(false)
    expect(verifyPassword('s3cure-passphrase', salt, 'deadbeef')).toBe(false)
    expect(verifyPassword('s3cure-passphrase', '', hash)).toBe(false)
  })

  it('never compares hashes of mismatched length unsafely', () => {
    const salt = generateSalt()
    const hash = hashPassword('anything', salt)
    expect(verifyPassword('anything', salt, hash.slice(0, 16))).toBe(false)
  })
})

describe('authCore validation', () => {
  it('accepts well-formed emails and normalizes them', () => {
    expect(validateEmail('user@example.com').valid).toBe(true)
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('rejects malformed emails', () => {
    expect(validateEmail('').valid).toBe(false)
    expect(validateEmail('not-an-email').valid).toBe(false)
    expect(validateEmail('a@b').valid).toBe(false)
    expect(validateEmail('a b@c.com').valid).toBe(false)
    expect(validateEmail('x'.repeat(300) + '@example.com').valid).toBe(false)
  })

  it('enforces password policy', () => {
    expect(validatePassword('').valid).toBe(false)
    expect(validatePassword('short').valid).toBe(false)
    expect(validatePassword('long-enough-password').valid).toBe(true)
    expect(validatePassword('x'.repeat(200)).valid).toBe(false)
  })
})

describe('authCore session payloads', () => {
  it('builds and parses a round-trippable session payload', () => {
    const payload = buildSessionPayload(
      { id: 'user-1', email: 'user@example.com', name: 'User' },
      true
    )
    const parsed = parseSessionPayload(JSON.parse(JSON.stringify(payload)))
    expect(parsed).not.toBeNull()
    expect(parsed!.userId).toBe('user-1')
    expect(parsed!.email).toBe('user@example.com')
    expect(parsed!.name).toBe('User')
    expect(parsed!.remember).toBe(true)
    expect(typeof parsed!.issuedAt).toBe('number')
  })

  it('rejects invalid payloads', () => {
    expect(parseSessionPayload(null)).toBeNull()
    expect(parseSessionPayload({})).toBeNull()
    expect(parseSessionPayload([])).toBeNull()
    expect(parseSessionPayload({ userId: 1, email: 'x', issuedAt: 1 })).toBeNull()
    expect(
      parseSessionPayload({ userId: 'a', email: 'a@b.com', issuedAt: 'now' })
    ).toBeNull()
  })
})
