import { describe, expect, it } from 'vitest'
import { float32ArrayToWav } from '../utils/audioProcess'

/**
 * Validates the WAV container produced by the app's audio pipeline against
 * the canonical RIFF/WAVE PCM16 spec. Both consumers of this format — the
 * STT upload path (OpenAI/Groq/local Whisper) and any audio decoder — rely
 * on these exact header fields, so this guards the mic->transcription chain.
 */
describe('WAV pipeline format contract', () => {
  function makeSamples(n: number, freq = 440, sampleRate = 16000): Float32Array {
    const samples = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5
    }
    return samples
  }

  it('produces a spec-compliant RIFF/WAVE PCM16 mono header', () => {
    const sampleRate = 16000
    const samples = makeSamples(1600, 440, sampleRate)
    const view = new DataView(float32ArrayToWav(samples, sampleRate))

    const readStr = (offset: number, len: number) =>
      Array.from({ length: len }, (_, i) =>
        String.fromCharCode(view.getUint8(offset + i))
      ).join('')

    expect(readStr(0, 4)).toBe('RIFF')
    expect(readStr(8, 4)).toBe('WAVE')
    expect(readStr(12, 4)).toBe('fmt ')
    expect(readStr(36, 4)).toBe('data')

    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2) // RIFF size
    expect(view.getUint32(16, true)).toBe(16) // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1) // PCM format
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(sampleRate)
    expect(view.getUint32(28, true)).toBe(sampleRate * 2) // byte rate
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(view.getUint32(40, true)).toBe(samples.length * 2) // data size
  })

  it('round-trips PCM16 samples within quantization tolerance', () => {
    const sampleRate = 22050
    const samples = makeSamples(882, 330, sampleRate)
    const view = new DataView(float32ArrayToWav(samples, sampleRate))

    for (let i = 0; i < samples.length; i += 37) {
      const pcm = view.getInt16(44 + i * 2, true)
      const recovered = pcm >= 0 ? pcm / 0x7fff : pcm / 0x8000
      expect(Math.abs(recovered - samples[i])).toBeLessThan(1 / 0x7fff + 1e-6)
    }
  })

  it('clamps out-of-range samples instead of overflowing PCM16', () => {
    const samples = new Float32Array([2.0, -2.0, 0.25])
    const view = new DataView(float32ArrayToWav(samples, 8000))
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
    expect(view.getInt16(48, true)).toBeGreaterThan(0)
  })

  it('matches the duration math used by STT length guards', () => {
    const sampleRate = 16000
    const seconds = 2
    const samples = makeSamples(sampleRate * seconds)
    const buffer = float32ArrayToWav(samples, sampleRate)
    const view = new DataView(buffer)

    // Same computation the transcription path uses to reject too-short clips.
    const bytesPerSecond = view.getUint32(28, true)
    const dataSize = view.getUint32(40, true)
    expect(dataSize / bytesPerSecond).toBe(seconds)
    expect(buffer.byteLength).toBe(44 + sampleRate * seconds * 2)
  })
})
