import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/23_websocket_client_message. "Dismiss" on a reminder of the panel sends the ack
// for it, takes it out of the panel at once, and moves the focus to the panel's heading
// (spec questions 1 and 4). The tests render the whole app with a signed-in user and replace
// fetch, and src/test/setup.ts replaces WebSocket with a fake that the tests drive, as in
// src/ReviewRemindersPanel.test.tsx, so nothing leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Answers like the backend for a signed-in user with no notes, collections, or tags. Any
// other request fails.
function stubBackend() {
  const routes: Record<string, () => Response> = {
    'GET /api/session': () => json(200, { user: { id: 1, display_name: 'Ada Lovelace' } }),
    'GET /api/csrf': () => json(200, { token: 'csrf-token' }),
    'GET /api/collections': () => json(200, { collections: [] }),
    'GET /api/tags': () => json(200, { tags: [] }),
    'GET /api/notes': () => json(200, { notes: [] }),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`
      const route = routes[key]
      if (!route) throw new Error(`unexpected request ${key}`)
      return route()
    }),
  )
}

// The reminders subscription's identifier, as the client sends it.
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

type Reminder = {
  type: 'review_due_today' | 'review_overdue'
  note_id: number
  title: string
  collection_name: string
  next_review_date: string
  review_state: 'due_today' | 'overdue'
}

// The reminders of the spec's scenarios, as a batch holds them.
const OLD_IDEA: Reminder = {
  type: 'review_overdue',
  note_id: 12,
  title: 'Old idea',
  collection_name: 'Work',
  next_review_date: '2026-11-02',
  review_state: 'overdue',
}
const RAILS_TIPS: Reminder = {
  type: 'review_due_today',
  note_id: 7,
  title: 'Rails tips',
  collection_name: 'Books',
  next_review_date: '2026-11-09',
  review_state: 'due_today',
}

// The ack of "Rails tips", exactly as the app sends it (spec question 1).
const RAILS_TIPS_ACK =
  '{"command":"message","identifier":"{\\"channel\\":\\"ReviewRemindersChannel\\"}","data":"{\\"action\\":\\"ack\\",\\"note_id\\":7,\\"next_review_date\\":\\"2026-11-09\\"}"}'

const sockets = () => FakeWebSocket.instances

// The message commands the app sent on a socket, as sent: the subscription is left out.
const messageCommands = (socket: FakeWebSocket) =>
  socket.sent.filter((text) => (JSON.parse(text) as { command: string }).command === 'message')

// The server accepts the connection and confirms the subscription.
const confirm = (socket: FakeWebSocket) =>
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
  })

// The server sends a message on the reminders subscription: a batch, or another message.
const sendOnSubscription = (socket: FakeWebSocket, message: unknown) =>
  act(() => socket.receive({ identifier: IDENTIFIER, message }))

const sendBatch = (socket: FakeWebSocket, reminders: Reminder[]) =>
  sendOnSubscription(socket, { type: 'review_reminders', reminders })

// Waits for the main layout, then for the connection it opens: the newest socket, still
// connecting. The layout opens it in an effect, which can run after the layout shows.
async function mainLayoutSocket(): Promise<FakeWebSocket> {
  await screen.findByRole('button', { name: 'Log out' })
  return waitFor(() => {
    const socket = sockets().at(-1)
    expect(socket?.readyState).toBe(FakeWebSocket.CONNECTING)
    return socket as FakeWebSocket
  })
}

// The review reminders panel, and its heading.
const findPanel = () => screen.findByRole('region', { name: 'Review reminders' })
const headingOf = (panel: HTMLElement) => within(panel).getByRole('heading', { name: 'Review reminders' })

// The panel's entry of the reminder with this title.
const entryOf = (panel: HTMLElement, title: string) => within(panel).getByText(title).closest('li') as HTMLElement
const dismissOf = (panel: HTMLElement, title: string) =>
  within(entryOf(panel, title)).getByRole('button', { name: 'Dismiss' })

// The titles the panel lists, in its order.
const listedTitles = (panel: HTMLElement) =>
  within(panel)
    .queryAllByRole('listitem')
    .map((item) => item.firstElementChild?.textContent)

// The main layout with the panel showing this batch on a confirmed connection.
async function panelShowing(reminders: Reminder[]) {
  stubBackend()
  render(<App />)
  const socket = await mainLayoutSocket()
  const panel = await findPanel()
  confirm(socket)
  sendBatch(socket, reminders)
  return { socket, panel }
}

describe('Dismiss in the review reminders panel (features/23_websocket_client_message)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-23 Dismiss sends the ack, takes the reminder out of the panel at once, and moves the focus to the heading', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    const { socket, panel } = await panelShowing([OLD_IDEA, RAILS_TIPS])
    const dismiss = dismissOf(panel, 'Rails tips')
    expect(dismiss).not.toHaveAttribute('aria-busy')

    await user.click(dismiss)

    // No answer has come from the server.
    expect(messageCommands(socket)).toEqual([RAILS_TIPS_ACK])
    expect(listedTitles(panel)).toEqual(['Old idea'])
    expect(headingOf(panel)).toHaveFocus()
    // No confirmation and no busy state: the panel holds only the entry of "Old idea".
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(panel).getAllByRole('button').map((button) => button.textContent)).toEqual(['Open', 'Dismiss'])
    expect(panel.querySelector('[aria-busy]')).toBeNull()
  })

  it('AC-23 dismissing the last reminder shows No review reminders', async () => {
    const user = userEvent.setup()
    const { panel } = await panelShowing([RAILS_TIPS])

    await user.click(dismissOf(panel, 'Rails tips'))

    expect(within(panel).getByText('No review reminders')).toBeInTheDocument()
    expect(within(panel).queryByRole('list')).not.toBeInTheDocument()
    expect(headingOf(panel)).toHaveFocus()
  })

  it('AC-23 an error answer shows no message, and the next batch decides what the panel shows', async () => {
    const user = userEvent.setup()
    const { socket, panel } = await panelShowing([OLD_IDEA, RAILS_TIPS])
    await user.click(dismissOf(panel, 'Rails tips'))
    expect(listedTitles(panel)).toEqual(['Old idea'])
    const shown = panel.textContent

    // The server did not record the ack: "Rails tips" was reviewed in another tab meanwhile.
    sendOnSubscription(socket, { type: 'error', error: 'not_found' })

    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('status')).not.toBeInTheDocument()
    expect(panel.textContent).toBe(shown)

    // The next batch still holds "Rails tips", so it shows again.
    sendBatch(socket, [OLD_IDEA, RAILS_TIPS])

    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-23 Dismiss is disabled while offline, and a Dismiss that cannot be sent keeps the reminder', async () => {
    const user = userEvent.setup()
    const { socket, panel } = await panelShowing([OLD_IDEA, RAILS_TIPS])

    // The socket is closing, and its close has not reached the panel yet.
    socket.readyState = FakeWebSocket.CLOSING
    await user.click(dismissOf(panel, 'Rails tips'))

    expect(messageCommands(socket)).toEqual([])
    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])

    // The close comes: the panel is offline.
    act(() => socket.closeFromServer(1006))
    expect(within(panel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    for (const title of ['Old idea', 'Rails tips']) expect(dismissOf(panel, title)).toBeDisabled()
    await user.click(dismissOf(panel, 'Old idea'))

    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])
    expect(sockets().flatMap(messageCommands)).toEqual([])
  })
})
