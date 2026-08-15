import { describe, expect, it } from 'vitest'
import {
  hasSecret,
  maskSecret,
  redactSecretsFromText,
} from '../utils/maskSecret'

describe('maskSecret', () => {
  it('masks all but the last four characters', () => {
    const masked = maskSecret('sk-1234567890abcdef1234')
    expect(masked.endsWith('1234')).toBe(true)
    expect(masked).not.toContain('1234567890abcdef')
    expect(masked).toContain('•')
  })

  it('never reveals short secrets', () => {
    expect(maskSecret('abcd')).toBe('••••')
    expect(maskSecret('ab')).toBe('••••')
  })

  it('handles empty values', () => {
    expect(maskSecret('')).toBe('')
    expect(maskSecret(null)).toBe('')
    expect(maskSecret(undefined)).toBe('')
  })

  it('detects presence of secrets', () => {
    expect(hasSecret('sk-abc')).toBe(true)
    expect(hasSecret('   ')).toBe(false)
    expect(hasSecret('')).toBe(false)
    expect(hasSecret(null)).toBe(false)
  })
})

describe('redactSecretsFromText', () => {
  it('redacts OpenAI-style keys', () => {
    const output = redactSecretsFromText(
      'failed with key sk-AbCdEfGh1234567890xyz for user'
    )
    expect(output).not.toContain('sk-AbCdEfGh1234567890xyz')
    expect(output).toContain('sk-[REDACTED]')
  })

  it('redacts API keys in query strings and auth headers', () => {
    const url =
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyA1234567890abcdefghij'
    expect(redactSecretsFromText(url)).toContain('key=[REDACTED]')
    expect(redactSecretsFromText(url)).not.toContain(
      'AIzaSyA1234567890abcdefghij'
    )

    const header = 'Authorization: Bearer gsk_ABCDEFGHIJKLMNOP1234'
    const redacted = redactSecretsFromText(header)
    expect(redacted).toContain('[REDACTED]')
    expect(redacted).not.toContain('gsk_ABCDEFGHIJKLMNOP1234')
  })

  it('leaves ordinary text untouched', () => {
    const text = 'TTS provider "local" failed: service unavailable'
    expect(redactSecretsFromText(text)).toBe(text)
  })
})
