/**
 * Protected string storage with a guaranteed fallback.
 *
 * Primary: Electron `safeStorage` (OS keychain: DPAPI / macOS Keychain /
 * libsecret / KWallet). On some Linux systems no keyring daemon exists, in
 * which case `safeStorage.isEncryptionAvailable()` is false and — without a
 * fallback — sessions and API keys would never persist (the "login again
 * every launch" problem).
 *
 * Fallback: AES-256-GCM with a random machine-local key kept in a 0600 file
 * inside the app's userData directory. This still encrypts the data at rest
 * and scopes it to the user account, which is an acceptable guarantee for
 * session tokens and API keys when the OS keychain is unavailable.
 *
 * Blobs written by the fallback carry an ASCII magic prefix so they can be
 * told apart from opaque safeStorage blobs, and decryption works no matter
 * which mechanism wrote the file.
 */
import { app, safeStorage } from 'electron'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'

const FALLBACK_MAGIC = 'aitzaz-fb1:'
const FALLBACK_KEY_FILE = 'aitzaz-fallback.key'
const KEY_LENGTH = 32
const IV_LENGTH = 12

let fallbackKeyPromise: Promise<Buffer> | null = null

function fallbackKeyPath(): string {
  return path.join(app.getPath('userData'), FALLBACK_KEY_FILE)
}

async function writePrivateFile(
  filePath: string,
  data: Buffer | string
): Promise<void> {
  await fs.writeFile(filePath, data, { mode: 0o600 })
  await fs.chmod(filePath, 0o600)
}

async function getFallbackKey(): Promise<Buffer> {
  if (!fallbackKeyPromise) {
    fallbackKeyPromise = (async () => {
      try {
        const existing = await fs.readFile(fallbackKeyPath())
        if (existing.length >= KEY_LENGTH) {
          return existing.subarray(0, KEY_LENGTH)
        }
      } catch {
        // First run or unreadable key — generate a fresh one below.
      }
      const key = crypto.randomBytes(KEY_LENGTH)
      await writePrivateFile(fallbackKeyPath(), key)
      return key
    })()
  }
  return fallbackKeyPromise
}

function safeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Encrypt a string using the OS keychain when possible, otherwise the
 * local AES-256-GCM fallback. Never throws because of a missing keychain.
 */
export async function encryptProtected(value: string): Promise<Buffer> {
  if (safeStorageAvailable()) {
    return safeStorage.encryptString(value)
  }
  const key = await getFallbackKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.from(
    FALLBACK_MAGIC +
      Buffer.concat([iv, tag, ciphertext]).toString('base64'),
    'utf8'
  )
}

/**
 * Decrypt a blob written by encryptProtected, regardless of which mechanism
 * produced it. Throws on tampering/corruption.
 */
export async function decryptProtected(data: Buffer): Promise<string> {
  const asText = data.toString('utf8')
  if (asText.startsWith(FALLBACK_MAGIC)) {
    const key = await getFallbackKey()
    const raw = Buffer.from(
      asText.slice(FALLBACK_MAGIC.length),
      'base64'
    )
    const iv = raw.subarray(0, IV_LENGTH)
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16)
    const ciphertext = raw.subarray(IV_LENGTH + 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8'
    )
  }
  return safeStorage.decryptString(data)
}

/**
 * True when either the OS keychain or the local fallback can be used.
 * The fallback only requires a writable userData directory, so this is
 * effectively always true in practice.
 */
export function protectedStorageReady(): boolean {
  return true
}

export function usingOsKeychain(): boolean {
  return safeStorageAvailable()
}
