<template>
  <div
    v-if="visible"
    class="voice-controls absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-sm shadow-lg"
    :style="{ bottom: isMinimized ? '64px' : '110px' }"
  >
    <!-- Play / Pause -->
    <button
      class="btn btn-circle btn-xs bg-white/10 border-0 hover:bg-white/25 text-white tooltip"
      :aria-label="isSpeechPaused ? 'Resume speech' : 'Pause speech'"
      :data-tip="isSpeechPaused ? 'Resume' : 'Pause'"
      @click="pauseOrResumePlayback"
    >
      <svg
        v-if="isSpeechPaused"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-3.5 h-3.5"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-3.5 h-3.5"
      >
        <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
      </svg>
    </button>

    <!-- Stop -->
    <button
      class="btn btn-circle btn-xs bg-white/10 border-0 hover:bg-white/25 text-white tooltip"
      aria-label="Stop speech"
      data-tip="Stop"
      @click="stopSpeechOutput"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-3.5 h-3.5"
      >
        <path d="M6 6h12v12H6z" />
      </svg>
    </button>

    <!-- Replay -->
    <button
      class="btn btn-circle btn-xs bg-white/10 border-0 hover:bg-white/25 text-white tooltip"
      aria-label="Replay last response"
      data-tip="Replay"
      @click="replayLastSpeech"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-3.5 h-3.5"
      >
        <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGeneralStore } from '../stores/generalStore'
import { useAudioPlayback } from '../composables/useAudioPlayback'

const generalStore = useGeneralStore()
const { audioState, audioQueue, isMinimized, isSpeechPaused } =
  storeToRefs(generalStore)

const { pauseOrResumePlayback, stopSpeechOutput, replayLastSpeech } =
  useAudioPlayback()

const visible = computed(
  () => audioState.value === 'SPEAKING' || isSpeechPaused.value || audioQueue.value.length > 0
)
</script>
