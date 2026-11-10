import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'

// features/21_data_privacy. The app keeps nothing of my workspace in the browser's storage, and a
// page whose sign-in ended shows none of my data. The tests render the whole app signed in as
// "Ada Lovelace" and replace fetch, and src/test/setup.ts replaces WebSocket with a fake that the
// tests drive, so nothing leaves the test (requirements.md section 7). Every behavior checked here
// was built by features 05, 17, 20, and 22; these tests check it for privacy (plan, Deviations).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = () => Response | Promise<Response>

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

// My notes as the list shows them (GET /api/notes), newest first: "Plan B" with no schedule, and
// "Rails tips", due today, with the tag "ruby".
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
const PLAN_B = summary(5, 'Plan B')
const RAILS_TIPS = summary(4, 'Rails tips', {
  tags: [{ id: 1, name: 'ruby' }],
  review_interval: 'weekly',
  next_review_date: '2026-11-09',
  review_state: 'due_today',
})

// The reminder of "Rails tips", as a batch holds it (features/20_realtime_notifications question 2).
const RAILS_TIPS_REMINDER = {
  type: 'review_due_today',
  note_id: 4,
  title: 'Rails tips',
  collection_name: 'Work',
  next_review_date: '2026-11-09',
  review_state: 'due_today',
}

// Every name of mine that the main layout shows: my display name, my collections and tag, my
// notes, and my reminder.
const MY_NAMES = ['Ada Lovelace', 'Books', 'Work', 'ruby', 'Plan B', 'Rails tips']

// The names of mine that the page's text holds, hidden parts included.
const myNamesInPage = () => MY_NAMES.filter((name) => document.body.textContent?.includes(name))

// Answers like the backend for me, signed in, by method and address, query included, such as
// 'GET /api/notes?review=due_today'. A test adds or replaces answers. Any other request fails.
function stubBackend(routes: Record<string, Handler> = {}) {
  const answers: Record<string, Handler> = {
    'GET /api/session': () => json(200, { user: { id: 1, display_name: 'Ada Lovelace' } }),
    'GET /api/csrf': () => json(200, { token: 'csrf-token' }),
    'GET /api/collections': () => json(200, { collections: [{ id: 2, name: 'Books' }, { id: 1, name: 'Work' }] }),
    'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'ruby' }] }),
    'GET /api/notes': () => json(200, { notes: [PLAN_B, RAILS_TIPS] }),
    'DELETE /api/session': () => new Response(null, { status: 204 }),
    ...routes,
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const answer = answers[key]
    if (!answer) throw new Error(`unexpected request ${key}`)
    return answer()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const sockets = () => FakeWebSocket.instances

// The reminders subscription's identifier, as the client sends it.
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

// The server accepts the connection, confirms the subscription, and sends a batch with "Rails tips".
const confirmWithBatch = (socket: FakeWebSocket) =>
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
    socket.receive({ identifier: IDENTIFIER, message: { type: 'review_reminders', reminders: [RAILS_TIPS_REMINDER] } })
  })

const notesArea = () => screen.getByRole('main', { name: 'Notes' })
const collectionsArea = () => screen.getByRole('complementary', { name: 'Collections' })
const tagsArea = () => screen.getByRole('complementary', { name: 'Tags' })
const panel = () => screen.getByRole('region', { name: 'Review reminders' })
const signInScreenShows = () => screen.queryByRole('button', { name: 'Continue with Google' }) !== null

// Renders the app and waits for my lists, then for the connection the main layout opens: the
// newest socket, still connecting. The layout opens it in an effect, which can run after the
// layout shows on a loaded machine. Returns that connection.
async function showMyLists(): Promise<FakeWebSocket> {
  render(<App />)
  await within(await screen.findByRole('main', { name: 'Notes' })).findByRole('button', { name: 'Plan B' })
  await within(collectionsArea()).findByText('Work')
  await within(tagsArea()).findByText('ruby')
  const socket = await waitFor(() => {
    const newest = sockets().at(-1)
    expect(newest?.readyState).toBe(FakeWebSocket.CONNECTING)
    return newest as FakeWebSocket
  })
  return socket
}

// Shows my lists and the reminder "Rails tips", so every name of mine is in the page. Returns the
// connection.
async function showMyData(): Promise<FakeWebSocket> {
  const socket = await showMyLists()
  confirmWithBatch(socket)
  expect(within(panel()).getByText('Rails tips')).toBeInTheDocument()
  expect(myNamesInPage()).toEqual(MY_NAMES)
  return socket
}

