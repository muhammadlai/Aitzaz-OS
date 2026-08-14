<template>
  <template
    v-if="showAuth || showOnboarding || showSettings || showOverlay"
  >
    <Overlay v-if="showOverlay" />
    <AuthScreen v-if="showAuth" />
    <OnboardingWizard v-if="showOnboarding" />
    <SettingsWindow v-if="showSettings" />
  </template>
  <Main v-else-if="!isBootstrapping" />
  <div
    role="alert"
    class="alert alert-vertical sm:alert-horizontal update-notification"
    v-if="updateAvailable"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      class="stroke-info h-6 w-6 shrink-0"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      ></path>
    </svg>
    <span>A new version {{ updateInfo.version }} of Aitzaz AI Pro is available!</span>
    <div class="flex items-center">
      <button class="btn btn-sm mr-2" @click="updateAvailable = false">
        Ignore
      </button>
      <button
        class="btn btn-sm btn-primary btn-active"
        @click="installUpdate()"
      >
        <template v-if="!generalStore.isMinimized">Install & Restart</template>
        <template v-else>Install</template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import Main from './components/Main.vue'
import Overlay from './components/Overlay.vue'
import AuthScreen from './components/auth/AuthScreen.vue'
import OnboardingWizard from './components/wizard/OnboardingWizard.vue'
import SettingsWindow from './components/SettingsWindow.vue'
import { useSettingsStore } from './stores/settingsStore'
import { useGeneralStore } from './stores/generalStore'
import { useConversationStore } from './stores/conversationStore'
import { useAuthStore } from './stores/authStore'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const route = useRoute()
const settingsStore = useSettingsStore()
const generalStore = useGeneralStore()
const conversationStore = useConversationStore()
const authStore = useAuthStore()

const showOverlay = computed(() => {
  return route.hash === '#overlay'
})

const showSettings = computed(() => {
  return route.hash === '#settings'
})

// While the persisted session and settings are being restored we keep the
// preload splash instead of flashing the assistant (or the login screen).
const isBootstrapping = computed(
  () =>
    authStore.isRestoring ||
    !settingsStore.initialLoadAttempted ||
    settingsStore.isLoading
)

const showAuth = computed(() => {
  if (
    isBootstrapping.value ||
    showSettings.value ||
    showOverlay.value
  ) {
    return false
  }
  return !authStore.isAuthenticated
})

const showOnboarding = computed(() => {
  if (isBootstrapping.value) {
    return false
  }
  if (!authStore.isAuthenticated) {
    return false
  }
  return route.hash !== '#settings' && route.hash !== '#overlay' && !settingsStore.settings.onboardingCompleted
})

const AUTH_WINDOW_SIZE = { width: 520, height: 700 }
const MAIN_WINDOW_SIZE = { width: 500, height: 500 }

watch(showAuth, isAuthVisible => {
  if (isAuthVisible) {
    window.electron?.resize?.(AUTH_WINDOW_SIZE)
  } else if (authStore.isAuthenticated && !showOnboarding.value) {
    window.electron?.resize?.(MAIN_WINDOW_SIZE)
  }
})

const updateAvailable = ref(false)
const updateInfo = ref<any>({})

const installUpdate = () => {
  window.aliceIPC.send('restart-and-install-update')
}

const handleContextAction = async (data: any) => {
  try {
    const { prompt } = data

    await conversationStore.initialize()
    await conversationStore.chatWithContextAction(prompt)
  } catch (error) {
    // Handle context action error silently
  }
}

onMounted(async () => {
  await Promise.all([settingsStore.loadSettings(), authStore.restoreSession()])

  if (window.aliceIPC) {
    window.aliceIPC.on('update-downloaded', info => {
      updateInfo.value = info
      updateAvailable.value = true
    })

    window.aliceIPC.on('context-action', data => {
      handleContextAction(data)
    })

    window.aliceIPC.on('settings-changed', async data => {
      if (data.type === 'settings-saved' && data.success && data.validationComplete) {
        try {
          generalStore.statusMessage = 'Applying new settings...'
          const isProduction = await window.aliceIPC.invoke('app:is-packaged')

          if (isProduction) {
            await window.aliceIPC.invoke('app:restart')
          } else {
            window.location.reload()
          }
        } catch (error) {
          console.error('[App] Error handling settings change:', error)
          generalStore.statusMessage = 'Error: Failed to apply new settings'
        }
      } else if (data.type === 'settings-saved' && !data.success) {
        console.log('[App] Settings validation failed, not applying changes')
        generalStore.statusMessage = 'Settings validation failed'
      }
    })
  }
})

onUnmounted(() => {
  if (window.aliceIPC) {
    window.aliceIPC.removeAllListeners('update-downloaded')
    window.aliceIPC.removeAllListeners('context-action')
    window.aliceIPC.removeAllListeners('kokoro-tts-progress')
    window.aliceIPC.removeAllListeners('local-embedding-progress')
    window.aliceIPC.removeAllListeners('settings-changed')
  }
})
</script>

<style scoped lang="postcss">
.update-notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}
</style>
