/**
 * Aitzaz AI Pro local account & session manager.
 *
 * Design notes
 * ------------
 * Aitzaz AI Pro is a desktop application with no hosted backend, so the
 * account system is implemented locally in the Electron main process:
 *
 *  - Account records (email + scrypt password hash + salt) live in
 *    `aitzaz-users.json` inside the OS user-data directory with 0600 perms.
 *    Plain-text passwords are never written to disk or logs.
 *  - The active session is a payload encrypted with Electron `safeStorage`
 *    (OS credential store: DPAPI on Windows, Keychain on macOS,
 *    libsecret/GNOME Keyring/KWallet on Linux). On systems without a keyring
 *    daemon an AES-256-GCM local fallback is used so "keep me signed in"
 *    still survives restarts everywhere. The session blob is only persisted
 *    when the user opts into "keep me signed in"; otherwise the session
 *    lives in memory for the current run only.
 *  - Renderer access goes through a narrow IPC surface (auth:sign-up,
 *    auth:login, auth:logout, auth:session) that is allowlisted in
 *    `ipcBridgePolicy.ts`.
 */
import { app, ipcMain } from 'electron'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  buildSessionPayload,
  generateSalt,
  hashPassword,
  normalizeEmail,
  parseSessionPayload,
  validateDisplayName,
  validateEmail,
  validatePassword,
  verifyPassword,
  type SessionPayload,
} from './authCore'
import {
  decryptProtected,
  encryptProtected,
} from './protectedStorage'
import { getMainWindow } from './windowManager'

const USERS_FILE_NAME = 'aitzaz-users.json'
const SESSION_FILE_NAME = 'aitzaz-session.bin'

interface StoredUser {
  id: string
  email: string
  name: string
  salt: string
  passwordHash: string
  createdAt: number
}

interface UsersFile {
  version: 1
  users: StoredUser[]
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: { email: string; name: string }
}

export interface SessionResult {
  success: boolean
  active: boolean
  user?: { email: string; name: string }
  error?: string
}

let usersFilePath: string | null = null
let sessionFilePath: string | null = null
let memorySession: SessionPayload | null = null
let initialized = false
let handlersRegistered = false

function ensurePaths(): void {
  if (!initialized) {
    usersFilePath = path.join(app.getPath('userData'), USERS_FILE_NAME)
    sessionFilePath = path.join(app.getPath('userData'), SESSION_FILE_NAME)
    initialized = true
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function writePrivateFile(
  filePath: string,
  data: string | Buffer,
  encoding?: BufferEncoding
): Promise<void> {
  await fs.writeFile(filePath, data, { encoding, mode: 0o600 })
  await fs.chmod(filePath, 0o600)
}

async function loadUsersFile(): Promise<UsersFile> {
  ensurePaths()
  try {
    if (!(await fileExists(usersFilePath!))) {
      return { version: 1, users: [] }
    }
    const raw = await fs.readFile(usersFilePath!, 'utf8')
    const parsed = JSON.parse(raw) as Partial<UsersFile>
    if (!parsed || !Array.isArray(parsed.users)) {
      return { version: 1, users: [] }
    }
    const users = parsed.users.filter(
      (user): user is StoredUser =>
        Boolean(
          user &&
            typeof user.id === 'string' &&
            typeof user.email === 'string' &&
            typeof user.salt === 'string' &&
            typeof user.passwordHash === 'string'
        )
    )
    return { version: 1, users }
  } catch (error) {
    console.error('[UserAuth] Failed to read account store:', error)
    return { version: 1, users: [] }
  }
}

async function saveUsersFile(store: UsersFile): Promise<void> {
  ensurePaths()
  await writePrivateFile(usersFilePath!, JSON.stringify(store, null, 2), 'utf8')
}

function findUserByEmail(store: UsersFile, email: string): StoredUser | null {
  const normalized = normalizeEmail(email)
  return store.users.find(user => user.email === normalized) || null
}

function publicUser(user: StoredUser): { email: string; name: string } {
  return { email: user.email, name: user.name }
}

function notifySessionChanged(active: boolean, email?: string): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('auth:session-changed', {
      active,
      user: active && email ? { email } : null,
    })
  }
}

// ---------------------------------------------------------------------------
// Session persistence (safeStorage / OS keychain)
// ---------------------------------------------------------------------------

async function persistSession(payload: SessionPayload): Promise<void> {
  ensurePaths()
  if (!payload.remember) {
    // Without "keep me signed in" the session is memory-only. Remove any
    // stale persisted session from a previous run.
    await fs.rm(sessionFilePath!, { force: true })
    return
  }
  // OS keychain when available, otherwise the local AES-256-GCM fallback —
  // the session now survives restarts on every system (including Linux
  // machines without a keyring daemon).
  const encrypted = await encryptProtected(JSON.stringify(payload))
  await writePrivateFile(sessionFilePath!, encrypted)
}

async function loadPersistedSession(): Promise<SessionPayload | null> {
  ensurePaths()
  try {
    if (!(await fileExists(sessionFilePath!))) {
      return null
    }
    const encrypted = await fs.readFile(sessionFilePath!)
    const payload = parseSessionPayload(
      JSON.parse(await decryptProtected(encrypted))
    )
    return payload
  } catch (error) {
    console.warn('[UserAuth] Failed to restore persisted session:', error)
    return null
  }
}

