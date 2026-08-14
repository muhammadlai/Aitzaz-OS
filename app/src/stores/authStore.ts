import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export type AuthStatus =
  | 'restoring' // checking for an existing session on startup
  | 'unauthenticated'
  | 'authenticating' // login/sign-up in flight
  | 'authenticated'

export interface AuthUser {
  email: string
  name: string
}

/**
 * Renderer-side session state. All credential handling happens in the Electron
 * main process (see userAuthManager.ts); the renderer only exchanges
 * email/password over the allow-listed IPC bridge and remembers whether a
 * session is active.
 */
export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('restoring')
  const user = ref<AuthUser | null>(null)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => status.value === 'authenticated')
  const isRestoring = computed(() => status.value === 'restoring')
  const isBusy = computed(() => status.value === 'authenticating')

  // The auth gate only applies inside the Electron shell, where the secure
  // account store exists. Plain web/dev builds without a preload bridge skip
  // the gate instead of locking users out.
  const isAuthSupported = computed(() => Boolean(window.authAPI))

  const setAuthenticated = (nextUser: AuthUser | null) => {
    user.value = nextUser
    status.value = 'authenticated'
    error.value = null
  }

  const setUnauthenticated = () => {
    user.value = null
    status.value = 'unauthenticated'
  }

  async function restoreSession(): Promise<void> {
    if (!isAuthSupported.value) {
      setAuthenticated({ email: 'dev', name: 'Developer' })
      return
    }
    status.value = 'restoring'
    try {
      const session = await window.authAPI!.getSession()
      if (session?.success && session.active && session.user) {
        setAuthenticated({ email: session.user.email, name: session.user.name })
      } else {
        setUnauthenticated()
      }
    } catch (e) {
      console.error('[AuthStore] Failed to restore session:', e)
      setUnauthenticated()
    }
  }

  async function login(email: string, password: string, remember: boolean) {
    if (!isAuthSupported.value) {
      setAuthenticated({ email: email || 'dev', name: 'Developer' })
      return true
    }
    status.value = 'authenticating'
    error.value = null
    try {
      const result = await window.authAPI!.login({ email, password, remember })
      if (result?.success && result.user) {
        setAuthenticated({ email: result.user.email, name: result.user.name })
        return true
      }
      error.value = result?.error || 'Sign in failed. Please try again.'
      status.value = 'unauthenticated'
      return false
    } catch (e: any) {
      error.value = 'Sign in failed. Please try again.'
      status.value = 'unauthenticated'
      return false
    }
  }

  async function signUp(
    email: string,
    password: string,
    name: string,
    remember: boolean
  ) {
    if (!isAuthSupported.value) {
      setAuthenticated({ email: email || 'dev', name: name || 'Developer' })
      return true
    }
    status.value = 'authenticating'
    error.value = null
    try {
      const result = await window.authAPI!.signUp({
        email,
        password,
        name,
        remember,
      })
      if (result?.success && result.user) {
        setAuthenticated({ email: result.user.email, name: result.user.name })
        return true
      }
      error.value = result?.error || 'Sign up failed. Please try again.'
      status.value = 'unauthenticated'
      return false
    } catch (e: any) {
      error.value = 'Sign up failed. Please try again.'
      status.value = 'unauthenticated'
      return false
    }
  }

  async function logout() {
    try {
      if (isAuthSupported.value) {
        await window.authAPI!.logout()
      }
    } catch (e) {
      console.error('[AuthStore] Logout request failed:', e)
    } finally {
      setUnauthenticated()
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    status,
    user,
    error,
    isAuthenticated,
    isRestoring,
    isBusy,
    isAuthSupported,
    restoreSession,
    login,
    signUp,
    logout,
    clearError,
  }
})
