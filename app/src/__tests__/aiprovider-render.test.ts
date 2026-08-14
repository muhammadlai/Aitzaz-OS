// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import AIProviderStep from '../components/wizard/steps/AIProviderStep.vue'

const makeProps = (provider: string) => ({
  formData: reactive({
    VITE_OPENAI_API_KEY: '',
    VITE_OPENROUTER_API_KEY: '',
    VITE_ZAI_API_KEY: '',
    VITE_MINIMAX_API_KEY: '',
    VITE_DEEPSEEK_API_KEY: '',
    codexAuthConnected: false,
    codexAccountLabel: '',
    aiProvider: provider,
    assistantModel: 'gpt-4.1-mini',
    summarizationModel: 'gpt-5.6-luna',
    ollamaBaseUrl: 'http://localhost:11434',
    lmStudioBaseUrl: 'http://localhost:1234',
    zaiBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
    minimaxBaseUrl: 'https://api.minimax.io/v1',
    deepseekBaseUrl: 'https://api.deepseek.com',
    availableModels: [],
  }),
  testResult: reactive({
    openai: { success: false, error: '' },
    openrouter: { success: false, error: '' },
    zai: { success: false, error: '' },
    minimax: { success: false, error: '' },
    deepseek: { success: false, error: '' },
    codex: { success: false, error: '' },
    ollama: { success: false, error: '' },
    lmStudio: { success: false, error: '' },
  }),
  isTesting: reactive({
    openai: false, openrouter: false, zai: false, minimax: false,
    deepseek: false, codex: false, ollama: false, lmStudio: false,
  }),
  savedConfig: reactive({
    VITE_OPENAI_API_KEY: '',
    VITE_OPENROUTER_API_KEY: '',
    VITE_ZAI_API_KEY: '',
    VITE_MINIMAX_API_KEY: '',
    VITE_DEEPSEEK_API_KEY: '',
  }),
})

describe('AIProviderStep renders every provider without crashing', () => {
  const providers = ['openai','openrouter','zai','minimax','deepseek','codex','ollama','lm-studio']
  for (const p of providers) {
    it(`renders provider: ${p}`, () => {
      const wrapper = mount(AIProviderStep, { props: makeProps(p) })
      expect(wrapper.html()).toContain('Choose Your AI Provider')
      // provider section should render something (dropdown at minimum)
      expect(wrapper.find('select').exists()).toBe(true)
    })
  }
})