async function clearPersistedSession(): Promise<void> {
  ensurePaths()
  await fs.rm(sessionFilePath!, { force: true })
}

async function resolveSession(): Promise<SessionPayload | null> {
  if (memorySession) {
    return memorySession
  }
  const persisted = await loadPersistedSession()
  if (!persisted) {
    return null
  }
  // A session is only valid while the account still exists.
  const store = await loadUsersFile()
  const user = store.users.find(candidate => candidate.id === persisted.userId)
  if (!user) {
    await clearPersistedSession()
    return null
  }
  memorySession = persisted
  return persisted
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function signUp(
  email: string,
  password: string,
  name: string,
  remember: boolean
): Promise<AuthResult> {
  const emailCheck = validateEmail(email)
  if (!emailCheck.valid) {
    return { success: false, error: emailCheck.error }
  }
  const passwordCheck = validatePassword(password)
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.error }
  }
  const nameCheck = validateDisplayName(name)
  if (!nameCheck.valid) {
    return { success: false, error: nameCheck.error }
  }

  const normalized = normalizeEmail(email)
  const store = await loadUsersFile()
  if (findUserByEmail(store, normalized)) {
    return {
      success: false,
      error: 'An account with this email already exists. Please sign in.',
    }
  }

  const salt = generateSalt()
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email: normalized,
    name: String(name || '').trim() || normalized.split('@')[0],
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: Date.now(),
  }
  store.users.push(user)
  await saveUsersFile(store)

  memorySession = buildSessionPayload(user, remember)
  await persistSession(memorySession)
  console.log('[UserAuth] Account created for', normalized)
  notifySessionChanged(true, normalized)
  return { success: true, user: publicUser(user) }
}

export async function login(
  email: string,
  password: string,
  remember: boolean
): Promise<AuthResult> {
  const emailCheck = validateEmail(email)
  if (!emailCheck.valid) {
    return { success: false, error: emailCheck.error }
  }
  if (!password) {
    return { success: false, error: 'Password is required.' }
  }

  const store = await loadUsersFile()
  const user = findUserByEmail(store, email)
  // Always run a hash computation so timing does not reveal whether the
  // account exists.
  const salt = user?.salt || generateSalt()
  const candidateHash = hashPassword(password, salt)
  const valid =
    user !== null && verifyPassword(password, user.salt, user.passwordHash)

  if (!valid || !user) {
    void candidateHash
    return { success: false, error: 'Invalid email or password.' }
  }

  memorySession = buildSessionPayload(user, remember)
  await persistSession(memorySession)
  console.log('[UserAuth] Signed in:', user.email)
  notifySessionChanged(true, user.email)
  return { success: true, user: publicUser(user) }
}

export async function logout(): Promise<AuthResult> {
  memorySession = null
  await clearPersistedSession()
  console.log('[UserAuth] Signed out.')
  notifySessionChanged(false)
  return { success: true }
}

export async function getSession(): Promise<SessionResult> {
  const session = await resolveSession()
  if (!session) {
    return { success: true, active: false }
  }
  return {
    success: true,
    active: true,
    user: { email: session.email, name: session.name },
  }
}

/**
 * Deletes the persisted session (used e.g. when a user account is removed).
 */
export async function invalidateSessionsForUser(userId: string): Promise<void> {
  if (memorySession?.userId === userId) {
    memorySession = null
  }
  const persisted = await loadPersistedSession()
  if (persisted?.userId === userId) {
    await clearPersistedSession()
  }
}

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

export function registerUserAuthIPCHandlers(): void {
  if (handlersRegistered) {
    return
  }
  handlersRegistered = true

  ipcMain.handle(
    'auth:sign-up',
    async (_event, payload: { email?: string; password?: string; name?: string; remember?: boolean }) => {
      try {
        return await signUp(
          String(payload?.email || ''),
          String(payload?.password || ''),
          String(payload?.name || ''),
          Boolean(payload?.remember)
        )
      } catch (error: any) {
        console.error('[UserAuth] sign-up failed:', error)
        return { success: false, error: 'Sign up failed. Please try again.' }
      }
    }
  )

  ipcMain.handle(
    'auth:login',
    async (_event, payload: { email?: string; password?: string; remember?: boolean }) => {
      try {
        return await login(
          String(payload?.email || ''),
          String(payload?.password || ''),
          Boolean(payload?.remember)
        )
      } catch (error: any) {
        console.error('[UserAuth] login failed:', error)
        return { success: false, error: 'Sign in failed. Please try again.' }
      }
    }
  )

  ipcMain.handle('auth:logout', async () => {
    try {
      return await logout()
    } catch (error: any) {
      console.error('[UserAuth] logout failed:', error)
      return { success: false, error: 'Sign out failed. Please try again.' }
    }
  })

  ipcMain.handle('auth:session', async () => {
    try {
      return await getSession()
    } catch (error: any) {
      console.error('[UserAuth] session lookup failed:', error)
      return { success: false, active: false }
    }
  })
}
