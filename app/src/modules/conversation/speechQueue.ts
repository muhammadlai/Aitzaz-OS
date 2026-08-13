import type { AudioState } from '../../stores/generalStore'
import { isExpectedAbortError } from '../../utils/isAbortError'

export interface SpeechQueueDependencies {
  createAbortController(): AbortController
  setTtsAbortController(controller: AbortController | null): void
  ttsStream(text: string, signal: AbortSignal): Promise<Response>
  queueAudioForPlayback(response: Response): boolean
  getAudioState(): AudioState
  setAudioState(state: AudioState): void
  logError(...args: any[]): void
}

export interface SpeechQueueManager {
  enqueueSpeech(text: string): Promise<void>
}

export function createSpeechQueueManager(
  dependencies: SpeechQueueDependencies
): SpeechQueueManager {
  return {
    async enqueueSpeech(text: string): Promise<void> {
      if (!text.trim()) return

      const abortController = dependencies.createAbortController()
      dependencies.setTtsAbortController(abortController)

      try {
        const ttsResponse = await dependencies.ttsStream(
          text,
          abortController.signal
        )

        // A provider may resolve a request after AbortController.abort() has
        // been called. Never let that stale response restart playback after a
        // barge-in or an explicit TTS cancellation.
        if (abortController.signal.aborted) {
          return
        }

        const enqueued = dependencies.queueAudioForPlayback(ttsResponse)
        if (enqueued && dependencies.getAudioState() !== 'SPEAKING') {
          dependencies.setAudioState('SPEAKING')
        }
      } catch (error: any) {
        if (abortController.signal.aborted || isExpectedAbortError(error)) {
          return
        }
        dependencies.logError('TTS stream creation failed:', error)
      }
    },
  }
}
