import { describe, expect, it, vi } from 'vitest'
import { openCable } from './cable'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/23_websocket_client_message. The client sends a message on the reminders
// subscription as Action Cable's message command, with the message as JSON text in its data
// (spec question 1). It sends only while the socket is open, and says whether it sent, so the
// panel keeps a reminder whose ack could not go out (spec question 5). src/test/setup.ts
// replaces WebSocket with a fake that never opens on its own: this test drives it.
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

const latestSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]

// The handlers the panel passes, as mocks.
const newHandlers = () => ({ onSignedOut: vi.fn(), onMessage: vi.fn(), onLost: vi.fn() })

// The message commands the app sent on the socket, as sent: the subscription is left out.
const messageCommands = (socket: FakeWebSocket) =>
  socket.sent.filter((text) => (JSON.parse(text) as { command: string }).command === 'message')

describe('the client → server message (features/23_websocket_client_message)', () => {
  it('AC-23 the client sends an ack as a message command with the data as JSON text', () => {
    const ack = { note_id: 7, next_review_date: '2026-11-09' }
    const cable = openCable(newHandlers())
    const socket = latestSocket()

    // Before the socket opens.
    expect(cable.perform('ack', ack)).toBe(false)
    expect(socket.sent).toEqual([])

    // Open, with the subscription confirmed.
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
    expect(cable.perform('ack', ack)).toBe(true)
    expect(messageCommands(socket)).toEqual([
      '{"command":"message","identifier":"{\\"channel\\":\\"ReviewRemindersChannel\\"}","data":"{\\"action\\":\\"ack\\",\\"note_id\\":7,\\"next_review_date\\":\\"2026-11-09\\"}"}',
    ])

    // While the socket is closing, before its close event.
    socket.readyState = FakeWebSocket.CLOSING
    expect(cable.perform('ack', ack)).toBe(false)

    // After a loss, while the retry waits.
    socket.closeFromServer(1006)
    expect(cable.perform('ack', ack)).toBe(false)
    expect(messageCommands(socket)).toHaveLength(1)
    cable.close()
  })
})