describe('data privacy in the browser (features/21_data_privacy)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AC-21 the app keeps nothing in local storage or session storage while I use every area and after logout', async () => {
    const fetchMock = stubBackend({
      'POST /api/collections': () => json(201, { collection: { id: 3, name: 'Temp' } }),
      'POST /api/tags': () => json(201, { tag: { id: 2, name: 'tmp' } }),
      'GET /api/notes/5': () => json(200, { note: { ...PLAN_B, body: 'Body of Plan B', source_url: null } }),
      'GET /api/notes?search=plan': () => json(200, { notes: [PLAN_B] }),
      'GET /api/notes?search=plan&review=due_today': () => json(200, { notes: [] }),
    })
    const user = userEvent.setup()
    // Each step after which the browser's storage held something, with what it held. The page
    // sets no cookie of its own either: the session cookie is the server's, and httpOnly.
    const kept: string[] = []
    const checkStorage = (step: string) => {
      const held = [localStorage.length, sessionStorage.length, document.cookie]
      if (held.some((value) => value !== 0 && value !== '')) kept.push(`${step}: ${JSON.stringify(held)}`)
    }
    checkStorage('before the app starts')

    const socket = await showMyLists()
    checkStorage('the lists loaded')

    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    await user.type(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' }), 'Temp')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Create' }))
    await within(collectionsArea()).findByText('Temp')
    checkStorage('a collection created')

    await user.click(within(tagsArea()).getByRole('button', { name: 'New tag' }))
    await user.type(within(tagsArea()).getByRole('textbox', { name: 'Tag name' }), 'tmp')
    await user.click(within(tagsArea()).getByRole('button', { name: 'Create' }))
    await within(tagsArea()).findByText('tmp')
    checkStorage('a tag created')

    await user.click(within(notesArea()).getByRole('button', { name: 'Plan B' }))
    await within(notesArea()).findByRole('heading', { name: 'Plan B' })
    checkStorage('a note opened')
    await user.click(within(notesArea()).getByRole('button', { name: 'Back to notes' }))

    await user.click(await within(notesArea()).findByRole('searchbox', { name: 'Search' }))
    await user.paste('plan')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notes?search=plan'))
    await user.selectOptions(within(notesArea()).getByRole('combobox', { name: 'Review' }), 'Due today')
    await within(notesArea()).findByText('No notes match your search and filters.')
    expect(fetchMock).toHaveBeenCalledWith('/api/notes?search=plan&review=due_today')
    checkStorage('a search and a review choice')

    confirmWithBatch(socket)
    expect(within(panel()).getByText('Rails tips')).toBeInTheDocument()
    checkStorage('a batch in the panel')

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })
    checkStorage('after logout')

    expect(kept).toEqual([])
  })

  it('AC-21 no source file uses a browser storage', () => {
    // The app's sources as text, test files and src/test/ left out, as feature 24's light-theme
    // check reads them. jsdom has no IndexedDB, so this scan covers what the storage test cannot.
    const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}', '!./test/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    })
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining(['./App.tsx', './cable.ts', './main.tsx', './NoteFilters.tsx', './Notes.tsx']),
    )
    // The Cache API counts when it is used (caches.), so the verb "caches" in a comment does not.
    const storage = /\b(localStorage|sessionStorage|indexedDB|serviceWorker)\b|\bcaches\s*\.|document\.cookie/

    const users = Object.entries(sources)
      .filter(([, text]) => storage.test(text))
      .map(([file, text]) => `${file}: ${text.match(storage)?.[0]}`)

    expect(users).toEqual([])
  })

  it('AC-21 after logout the page holds none of my records, my name, or my reminders, and the connection is closed', async () => {
    stubBackend()
    const user = userEvent.setup()
    const socket = await showMyData()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })

    expect(myNamesInPage()).toEqual([])
    // The panel closes the connection in its effect's cleanup, which can run just after the
    // sign-in screen shows.
    await waitFor(() => expect(socket.closedByApp).toBe(true))
  })

  it("AC-21 another tab's logout shows the sign-in screen at once with none of my data", async () => {
    stubBackend()
    const socket = await showMyData()

    // A logout in another tab of this browser closes this tab's connection (features/22_websocket_auth question 4).
    act(() => {
      socket.receive({ type: 'disconnect', reason: 'remote', reconnect: false })
      socket.closeFromServer()
    })

    expect(signInScreenShows()).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(myNamesInPage()).toEqual([])
  })

  it('AC-21 a tab whose connection was lost keeps its data only until its next request answers 401 or its next connection is refused within 30 s', async () => {
    stubBackend({ 'GET /api/notes?review=due_today': () => json(401, { error: 'unauthenticated' }) })
    const socket = await showMyLists()

    // The test owns the clock from here, so each retry comes when the clock moves on. Testing
    // Library's findBy waits on setTimeout, so only synchronous queries run until the clock is
    // real again.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    confirmWithBatch(socket)
    expect(myNamesInPage()).toEqual(MY_NAMES)

    // The connection is lost at the moment of the logout, and each new attempt fails to open,
    // until the wait between two attempts is the longest (features/20_realtime_notifications
    // question 8). Meanwhile the tab keeps what it loaded.
    act(() => socket.closeFromServer(1006))
    for (const wait of [1_000, 2_000, 4_000, 8_000, 16_000]) {
      const count = sockets().length
      await act(() => vi.advanceTimersByTimeAsync(wait))
      expect(sockets()).toHaveLength(count + 1)
      act(() => sockets()[count].failToOpen())
      expect(within(panel()).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
      expect(myNamesInPage()).toEqual(MY_NAMES)
    }

    // The next attempt comes at most 30 s later, and the server refuses it.
    const count = sockets().length
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(sockets()).toHaveLength(count + 1)
    act(() => {
      const refused = sockets()[count]
      refused.open()
      refused.receive({ type: 'disconnect', reason: 'unauthorized', reconnect: false })
      refused.closeFromServer()
    })
    expect(signInScreenShows()).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(myNamesInPage()).toEqual([])
    vi.useRealTimers()
    cleanup()

    // Another tab, after the same loss: its next request answers 401, and the sign-in screen
    // shows at once.
    const user = userEvent.setup()
    const lost = await showMyLists()
    confirmWithBatch(lost)
    act(() => lost.closeFromServer(1006))
    expect(within(panel()).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    expect(myNamesInPage()).toEqual(MY_NAMES)

    await user.selectOptions(within(notesArea()).getByRole('combobox', { name: 'Review' }), 'Due today')

    await screen.findByRole('button', { name: 'Continue with Google' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(myNamesInPage()).toEqual([])
  })
})
