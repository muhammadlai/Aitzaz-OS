import { watch, onUnmounted } from 'vue'
import { useGeneralStore } from '../stores/generalStore'
import { useSettingsStore } from '../stores/settingsStore'
import { storeToRefs } from 'pinia'
import { ttsStream } from '../services/apiService'
import type { ChatMessage } from '../types/chat'

/**
 * The playback queue processor must exist exactly once per app instance: it
 * owns watchers that dequeue synthesized speech and drive the audio element.
 * Components that only need the control functions (pause/stop/replay) can
 * call this composable too without spawning a second processor.
 */
let playbackProcessorRegistered = false
let activeReplayAbortController: AbortController | null = null

function extractTextFromMessage(message: ChatMessage): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter(part => part.type === 'app_text' && part.text)
      .map(part => part.text)
      .join(' ')
  }
  return ''
}

export function useAudioPlayback() {
  const generalStore = useGeneralStore()
  const settingsStore = useSettingsStore()
  const {
    audioState,
    audioPlayer,
    audioQueue,
    isTTSEnabled,
    isRecordingRequested,
    chatHistory,
    isSpeechPaused,
  } = storeToRefs(generalStore)
  const { setAudioState } = generalStore

  let isProcessingQueue = false
  const ownsProcessor = !playbackProcessorRegistered
  if (ownsProcessor) {
    playbackProcessorRegistered = true
  }

  const applyVolumeToPlayer = () => {
    if (!audioPlayer.value) return
    const volume = Number(settingsStore.settings.ttsVolume)
    audioPlayer.value.volume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 1
  }

  const stopPlaybackAndClearQueue = () => {
    console.log('[Playback Control] Stopping playback and clearing queue.')
    activeReplayAbortController?.abort()
    activeReplayAbortController = null
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      if (audioPlayer.value.src && audioPlayer.value.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPlayer.value.src)
      }
      audioPlayer.value.src = ''
      audioPlayer.value.onended = null
      audioPlayer.value.onerror = null
    }
    audioQueue.value = []
    isProcessingQueue = false
    isSpeechPaused.value = false
  }

  const playNextAudio = async () => {
    if (isProcessingQueue) {
      console.log('[Playback] playNextAudio skipped: Already processing queue.')
      return
    }
    if (audioState.value !== 'SPEAKING' || !isTTSEnabled.value) {
      console.log(
        `[Playback] playNextAudio skipped: State is ${audioState.value} or TTS disabled.`
      )
      isProcessingQueue = false
      return
    }
    if (audioQueue.value.length === 0) {
      console.log('[Playback] Queue empty, transitioning state.')
      isSpeechPaused.value = false
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
      isProcessingQueue = false
      return
    }
    if (!audioPlayer.value) {
      console.error('[Playback] Audio player element not available.')
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
      isProcessingQueue = false
      return
    }

    isProcessingQueue = true
    const audioResponse = audioQueue.value.shift()
    console.log(
      `[Playback] Processing next audio chunk. Queue size: ${audioQueue.value.length}`
    )

    if (!audioResponse) {
      console.warn('[Playback] Dequeued undefined audio response.')
      isProcessingQueue = false
      playNextAudio()
      return
    }

    let audioUrl: string | null = null
    try {
      const blob = await audioResponse.blob()
      audioUrl = URL.createObjectURL(blob)

      if (audioPlayer.value.src) {
        URL.revokeObjectURL(audioPlayer.value.src)
      }
      audioPlayer.value.src = audioUrl

      audioPlayer.value.onended = null
      audioPlayer.value.onerror = null

      const currentAudioUrl = audioUrl
      audioPlayer.value.onended = () => {
        console.log('[Playback] Audio chunk finished playing.')
        URL.revokeObjectURL(currentAudioUrl)
        isProcessingQueue = false
        isSpeechPaused.value = false
        requestAnimationFrame(playNextAudio)
      }

      audioPlayer.value.onerror = e => {
        console.error(
          '[Playback] Error playing audio:',
          e,
          audioPlayer.value?.error
        )
        URL.revokeObjectURL(currentAudioUrl)
        isProcessingQueue = false
        isSpeechPaused.value = false
        requestAnimationFrame(playNextAudio)
      }

      applyVolumeToPlayer()
      await audioPlayer.value.play()
      isSpeechPaused.value = false
      console.log('[Playback] Audio play() called.')
    } catch (error: any) {
      console.error('[Playback] Error setting up or playing audio:', error)
      isProcessingQueue = false
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl)
      }
      requestAnimationFrame(playNextAudio)
    }
  }

  const initiatePlaybackIfNeeded = () => {
    if (
      audioState.value !== 'SPEAKING' &&
      !isProcessingQueue &&
      audioQueue.value.length > 0 &&
      isTTSEnabled.value
    ) {
      console.log(
        '[Playback Initiator] Queue has items, setting state to SPEAKING.'
      )
      setAudioState('SPEAKING')
    }
  }

  if (ownsProcessor) {
    watch(audioState, (newState, oldState) => {
      console.log(
        `[Playback Watcher] Audio state changed from ${oldState} to ${newState}`
      )
      if (newState === 'SPEAKING') {
        if (!isProcessingQueue && audioQueue.value.length > 0) {
          console.log(
            '[Playback Watcher] State is SPEAKING, starting playback.'
          )
          playNextAudio()
        } else {
          console.log(
            '[Playback Watcher] State is SPEAKING, but already processing or queue empty.'
          )
        }
      } else if (oldState === 'SPEAKING') {
        console.log(
          '[Playback Watcher] State left SPEAKING, stopping playback.'
        )
        stopPlaybackAndClearQueue()
      }
    })

    watch(
      () => audioQueue.value.length,
      (newLength, oldLength) => {
        if (newLength > oldLength) {
          initiatePlaybackIfNeeded()
        }
      }
    )

    watch(
      () => settingsStore.settings.ttsVolume,
      () => {
        applyVolumeToPlayer()
      }
    )
  }

  const persistVoiceResponseEnabled = (enabled: boolean) => {
    try {
      settingsStore.updateSetting('voiceResponseEnabled', enabled)
      void settingsStore.saveSettingsToFile()
    } catch (error) {
      console.warn('[Playback] Failed to persist voice response toggle:', error)
    }
  }

  const toggleTTSPreference = () => {
    const newState = !isTTSEnabled.value
    isTTSEnabled.value = newState
    console.log(`TTS preference toggled via UI: ${newState}`)
    persistVoiceResponseEnabled(newState)

    if (!newState) {
      if (audioState.value === 'SPEAKING') {
        console.log('TTS disabled while speaking - stopping playback.')
        generalStore.stopPlaybackAndClearQueue()
        stopPlaybackAndClearQueue()
        setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
      } else if (audioQueue.value.length > 0) {
        console.log('TTS disabled - clearing pending audio queue.')
        audioQueue.value = []
      }
    }
  }

  const setTTSEnabled = (enabled: boolean) => {
    if (isTTSEnabled.value === enabled) return
    isTTSEnabled.value = enabled
    persistVoiceResponseEnabled(enabled)
  }

  const pauseOrResumePlayback = () => {
    if (!audioPlayer.value) return
    if (audioState.value !== 'SPEAKING') return

    if (isSpeechPaused.value) {
      audioPlayer.value
        .play()
        .then(() => {
          isSpeechPaused.value = false
        })
        .catch(error => {
          console.warn('[Playback] Resume failed:', error)
        })
    } else {
      audioPlayer.value.pause()
      isSpeechPaused.value = true
    }
  }

  const stopSpeechOutput = () => {
    console.log('[Playback Control] User stopped speech output.')
    generalStore.stopPlaybackAndClearQueue()
    stopPlaybackAndClearQueue()
    if (audioState.value === 'SPEAKING') {
      setAudioState(isRecordingRequested.value ? 'LISTENING' : 'IDLE')
    }
  }

  const getLastAssistantText = (): string => {
    for (const message of chatHistory.value) {
      if (message.role !== 'assistant') continue
      const text = extractTextFromMessage(message).trim()
      if (text) {
        return text
      }
    }
    return ''
  }

  const replayLastSpeech = async () => {
    const text = getLastAssistantText()
    if (!text) {
      console.log('[Playback] Nothing to replay yet.')
      return
    }

    // An explicit replay is a user request to hear the assistant even if
    // automatic voice responses are switched off.
    if (!isTTSEnabled.value) {
      setTTSEnabled(true)
    }

    generalStore.stopPlaybackAndClearQueue()
    stopPlaybackAndClearQueue()

    activeReplayAbortController?.abort()
    const abortController = new AbortController()
    activeReplayAbortController = abortController

    try {
      const response = await ttsStream(text, abortController.signal)
      if (abortController.signal.aborted) return
      const enqueued = generalStore.queueAudioForPlayback(response)
      if (enqueued && audioState.value !== 'SPEAKING') {
        setAudioState('SPEAKING')
      }
    } catch (error: any) {
      console.error('[Playback] Replay failed:', error)
      generalStore.statusMessage = 'Error: Voice replay failed'
    }
  }

  if (ownsProcessor) {
    onUnmounted(() => {
      console.log('[Audio Playback] Processor owner unmounted, cleaning up.')
      playbackProcessorRegistered = false
      stopPlaybackAndClearQueue()
    })
  }

  return {
    isSpeechPaused,
    toggleTTSPreference,
    setTTSEnabled,
    pauseOrResumePlayback,
    stopSpeechOutput,
    replayLastSpeech,
    applyVolumeToPlayer,
  }
}
