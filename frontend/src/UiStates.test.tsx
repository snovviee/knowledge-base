import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/24_ui_states: the empty, loading, busy, validation, and error states across the
// app (spec question 1). Features 01 to 23 built each state and test it under their own AC
// IDs; these tests check them together, as the guards of this feature's scenarios. They render
// the whole app and replace fetch, and src/test/setup.ts replaces WebSocket with a fake that
// the tests drive, so nothing leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

const error500: Handler = () => json(500, { error: 'internal' })
// No answer: the network fails.
const noAnswer: Handler = () => {
  throw new TypeError('Failed to fetch')
}

// The left area's lists, in the server's order: the collections "Books" (id 2) and "Work"
// (id 1), and the tags "ai" (id 1) and "ruby" (id 2).
const WORK = { id: 1, name: 'Work' }
const COLLECTIONS = [{ id: 2, name: 'Books' }, WORK]
const TAGS = [
  { id: 1, name: 'ai' },
  { id: 2, name: 'ruby' },
]

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

// A note as the list shows it (GET /api/notes), in "Work", with no tags and no schedule
// unless the test gives them.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: WORK,
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
const fullNote = (note: Summary) => ({ ...note, body: `Body of ${note.title}`, source_url: null })

// "Rails tips", weekly and due today, with the tag "ruby"; "Old idea", archived.
const RAILS_TIPS = summary(7, 'Rails tips', {
  tags: [{ id: 2, name: 'ruby' }],
  review_interval: 'weekly',
  next_review_date: '2026-11-09',
  review_state: 'due_today',
})
const OLD_IDEA = summary(12, 'Old idea', { status: 'archived' })

// What the session check answers: a signed-in user, the sign-in screen (401), or nothing yet.
type Session = 'signed-in' | 'signed-out' | 'held'

// Answers like the backend, as in src/NoteFilters.test.tsx: the session check, GET /api/csrf,
// the collections and tags lists above, the list of "Rails tips" and "Old idea", and their
// details, unless the test names them; and the requests the test names by method and address,
// query included. Any other request fails.
function stubBackend(routes: Record<string, Handler> = {}, session: Session = 'signed-in') {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: COLLECTIONS }),
    'GET /api/tags': () => json(200, { tags: TAGS }),
    'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
    'GET /api/notes/7': () => json(200, { note: fullNote(RAILS_TIPS) }),
    'GET /api/notes/12': () => json(200, { note: fullNote(OLD_IDEA) }),
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session' && !routes[key]) {
      if (session === 'signed-out') return json(401, { error: 'unauthenticated' })
      if (session === 'held') return new Promise<Response>(() => {})
      return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    }
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    const handler = routes[key] ?? defaults[key]
    if (!handler) throw new Error(`unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  // How many requests were made by method and address, such as 'POST /api/collections'.
  const count = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? 'GET'} ${url}` === key).length
  return { fetchMock, count }
}

// An answer that the test gives later. `requested` settles once the request is made, so the
// test never answers a request that has not started yet.
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

// A handler that answers each request with the next of the given handlers, and every later
// request with the last one. Two parts of the page that ask the same path ask in turn: the
// left area first, when the page loads, then a note form.
function inTurn(...handlers: Handler[]): Handler {
  let calls = 0
  return (init) => handlers[Math.min(calls++, handlers.length - 1)](init)
}

// The areas of the main layout. Queries are scoped to an area: "Collection", "Tags", and
// "Due today" each name more than one element.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })
const collectionsArea = () => screen.getByRole('complementary', { name: 'Collections' })
const tagsArea = () => screen.getByRole('complementary', { name: 'Tags' })

const NO_COLLECTION = 'Create a collection first. Every note belongs to a collection.'

// The reminders subscription's identifier, as the client sends it (features/20_realtime_notifications).
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

// A reminder of "Rails tips", due today, as a batch holds it.
const RAILS_TIPS_REMINDER = {
  type: 'review_due_today',
  note_id: 7,
  title: 'Rails tips',
  collection_name: 'Work',
  next_review_date: '2026-11-09',
  review_state: 'due_today',
}

// The main layout's connection: the newest socket, once the layout shows. The layout opens it
// in an effect, which can run after the layout shows.
async function mainLayoutSocket(): Promise<FakeWebSocket> {
  await screen.findByRole('button', { name: 'Log out' })
  return waitFor(() => {
    const socket = FakeWebSocket.instances.at(-1)
    expect(socket?.readyState).toBe(FakeWebSocket.CONNECTING)
    return socket as FakeWebSocket
  })
}

// The server accepts the connection and confirms the subscription.
const confirm = (socket: FakeWebSocket) =>
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
  })

// The server sends a batch of reminders.
const sendBatch = (socket: FakeWebSocket, reminders: (typeof RAILS_TIPS_REMINDER)[]) =>
  act(() => socket.receive({ identifier: IDENTIFIER, message: { type: 'review_reminders', reminders } }))

const findPanel = () => screen.findByRole('region', { name: 'Review reminders' })

// The tests that walk many screens take longer than Vitest's default of 5 s on a busy machine.
const LONG_TEST_MS = 20_000

