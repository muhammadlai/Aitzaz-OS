import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../../stores/settingsStore'

function installWindowMocks() {
  ;(globalThis as any).window = {
    customToolsAPI: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: {
          tools: [],
          diagnostics: [],
          filePath: '',
          lastModified: Date.now(),
        },
      }),
    },
  }
}

describe('buildToolsForProvider', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installWindowMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).window
  })

  it('uses GPT Image 2 for OpenAI image generation', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.updateSetting('aiProvider', 'openai')
    settingsStore.updateSetting('assistantModel', 'gpt-5')
    settingsStore.updateSetting('assistantReasoningEffort', 'medium')

    const { buildToolsForProvider } = await import('../tools')
    const tools = await buildToolsForProvider()

    expect(tools).toContainEqual({
      type: 'image_generation',
      model: 'gpt-image-2',
      partial_images: 2,
    })
  })

  it('uses OpenRouter server-side web search instead of the Tavily function', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.updateSetting('aiProvider', 'openrouter')
    settingsStore.updateSetting('assistantTools', ['perform_web_search'])

    const { buildToolsForProvider } = await import('../tools')
    const tools = await buildToolsForProvider()

    expect(tools).toContainEqual({ type: 'openrouter:web_search' })
    expect(tools).not.toContainEqual(
      expect.objectContaining({ name: 'perform_web_search' })
    )
  })
})
