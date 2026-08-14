// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AuthScreen from '../components/auth/AuthScreen.vue'
import { useAuthStore } from '../stores/authStore'

function installFakeAuthAPI(overrides: Partial<any> = {}) {
  const calls: Record<string, any[]> = {
    login: [],
    signUp: [],
    logout: [],
  }
  const fake = {
    login: vi.fn(async (payload: any) => {
      calls.login.push(payload)
      return (
        overrides.loginResult ?? {
          success: true,
          user: { email: payload.email, name: 'Test' },
        }
      )
    }),
    signUp: vi.fn(async (payload: any) => {
      calls.signUp.push(payload)
      return (
        overrides.signUpResult ?? {
          success: true,
          user: { email: payload.email, name: payload.name || 'Test' },
        }
      )
    }),
    logout: vi.fn(async () => ({ success: true })),
    getSession: vi.fn(async () => overrides.session ?? { success: true, active: false }),
  }
  vi.stubGlobal('authAPI', fake)
  return { fake, calls }
}

describe('AuthScreen (login / sign-up UI)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('submits login with email, password and remember flag', async () => {
    const { fake } = installFakeAuthAPI()
    const wrapper = mount(AuthScreen, {
      global: { plugins: [createPinia()] },
    })

    await wrapper.find('#auth-email').setValue('user@example.com')
    await wrapper.find('#auth-password').setValue('password-123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fake.login).toHaveBeenCalledTimes(1)
    expect(fake.login.mock.calls[0][0]).toEqual({
      email: 'user@example.com',
      password: 'password-123',
      remember: true,
    })

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.email).toBe('user@example.com')
  })

  it('shows the backend error and clears the password on failed login', async () => {
    installFakeAuthAPI({
      loginResult: { success: false, error: 'Invalid email or password.' },
    })
    const wrapper = mount(AuthScreen, {
      global: { plugins: [createPinia()] },
    })

    await wrapper.find('#auth-email').setValue('user@example.com')
    const passwordInput = wrapper.find('#auth-password')
    await passwordInput.setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.html()).toContain('Invalid email or password.')
    expect((passwordInput.element as HTMLInputElement).value).toBe('')

    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('sign-up validates password length client-side before calling IPC', async () => {
    const { fake } = installFakeAuthAPI()
    const wrapper = mount(AuthScreen, {
      global: { plugins: [createPinia()] },
    })

    // Switch to Create Account mode.
    await wrapper
      .findAll('button')
      .find(b => b.text().includes('Create Account'))!
      .trigger('click')

    await wrapper.find('#auth-email').setValue('new@example.com')
    await wrapper.find('#auth-password').setValue('short')
    await wrapper.find('#auth-confirm').setValue('short')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fake.signUp).not.toHaveBeenCalled()
    expect(wrapper.html()).toContain('at least 8 characters')

    // Now a valid sign-up goes through.
    await wrapper.find('#auth-password').setValue('long-enough-password')
    await wrapper.find('#auth-confirm').setValue('long-enough-password')
    await wrapper.find('#auth-name').setValue('Aitzaz User')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fake.signUp).toHaveBeenCalledTimes(1)
    expect(fake.signUp.mock.calls[0][0]).toMatchObject({
      email: 'new@example.com',
      name: 'Aitzaz User',
      remember: true,
    })
  })

  it('rejects mismatched passwords on sign-up', async () => {
    const { fake } = installFakeAuthAPI()
    const wrapper = mount(AuthScreen, {
      global: { plugins: [createPinia()] },
    })

    await wrapper
      .findAll('button')
      .find(b => b.text().includes('Create Account'))!
      .trigger('click')

    await wrapper.find('#auth-email').setValue('new@example.com')
    await wrapper.find('#auth-password').setValue('long-enough-password')
    await wrapper.find('#auth-confirm').setValue('different-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fake.signUp).not.toHaveBeenCalled()
    expect(wrapper.html()).toContain('Passwords do not match')
  })
})
