import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/20_realtime_notifications. The main layout shows the "Review reminders" panel
// above the notes area. The tests render the whole app with a signed-in user and replace
// fetch, and src/test/setup.ts replaces WebSocket with a fake that the tests drive, so nothing
// leaves the test (requirements.md section 7). The server makes the batches; the app shows
// them and computes no date.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user, as in src/ReviewDueToday.test.tsx: the
// session check, GET /api/csrf, the collections ("Work") and tags (none) lists unless the
// test names them, and the notes requests that the test names by method and address. Any
// other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
    'GET /api/tags': () => json(200, { tags: [] }),
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session') return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    const handler = routes[key] ?? defaults[key]
    if (!handler) throw new Error(`unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

type Summary = {
  id: number
  title: string
  status: 'active' | 'archived'
  collection: { id: number; name: string }
  tags: { id: number; name: string }[]
  review_interval: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  review_interval_days: number | null
  next_review_date: string | null
  last_reviewed_date: string | null
  review_state: 'due_today' | 'overdue' | null
  created_at: string
  updated_at: string
}

// A note as the list shows it (GET /api/notes), in "Work", with no schedule unless the test
// gives one.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
  tags: [],
  review_interval: 'none',
  review_interval_days: null,
  next_review_date: null,
  last_reviewed_date: null,
  review_state: null,
  created_at: '2026-11-09T10:00:00.000Z',
  updated_at: '2026-11-09T10:00:00.000Z',
  ...fields,
})

// A note as its detail shows it (GET /api/notes/:id).
const fullNote = (id: number, title: string, fields: Partial<Summary> = {}) => ({
  ...summary(id, title, fields),
  body: `Body of ${title}`,
  source_url: null,
})

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

// A reminder as a batch holds it (spec question 2).
const reminder = (
  noteId: number,
  title: string,
  collectionName: string,
  nextReviewDate: string,
  reviewState: Reminder['review_state'],
): Reminder => ({
  type: `review_${reviewState}`,
  note_id: noteId,
  title,
  collection_name: collectionName,
  next_review_date: nextReviewDate,
  review_state: reviewState,
})

// The reminders of the spec's scenarios.
const OLD_IDEA = reminder(12, 'Old idea', 'Work', '2026-11-02', 'overdue')
const RAILS_TIPS = reminder(7, 'Rails tips', 'Books', '2026-11-09', 'due_today')

const sockets = () => FakeWebSocket.instances

// The server accepts the connection and confirms the subscription.
const confirm = (socket: FakeWebSocket) =>
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
  })

// The server sends a batch on the reminders subscription.
const sendBatch = (socket: FakeWebSocket, reminders: Reminder[]) =>
  act(() => socket.receive({ identifier: IDENTIFIER, message: { type: 'review_reminders', reminders } }))

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

// An answer that the test gives later, as in src/ReviewDueToday.test.tsx. `requested`
// settles once the request is made.
function later() {
  let resolve: (res: Response) => void = () => {}
  let markRequested: () => void = () => {}
  const requested = new Promise<void>((settle) => (markRequested = settle))
  const handler: Handler = () => {
    markRequested()
    return new Promise<Response>((settle) => (resolve = settle))
  }
  return { handler, requested, answer: (res: Response) => resolve(res) }
}

// While the clock is fake, Testing Library's findBy never returns. This lets the app's
// pending requests finish instead, one turn of the event loop at a time, without moving the
// clock, until the check passes.
async function settleUntil(check: () => boolean) {
  for (let turn = 0; turn < 50 && !check(); turn += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0))
  }
  expect(check()).toBe(true)
}

// The review reminders panel.
const findPanel = () => screen.findByRole('region', { name: 'Review reminders' })

// The sign-in screen shows.
const signInScreenShows = () => screen.queryByRole('button', { name: 'Continue with Google' }) !== null

// The panel's entry of the reminder with this title.
const entryOf = (panel: HTMLElement, title: string) => within(panel).getByText(title).closest('li') as HTMLElement

// The titles the panel lists, in its order.
const listedTitles = (panel: HTMLElement) =>
  within(panel)
    .queryAllByRole('listitem')
    .map((item) => item.firstElementChild?.textContent)

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// Whether the first element comes before the second in the page, outside it.
const isBefore = (first: Element, second: Element) =>
  !first.contains(second) && Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('the review reminders panel (features/20_realtime_notifications)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-20 the main layout shows the Review reminders panel above the notes area, with Loading until the first batch', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(7, 'Rails tips')] }),
      'GET /api/notes/7': () => json(200, { note: fullNote(7, 'Rails tips') }),
    })
    const user = userEvent.setup()
    render(<App />)
    await mainLayoutSocket()

    const panel = await findPanel()
    const heading = within(panel).getByRole('heading', { level: 2, name: 'Review reminders' })
    expect(heading).toHaveAttribute('tabindex', '-1')
    // No batch yet: the fake socket never opens on its own.
    expect(within(panel).getByRole('status')).toHaveTextContent('Loading…')

    // The rest of the layout loads and works meanwhile.
    const area = await findNotesArea()
    expect(await within(area).findByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    const collections = screen.getByRole('complementary', { name: 'Collections' })
    expect(await within(collections).findByText('Work')).toBeInTheDocument()
    const tags = screen.getByRole('complementary', { name: 'Tags' })
    expect(await within(tags).findByText('No tags yet')).toBeInTheDocument()

    // After the left area and before the notes area, whatever the notes area shows.
    const leftArea = collections.parentElement!
    const inPlace = () => {
      expect(isBefore(leftArea, panel)).toBe(true)
      expect(isBefore(panel, area)).toBe(true)
    }
    inPlace()
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    inPlace()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    expect(await within(area).findByLabelText('Title')).toBeInTheDocument()
    inPlace()
    expect(within(panel).getByRole('status')).toHaveTextContent('Loading…')
  })

  it('AC-20 the panel lists each reminder of a batch with its title, collection, state, date, Open, and Dismiss, or No review reminders', async () => {
    stubBackend({ 'GET /api/notes': () => json(200, { notes: [] }) })
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    confirm(socket)

    sendBatch(socket, [OLD_IDEA, RAILS_TIPS])

    const items = within(panel).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    const [oldIdea, railsTips] = items
    for (const text of ['Old idea', 'Work', 'Overdue', 'Next review: Nov 2, 2026']) {
      expect(within(oldIdea).getByText(text)).toBeInTheDocument()
    }
    for (const text of ['Rails tips', 'Books', 'Due today', 'Next review: Nov 9, 2026']) {
      expect(within(railsTips).getByText(text)).toBeInTheDocument()
    }
    for (const item of items) {
      expect(within(item).getByRole('button', { name: 'Open' })).toBeEnabled()
      expect(within(item).getByRole('button', { name: 'Dismiss' })).toBeEnabled()
    }
    // A long list scrolls inside the panel (12 rem), so the notes area stays in view.
    expect(within(panel).getByRole('list')).toHaveClass('max-h-48', 'overflow-y-auto')
    expect(within(panel).queryByRole('status')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Loading…')).not.toBeInTheDocument()

    // Another message of the subscription is not a batch: it changes nothing.
    act(() => socket.receive({ identifier: IDENTIFIER, message: { type: 'error', error: 'invalid' } }))
    expect(within(panel).getAllByRole('listitem')).toHaveLength(2)

    sendBatch(socket, [])

    expect(within(panel).getByText('No review reminders')).toBeInTheDocument()
    expect(within(panel).queryByRole('list')).not.toBeInTheDocument()
  })

  it('AC-20 each batch replaces the list, and a repeated reminder keeps its element and the focus', async () => {
    stubBackend({ 'GET /api/notes': () => json(200, { notes: [] }) })
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    confirm(socket)
    sendBatch(socket, [OLD_IDEA, RAILS_TIPS])
    const open = within(entryOf(panel, 'Rails tips')).getByRole('button', { name: 'Open' })
    act(() => open.focus())

    // The next check: a new reminder comes before "Rails tips", which is repeated unchanged.
    const adasIdea = reminder(15, "Ada's idea", 'Work', '2026-11-05', 'overdue')
    sendBatch(socket, [OLD_IDEA, adasIdea, RAILS_TIPS])

    expect(listedTitles(panel)).toEqual(['Old idea', "Ada's idea", 'Rails tips'])
    expect(open).toHaveFocus()
    expect(entryOf(panel, 'Rails tips')).toContainElement(open)

    // A batch without "Rails tips" removes it.
    sendBatch(socket, [OLD_IDEA, adasIdea])
    expect(listedTitles(panel)).toEqual(['Old idea', "Ada's idea"])

    // After midnight "Rails tips" is overdue: a new key, shown once, with its new label.
    sendBatch(socket, [OLD_IDEA, adasIdea, { ...RAILS_TIPS, type: 'review_overdue', review_state: 'overdue' }])
    expect(listedTitles(panel)).toEqual(['Old idea', "Ada's idea", 'Rails tips'])
    expect(within(entryOf(panel, 'Rails tips')).getByText('Overdue')).toBeInTheDocument()
    expect(within(entryOf(panel, 'Rails tips')).queryByText('Due today')).not.toBeInTheDocument()
  })

  it("AC-20 Open shows the reminder's note in the notes area with the focus on its title", async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(7, 'Rails tips'), summary(5, 'Ruby notes')] }),
      'GET /api/notes/7': () => json(200, { note: fullNote(7, 'Rails tips') }),
      'GET /api/notes/5': () => json(200, { note: fullNote(5, 'Ruby notes') }),
      // "Old idea" was deleted before the panel heard of it.
      'GET /api/notes/12': () => json(404, { error: 'not_found' }),
    })
    const detailRequests = (id: number) => fetchMock.mock.calls.filter(([url]) => url === `/api/notes/${id}`).length
    const user = userEvent.setup()
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    const area = await findNotesArea()
    expect(await within(area).findByRole('button', { name: 'Ruby notes' })).toBeInTheDocument()
    confirm(socket)
    sendBatch(socket, [OLD_IDEA, RAILS_TIPS])
    const openRailsTips = () => user.click(within(entryOf(panel, 'Rails tips')).getByRole('button', { name: 'Open' }))
    // The detail focuses its title in an effect, which can run after the title shows.
    const expectFocusedTitle = async (title: string) => {
      const heading = await within(area).findByRole('heading', { name: title })
      await waitFor(() => expect(heading).toHaveFocus())
    }

    // From the list.
    await openRailsTips()
    await expectFocusedTitle('Rails tips')
    expect(detailRequests(7)).toBe(1)
    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])

    // From the detail of another note.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Ruby notes' }))
    await expectFocusedTitle('Ruby notes')
    await openRailsTips()
    await expectFocusedTitle('Rails tips')
    expect(within(area).queryByRole('heading', { name: 'Ruby notes' })).not.toBeInTheDocument()

    // From its own detail: it loads again, and the focus goes back to its title.
    await openRailsTips()
    await waitFor(() => expect(detailRequests(7)).toBe(3))
    await expectFocusedTitle('Rails tips')

    // A note deleted meanwhile: the list, with the notes area's message.
    await user.click(within(entryOf(panel, 'Old idea')).getByRole('button', { name: 'Open' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(within(area).getByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])
  })

  it('AC-20 Open is disabled while a note form is open, and a batch then changes only the panel', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(7, 'Rails tips')] }),
      'GET /api/notes/7': () => json(200, { note: fullNote(7, 'Rails tips') }),
      'PATCH /api/notes/7': () => json(200, { note: fullNote(7, 'Rails tricks') }),
    })
    const user = userEvent.setup()
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    const area = await findNotesArea()
    confirm(socket)
    sendBatch(socket, [RAILS_TIPS])
    const openButtons = () => within(panel).getAllByRole('button', { name: 'Open' })

    // The new-note form, with a title typed.
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Draft')
    await waitFor(() => expect(openButtons()[0]).toBeDisabled())

    // A batch changes the panel, and the form keeps what was typed.
    sendBatch(socket, [OLD_IDEA, RAILS_TIPS])
    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])
    for (const open of openButtons()) expect(open).toBeDisabled()
    expect(within(area).getByLabelText('Title')).toHaveValue('Draft')

    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(openButtons()[0]).toBeEnabled())
    for (const open of openButtons()) expect(open).toBeEnabled()

    // The edit form, until "Save".
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const title = await within(area).findByLabelText('Title')
    await waitFor(() => expect(openButtons()[0]).toBeDisabled())
    for (const open of openButtons()) expect(open).toBeDisabled()
    await user.clear(title)
    await user.type(title, 'Rails tricks')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tricks' })).toBeInTheDocument()
    await waitFor(() => expect(openButtons()[0]).toBeEnabled())
    for (const open of openButtons()) expect(open).toBeEnabled()
  })

  it('AC-20 a lost connection shows the offline alert, keeps the list with Open working and Dismiss disabled, and the next batch clears it', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(7, 'Rails tips')] }),
      'GET /api/notes/7': () => json(200, { note: fullNote(7, 'Rails tips') }),
    })
    const first = render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    const area = await findNotesArea()
    expect(await within(area).findByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    confirm(socket)
    sendBatch(socket, [RAILS_TIPS])
    const dismiss = () => within(entryOf(panel, 'Rails tips')).getByRole('button', { name: 'Dismiss' })
    expect(dismiss()).toBeEnabled()

    // The test owns the clock from here, so the retry shows when the clock moves on. Testing
    // Library's findBy waits on setTimeout, so only synchronous queries run until the clock
    // is real again.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // The network fails: a close with no message.
    act(() => socket.closeFromServer(1006))

    expect(within(panel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    expect(listedTitles(panel)).toEqual(['Rails tips'])
    expect(dismiss()).toBeDisabled()
    // "Open" works: the notes area leaves the list for the note's detail.
    act(() => within(entryOf(panel, 'Rails tips')).getByRole('button', { name: 'Open' }).click())
    expect(within(area).queryByRole('button', { name: 'Rails tips' })).not.toBeInTheDocument()

    // The client connects again 1 s after the loss. Its first batch replaces the list, and
    // the alert goes.
    const count = sockets().length
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(sockets()).toHaveLength(count)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(sockets()).toHaveLength(count + 1)
    const again = sockets()[count]
    confirm(again)
    expect(within(panel).getByRole('alert')).toBeInTheDocument()
    sendBatch(again, [OLD_IDEA, RAILS_TIPS])
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
    expect(listedTitles(panel)).toEqual(['Old idea', 'Rails tips'])
    expect(dismiss()).toBeEnabled()
    vi.useRealTimers()
    // The detail that "Open" showed while the panel was offline.
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    first.unmount()

    // A connection that cannot be opened before any batch: the alert alone, with no "Loading…".
    render(<App />)
    const unopened = await mainLayoutSocket()
    const lonePanel = await findPanel()
    act(() => unopened.failToOpen())
    expect(within(lonePanel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    expect(within(lonePanel).queryByRole('status')).not.toBeInTheDocument()
    expect(within(lonePanel).queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('AC-20 a sign-in screen closes the connection and stops its retries', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'DELETE /api/session': () => new Response(null, { status: 204 }),
    })
    const first = render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    confirm(socket)
    sendBatch(socket, [RAILS_TIPS])

    // Offline, with a retry waiting on the faked clock.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    act(() => socket.closeFromServer(1006))
    expect(within(panel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    const count = sockets().length

    // "Log out": the sign-in screen, with no panel, and no new socket.
    act(() => screen.getByRole('button', { name: 'Log out' }).click())
    await settleUntil(signInScreenShows)
    expect(screen.queryByRole('region', { name: 'Review reminders' })).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(sockets()).toHaveLength(count)
    vi.useRealTimers()
    first.unmount()

    // A list request answered 401 while the connection is open.
    const list = later()
    stubBackend({ 'GET /api/notes': list.handler })
    render(<App />)
    const open = await mainLayoutSocket()
    confirm(open)
    await list.requested
    list.answer(json(401, { error: 'unauthenticated' }))
    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(screen.queryByRole('region', { name: 'Review reminders' })).not.toBeInTheDocument()
    // The panel closes the connection in its effect's cleanup, which a loaded machine can run
    // after the sign-in screen shows (Deviations, 2026-11-10).
    await waitFor(() => expect(open.closedByApp).toBe(true))

    // The socket the app closed fires its close event some time later, as a real one does.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const after = sockets().length
    act(() => open.closeFromServer())
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(sockets()).toHaveLength(after)
    expect(signInScreenShows()).toBe(true)
  })

  it('AC-20 each tab opens its own connection and shows its own batches', async () => {
    stubBackend({ 'GET /api/notes': () => json(200, { notes: [] }) })
    // Two tabs of the main layout, side by side. Each opens its connection once it shows.
    const opened = async () => {
      const tab = render(<App />)
      await within(tab.container).findByRole('button', { name: 'Log out' })
      await waitFor(() => expect(sockets().at(-1)?.readyState).toBe(FakeWebSocket.CONNECTING))
      return { panel: await within(tab.container).findByRole('region', { name: 'Review reminders' }) }
    }
    const first = await opened()
    expect(sockets()).toHaveLength(1)
    const second = await opened()
    expect(sockets()).toHaveLength(2)
    const [firstSocket, secondSocket] = sockets()
    confirm(firstSocket)
    confirm(secondSocket)

    sendBatch(firstSocket, [OLD_IDEA])
    sendBatch(secondSocket, [RAILS_TIPS])

    expect(listedTitles(first.panel)).toEqual(['Old idea'])
    expect(listedTitles(second.panel)).toEqual(['Rails tips'])
  })

  it('AC-20 the panel shows titles and collection names as plain text', async () => {
    stubBackend({ 'GET /api/notes': () => json(200, { notes: [] }) })
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    confirm(socket)
    const title = '<img src=x onerror=alert(1)>'

    sendBatch(socket, [reminder(9, title, '<b>Work</b>', '2026-11-09', 'due_today')])

    expect(within(panel).getByText(title)).toBeInTheDocument()
    expect(within(panel).getByText('<b>Work</b>')).toBeInTheDocument()
    expect(panel.querySelector('img')).toBeNull()
    expect(panel.querySelector('b')).toBeNull()
  })

  it("AC-20 a batch changes the panel and not the notes list's labels", async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [summary(7, 'Rails tips', { review_interval: 'weekly', next_review_date: '2026-11-09', review_state: 'due_today' })],
        }),
    })
    const listRequests = () =>
      fetchMock.mock.calls.filter(([url]) => new URL(url, 'http://localhost').pathname === '/api/notes').length
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    const area = await findNotesArea()
    const entry = (await within(area).findByRole('button', { name: 'Rails tips' })).closest('li') as HTMLElement
    expect(within(entry).getByTestId('note-review-state')).toHaveTextContent('Due today')
    expect(listRequests()).toBe(1)
    confirm(socket)

    // After midnight the server says "Rails tips" is overdue.
    sendBatch(socket, [{ ...RAILS_TIPS, type: 'review_overdue', review_state: 'overdue' }])
    await act(async () => {})

    expect(within(entryOf(panel, 'Rails tips')).getByText('Overdue')).toBeInTheDocument()
    // The list's label holds as of the list load, and no list request follows the batch.
    expect(within(entry).getByTestId('note-review-state')).toHaveTextContent('Due today')
    expect(listRequests()).toBe(1)
  })
})
