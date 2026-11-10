import { describe, expect, it, vi } from 'vitest'
import {
  guardFetch,
  guardWebSocket,
  guardXMLHttpRequest,
  installNetworkGuard,
  takeBlockedRequests,
} from './networkGuard'

// features/27_local_tests, spec question 4. No frontend test reaches another host: a request
// to one is refused and recorded, and never sent. These tests hand the guards fakes in place
// of the real fetch, XMLHttpRequest, and WebSocket. They read the record with
// takeBlockedRequests(), which clears it, so their own refusals do not fail them.

// Stand-ins for the browser's XMLHttpRequest and WebSocket, which record their calls.
function fakeClasses() {
  const opened: unknown[][] = []
  const constructed: unknown[][] = []
  class FakeXMLHttpRequest {
    open(...args: unknown[]) {
      opened.push(args)
    }
  }
  class FakeWebSocket {
    constructor(...args: unknown[]) {
      constructed.push(args)
    }
  }
  return {
    FakeXMLHttpRequest: FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
    FakeWebSocket: FakeWebSocket as unknown as typeof WebSocket,
    opened,
    constructed,
  }
}

describe('the network guard of the tests (features/27_local_tests)', () => {
  it('AC-27 a fetch to another host is refused and recorded, and nothing is sent', async () => {
    const response = new Response('ok')
    const realFetch = vi.fn<typeof fetch>().mockResolvedValue(response)
    const guardedFetch = guardFetch(realFetch)
    const otherHosts = [
      'https://accounts.google.com/o/oauth2/auth',
      'https://github.com/login/oauth/authorize',
      'http://192.0.2.1/',
    ]

    for (const url of otherHosts) {
      for (const input of [url, new URL(url), new Request(url)]) {
        await expect(guardedFetch(input)).rejects.toThrow(
          new Error(`Blocked a request to another host in a test: ${url}`),
        )
      }
    }
    expect(realFetch).not.toHaveBeenCalled()
    expect(takeBlockedRequests()).toEqual(otherHosts.flatMap((url) => [url, url, url]))

    // This machine, with a path read against the page's address.
    const init = { method: 'POST' }
    for (const url of ['/api/session', 'http://localhost:3000/api/csrf', 'http://127.0.0.1:3000/', 'http://[::1]/']) {
      await expect(guardedFetch(url, init)).resolves.toBe(response)
      expect(realFetch).toHaveBeenLastCalledWith(url, init)
    }
    expect(realFetch).toHaveBeenCalledTimes(4)
    expect(takeBlockedRequests()).toEqual([])
  })

  it('AC-27 an XMLHttpRequest or a WebSocket to another host is refused and recorded, and nothing is sent', () => {
    const { FakeXMLHttpRequest, FakeWebSocket, opened, constructed } = fakeClasses()
    const GuardedXMLHttpRequest = guardXMLHttpRequest(FakeXMLHttpRequest)
    const GuardedWebSocket = guardWebSocket(FakeWebSocket)

    expect(() => new GuardedXMLHttpRequest().open('GET', 'http://192.0.2.1/')).toThrow(
      new Error('Blocked a request to another host in a test: http://192.0.2.1/'),
    )
    expect(() => new GuardedWebSocket('wss://example.com/cable')).toThrow(
      new Error('Blocked a request to another host in a test: wss://example.com/cable'),
    )
    expect(opened).toEqual([])
    expect(constructed).toEqual([])
    expect(takeBlockedRequests()).toEqual(['http://192.0.2.1/', 'wss://example.com/cable'])

    // This machine.
    new GuardedXMLHttpRequest().open('GET', '/api/notes')
    const socket = new GuardedWebSocket('ws://localhost:3000/cable', ['actioncable-v1-json'])
    expect(opened).toEqual([['GET', '/api/notes']])
    expect(constructed).toEqual([['ws://localhost:3000/cable', ['actioncable-v1-json']]])
    expect(socket).toBeInstanceOf(FakeWebSocket)
    expect(takeBlockedRequests()).toEqual([])
  })

  it('AC-27 a test that reached for another host fails when it ends, even if its code caught the refusal', async () => {
    const realFetch = vi.fn<typeof fetch>()
    const { FakeXMLHttpRequest, FakeWebSocket, opened, constructed } = fakeClasses()
    const target = { fetch: realFetch, XMLHttpRequest: FakeXMLHttpRequest, WebSocket: FakeWebSocket }
    const hooks: (() => void)[] = []

    installNetworkGuard({ target, afterEach: (hook) => hooks.push(hook) })

    // Each of the three is replaced by its guard.
    await expect(target.fetch('http://192.0.2.1/')).rejects.toThrow('Blocked a request to another host in a test')
    expect(() => new target.XMLHttpRequest().open('GET', 'http://192.0.2.1/')).toThrow(
      'Blocked a request to another host in a test',
    )
    expect(() => new target.WebSocket('ws://192.0.2.1/')).toThrow('Blocked a request to another host in a test')
    expect([realFetch.mock.calls, opened, constructed]).toEqual([[], [], []])
    takeBlockedRequests()

    expect(hooks).toHaveLength(1)
    const [whenTestEnds] = hooks
    // A test that made no refused request passes.
    expect(whenTestEnds).not.toThrow()

    // The code under test catches the refusal, as the app's code does with a failed request.
    await target.fetch('http://192.0.2.1/').catch(() => undefined)
    expect(whenTestEnds).toThrow(new Error('A test tried to reach another host: http://192.0.2.1/'))
    // The record was cleared, so the next test does not fail for it.
    expect(whenTestEnds).not.toThrow()
  })
})
