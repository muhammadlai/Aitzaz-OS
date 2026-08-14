import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../../stores/settingsStore'
import { getOpenRouterClient } from '../../apiClients'
import { createOpenRouterResponse } from '../openrouter'

vi.mock('../../apiClients', () => ({
  getOpenRouterClient: vi.fn(),
}))

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

describe('createOpenRouterResponse', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installWindowMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).window
  })

  it('uses the configured model and the OpenRouter web search server tool', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.updateSetting('aiProvider', 'openrouter')
    settingsStore.updateSetting('assistantModel', 'anthropic/claude-sonnet-4.5')

    const create = vi.fn().mockResolvedValue({ choices: [] })
    vi.mocked(getOpenRouterClient).mockReturnValue({
      chat: { completions: { create } },
    } as any)

    await createOpenRouterResponse(
      [
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'What changed today?' }],
        } as any,
      ],
      null,
      false
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-sonnet-4.5',
        max_tool_calls: 1,
        // Regression guard: without an explicit cap OpenRouter reserves the
        // model's full max output (e.g. 65536) against credits and rejects
        // low-credit accounts with HTTP 402.
        max_tokens: expect.any(Number),
        tools: expect.arrayContaining([
          { type: 'openrouter:web_search' },
        ]),
      }),
      expect.any(Object)
    )

    const sentParams = create.mock.calls[0][0]
    expect(sentParams.max_tokens).toBeLessThanOrEqual(4096)
    expect(sentParams.max_tokens).toBeGreaterThan(0)
  })
})
