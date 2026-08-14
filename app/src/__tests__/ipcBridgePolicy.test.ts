import { describe, expect, it } from 'vitest'
import {
  isAllowedEventChannel,
  isAllowedInvokeChannel,
  isAllowedSendChannel,
} from '../../electron/preload/ipcBridgePolicy'

describe('renderer IPC bridge policy', () => {
  it('allows only known renderer invoke and send channels', () => {
    expect(isAllowedInvokeChannel('memory:get')).toBe(true)
    expect(isAllowedInvokeChannel('unknown:channel')).toBe(false)
    expect(isAllowedInvokeChannel('desktop:listDirectory')).toBe(true)
    expect(isAllowedInvokeChannel('desktop:executeCommand')).toBe(true)
    expect(isAllowedSendChannel('restart-and-install-update')).toBe(true)
    expect(isAllowedSendChannel('desktop:executeCommand')).toBe(false)
  })

  it('exposes the account/session IPC surface', () => {
    expect(isAllowedInvokeChannel('auth:sign-up')).toBe(true)
    expect(isAllowedInvokeChannel('auth:login')).toBe(true)
    expect(isAllowedInvokeChannel('auth:logout')).toBe(true)
    expect(isAllowedInvokeChannel('auth:session')).toBe(true)
    expect(isAllowedEventChannel('auth:session-changed')).toBe(true)
    expect(isAllowedInvokeChannel('auth:delete-account')).toBe(false)
  })

  it('allows stream event ids without allowing arbitrary event channels', () => {
    expect(isAllowedEventChannel('codex:stream:event:request-123')).toBe(true)
    expect(
      isAllowedEventChannel('http:stream:event:renderer-http-stream-1-a_b')
    ).toBe(true)
    expect(isAllowedEventChannel('http:stream:event:../../settings:load')).toBe(
      false
    )
    expect(isAllowedEventChannel('unknown:event')).toBe(false)
  })
})
