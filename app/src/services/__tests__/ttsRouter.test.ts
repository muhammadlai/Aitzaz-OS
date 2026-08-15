import { describe, expect, it } from 'vitest'
import {
  getTtsFallbackChain,
  normalizeTtsProvider,
} from '../ttsRouter'

describe('TTS fallback chain', () => {
  it('starts with the configured provider', () => {
    const chain = getTtsFallbackChain({
      ttsProvider: 'openai',
      VITE_OPENAI_API_KEY: 'sk-test',
    })
    expect(chain[0]).toBe('openai')
  })

  it('always includes local Piper as a fallback exactly once', () => {
    const chain = getTtsFallbackChain({
      ttsProvider: 'openai',
      VITE_OPENAI_API_KEY: 'sk-test',
    })
    expect(chain.filter(provider => provider === 'local')).toHaveLength(1)
    expect(chain).toContain('local')
  })

  it('does not duplicate the configured local provider', () => {
    const chain = getTtsFallbackChain({ ttsProvider: 'local' })
    expect(chain[0]).toBe('local')
    expect(chain.filter(provider => provider === 'local')).toHaveLength(1)
  })

  it('adds cloud providers only when keys exist', () => {
    const withoutKeys = getTtsFallbackChain({ ttsProvider: 'local' })
    expect(withoutKeys).not.toContain('openai')
    expect(withoutKeys).not.toContain('google')

    const withKeys = getTtsFallbackChain({
      ttsProvider: 'local',
      VITE_OPENAI_API_KEY: 'sk-test',
      VITE_GOOGLE_API_KEY: 'AIza-test',
    })
    expect(withKeys).toContain('openai')
    expect(withKeys).toContain('google')
  })

  it('falls back to openai for unknown provider values', () => {
    expect(normalizeTtsProvider(undefined)).toBe('openai')
    expect(normalizeTtsProvider('bogus')).toBe('openai')
    const chain = getTtsFallbackChain({ ttsProvider: 'bogus' })
    expect(chain[0]).toBe('openai')
  })

  it('keeps google first when configured', () => {
    const chain = getTtsFallbackChain({
      ttsProvider: 'google',
      VITE_GOOGLE_API_KEY: 'AIza-test',
    })
    expect(chain[0]).toBe('google')
    expect(chain.filter(provider => provider === 'google')).toHaveLength(1)
  })
})
