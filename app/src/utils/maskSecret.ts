/**
 * Utilities for displaying secret values (API keys, tokens) safely.
 *
 * The full value is never rendered in the UI or logs — only a short masked
 * representation that lets the user recognize which key is configured.
 */

export function maskSecret(secret: string | null | undefined): string {
  if (!secret) {
    return ''
  }
  const trimmed = String(secret).trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.length <= 4) {
    return '••••'
  }
  const lastFour = trimmed.slice(-4)
  return `${'•'.repeat(12)}${lastFour}`
}

export function hasSecret(secret: string | null | undefined): boolean {
  return Boolean(secret && String(secret).trim().length > 0)
}

/**
 * Redact secret-looking values from arbitrary text before it reaches logs.
 * Matches common provider key shapes (sk-..., gsk_..., AIza..., bearer
 * tokens in headers, api_key/key query params).
 */
export function redactSecretsFromText(text: string): string {
  if (!text) {
    return text
  }
  return (
    String(text)
      // Authorization headers
      .replace(/(authorization:\s*(?:bearer\s+)?)[^\s"',}]+/gi, '$1[REDACTED]')
      // Query parameters (?key=..., &api_key=..., ?apiKey=...)
      .replace(
        /([?&](?:api[_-]?key|key|token|access_token|secret)=)[^&\s"']+/gi,
        '$1[REDACTED]'
      )
      // OpenAI-style keys
      .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-[REDACTED]')
      // Groq keys
      .replace(/\bgsk_[A-Za-z0-9]{16,}\b/g, 'gsk_[REDACTED]')
      // Google API keys
      .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, 'AIza[REDACTED]')
  )
}
