import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Integration test for the Electron main-process account manager.
 * Electron is mocked: safeStorage is simulated with a reversible encoding
 * (the real implementation delegates to the OS keychain), and userData is a
 * per-test temp directory so persistence is genuinely exercised on disk.
 */

let userDataDir = ''
const registeredHandlers = new Map<string, (event: any, payload?: any) => any>()

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
  ipcMain: {
    handle: (channel: string, handler: any) => {
      registeredHandlers.set(channel, handler)
    },
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) =>
      Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) =>
      Buffer.from(buffer).toString('utf8').replace(/^enc:/, ''),
  },
}))

vi.mock('../../electron/main/windowManager', () => ({
  getMainWindow: () => null,
  getSettingsWindow: () => null,
}))

async function freshManager() {
  vi.resetModules()
  return import('../../electron/main/userAuthManager')
}

describe('userAuthManager (mocked Electron)', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitzaz-auth-'))
    registeredHandlers.clear()
  })

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('signs up a new user and persists the account store', async () => {
    const manager = await freshManager()
    const result = await manager.signUp(
      'User@Example.com',
      'password-123',
      'Test User',
      true
    )
    expect(result.success).toBe(true)
    expect(result.user?.email).toBe('user@example.com')

    const storeFile = path.join(userDataDir, 'aitzaz-users.json')
    expect(fs.existsSync(storeFile)).toBe(true)
    const raw = JSON.parse(fs.readFileSync(storeFile, 'utf8'))
    expect(raw.users).toHaveLength(1)
    // The password must never be stored in plain text.
    expect(JSON.stringify(raw)).not.toContain('password-123')
    expect(raw.users[0].passwordHash).toBeTruthy()
    expect(raw.users[0].salt).toBeTruthy()

    // Session blob must exist (remember=true) and not contain the password.
    const sessionFile = path.join(userDataDir, 'aitzaz-session.bin')
    expect(fs.existsSync(sessionFile)).toBe(true)
    expect(fs.readFileSync(sessionFile).toString()).not.toContain(
      'password-123'
    )
  })

  it('rejects duplicate sign-ups and invalid input', async () => {
    const manager = await freshManager()
    await manager.signUp('dup@example.com', 'password-123', '', true)

    const duplicate = await manager.signUp(
      'DUP@example.com',
      'other-password',
      '',
      true
    )
    expect(duplicate.success).toBe(false)
    expect(duplicate.error).toContain('already exists')

    const badEmail = await manager.signUp('nope', 'password-123', '', true)
    expect(badEmail.success).toBe(false)

    const badPassword = await manager.signUp(
      'new@example.com',
      'short',
      '',
      true
    )
    expect(badPassword.success).toBe(false)
  })

  it('logs in with the correct password and rejects wrong ones', async () => {
    const manager = await freshManager()
    await manager.signUp('login@example.com', 'password-123', '', true)
    await manager.logout()

    const wrong = await manager.login('login@example.com', 'wrong-pass', true)
    expect(wrong.success).toBe(false)
    expect(wrong.error).toBe('Invalid email or password.')

    const unknown = await manager.login('ghost@example.com', 'password-123', true)
    expect(unknown.success).toBe(false)
    expect(unknown.error).toBe('Invalid email or password.')

    const ok = await manager.login('login@example.com', 'password-123', true)
    expect(ok.success).toBe(true)
    expect(ok.user?.email).toBe('login@example.com')
  })

  it('restores a remembered session after a simulated restart', async () => {
    const firstRun = await freshManager()
    await firstRun.signUp('returning@example.com', 'password-123', 'R', true)

    // Simulated app restart: fresh module instance, same userData directory.
    const secondRun = await freshManager()
    const session = await secondRun.getSession()
    expect(session.active).toBe(true)
    expect(session.user?.email).toBe('returning@example.com')
  })

  it('does not restore a session when remember-me was off', async () => {
    const firstRun = await freshManager()
    await firstRun.signUp('transient@example.com', 'password-123', '', false)

    const sessionFile = path.join(userDataDir, 'aitzaz-session.bin')
    expect(fs.existsSync(sessionFile)).toBe(false)

    const secondRun = await freshManager()
    const session = await secondRun.getSession()
    expect(session.active).toBe(false)

    // But credentials still work for a manual sign-in.
    const login = await secondRun.login(
      'transient@example.com',
      'password-123',
      false
    )
    expect(login.success).toBe(true)
  })

  it('logout clears both in-memory and persisted sessions', async () => {
    const manager = await freshManager()
    await manager.signUp('bye@example.com', 'password-123', '', true)

    const out = await manager.logout()
    expect(out.success).toBe(true)
    expect(
      fs.existsSync(path.join(userDataDir, 'aitzaz-session.bin'))
    ).toBe(false)

    const afterLogout = await manager.getSession()
    expect(afterLogout.active).toBe(false)

    const restart = await freshManager()
    expect((await restart.getSession()).active).toBe(false)
  })

  it('registers the allow-listed auth IPC handlers', async () => {
    const manager = await freshManager()
    manager.registerUserAuthIPCHandlers()
    expect(registeredHandlers.has('auth:sign-up')).toBe(true)
    expect(registeredHandlers.has('auth:login')).toBe(true)
    expect(registeredHandlers.has('auth:logout')).toBe(true)
    expect(registeredHandlers.has('auth:session')).toBe(true)

    const viaIpc = await registeredHandlers.get('auth:sign-up')!(null, {
      email: 'ipc@example.com',
      password: 'password-123',
      name: 'IPC',
      remember: true,
    })
    expect(viaIpc.success).toBe(true)

    const sessionViaIpc = await registeredHandlers.get('auth:session')!(null)
    expect(sessionViaIpc.active).toBe(true)
    expect(sessionViaIpc.user.email).toBe('ipc@example.com')
  })
})
