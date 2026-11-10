import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { FakeWebSocket } from './fakeWebSocket'
import { installNetworkGuard } from './networkGuard'
import { matchMedia, resetWindowWidth } from './screen'

// No test opens a real WebSocket: the app's connection gets a fake that never opens on its
// own (features/22_websocket_auth). It is assigned, not stubbed with vi.stubGlobal, because
// most test files call vi.unstubAllGlobals(), which would remove a stubbed global.
globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket

// No test reaches another host (features/27_local_tests): fetch, XMLHttpRequest, and the
// WebSocket above refuse it, and the test that tried fails when it ends. The guards are
// assigned too, so vi.unstubAllGlobals() brings them back, and a test's own fetch stub sits
// on top of them.
installNetworkGuard({ target: globalThis, afterEach })

// jsdom has no matchMedia: every test gets a stand-in that answers for a window 1280 px wide,
// unless the test sets another width with setWindowWidth (features/25_responsive_layout). It is
// assigned, as WebSocket is, so vi.unstubAllGlobals() keeps it.
window.matchMedia = matchMedia
resetWindowWidth()

// Vitest globals are off, so Testing Library cannot register its cleanup itself.
afterEach(() => {
  cleanup()
  FakeWebSocket.instances = []
  resetWindowWidth()
})
