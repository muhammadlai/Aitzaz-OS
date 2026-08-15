<template>
  <div
    data-theme="dark"
    class="fixed inset-0 bg-gray-950 text-base-content flex items-center justify-center overflow-y-auto"
  >
    <div class="w-full max-w-md mx-auto p-6 my-6 relative">
      <!-- Window controls (frameless window) -->
      <button
        class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-base-content/60 transition-colors z-10"
        style="-webkit-app-region: no-drag"
        aria-label="Close Aitzaz AI Pro"
        @click="closeApp"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <!-- Brand header (drag handle for the frameless window) -->
      <div
        class="dragable flex flex-col items-center mb-6 text-center rounded-xl py-2"
      >
        <img :src="appLogo" alt="Aitzaz AI Pro" class="w-16 h-16 mb-3 rounded-2xl" />
        <h1 class="text-2xl font-semibold tracking-tight text-white">
          Aitzaz AI Pro
        </h1>
        <p class="text-sm text-base-content/60 mt-1">
          Your personal desktop AI companion
        </p>
      </div>

      <div
        class="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6"
      >
        <!-- Mode tabs -->
        <div class="tabs tabs-boxed bg-gray-800 mb-5">
          <button
            class="tab flex-1"
            :class="{ 'tab-active': mode === 'login' }"
            @click="switchMode('login')"
            type="button"
          >
            Sign In
          </button>
          <button
            class="tab flex-1"
            :class="{ 'tab-active': mode === 'signup' }"
            @click="switchMode('signup')"
            type="button"
          >
            Create Account
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="mode === 'signup'" class="form-control">
            <label class="label py-1" for="auth-name">
              <span class="label-text text-base-content/70">Name (optional)</span>
            </label>
            <input
              id="auth-name"
              v-model="form.name"
              type="text"
              autocomplete="name"
              placeholder="Your name"
              class="input input-bordered w-full bg-gray-800 focus:outline-none"
            />
          </div>

          <div class="form-control">
            <label class="label py-1" for="auth-email">
              <span class="label-text text-base-content/70">Email</span>
            </label>
            <input
              id="auth-email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              required
              placeholder="you@example.com"
              class="input input-bordered w-full bg-gray-800 focus:outline-none"
            />
          </div>

          <div class="form-control">
            <label class="label py-1" for="auth-password">
              <span class="label-text text-base-content/70">Password</span>
            </label>
            <input
              id="auth-password"
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
              required
              placeholder="••••••••"
              class="input input-bordered w-full bg-gray-800 focus:outline-none"
            />
            <p v-if="mode === 'signup'" class="text-xs text-base-content/50 mt-1">
              Use at least {{ minPasswordLength }} characters.
            </p>
          </div>

          <div v-if="mode === 'signup'" class="form-control">
            <label class="label py-1" for="auth-confirm">
              <span class="label-text text-base-content/70">Confirm password</span>
            </label>
            <input
              id="auth-confirm"
              v-model="form.confirm"
              type="password"
              autocomplete="new-password"
              required
              placeholder="••••••••"
              class="input input-bordered w-full bg-gray-800 focus:outline-none"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              v-model="form.remember"
              class="checkbox checkbox-sm checkbox-primary"
            />
            <span class="text-sm text-base-content/70">Keep me signed in</span>
          </label>

          <div
            v-if="localError"
            class="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2"
            role="alert"
          >
            {{ localError }}
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isBusy"
          >
            <span v-if="isBusy" class="loading loading-spinner loading-sm"></span>
            <template v-else>
              {{ mode === 'login' ? 'Sign In' : 'Create Account' }}
            </template>
          </button>
        </form>

        <p class="text-xs text-base-content/45 mt-4 text-center leading-relaxed">
          Your account is stored securely on this device. Passwords are
          encrypted and never leave your computer.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { appLogo } from '../../utils/assetsImport'

const authStore = useAuthStore()

const mode = ref<'login' | 'signup'>('login')
const minPasswordLength = 8

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirm: '',
  remember: true,
})

const isBusy = computed(() => authStore.isBusy)
const localError = ref<string | null>(null)

const closeApp = () => {
  try {
    if (typeof (window as any).electron?.closeApp === 'function') {
      ;(window as any).electron.closeApp()
      return
    }
    window.aliceIPC?.send?.('close-app')
  } catch (error) {
    console.error('Failed to close app from auth screen:', error)
  }
}

const switchMode = (next: 'login' | 'signup') => {
  if (mode.value === next) return
  mode.value = next
  localError.value = null
  authStore.clearError()
}

const validate = (): string | null => {
  const email = form.email.trim()
  if (!email) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Please enter a valid email address.'
  }
  if (!form.password) return 'Password is required.'
  if (mode.value === 'signup') {
    if (form.password.length < minPasswordLength) {
      return `Password must be at least ${minPasswordLength} characters long.`
    }
    if (form.password !== form.confirm) {
      return 'Passwords do not match.'
    }
  }
  return null
}

const handleSubmit = async () => {
  localError.value = null
  authStore.clearError()

  const validationError = validate()
  if (validationError) {
    localError.value = validationError
    return
  }

  let ok = false
  if (mode.value === 'login') {
    ok = await authStore.login(form.email.trim(), form.password, form.remember)
  } else {
    ok = await authStore.signUp(
      form.email.trim(),
      form.password,
      form.name.trim(),
      form.remember
    )
  }

  if (!ok) {
    localError.value = authStore.error || 'Authentication failed.'
    // Clear the password on failure so stale credentials are not retained.
    form.password = ''
    form.confirm = ''
  }
}
</script>
