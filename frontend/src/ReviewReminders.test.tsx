import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/22_websocket_auth. The main layout opens the app's WebSocket, which uses the
// browser's sign-in, and a refusal shows the sign-in screen as a 401 does. These tests
// replace fetch, and src/test/setup.ts replaces WebSocket, so nothing leaves the test
// (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = () => Response | Promise<Response>

// Answers like the backend, by method and path: a signed-in user with empty lists. A test
// replaces any answer with its own.
function stubBackend(routes: Record<string, Handler> = {}) {
  const answers: Record<string, Handler> = {
    'GET /api/session': () => json(200, { user: { id: 1, display_name: 'Ada Lovelace' } }),
    'GET /api/collections': () => json(200, { collections: [] }),
    'GET /api/tags': () => json(200, { tags: [] }),
    'GET /api/notes': () => json(200, { notes: [] }),
    'GET /api/csrf': () => json(200, { token: 'csrf-token' }),
    ...routes,
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    if (!answer) throw new Error(`unexpected request ${init?.method ?? 'GET'} ${url}`)
    return answer()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const sockets = () => FakeWebSocket.instances

// Waits for the main layout, then for the connection it opens: the newest socket, still
// connecting. The layout opens it in an effect, which can run after the layout shows on a
// loaded machine (features/27_local_tests). Returns that connection.
async function mainLayoutConnection(): Promise<FakeWebSocket> {
  await screen.findByRole('button', { name: 'Log out' })
  return waitFor(() => {
    const socket = sockets().at(-1)
    expect(socket?.readyState).toBe(FakeWebSocket.CONNECTING)
    return socket as FakeWebSocket
  })
}

// Waits for the main layout's connection, then opens it and confirms the subscription, as
// the server does for a live sign-in. Returns that connection.
async function confirmedConnection(): Promise<FakeWebSocket> {
  const socket = await mainLayoutConnection()
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: '{"channel":"ReviewRemindersChannel"}', type: 'confirm_subscription' })
  })
  return socket
}

describe('the review reminders connection (features/22_websocket_auth)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-22 the main layout opens a connection to /cable and subscribes to the reminders after the welcome', async () => {
    // The loading screen opens none.
    stubBackend({ 'GET /api/session': () => new Promise<Response>(() => {}) })
    const loading = render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(sockets()).toHaveLength(0)
    loading.unmount()

    // The sign-in screen opens none.
    stubBackend({ 'GET /api/session': () => json(401, { error: 'unauthenticated' }) })
    const signedOut = render(<App />)
    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(sockets()).toHaveLength(0)
    signedOut.unmount()

    stubBackend()
    render(<App />)
    await mainLayoutConnection()

    expect(sockets()).toHaveLength(1)
    const socket = sockets()[0]
    expect(socket.url).toBe(`ws://${window.location.host}/cable`)
    expect(socket.protocols).toEqual(['actioncable-v1-json'])

    // Nothing is sent before the server's welcome.
    act(() => socket.open())
    expect(socket.sent).toEqual([])

    act(() => socket.receive({ type: 'welcome' }))
    expect(socket.sent).toHaveLength(1)
    // The subscription carries the channel's name only: no token and no user id.
    expect(JSON.parse(socket.sent[0])).toEqual({
      command: 'subscribe',
      identifier: '{"channel":"ReviewRemindersChannel"}',
    })
    expect(sockets()).toHaveLength(1)
  })

  it('AC-22 the app keeps one connection while the main layout shows and closes it when the sign-in screen shows', async () => {
    // The first logout is refused, so the main layout re-renders with its alert. The second
    // one signs out.
    const logouts = [json(403, { error: 'invalid_csrf_token' }), new Response(null, { status: 204 })]
    stubBackend({ 'DELETE /api/session': () => logouts.shift()! })
    const user = userEvent.setup()

    const first = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log out. Try again.')
    expect(sockets()).toHaveLength(1)
    expect(sockets()[0].closedByApp).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(sockets()).toHaveLength(1)
    // The panel closes the connection in its effect's cleanup, which a loaded machine can run
    // after the sign-in screen shows (features/21_data_privacy, Deviations).
    await waitFor(() => expect(sockets()[0].closedByApp).toBe(true))
    first.unmount()

    // A list answered 401 shows the sign-in screen, and the connection closes with it.
    stubBackend({ 'GET /api/notes': () => json(401, { error: 'unauthenticated' }) })
    render(<App />)
    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(sockets()).toHaveLength(2)
    await waitFor(() => expect(sockets()[1].closedByApp).toBe(true))
  })

  it('AC-22 a refused connection shows the sign-in screen with no message, and the app does not connect again', async () => {
    stubBackend()
    render(<App />)
    const socket = await mainLayoutConnection()

    // The test owns the clock from here, so a retry would show when the clock moves on.
    vi.useFakeTimers()
    try {
      // The server refuses the connection: the refusal, then a close, and no welcome.
      act(() => {
        socket.open()
        socket.receive({ type: 'disconnect', reason: 'unauthorized', reconnect: false })
        socket.closeFromServer()
      })

      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(socket.sent).toEqual([])

      // Feature 20 retries a lost connection at most 30 seconds apart. A refusal is not retried.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      expect(sockets()).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('AC-22 a connection the server closes with reconnect false shows the sign-in screen with no message', async () => {
    // A logout in another tab of this browser closes this tab's connection.
    stubBackend()
    const first = render(<App />)
    const loggedOutElsewhere = await confirmedConnection()
    act(() => {
      loggedOutElsewhere.receive({ type: 'disconnect', reason: 'remote', reconnect: false })
      loggedOutElsewhere.closeFromServer()
    })
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    first.unmount()

    // A sign-in deleted on the server: the connection is closed before its next message.
    stubBackend()
    render(<App />)
    const signInGone = await confirmedConnection()
    act(() => {
      signInGone.receive({ type: 'disconnect', reason: 'unauthorized', reconnect: false })
      signInGone.closeFromServer()
    })
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sockets()).toHaveLength(2)
  })

  it('AC-22 a connection lost without the refusal keeps the main layout', async () => {
    const mainLayoutShows = () => {
      expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
    }

    // The network fails: a close with no message. The retry and the offline state are feature 20's.
    stubBackend()
    const first = render(<App />)
    const lost = await confirmedConnection()
    act(() => lost.closeFromServer(1006))
    mainLayoutShows()
    first.unmount()

    // The server restarts: Action Cable tells the app to reconnect.
    stubBackend()
    const second = render(<App />)
    const restarted = await confirmedConnection()
    act(() => {
      restarted.receive({ type: 'disconnect', reason: 'server_restart', reconnect: true })
      restarted.closeFromServer()
    })
    mainLayoutShows()
    second.unmount()

    // The connection cannot be opened at all.
    stubBackend()
    render(<App />)
    const unopened = await mainLayoutConnection()
    act(() => unopened.failToOpen())
    mainLayoutShows()
  })
})
