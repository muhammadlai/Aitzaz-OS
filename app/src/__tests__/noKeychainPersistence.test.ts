import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Simulates Linux machines WITHOUT a keyring daemon (safeStorage reports
 * unavailable). Verifies the AES-256-GCM fallback keeps sessions and API
 * keys persisted across restarts — the "login/key only once" guarantee.
 */

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  safeStorage: {
    // Keychain deliberately unavailable.
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('safeStorage must not be used when unavailable')
    },
    decryptString: () => {
      throw new Error('safeStorage must not be used when unavailable')
    },
  },
}))

vi.mock('../../electron/main/windowManager', () => ({
  getMainWindow: () => null,
  getSettingsWindow: () => null,
}))

async function freshAuth() {
  vi.resetModules()
  return import('../../electron/main/userAuthManager')
}

async function freshSettings() {
  vi.resetModules()
  return import('../../electron/main/settingsManager')
}

describe('persistence without OS keychain (fallback AES-256-GCM)', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitzaz-nokeychain-'))
  })

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('session survives a simulated restart via the fallback store', async () => {
    const first = await freshAuth()
    const signUp = await first.signUp(
      'nokeychain@example.com',
      'password-123',
      'NK',
      true
    )
    expect(signUp.success).toBe(true)

    // Session file must exist and be opaque (not plaintext).
    const sessionFile = path.join(userDataDir, 'aitzaz-session.bin')
    expect(fs.existsSync(sessionFile)).toBe(true)
    const raw = fs.readFileSync(sessionFile, 'utf8')
    expect(raw).toContain('aitzaz-fb1:')
    expect(raw).not.toContain('nokeychain@example.com')

    // Simulated restart: fresh module, same userData.
    const second = await freshAuth()
    const session = await second.getSession()
    expect(session.active).toBe(true)
    expect(session.user?.email).toBe('nokeychain@example.com')
  })

  it('API keys persist and reload without a keychain', async () => {
    const first = await freshSettings()
    await first.saveSettings({
      VITE_OPENAI_API_KEY: 'sk-live-persist-once-1234',
      aiProvider: 'openai',
    } as any)

    const secretsFile = path.join(userDataDir, 'alice-secrets.bin')
    expect(fs.existsSync(secretsFile)).toBe(true)
    const raw = fs.readFileSync(secretsFile, 'utf8')
    expect(raw).toContain('aitzaz-fb1:')
    expect(raw).not.toContain('sk-live-persist-once-1234')

    const plain = fs.readFileSync(
      path.join(userDataDir, 'alice-settings.json'),
      'utf8'
    )
    expect(plain).not.toContain('sk-live-persist-once-1234')

    const second = await freshSettings()
    const loaded = await second.loadSettings()
    expect((loaded as any).VITE_OPENAI_API_KEY).toBe(
      'sk-live-persist-once-1234'
    )
  })

  it('fallback blobs are authenticated: tampering is rejected', async () => {
    const first = await freshAuth()
    await first.signUp('tamper@example.com', 'password-123', 'T', true)

    const sessionFile = path.join(userDataDir, 'aitzaz-session.bin')
    const original = fs.readFileSync(sessionFile, 'utf8')
    // Flip a character inside the base64 payload (after the magic prefix).
    const prefix = original.slice(0, 20)
    const rest = original
      .slice(20)
      .replace(/[A-Za-z]/, c => (c === 'A' ? 'B' : 'A'))
    fs.writeFileSync(sessionFile, prefix + rest)

    const second = await freshAuth()
    const session = await second.getSession()
    expect(session.active).toBe(false)
  })
})
