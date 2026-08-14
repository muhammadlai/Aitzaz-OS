// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'

function installMocks() {
  const ipcListeners = new Map<string, Function>()
  vi.stubGlobal('aliceIPC', {
    on: (ch: string, fn: Function) => void ipcListeners.set(ch, fn),
    off: () => {},
    removeAllListeners: () => {},
    send: vi.fn(),
    invoke: vi.fn(async (ch: string) => {
      if (ch === 'app:is-packaged') return true
      return { success: true }
    }),
  })
  vi.stubGlobal('electron', {
    resize: vi.fn(),
    mini: vi.fn(),
    screenshot: vi.fn(),
    showOverlay: vi.fn(),
    getScreenshot: vi.fn(),
    closeApp: vi.fn(),
  })
  vi.stubGlobal('settingsAPI', {
    loadSettings: vi.fn(async () => null),
    saveSettings: vi.fn(async () => ({ success: true })),
  })
  let loggedIn = false
  vi.stubGlobal('authAPI', {
    getSession: vi.fn(async () => ({ success: true, active: loggedIn, user: loggedIn ? { email: 'u@example.com', name: 'U' } : undefined })),
    login: vi.fn(async (p: any) => { loggedIn = true; return { success: true, user: { email: p.email, name: 'U' } } }),
    signUp: vi.fn(async (p: any) => { loggedIn = true; return { success: true, user: { email: p.email, name: 'U' } } }),
    logout: vi.fn(async () => { loggedIn = false; return { success: true } }),
  })
}

async function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  const wrapper = mount(App, {
    global: { plugins: [createPinia(), router] },
  })
  await router.isReady()
  await flushPromises()
  return wrapper
}

describe('Full app flow: auth -> wizard -> provider step', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    installMocks()
  })

  it('shows auth screen, logs in, then shows onboarding wizard and renders provider step', async () => {
    const wrapper = await mountApp()

    // 1. Unauthenticated -> AuthScreen visible
    expect(wrapper.html()).toContain('Aitzaz AI Pro')
    expect(wrapper.find('#auth-email').exists()).toBe(true)

    // 2. Log in
    await wrapper.find('#auth-email').setValue('user@example.com')
    await wrapper.find('#auth-password').setValue('password-123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // 3. Fresh settings -> onboarding wizard appears (Welcome step)
    const html = wrapper.html()
    expect(html).toContain('Welcome')

    // 4. Advance to AI Provider step via footer Next button
    const nextBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Next')
    expect(nextBtn, 'Next button must exist').toBeTruthy()
    await nextBtn!.trigger('click')
    await flushPromises()

    // 5. AI Provider step rendered
    expect(wrapper.html()).toContain('Choose Your AI Provider')

    // 6. Select OpenRouter from the provider dropdown
    const providerSelect = wrapper.find('#ai-provider, select')
    expect(providerSelect.exists()).toBe(true)
    await providerSelect.setValue('openrouter')
    await flushPromises()

    // 7. OpenRouter section visible with masked key input, nothing crashed
    expect(wrapper.html()).toContain('OpenRouter')
    expect(wrapper.html()).toContain('Get your key from')
  })
})
