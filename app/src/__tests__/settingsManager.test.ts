import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Integration test for the secure settings persistence used for API keys.
 * Electron is mocked (safeStorage simulated with a reversible encoding), but
 * all file I/O is real: we verify that API keys NEVER land in the plain JSON
 * settings file, that they survive a load/save round-trip, that removing a
 * key wipes it, and that legacy plaintext keys get migrated into protected
 * storage automatically.
 */

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    // Simulated ciphertext: opaque on disk, reversible with the "keychain".
    encryptString: (value: string) =>
      Buffer.from(Buffer.from(value, 'utf8').toString('base64'), 'utf8'),
    decryptString: (buffer: Buffer) =>
      Buffer.from(buffer.toString('utf8'), 'base64').toString('utf8'),
  },
}))

const SETTINGS_FILE = 'alice-settings.json'
const SECRETS_FILE = 'alice-secrets.bin'
const TEST_KEY = 'sk-live-supersecret-1234567890abcdef'

async function freshManager() {
  vi.resetModules()
  return import('../../electron/main/settingsManager')
}

describe('settingsManager secure API key persistence', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitzaz-settings-'))
  })

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('never writes API keys into the plain JSON settings file', async () => {
    const manager = await freshManager()
    await manager.saveSettings({
      VITE_OPENAI_API_KEY: TEST_KEY,
      aiProvider: 'openai',
      assistantModel: 'gpt-4.1-mini',
    } as any)

    const settingsPath = path.join(userDataDir, SETTINGS_FILE)
    const secretsPath = path.join(userDataDir, SECRETS_FILE)

    expect(fs.existsSync(settingsPath)).toBe(true)
    expect(fs.existsSync(secretsPath)).toBe(true)

    const plainJson = fs.readFileSync(settingsPath, 'utf8')
    expect(plainJson).not.toContain(TEST_KEY)
    expect(plainJson).not.toContain('sk-live')
    // Non-secret settings remain in the plain file.
    expect(plainJson).toContain('"aiProvider": "openai"')

    // The encrypted blob must not contain the raw key either.
    const secretBlob = fs.readFileSync(secretsPath)
    expect(secretBlob.toString('utf8')).not.toContain(TEST_KEY)

    // Files must be owner-only.
    const mode = fs.statSync(settingsPath).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('round-trips secrets through loadSettings', async () => {
    const manager = await freshManager()
    await manager.saveSettings({
      VITE_OPENAI_API_KEY: TEST_KEY,
      VITE_GROQ_API_KEY: 'gsk-live-abcdef123456',
      ttsProvider: 'openai',
    } as any)

    const loaded = await manager.loadSettings()
    expect(loaded).not.toBeNull()
    expect((loaded as any).VITE_OPENAI_API_KEY).toBe(TEST_KEY)
    expect((loaded as any).VITE_GROQ_API_KEY).toBe('gsk-live-abcdef123456')
    expect((loaded as any).ttsProvider).toBe('openai')
  })

  it('wipes a stored key when it is saved empty (Remove API Key)', async () => {
    const manager = await freshManager()
    await manager.saveSettings({
      VITE_OPENAI_API_KEY: TEST_KEY,
    } as any)

    // User clicks "Remove API Key": the renderer saves the field as empty.
    await manager.saveSettings({
      VITE_OPENAI_API_KEY: '',
    } as any)

    const loaded = await manager.loadSettings()
    expect((loaded as any)?.VITE_OPENAI_API_KEY ?? '').toBe('')

    const secretsPath = path.join(userDataDir, SECRETS_FILE)
    const blob = fs.readFileSync(secretsPath, 'utf8')
    expect(blob).not.toContain(TEST_KEY)
  })

  it('migrates legacy plaintext keys out of the JSON file', async () => {
    const settingsPath = path.join(userDataDir, SETTINGS_FILE)
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        { VITE_OPENAI_API_KEY: TEST_KEY, aiProvider: 'openai' },
        null,
        2
      ),
      { mode: 0o600 }
    )

    const manager = await freshManager()
    const loaded = await manager.loadSettings()
    expect((loaded as any).VITE_OPENAI_API_KEY).toBe(TEST_KEY)

    // After migration the plaintext file must no longer contain the key.
    const plainJson = fs.readFileSync(settingsPath, 'utf8')
    expect(plainJson).not.toContain(TEST_KEY)
    expect(plainJson).toContain('"aiProvider": "openai"')

    // And the protected blob now owns it.
    const secretsPath = path.join(userDataDir, SECRETS_FILE)
    expect(fs.existsSync(secretsPath)).toBe(true)

    const reloaded = await manager.loadSettings()
    expect((reloaded as any).VITE_OPENAI_API_KEY).toBe(TEST_KEY)
  })

  it('deleteSettingsFile removes both settings and protected secrets', async () => {
    const manager = await freshManager()
    await manager.saveSettings({ VITE_OPENAI_API_KEY: TEST_KEY } as any)
    await manager.deleteSettingsFile()

    expect(
      fs.existsSync(path.join(userDataDir, SETTINGS_FILE))
    ).toBe(false)
    expect(
      fs.existsSync(path.join(userDataDir, SECRETS_FILE))
    ).toBe(false)
  })
})
