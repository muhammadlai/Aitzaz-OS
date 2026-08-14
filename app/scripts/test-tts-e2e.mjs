#!/usr/bin/env node
/**
 * Real end-to-end test of the Aitzaz AI Pro voice pipeline (cloud path).
 *
 * Chain under test (same SDK + parameters as the renderer):
 *   chat completion (AI response) -> ttsStream-equivalent TTS call
 *   (gpt-4o-mini-tts, voice + speed from settings) -> MP3 bytes on disk
 *   -> byte-level validation (MPEG frame / ID3 header, size, duration est.)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/test-tts-e2e.mjs [voice] [speed]
 *
 * This is NOT a mock: it hits the real OpenAI API and validates the real
 * audio bytes that the Electron <audio> element would play.
 */
import OpenAI from 'openai'
import fs from 'node:fs'
import path from 'node:path'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY is not set.')
  process.exit(2)
}

const voice = process.argv[2] || 'nova'
const speed = Number(process.argv[3] || 1.0)
const keyMasked = `${'•'.repeat(12)}${apiKey.slice(-4)}`

const openai = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 })

async function main() {
  console.log(`[E2E] OpenAI key: ${keyMasked}`)

  // 1) Real AI chat response (same responses API family the app uses).
  console.log('[E2E] Step 1: requesting AI chat completion...')
  const chat = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Reply with one short greeting sentence as Aitzaz, a desktop AI assistant.' },
    ],
    max_tokens: 80,
  })
  const aiText = chat.choices[0]?.message?.content?.trim()
  if (!aiText) {
    console.error('ERROR: chat completion returned no text.')
    process.exit(1)
  }
  console.log(`[E2E] AI response: "${aiText}"`)

  // 2) Real TTS synthesis of that exact response (same call the app makes in
  //    apiService.openAITTS: gpt-4o-mini-tts + voice + speed + mp3).
  console.log(`[E2E] Step 2: synthesizing speech (voice=${voice}, speed=${speed})...`)
  const ttsResponse = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: aiText,
    response_format: 'mp3',
    speed: Math.min(2.0, Math.max(0.5, speed)),
  })

  const arrayBuffer = await ttsResponse.arrayBuffer()
  const bytes = Buffer.from(arrayBuffer)

  const outFile = path.join(process.cwd(), 'e2e-tts-output.mp3')
  fs.writeFileSync(outFile, bytes)
  console.log(`[E2E] Step 3: wrote ${bytes.length} bytes -> ${outFile}`)

  // 3) Byte-level validation of the audio the app would hand to <audio>.
  if (bytes.length < 10_000) {
    console.error(`ERROR: audio too small (${bytes.length} bytes) — synthesis likely failed.`)
    process.exit(1)
  }

  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 // "ID3"
  let frameSync = false
  for (let i = 0; i < Math.min(bytes.length - 1, 4096); i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      frameSync = true
      break
    }
  }
  if (!isId3 && !frameSync) {
    console.error('ERROR: output is not an MP3 stream (no ID3 tag, no MPEG frame sync).')
    process.exit(1)
  }
  console.log(`[E2E] MP3 validation OK (ID3=${isId3}, frame-sync=${frameSync}).`)

  // Rough duration estimate from file size at ~32kbps (gpt-4o-mini-tts mp3).
  const estSeconds = (bytes.length * 8) / 32000
  console.log(`[E2E] Estimated audio duration: ~${estSeconds.toFixed(1)}s`)

  // Non-silence heuristic: real speech mp3s at this bitrate land well above
  // the tiny-file range; enforced by the 10KB minimum plus duration check.
  if (estSeconds < 0.5) {
    console.error('ERROR: estimated duration too short to be speech.')
    process.exit(1)
  }

  console.log('[E2E] RESULT: AI response -> TTS -> valid MP3 audio bytes: PASS')
  console.log('[E2E] NOTE: speaker playback must be verified on a machine with')
  console.log('            audio output (this CI/sandbox check stops at audio bytes).')
}

main().catch(err => {
  const message = String(err?.message || err)
    .replace(new RegExp(apiKey, 'g'), '[REDACTED]')
  console.error('[E2E] FAILED:', message)
  process.exit(1)
})
