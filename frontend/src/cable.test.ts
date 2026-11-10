import { describe, expect, it } from 'vitest'
import { cableUrl } from './cable'

// features/22_websocket_auth. The app's WebSocket is at /cable on the page's own address.
describe('the WebSocket address (features/22_websocket_auth)', () => {
  it("AC-22 the connection address is /cable on the page's host, with wss under https", () => {
    expect(cableUrl({ protocol: 'http:', host: 'localhost:3000' })).toBe('ws://localhost:3000/cable')
    expect(cableUrl({ protocol: 'https:', host: 'kb.example.com' })).toBe('wss://kb.example.com/cable')
    // With no argument, the address of the page itself.
    expect(cableUrl()).toBe(`ws://${window.location.host}/cable`)
  })
})
