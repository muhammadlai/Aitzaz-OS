<template>
  <div class="secret-key-input">
    <!-- Saved key: show masked value + actions, never the raw key -->
    <div
      v-if="showSavedView"
      class="rounded-lg border border-base-300 bg-base-200/50 p-3 space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-xs text-base-content/60">API Key</div>
          <div class="font-mono text-sm truncate" :title="'••••••••••••' + lastFour">
            {{ maskedValue }}
          </div>
        </div>
        <span class="badge badge-sm" :class="statusBadgeClass">
          {{ statusLabel }}
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-xs btn-secondary"
          :disabled="busy"
          @click="$emit('test')"
        >
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          Test Connection
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          @click="startEditing"
        >
          Change API Key
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost text-error"
          @click="removeKey"
        >
          Remove API Key
        </button>
      </div>
    </div>

    <!-- Editing / new key: password input + test button -->
    <div v-else class="space-y-2">
      <input
        type="password"
        :value="modelValue"
        :placeholder="placeholder"
        class="input input-bordered w-full focus:input-primary"
        :class="{ 'input-error': hasError }"
        autocomplete="new-password"
        @input="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-secondary flex-1"
          :disabled="busy || !String(modelValue || '').trim()"
          @click="$emit('test')"
        >
          <span v-if="busy" class="loading loading-spinner loading-xs mr-2"></span>
          {{ testLabel }}
        </button>
        <button
          v-if="hasSavedKey"
          type="button"
          class="btn btn-ghost"
          @click="cancelEditing"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { maskSecret } from '../../utils/maskSecret'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** The key that was already saved in secure storage (if any). */
    savedValue?: string
    placeholder?: string
    busy?: boolean
    testLabel?: string
    /** Tri-state test status for the saved view. */
    testPassed?: boolean | null
    hasError?: boolean
  }>(),
  {
    savedValue: '',
    placeholder: '',
    busy: false,
    testLabel: 'Test Connection',
    // Explicit null default: Vue casts absent boolean-typed props to false,
    // which would wrongly render "Check failed" for an untested saved key.
    testPassed: null,
    hasError: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  test: []
  remove: []
}>()

const editing = ref(false)

const hasSavedKey = computed(() => Boolean(props.savedValue?.trim()))

const showSavedView = computed(
  () => hasSavedKey.value && !editing.value && props.modelValue === props.savedValue
)

const maskedValue = computed(() => maskSecret(props.modelValue))

const lastFour = computed(() => {
  const value = String(props.modelValue || '').trim()
  return value.length >= 4 ? value.slice(-4) : value
})

const statusLabel = computed(() => {
  if (props.testPassed === true) return 'Connected'
  if (props.testPassed === false) return 'Check failed'
  return 'Saved securely'
})

const statusBadgeClass = computed(() => {
  if (props.testPassed === true) return 'badge-success'
  if (props.testPassed === false) return 'badge-error'
  return 'badge-ghost'
})

const startEditing = () => {
  editing.value = true
  // Never expose the saved key in the input; the user provides a new value.
  emit('update:modelValue', '')
}

const cancelEditing = () => {
  editing.value = false
  emit('update:modelValue', props.savedValue || '')
}

const removeKey = () => {
  editing.value = false
  emit('update:modelValue', '')
  emit('remove')
}

watch(hasSavedKey, value => {
  if (!value) {
    editing.value = false
  }
})
</script>