describe('the empty, loading, busy, validation, and error states (features/24_ui_states)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-24 the areas and the note form show their empty states only once loaded and empty', async () => {
    const user = userEvent.setup()
    const emptyStates = ['No collections yet', 'No tags yet', 'No notes yet', NO_COLLECTION]
    const noEmptyState = () => {
      for (const text of emptyStates) expect(screen.queryByText(text)).not.toBeInTheDocument()
    }

    // A user with nothing, whose lists wait until the test answers them.
    const areaCollections = later()
    const formCollections = later()
    const areaTags = later()
    const notes = later()
    stubBackend({
      'GET /api/collections': inTurn(areaCollections.handler, formCollections.handler),
      'GET /api/tags': areaTags.handler,
      'GET /api/notes': notes.handler,
    })
    const first = render(<App />)
    let area = await findNotesArea()
    await Promise.all([areaCollections.requested, areaTags.requested, notes.requested])
    for (const part of [collectionsArea(), tagsArea(), area]) {
      expect(within(part).getByRole('status')).toHaveTextContent('Loading…')
    }
    noEmptyState()

    areaCollections.answer(json(200, { collections: [] }))
    areaTags.answer(json(200, { tags: [] }))
    notes.answer(json(200, { notes: [] }))
    expect(await within(collectionsArea()).findByText('No collections yet')).toBeInTheDocument()
    expect(await within(tagsArea()).findByText('No tags yet')).toBeInTheDocument()
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    // With "Search" empty and every filter at "All".
    expect(within(area).getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    for (const name of ['Collection', 'Tag', 'Status', 'Review']) {
      expect(within(area).getByRole('combobox', { name })).toHaveDisplayValue('All')
    }
    expect(within(area).queryByText('No notes match your search and filters.')).not.toBeInTheDocument()

    // "New note" with no collection: "Loading…" while the form's collections load, then the
    // empty state with only "Cancel" and no field.
    await user.click(within(area).getByRole('button', { name: 'New note' }))
    await formCollections.requested
    const form = within(area).getByRole('form', { name: 'New note' })
    expect(within(form).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(form).queryByText(NO_COLLECTION)).not.toBeInTheDocument()
    formCollections.answer(json(200, { collections: [] }))
    expect(await within(form).findByText(NO_COLLECTION)).toBeInTheDocument()
    expect(within(form).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel'])
    for (const role of ['textbox', 'combobox', 'checkbox']) expect(within(form).queryAllByRole(role)).toEqual([])
    first.unmount()

    // One collection and no tags: the form's "Tags" group shows "No tags yet" once its own
    // request has answered.
    const formTags = later()
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [WORK] }),
      'GET /api/tags': inTurn(() => json(200, { tags: [] }), formTags.handler),
      'GET /api/notes': () => json(200, { notes: [] }),
    })
    const second = render(<App />)
    area = await findNotesArea()
    expect(await within(tagsArea()).findByText('No tags yet')).toBeInTheDocument()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await formTags.requested
    let group = await within(area).findByRole('group', { name: 'Tags' })
    expect(within(group).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(group).queryByText('No tags yet')).not.toBeInTheDocument()
    formTags.answer(json(200, { tags: [] }))
    expect(await within(group).findByText('No tags yet')).toBeInTheDocument()
    second.unmount()

    // Lists that cannot load show their alerts, never an empty state; so does the form's
    // "Tags" group.
    stubBackend({
      'GET /api/collections': inTurn(error500, () => json(200, { collections: [WORK] })),
      'GET /api/tags': error500,
      'GET /api/notes': inTurn(error500, () => json(200, { notes: [] })),
    })
    render(<App />)
    area = await findNotesArea()
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(await within(collectionsArea()).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
    expect(await within(tagsArea()).findByRole('alert')).toHaveTextContent('Could not load tags. Try again.')
    noEmptyState()
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    group = await within(area).findByRole('group', { name: 'Tags' })
    expect(await within(group).findByRole('alert')).toHaveTextContent('Could not load tags. Try again.')
    expect(within(group).queryByText('No tags yet')).not.toBeInTheDocument()
  })

  it('AC-24 an empty notes list says which search or filter found nothing', async () => {
    const empty = () => json(200, { notes: [] })
    stubBackend({
      'GET /api/notes?search=zzz': empty,
      'GET /api/notes?review=due_today': empty,
      'GET /api/notes?review=overdue': empty,
      'GET /api/notes?review=next_7_days': empty,
      'GET /api/notes?review=unscheduled': empty,
      'GET /api/notes?status=archived&review=due_today': empty,
    })
    const user = userEvent.setup()
    render(<App />)
    const area = await findNotesArea()
    await within(area).findByRole('button', { name: 'Rails tips' })
    const clearButton = () => within(area).queryByRole('button', { name: 'Clear search and filters' })
    const review = within(area).getByRole('combobox', { name: 'Review' })

    // A search that finds nothing.
    await user.type(within(area).getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(await within(area).findByText('No notes match your search and filters.')).toBeInTheDocument()
    expect(clearButton()).toBeInTheDocument()
    expect(within(area).queryByText('No notes yet')).not.toBeInTheDocument()
    await user.click(clearButton()!)
    await within(area).findByRole('button', { name: 'Rails tips' })

    // "Review" alone: its own message, with no "Clear search and filters".
    const reviewMessages: [string, string][] = [
      ['Due today', 'No notes are due for review today.'],
      ['Overdue', 'No notes are overdue for review.'],
      ['Next 7 days', 'No notes are due for review in the next 7 days.'],
      ['No review scheduled', 'Every note has a review schedule.'],
    ]
    for (const [choice, message] of reviewMessages) {
      await user.selectOptions(review, choice)
      expect(await within(area).findByText(message)).toBeInTheDocument()
      expect(clearButton()).not.toBeInTheDocument()
      expect(within(area).queryByText('No notes match your search and filters.')).not.toBeInTheDocument()
    }

    // "Review" with another filter: the search-and-filters message, with the button.
    await user.selectOptions(review, 'Due today')
    await within(area).findByText('No notes are due for review today.')
    await user.selectOptions(within(area).getByRole('combobox', { name: 'Status' }), 'Archived')
    expect(await within(area).findByText('No notes match your search and filters.')).toBeInTheDocument()
    expect(clearButton()).toBeInTheDocument()
    expect(within(area).queryByText('No notes are due for review today.')).not.toBeInTheDocument()
  })

  it('AC-24 the reminders panel shows Loading until the first batch and then No review reminders', async () => {
    const user = userEvent.setup()
    stubBackend()
    render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    const loadingOnly = () => {
      expect(within(panel).getByRole('status')).toHaveTextContent('Loading…')
      expect(within(panel).queryByText('No review reminders')).not.toBeInTheDocument()
    }

    // No batch yet: "Loading…", while the other areas load and work.
    loadingOnly()
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(await within(collectionsArea()).findByText('Books')).toBeInTheDocument()
    expect(await within(tagsArea()).findByText('ruby')).toBeInTheDocument()
    loadingOnly()
    // Connected and subscribed, still before the first batch.
    confirm(socket)
    loadingOnly()

    // A batch with no reminders.
    sendBatch(socket, [])
    expect(within(panel).getByText('No review reminders')).toBeInTheDocument()
    expect(within(panel).queryByRole('status')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Loading…')).not.toBeInTheDocument()

    // The last reminder dismissed (features/23_websocket_client_message).
    sendBatch(socket, [RAILS_TIPS_REMINDER])
    expect(within(panel).queryByText('No review reminders')).not.toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Dismiss' }))
    expect(within(panel).getByText('No review reminders')).toBeInTheDocument()
    expect(within(panel).queryByText('Rails tips')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('AC-24 each loading state shows Loading as a status in its own place while the rest works', async () => {
    const user = userEvent.setup()
    const held: Handler = () => new Promise<Response>(() => {})

    // The session check: "Loading…" alone, neither the sign-in screen nor the main layout.
    stubBackend({}, 'held')
    let page = render(<App />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
    page.unmount()

    // The collections held alone: the tags and the notes show, and the tags area works.
    stubBackend({ 'GET /api/collections': held })
    page = render(<App />)
    let area = await findNotesArea()
    expect(await within(area).findByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    expect(await within(tagsArea()).findByText('ruby')).toBeInTheDocument()
    expect(within(collectionsArea()).getByRole('status')).toHaveTextContent('Loading…')
    await user.click(within(tagsArea()).getByRole('button', { name: 'New tag' }))
    expect(within(tagsArea()).getByLabelText('Tag name')).toHaveFocus()
    page.unmount()

    // The tags held alone: the collections and the notes show, and the collections area works.
    stubBackend({ 'GET /api/tags': held })
    page = render(<App />)
    area = await findNotesArea()
    expect(await within(area).findByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    expect(await within(collectionsArea()).findByText('Books')).toBeInTheDocument()
    expect(within(tagsArea()).getByRole('status')).toHaveTextContent('Loading…')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    expect(within(collectionsArea()).getByLabelText('Collection name')).toHaveFocus()
    page.unmount()

    // The notes held alone: the left area shows its lists and works.
    stubBackend({ 'GET /api/notes': held })
    page = render(<App />)
    area = await findNotesArea()
    expect(await within(collectionsArea()).findByText('Books')).toBeInTheDocument()
    expect(await within(tagsArea()).findByText('ruby')).toBeInTheDocument()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    expect(within(collectionsArea()).getByLabelText('Collection name')).toHaveFocus()
    page.unmount()

    // The list after "Archived" is chosen: "Loading…" in place of the entries, and "Search"
    // and the filters keep their values.
    const archived = later()
    stubBackend({
      'GET /api/notes?search=rails': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes?search=rails&status=archived': archived.handler,
    })
    page = render(<App />)
    area = await findNotesArea()
    await within(area).findByRole('button', { name: 'Old idea' })
    const search = within(area).getByRole('searchbox', { name: 'Search' })
    await user.type(search, 'rails')
    await waitFor(() => expect(within(area).queryByRole('button', { name: 'Old idea' })).not.toBeInTheDocument())
    await user.selectOptions(within(area).getByRole('combobox', { name: 'Status' }), 'Archived')
    await archived.requested
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(area).queryByRole('button', { name: 'Rails tips' })).not.toBeInTheDocument()
    expect(search).toHaveValue('rails')
    expect(within(area).getByRole('combobox', { name: 'Status' })).toHaveDisplayValue('Archived')
    for (const name of ['Collection', 'Tag', 'Review']) {
      expect(within(area).getByRole('combobox', { name })).toHaveDisplayValue('All')
    }
    page.unmount()

    // A note's detail, the new-note form until its collections arrive, and the edit form, whose
    // fields show at once while its "Collection" field and its "Tags" group load.
    const detail = later()
    const newNoteCollections = later()
    const editCollections = later()
    const editTags = later()
    stubBackend({
      'GET /api/collections': inTurn(
        () => json(200, { collections: COLLECTIONS }),
        newNoteCollections.handler,
        editCollections.handler,
      ),
      'GET /api/tags': inTurn(() => json(200, { tags: TAGS }), () => json(200, { tags: TAGS }), editTags.handler),
      'GET /api/notes/7': inTurn(detail.handler, () => json(200, { note: fullNote(RAILS_TIPS) })),
    })
    render(<App />)
    area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await detail.requested
    expect(within(area).getByRole('button', { name: 'Back to notes' })).toBeInTheDocument()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    detail.answer(json(200, { note: fullNote(RAILS_TIPS) }))
    await within(area).findByRole('heading', { name: 'Rails tips' })

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await newNoteCollections.requested
    const newNote = within(area).getByRole('form', { name: 'New note' })
    expect(within(newNote).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(newNote).queryByLabelText('Title')).not.toBeInTheDocument()
    newNoteCollections.answer(json(200, { collections: COLLECTIONS }))
    expect(await within(newNote).findByLabelText('Title')).toBeInTheDocument()
    await within(newNote).findAllByRole('checkbox')

    await user.click(within(newNote).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await editCollections.requested
    const edit = within(area).getByRole('form', { name: 'Edit note' })
    const title = within(edit).getByLabelText('Title')
    expect(title).toHaveValue('Rails tips')
    expect(within(edit).getByLabelText('Body')).toHaveValue('Body of Rails tips')
    await editTags.requested
    expect(within(within(edit).getByRole('group', { name: 'Collection' })).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(within(edit).getByRole('group', { name: 'Tags' })).getByRole('status')).toHaveTextContent('Loading…')
    await user.type(title, ' x')
    expect(title).toHaveValue('Rails tips x')
  }, LONG_TEST_MS)

  it('AC-24 every button that sends a request is busy while it waits and takes no second click', async () => {
    const user = userEvent.setup()

    // "Continue with Google" and "Continue with GitHub": both busy once either is chosen. jsdom
    // cannot leave the page, so the forms' submits are stopped and counted.
    stubBackend({}, 'signed-out')
    const signIn = render(<App />)
    const google = await screen.findByRole('button', { name: 'Continue with Google' })
    const github = screen.getByRole('button', { name: 'Continue with GitHub' })
    const submits = vi.fn((event: Event) => event.preventDefault())
    for (const button of [google, github]) button.closest('form')!.addEventListener('submit', submits)
    await user.click(google)
    await user.click(google)
    await user.click(github)
    expect(submits).toHaveBeenCalledTimes(1)
    for (const button of [google, github]) {
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
    }
    signIn.unmount()

    // In the main layout, each change waits until the test answers it with a 500, so its button
    // stays where it is.
    const waiting = new Map<string, ReturnType<typeof later>>()
    const hold =
      (key: string): Handler =>
      (init) => {
        const pending = later()
        waiting.set(key, pending)
        return pending.handler(init)
      }
    const changes = [
      'DELETE /api/session',
      'POST /api/collections',
      'PATCH /api/collections/1',
      'DELETE /api/collections/1',
      'POST /api/tags',
      'PATCH /api/tags/1',
      'DELETE /api/tags/1',
      'POST /api/notes',
      'PATCH /api/notes/7',
      'POST /api/notes/7/review',
      'DELETE /api/notes/7',
      'PATCH /api/notes/12',
    ]
    const { count } = stubBackend(Object.fromEntries(changes.map((key) => [key, hold(key)])))

    // Chooses the button, which sends its request: while it waits, the button is disabled and
    // busy, and a second click starts nothing (each change first asks GET /api/csrf). After the
    // answer, it is enabled again.
    const busyWhileWaiting = async (key: string, button: () => HTMLElement) => {
      const sent = count(key)
      await user.click(button())
      await waitFor(() => expect(count(key)).toBe(sent + 1))
      expect(button()).toBeDisabled()
      expect(button()).toHaveAttribute('aria-busy', 'true')
      const tokens = count('GET /api/csrf')
      await user.click(button())
      expect(count('GET /api/csrf')).toBe(tokens)
      expect(count(key)).toBe(sent + 1)
      waiting.get(key)!.answer(json(500, { error: 'internal' }))
      await waitFor(() => expect(button()).toBeEnabled())
      expect(button()).toHaveAttribute('aria-busy', 'false')
    }

    render(<App />)
    const area = await findNotesArea()
    await within(area).findByRole('button', { name: 'Rails tips' })
    await busyWhileWaiting('DELETE /api/session', () => screen.getByRole('button', { name: 'Log out' }))

    // Create, rename ("Save"), and delete, in each left area.
    const leftAreas: [() => HTMLElement, string, string][] = [
      [collectionsArea, 'collections', 'Work'],
      [tagsArea, 'tags', 'ai'],
    ]
    for (const [part, path, name] of leftAreas) {
      const button = (label: string) => () => within(part()).getByRole('button', { name: label })
      await user.click(await within(part()).findByRole('button', { name: /^New / }))
      await user.type(within(part()).getByRole('textbox'), 'Ideas')
      await busyWhileWaiting(`POST /api/${path}`, button('Create'))
      await user.click(button('Cancel')())
      await user.click(button(`Rename ${name}`)())
      await busyWhileWaiting(`PATCH /api/${path}/1`, button('Save'))
      await user.click(button('Cancel')())
      await user.click(button(`Delete ${name}`)())
      await busyWhileWaiting(`DELETE /api/${path}/1`, button('Delete'))
      await user.click(button('Cancel')())
    }

    // A note: create, archive, review, delete, and save; and restore an archived one.
    const notesButton = (label: string) => () => within(area).getByRole('button', { name: label })
    await user.click(notesButton('New note')())
    await user.type(await within(area).findByLabelText('Title'), 'Busy')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(await within(area).findByRole('combobox', { name: 'Collection' }), 'Work')
    await busyWhileWaiting('POST /api/notes', notesButton('Create'))
    await user.click(notesButton('Cancel')())
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await within(area).findByRole('heading', { name: 'Rails tips' })
    await busyWhileWaiting('PATCH /api/notes/7', notesButton('Archive'))
    await busyWhileWaiting('POST /api/notes/7/review', notesButton('Mark as reviewed'))
    await user.click(notesButton('Delete')())
    await busyWhileWaiting('DELETE /api/notes/7', notesButton('Delete'))
    await user.click(notesButton('Cancel')())
    await user.click(notesButton('Edit')())
    await within(area).findAllByRole('checkbox')
    await busyWhileWaiting('PATCH /api/notes/7', notesButton('Save'))
    await user.click(notesButton('Cancel')())
    await user.click(await within(area).findByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
    await within(area).findByRole('heading', { name: 'Old idea' })
    await busyWhileWaiting('PATCH /api/notes/12', notesButton('Restore'))
  }, LONG_TEST_MS)

  it('AC-24 the note forms check their fields at Create and Save and show each message under its field', async () => {
    const user = userEvent.setup()
    const create = later()
    const { count } = stubBackend({ 'POST /api/notes': create.handler })
    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const form = await within(area).findByRole('form', { name: 'New note' })
    const field = (label: string) => within(form).getByLabelText(label)
    const createButton = () => within(form).getByRole('button', { name: 'Create' })
    // The message tied to the field (aria-describedby) shows under it, and the field is invalid.
    const expectMessageUnder = (label: string, message: string) => {
      const control = field(label)
      expect(control).toHaveAccessibleDescription(message)
      expect(control).toHaveAttribute('aria-invalid', 'true')
      const shown = document.getElementById(control.getAttribute('aria-describedby') ?? '')
      expect(shown).toHaveTextContent(message)
      expect(control.compareDocumentPosition(shown!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    await within(form).findByLabelText('Title')

    // Typing checks nothing: no message shows before "Create".
    await user.type(field('Source URL (optional)'), 'example.com')
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument()

    // "Create" with "Title" and "Body" empty, a URL without http://, and no collection.
    await user.click(createButton())
    expectMessageUnder('Title', 'Enter a title.')
    expectMessageUnder('Body', 'Enter a body.')
    expectMessageUnder('Source URL (optional)', 'Enter a URL that starts with http:// or https://.')
    expectMessageUnder('Collection', 'Choose a collection.')
    expect(field('Title')).toHaveFocus()
    expect(within(form).getAllByRole('alert')).toHaveLength(4)

    // Typing does not check again: the title's message stays until the next "Create".
    await user.type(field('Title'), 'Rails tips')
    expect(field('Title')).toHaveAccessibleDescription('Enter a title.')

    // "Every N days": the number of days, empty and then 0; then a date the browser cannot read.
    await user.selectOptions(field('Review interval'), 'Every N days')
    await user.click(createButton())
    expectMessageUnder('Number of days', 'Enter the number of days.')
    expect(field('Title')).not.toHaveAttribute('aria-invalid')
    await user.type(field('Number of days'), '0')
    await user.click(createButton())
    expectMessageUnder('Number of days', 'Enter a whole number from 1 to 365.')
    const date = field('Next review date (optional)')
    // jsdom never reports bad input, so the field reports it here, as in src/ReviewInterval.test.tsx.
    const badInput = vi
      .spyOn(date as HTMLInputElement, 'validity', 'get')
      .mockReturnValue({ badInput: true, valid: false } as ValidityState)
    await user.click(createButton())
    expectMessageUnder('Next review date (optional)', 'Enter a valid date.')
    expect(count('POST /api/notes')).toBe(0)

    // Every field valid: "Create" removes the messages and creates the note.
    badInput.mockRestore()
    await user.selectOptions(field('Review interval'), 'None')
    await user.type(field('Body'), 'B')
    await user.clear(field('Source URL (optional)'))
    await user.selectOptions(field('Collection'), 'Work')
    await user.click(createButton())
    await create.requested
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument()
    for (const control of within(form).getAllByRole('textbox')) expect(control).not.toHaveAttribute('aria-invalid')
    create.answer(json(201, { note: fullNote(summary(20, 'Rails tips')) }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(count('POST /api/notes')).toBe(1)

    // The edit form: "Title" emptied, then "Save".
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const edit = await within(area).findByRole('form', { name: 'Edit note' })
    await user.clear(within(edit).getByLabelText('Title'))
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    const title = within(edit).getByLabelText('Title')
    expect(title).toHaveAccessibleDescription('Enter a title.')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveFocus()
    expect(count('PATCH /api/notes/12')).toBe(0)
  }, LONG_TEST_MS)

  it("AC-24 the server's refusals show under their fields and the forms keep what was typed", async () => {
    const user = userEvent.setup()
    const refused = (fields: Record<string, string>) => () => json(422, { error: 'validation_failed', fields })
    const { count } = stubBackend({
      'PATCH /api/notes/7': refused({ collection_id: 'not_found' }),
      'POST /api/notes': inTurn(
        refused({ review_interval: 'invalid' }),
        refused({ review_interval_days: 'invalid' }),
        refused({ tag_ids: 'not_found' }),
      ),
      'POST /api/collections': inTurn(refused({ name: 'blank' }), refused({ name: 'too_long' }), refused({ name: 'taken' })),
    })
    render(<App />)
    const area = await findNotesArea()

    // The edit form: the chosen collection was deleted in another tab.
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const edit = await within(area).findByRole('form', { name: 'Edit note' })
    await user.type(within(edit).getByLabelText('Body'), ' (draft)')
    await user.selectOptions(await within(edit).findByRole('combobox', { name: 'Collection' }), 'Books')
    await user.click(within(edit).getByRole('button', { name: 'Save' }))
    const collection = within(edit).getByRole('combobox', { name: 'Collection' })
    await waitFor(() => expect(collection).toHaveAccessibleDescription('This collection no longer exists. Choose another.'))
    expect(collection).toHaveAttribute('aria-invalid', 'true')
    expect(collection).toHaveDisplayValue('Books')
    expect(within(edit).getByLabelText('Title')).toHaveValue('Rails tips')
    expect(within(edit).getByLabelText('Body')).toHaveValue('Body of Rails tips (draft)')

    // The new-note form: the server refuses the interval, then the number of days, then a tag.
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(area).findByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const form = await within(area).findByRole('form', { name: 'New note' })
    const field = (label: string) => within(form).getByLabelText(label)
    await user.type(await within(form).findByLabelText('Title'), 'Days')
    await user.type(field('Body'), 'B')
    await user.selectOptions(await within(form).findByRole('combobox', { name: 'Collection' }), 'Work')
    await user.selectOptions(field('Review interval'), 'Every N days')
    await user.type(field('Number of days'), '10')
    const createButton = () => within(form).getByRole('button', { name: 'Create' })
    await user.click(createButton())
    await waitFor(() => expect(field('Review interval')).toHaveAccessibleDescription('Choose a review interval.'))
    expect(field('Review interval')).toHaveAttribute('aria-invalid', 'true')
    await user.click(createButton())
    await waitFor(() => expect(field('Number of days')).toHaveAccessibleDescription('Enter a whole number from 1 to 365.'))
    expect(field('Number of days')).toHaveAttribute('aria-invalid', 'true')
    await user.click(await within(form).findByRole('checkbox', { name: 'ruby' }))
    await user.click(createButton())
    const group = within(form).getByRole('group', { name: 'Tags' })
    expect(await within(group).findByRole('alert')).toHaveTextContent('A chosen tag no longer exists. Check the tags again.')
    expect(field('Title')).toHaveValue('Days')
    expect(field('Body')).toHaveValue('B')
    expect(field('Number of days')).toHaveValue('10')
    expect(within(form).getByRole('combobox', { name: 'Collection' })).toHaveDisplayValue('Work')
    expect(count('POST /api/notes')).toBe(3)

    // A collection's name is checked only on the server: "Create" sends it, empty included, and
    // its answer shows under "Collection name", which keeps what was typed.
    const collections = collectionsArea()
    await user.click(within(collections).getByRole('button', { name: 'New collection' }))
    const name = within(collections).getByLabelText('Collection name')
    const createCollection = () => within(collections).getByRole('button', { name: 'Create' })
    await user.click(createCollection())
    await waitFor(() => expect(name).toHaveAccessibleDescription('Enter a name.'))
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(count('POST /api/collections')).toBe(1)
    await user.click(name)
    await user.paste('x'.repeat(101))
    await user.click(createCollection())
    await waitFor(() => expect(name).toHaveAccessibleDescription('Use at most 100 characters.'))
    expect(name).toHaveValue('x'.repeat(101))
    await user.clear(name)
    await user.type(name, 'work')
    await user.click(createCollection())
    await waitFor(() => expect(name).toHaveAccessibleDescription('A collection with this name already exists.'))
    expect(name).toHaveValue('work')
    expect(count('POST /api/collections')).toBe(3)
  }, LONG_TEST_MS)

  it('AC-24 the server error, the sign-in error, and each load failure show their alert with Try again', async () => {
    const user = userEvent.setup()
    const signedIn: Handler = () => json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })

    // The session check gets no answer, then a 500: the server error each time, and no sign-in
    // screen. "Try again" checks the session again.
    const { count } = stubBackend({ 'GET /api/session': inTurn(noAnswer, error500, signedIn) })
    let page = render(<App />)
    for (const checks of [1, 2]) {
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Try again.')
      expect(count('GET /api/session')).toBe(checks)
      expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
    }
    expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(count('GET /api/session')).toBe(3)
    page.unmount()

    // A sign-in that did not complete.
    window.history.replaceState({}, '', '/?sign_in_error=github')
    stubBackend({}, 'signed-out')
    page = render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in with GitHub did not complete. Try again.')
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(window.location.search).toBe('')
    page.unmount()

    // Each list failing alone: its alert and "Try again" in its own area, which loads it again,
    // while the other areas show their lists.
    const lists = [
      {
        request: 'GET /api/collections',
        part: collectionsArea,
        failure: noAnswer,
        message: 'Could not load collections. Try again.',
        answer: { collections: COLLECTIONS },
        listed: 'Books',
      },
      {
        request: 'GET /api/tags',
        part: tagsArea,
        failure: error500,
        message: 'Could not load tags. Try again.',
        answer: { tags: TAGS },
        listed: 'ruby',
      },
      {
        request: 'GET /api/notes',
        part: () => screen.getByRole('main', { name: 'Notes' }),
        failure: error500,
        message: 'Could not load notes. Try again.',
        answer: { notes: [RAILS_TIPS, OLD_IDEA] },
        listed: 'Rails tips',
      },
    ]
    for (const list of lists) {
      stubBackend({ [list.request]: inTurn(list.failure, () => json(200, list.answer)) })
      page = render(<App />)
      await findNotesArea()
      expect(await within(list.part()).findByRole('alert')).toHaveTextContent(list.message)
      for (const other of lists.filter((each) => each !== list)) {
        expect(await within(other.part()).findByText(other.listed)).toBeInTheDocument()
      }
      await user.click(within(list.part()).getByRole('button', { name: 'Try again' }))
      expect(await within(list.part()).findByText(list.listed)).toBeInTheDocument()
      expect(within(list.part()).queryByRole('alert')).not.toBeInTheDocument()
      page.unmount()
    }

    // A note that cannot load: its alert with "Try again", which loads it.
    stubBackend({ 'GET /api/notes/7': inTurn(noAnswer, () => json(200, { note: fullNote(RAILS_TIPS) })) })
    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load the note. Try again.')
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
  }, LONG_TEST_MS)

  it('AC-24 a failed change names what failed and keeps the form, the detail, or the confirmation open', async () => {
    const user = userEvent.setup()
    const notFound = () => json(404, { error: 'not_found' })

    // Every change gets no answer, and then, in a second page, a 500.
    const changes = [
      'POST /api/collections',
      'PATCH /api/collections/1',
      'DELETE /api/collections/1',
      'POST /api/tags',
      'PATCH /api/tags/1',
      'DELETE /api/tags/1',
      'POST /api/notes',
      'PATCH /api/notes/7',
      'POST /api/notes/7/review',
      'DELETE /api/notes/7',
      'PATCH /api/notes/12',
    ]
    for (const failure of [noAnswer, error500]) {
      stubBackend(Object.fromEntries(changes.map((key) => [key, failure])))
      const page = render(<App />)
      const area = await findNotesArea()
      await within(area).findByRole('button', { name: 'Rails tips' })

      // In each left area: the create and the rename keep the typed name, and the delete keeps
      // its confirmation.
      const leftAreas: [() => HTMLElement, string, string][] = [
        [collectionsArea, 'collection', 'Work'],
        [tagsArea, 'tag', 'ai'],
      ]
      for (const [part, record, name] of leftAreas) {
        const button = (label: string) => within(part()).getByRole('button', { name: label })
        const field = () => within(part()).getByRole('textbox')
        await user.click(await within(part()).findByRole('button', { name: /^New / }))
        await user.type(field(), 'Ideas')
        await user.click(button('Create'))
        expect(await within(part()).findByRole('alert')).toHaveTextContent(`Could not create the ${record}. Try again.`)
        expect(field()).toHaveValue('Ideas')
        await user.click(button('Cancel'))
        await user.click(button(`Rename ${name}`))
        await user.clear(field())
        await user.type(field(), 'Renamed')
        await user.click(button('Save'))
        expect(await within(part()).findByRole('alert')).toHaveTextContent(`Could not rename the ${record}. Try again.`)
        expect(field()).toHaveValue('Renamed')
        await user.click(button('Cancel'))
        await user.click(button(`Delete ${name}`))
        await user.click(button('Delete'))
        expect(await within(part()).findByRole('alert')).toHaveTextContent(`Could not delete the ${record}. Try again.`)
        expect(within(part()).getByText(`Delete “${name}”? This cannot be undone.`)).toBeInTheDocument()
        await user.click(button('Cancel'))
      }

      // A note: the create and the save keep what was typed; the archive, the review, and the
      // restore keep the detail; the delete keeps its confirmation.
      const button = (label: string) => within(area).getByRole('button', { name: label })
      // A detail keeps the message of each action that failed, so the alert is found by its text.
      const alertSays = async (message: string) =>
        expect(await within(area).findByText(message)).toHaveAttribute('role', 'alert')
      await user.click(button('New note'))
      await user.type(await within(area).findByLabelText('Title'), 'Draft')
      await user.type(within(area).getByLabelText('Body'), 'B')
      await user.selectOptions(await within(area).findByRole('combobox', { name: 'Collection' }), 'Work')
      await user.click(button('Create'))
      await alertSays('Could not create the note. Try again.')
      expect(within(area).getByLabelText('Title')).toHaveValue('Draft')
      await user.click(button('Cancel'))

      await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
      await user.click(await within(area).findByRole('button', { name: 'Edit' }))
      await user.type(await within(area).findByLabelText('Title'), ' 2')
      await user.click(button('Save'))
      await alertSays('Could not save the note. Try again.')
      expect(within(area).getByLabelText('Title')).toHaveValue('Rails tips 2')
      await user.click(button('Cancel'))

      const detailStays = async (action: string, message: string) => {
        await user.click(await within(area).findByRole('button', { name: action }))
        await alertSays(message)
        expect(within(area).getByRole('heading', { level: 3 })).toBeInTheDocument()
        expect(within(area).getByRole('button', { name: action })).toBeEnabled()
      }
      await detailStays('Archive', 'Could not archive the note. Try again.')
      await detailStays('Mark as reviewed', 'Could not mark the note as reviewed. Try again.')
      await user.click(button('Delete'))
      await user.click(button('Delete'))
      await alertSays('Could not delete the note. Try again.')
      expect(within(area).getByRole('group', { name: 'Delete “Rails tips”' })).toBeInTheDocument()
      await user.click(button('Cancel'))
      await user.click(button('Back to notes'))
      await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
      await detailStays('Restore', 'Could not restore the note. Try again.')
      page.unmount()
    }

    // The special answers: a record that is gone (404), a refused delete (409), and a logout
    // with no answer.
    stubBackend({
      'PATCH /api/collections/1': notFound,
      'PATCH /api/tags/1': notFound,
      'DELETE /api/collections/2': () => json(409, { error: 'collection_not_empty' }),
      'PATCH /api/notes/7': notFound,
      'POST /api/notes/12/review': notFound,
      'DELETE /api/session': noAnswer,
    })
    render(<App />)
    const area = await findNotesArea()
    for (const [part, name, gone] of [
      [collectionsArea, 'Work', 'This collection no longer exists.'],
      [tagsArea, 'ai', 'This tag no longer exists.'],
    ] as const) {
      await user.click(await within(part()).findByRole('button', { name: `Rename ${name}` }))
      await user.click(within(part()).getByRole('button', { name: 'Save' }))
      expect(await within(part()).findByRole('alert')).toHaveTextContent(gone)
      expect(within(part()).queryByText(name)).not.toBeInTheDocument()
    }
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Delete Books' }))
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Delete' }))
    expect(await within(collectionsArea()).findByRole('alert')).toHaveTextContent(
      'This collection still has notes. Move or delete them first.',
    )
    expect(within(collectionsArea()).getByText('Delete “Books”? This cannot be undone.')).toBeInTheDocument()

    // A save and a review of a note deleted elsewhere: the list, without it, says so.
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await within(area).findByLabelText('Title')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(within(area).queryByRole('button', { name: 'Rails tips' })).not.toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Old idea' }))
    await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(within(area).queryByRole('button', { name: 'Old idea' })).not.toBeInTheDocument()

    // A logout with no answer: the alert under the header, and the main layout stays.
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    const logoutFailed = await screen.findByText('Could not log out. Try again.')
    expect(logoutFailed).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('banner').compareDocumentPosition(logoutFailed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    expect(screen.getByRole('main', { name: 'Notes' })).toBeInTheDocument()
  }, LONG_TEST_MS)

  it('AC-24 the reminders go offline with an alert and an ended sign-in shows the sign-in screen with no message', async () => {
    // A reminder in the panel, then the connection is lost with no refusal: the offline alert,
    // the reminder kept, "Open" enabled, and "Dismiss" disabled.
    stubBackend()
    let page = render(<App />)
    const socket = await mainLayoutSocket()
    const panel = await findPanel()
    confirm(socket)
    sendBatch(socket, [RAILS_TIPS_REMINDER])
    expect(within(panel).getByText('Rails tips')).toBeInTheDocument()
    act(() => socket.closeFromServer(1006))
    expect(within(panel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    expect(within(panel).getByText('Rails tips')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Open' })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Dismiss' })).toBeDisabled()
    page.unmount()

    // A list answered 401: the sign-in screen, with no message.
    stubBackend({ 'GET /api/notes': () => json(401, { error: 'unauthenticated' }) })
    page = render(<App />)
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    page.unmount()

    // The server refuses the app's connection: the sign-in screen, with no message.
    stubBackend()
    render(<App />)
    const refused = await mainLayoutSocket()
    act(() => {
      refused.open()
      refused.receive({ type: 'disconnect', reason: 'unauthorized', reconnect: false })
    })
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Review reminders' })).not.toBeInTheDocument()
  })
})
