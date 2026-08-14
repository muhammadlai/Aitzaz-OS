/**
 * Text-to-Speech provider routing with automatic fallback.
 *
 * The assistant must always be able to speak. A single provider failing
 * (missing permissions, rate limits, offline cloud, model not available for
 * the configured key) must not silence the assistant, so synthesis walks a
 * fallback chain:
 *
 *   configured provider -> local Piper (bundled Go backend, offline)
 *                       -> OpenAI (if a key is configured)
 *                       -> Google (if a key is configured)
 *
 * The chain computation is pure so it can be unit-tested.
 */

export type TtsProviderId = 'openai' | 'google' | 'local'

export interface TtsRouterConfig {
  ttsProvider?: string
  VITE_OPENAI_API_KEY?: string
  VITE_GOOGLE_API_KEY?: string
}

export function hasOpenAIKeyForTts(config: TtsRouterConfig): boolean {
  return Boolean(config.VITE_OPENAI_API_KEY?.trim())
}

export function hasGoogleKeyForTts(config: TtsRouterConfig): boolean {
  return Boolean(config.VITE_GOOGLE_API_KEY?.trim())
}

export function normalizeTtsProvider(
  provider: string | undefined
): TtsProviderId {
  if (provider === 'local' || provider === 'google' || provider === 'openai') {
    return provider
  }
  return 'openai'
}

export function getTtsFallbackChain(config: TtsRouterConfig): TtsProviderId[] {
  const chain: TtsProviderId[] = []

  const configured = normalizeTtsProvider(config.ttsProvider)
  chain.push(configured)

  // The bundled local Piper backend requires no API key and works offline,
  // which makes it the safest universal fallback.
  if (!chain.includes('local')) {
    chain.push('local')
  }

  if (hasOpenAIKeyForTts(config) && !chain.includes('openai')) {
    chain.push('openai')
  }

  if (hasGoogleKeyForTts(config) && !chain.includes('google')) {
    chain.push('google')
  }

  return chain
}

export const TTS_PROVIDER_LABELS: Record<TtsProviderId, string> = {
  openai: 'OpenAI TTS',
  google: 'Google TTS',
  local: 'Local Piper TTS',
}
