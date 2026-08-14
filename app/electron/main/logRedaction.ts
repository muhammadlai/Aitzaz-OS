/**
 * Redaction helpers for main-process logging. API keys and bearer tokens
 * must never reach log files, even accidentally via URLs or error messages.
 */
export function redactSensitiveText(text: string): string {
  if (!text) {
    return text
  }
  return String(text)
    .replace(/(authorization:\s*(?:bearer\s+)?)[^\s"',}]+/gi, '$1[REDACTED]')
    .replace(
      /([?&](?:api[_-]?key|key|token|access_token|secret)=)[^&\s"']+/gi,
      '$1[REDACTED]'
    )
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-[REDACTED]')
    .replace(/\bgsk_[A-Za-z0-9]{16,}\b/g, 'gsk_[REDACTED]')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, 'AIza[REDACTED]')
}

export function redactErrorForLog(error: unknown): string {
  try {
    const anyError = error as any
    const message = anyError?.message || String(error)
    const url = anyError?.config?.url || anyError?.url
    if (url) {
      return redactSensitiveText(`${message} (${url})`)
    }
    return redactSensitiveText(message)
  } catch {
    return '[unserializable error]'
  }
}
