import { afterEach, describe, expect, it, vi } from 'vitest'
import { openCable } from './cable'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/20_realtime_notifications. The app's connection hands each message of the
// reminders subscription to the panel, reports a lost connection, and connects again on its
// own (spec questions 4 and 8). src/test/setup.ts replaces WebSocket with a fake that never
// opens on its own: these tests drive it.
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

const sockets = () => FakeWebSocket.instances
const latestSocket = () => sockets()[sockets().length - 1]

// The handlers the panel passes, as mocks.
const newHandlers = () => ({ onSignedOut: vi.fn(), onMessage: vi.fn(), onLost: vi.fn() })

// The server accepts the newest socket: it opens, and the welcome comes.
const welcomeLatest = () => {
  const socket = latestSocket()
  socket.open()
  socket.receive({ type: 'welcome' })
  return socket
}

// Moves the fake clock on, and expects one new socket exactly `ms` after now, not before.
async function expectNewSocketAfter(ms: number) {
  const count = sockets().length
  await vi.advanceTimersByTimeAsync(ms - 1)
  expect(sockets()).toHaveLength(count)
  await vi.advanceTimersByTimeAsync(1)
  expect(sockets()).toHaveLength(count + 1)
}

// Moves the fake clock on 31 seconds, longer than the longest wait, and expects no new socket.
async function expectNoNewSocket() {
  const count = sockets().length
  await vi.advanceTimersByTimeAsync(31_000)
  expect(sockets()).toHaveLength(count)
}

describe('the review reminders connection (features/20_realtime_notifications)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-20 the client hands each message of the reminders subscription to the app, and no pings or protocol messages', () => {
    const handlers = newHandlers()
    const cable = openCable(handlers)
    const socket = latestSocket()
    const first = { type: 'review_reminders', reminders: [] }
    const second = {
      type: 'review_reminders',
      reminders: [
        {
          type: 'review_due_today',
          note_id: 7,
          title: 'Rails tips',
          collection_name: 'Books',
          next_review_date: '2026-11-09',
          review_state: 'due_today',
        },
      ],
    }

    socket.open()
    socket.receive({ type: 'welcome' })
    // The first batch may come just before the confirmation.
    socket.receive({ identifier: IDENTIFIER, message: first })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
    socket.receive({ type: 'ping', message: 1794259356 })
    socket.receive({ identifier: IDENTIFIER, message: second })
    socket.receive({ identifier: '{"channel":"OtherChannel"}', message: first })

    expect(handlers.onMessage.mock.calls).toEqual([[first], [second]])
    expect(handlers.onLost).not.toHaveBeenCalled()
    expect(handlers.onSignedOut).not.toHaveBeenCalled()
    cable.close()
  })

  it('AC-20 a lost connection is reported and retried on its own at most 30 seconds apart, and a refusal or close stops the retries', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Each kind of loss is reported once: the network fails (a close with no message), the
    // server restarts (Action Cable's reconnect true, then a close), and a connection that
    // cannot be opened (an error, then a close).
    const losses: ((socket: FakeWebSocket) => void)[] = [
      (socket) => socket.closeFromServer(1006),
      (socket) => {
        socket.receive({ type: 'disconnect', reason: 'server_restart', reconnect: true })
        socket.closeFromServer()
      },
    ]
    for (const lose of losses) {
      const handlers = newHandlers()
      const cable = openCable(handlers)
      lose(welcomeLatest())
      expect(handlers.onLost).toHaveBeenCalledTimes(1)
      expect(handlers.onSignedOut).not.toHaveBeenCalled()
      cable.close()
    }
    const unopened = newHandlers()
    const retrying = openCable(unopened)
    latestSocket().failToOpen()
    expect(unopened.onLost).toHaveBeenCalledTimes(1)

    // The waits: 1 s after the loss, then 2, 4, 8, 16, 30, and 30 s while each new socket fails.
    await expectNewSocketAfter(1_000)
    for (const wait of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
      latestSocket().failToOpen()
      await expectNewSocketAfter(wait)
    }
    // A welcome starts the waits again from 1 s.
    welcomeLatest().closeFromServer(1006)
    await expectNewSocketAfter(1_000)
    expect(unopened.onSignedOut).not.toHaveBeenCalled()
    retrying.close()

    // The refusal ends the sign-in: no new socket, and the close that follows is no loss.
    const refused = newHandlers()
    openCable(refused)
    const refusedSocket = latestSocket()
    refusedSocket.open()
    refusedSocket.receive({ type: 'disconnect', reason: 'unauthorized', reconnect: false })
    refusedSocket.closeFromServer()
    expect(refused.onSignedOut).toHaveBeenCalledTimes(1)
    expect(refused.onLost).not.toHaveBeenCalled()
    await expectNoNewSocket()

    // close() while a retry waits: no new socket.
    const waiting = newHandlers()
    const waitingCable = openCable(waiting)
    latestSocket().failToOpen()
    waitingCable.close()
    await expectNoNewSocket()

    // close() on an open socket, then the late close event that a real socket fires some time
    // after close(): neither handler is called, and no new socket opens.
    const closing = newHandlers()
    const closingCable = openCable(closing)
    const closedSocket = welcomeLatest()
    closingCable.close()
    expect(closedSocket.closedByApp).toBe(true)
    closedSocket.closeFromServer()
    expect(closing.onLost).not.toHaveBeenCalled()
    expect(closing.onSignedOut).not.toHaveBeenCalled()
    await expectNoNewSocket()
  })

  it('AC-20 an open connection with no frame for 10 seconds is closed and retried', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Action Cable pings every 3 s: a ping keeps the connection, here for 30 s.
    const kept = newHandlers()
    const keptCable = openCable(kept)
    const pinged = welcomeLatest()
    for (let second = 3; second <= 30; second += 3) {
      await vi.advanceTimersByTimeAsync(3_000)
      pinged.receive({ type: 'ping', message: 1794259356 + second })
    }
    expect(pinged.closedByApp).toBe(false)
    expect(kept.onLost).not.toHaveBeenCalled()
    keptCable.close()

    // A socket that never opens is not closed by this check.
    const connecting = newHandlers()
    const connectingCable = openCable(connecting)
    const unopened = latestSocket()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(unopened.closedByApp).toBe(false)
    expect(connecting.onLost).not.toHaveBeenCalled()
    connectingCable.close()

    // The network fails with no close: no frame for 10 s. The client closes the socket,
    // reports the loss once, and opens a new socket 1 s later.
    const handlers = newHandlers()
    const cable = openCable(handlers)
    const silent = welcomeLatest()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(silent.closedByApp).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(silent.closedByApp).toBe(true)
    expect(handlers.onLost).toHaveBeenCalledTimes(1)
    // The stale socket's own close event comes later: no second loss, and no second retry.
    silent.closeFromServer(1006)
    expect(handlers.onLost).toHaveBeenCalledTimes(1)
    await expectNewSocketAfter(1_000)
    await expectNoNewSocket()
    expect(handlers.onLost).toHaveBeenCalledTimes(1)
    cable.close()
  })
})
