// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SecretKeyInput from '../components/common/SecretKeyInput.vue'

const SAVED_KEY = 'sk-live-abcdefghijklmnop9876'

describe('SecretKeyInput (masked API key UX)', () => {
  it('shows only a masked key when a saved key exists - never the raw value', () => {
    const wrapper = mount(SecretKeyInput, {
      props: {
        modelValue: SAVED_KEY,
        savedValue: SAVED_KEY,
        testLabel: 'Test OpenAI Key',
      },
    })

    const html = wrapper.html()
    // Masked representation is present.
    expect(html).toContain('9876')
    expect(html).toContain('•')
    // The full raw key must never appear in the rendered DOM.
    expect(html).not.toContain(SAVED_KEY)
    expect(html).not.toContain('abcdefghijklmnop')

    // Saved view shows the three required actions + status badge.
    expect(html).toContain('Test Connection')
    expect(html).toContain('Change API Key')
    expect(html).toContain('Remove API Key')
    expect(html).toContain('Saved securely')
    // No password input is rendered while in saved view.
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  })

  it('shows Connected status after a successful test', () => {
    const wrapper = mount(SecretKeyInput, {
      props: {
        modelValue: SAVED_KEY,
        savedValue: SAVED_KEY,
        testPassed: true,
      },
    })
    expect(wrapper.html()).toContain('Connected')
  })

  it('Change API Key clears the value and reveals a password input', async () => {
    const wrapper = mount(SecretKeyInput, {
      props: {
        modelValue: SAVED_KEY,
        savedValue: SAVED_KEY,
        testLabel: 'Test OpenAI Key',
      },
    })

    await wrapper
      .findAll('button')
      .find(b => b.text().includes('Change API Key'))!
      .trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]).toEqual([''])

    // Simulate the v-model round-trip: the parent applies the emitted value.
    await wrapper.setProps({ modelValue: '' })

    const input = wrapper.find('input[type="password"]')
    expect(input.exists()).toBe(true)
    // The input must not carry the old saved key.
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.html()).not.toContain(SAVED_KEY)
  })

  it('Remove API Key emits an empty value and the remove event', async () => {
    const wrapper = mount(SecretKeyInput, {
      props: {
        modelValue: SAVED_KEY,
        savedValue: SAVED_KEY,
      },
    })

    await wrapper
      .findAll('button')
      .find(b => b.text().includes('Remove API Key'))!
      .trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    const updates = wrapper.emitted('update:modelValue')!
    expect(updates[updates.length - 1]).toEqual([''])
  })

  it('renders a plain input for fresh installs (no saved key)', () => {
    const wrapper = mount(SecretKeyInput, {
      props: {
        modelValue: '',
        savedValue: '',
        testLabel: 'Test OpenAI Key',
      },
    })
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.html()).toContain('Test OpenAI Key')
    expect(wrapper.html()).not.toContain('Saved securely')
  })
})
