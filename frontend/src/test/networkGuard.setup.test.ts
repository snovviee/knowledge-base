import { describe, expect, it, vi } from 'vitest'
import { takeBlockedRequests } from './networkGuard'

// features/27_local_tests, spec question 4. src/test/setup.ts puts the network guard on the
// globals of every test file. vi.unstubAllGlobals(), which most test files call, brings back
// what was there before their stub: the guard. 192.0.2.1 is TEST-NET-1, so even a request that
// got out would reach no real host, and the signal ends a fetch after a second.
describe('the network guard in every test file (features/27_local_tests)', () => {
  it('AC-27 every test file runs with the network guard, also after vi.unstubAllGlobals', async () => {
    const blocked = new Error('Blocked a request to another host in a test: http://192.0.2.1/')
    await expect(fetch('http://192.0.2.1/', { signal: AbortSignal.timeout(1000) })).rejects.toThrow(blocked)

    vi.stubGlobal('fetch', vi.fn())
    vi.unstubAllGlobals()
    await expect(fetch('http://192.0.2.1/', { signal: AbortSignal.timeout(1000) })).rejects.toThrow(blocked)

    expect(() => new XMLHttpRequest().open('GET', 'http://192.0.2.1/')).toThrow(blocked)
    expect(() => new WebSocket('ws://192.0.2.1/')).toThrow(
      new Error('Blocked a request to another host in a test: ws://192.0.2.1/'),
    )

    // These refusals were made on purpose: taking the record keeps them from failing this test.
    expect(takeBlockedRequests()).toEqual([
      'http://192.0.2.1/',
      'http://192.0.2.1/',
      'http://192.0.2.1/',
      'ws://192.0.2.1/',
    ])
  })
})
