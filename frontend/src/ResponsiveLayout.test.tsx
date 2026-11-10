import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'
import { setWindowWidth } from './test/screen'
import { hoverClasses, keepsFocusVisible, lookOf } from './test/ui'

// features/25_responsive_layout. Below 768 px the left area moves into two push-down panels
// that the bar under the header opens: "Collections" and "Menu" (the tags). The tests render the
// whole app with a signed-in user and replace fetch, and src/test/setup.ts replaces WebSocket and
// matchMedia, so nothing leaves the test (requirements.md section 7). setWindowWidth sets the
// window's width; every test starts at 1280 px. jsdom has no layout: these tests check the
// panels, the order of the areas in the page, the requests, and the classes that make the layout
// fit; the Verify walkthrough measures the real layout in a browser.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// No answer: the network fails.
const noAnswer: Handler = () => {
  throw new TypeError('Failed to fetch')
}

// The left area's lists, in the server's order: the collections "Books" (id 2) and "Work"
// (id 1), and the tag "ruby" (id 2).
const COLLECTIONS = [
  { id: 2, name: 'Books' },
  { id: 1, name: 'Work' },
]
const TAGS = [{ id: 2, name: 'ruby' }]

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

type Note = Summary & { body: string; source_url: string | null }

// A note as its detail shows it (GET /api/notes/:id).
const fullNote = (note: Summary, fields: Partial<Note> = {}): Note => ({
  ...note,
  body: `Body of ${note.title}`,
  source_url: null,
  ...fields,
})

// The notes of the tests, newest first: "Rails tips" is weekly, with two tags and a source URL.
const NEWER = summary(4, 'Newer', { collection: { id: 2, name: 'Books' } })
const RAILS_TIPS = summary(3, 'Rails tips', {
  tags: [
    { id: 1, name: 'ai' },
    { id: 2, name: 'ruby' },
  ],
  review_interval: 'weekly',
  next_review_date: '2026-11-16',
  last_reviewed_date: '2026-11-09',
})
const OLDER = summary(1, 'Older')
const RAILS_TIPS_NOTE = fullNote(RAILS_TIPS, { source_url: 'https://guides.rubyonrails.org' })

type StubOptions = {
  // The signed-in user's display name.
  displayName?: string
  // What the session check answers: a signed-in user, the sign-in screen (401), a server
  // error (500), or nothing yet.
  session?: 'signed-in' | 'signed-out' | 'error' | 'held'
}

// Answers like the backend, as in src/NoteFilters.test.tsx: the session check, GET /api/csrf,
// the collections and tags lists above, the list of "Newer", "Rails tips", and "Older", and the
// detail of "Rails tips", unless the test names them; and the requests the test names by method
// and address. Any other request fails.
function stubBackend(routes: Record<string, Handler> = {}, options: StubOptions = {}) {
  const { displayName = 'Ada Lovelace', session = 'signed-in' } = options
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: COLLECTIONS }),
    'GET /api/tags': () => json(200, { tags: TAGS }),
    'GET /api/notes': () => json(200, { notes: [NEWER, RAILS_TIPS, OLDER] }),
    'GET /api/notes/3': () => json(200, { note: RAILS_TIPS_NOTE }),
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session' && !routes[key]) {
      if (session === 'signed-out') return json(401, { error: 'unauthenticated' })
      if (session === 'error') return json(500, { error: 'internal' })
      if (session === 'held') return new Promise<Response>(() => {})
      return json(200, { user: { id: 1, display_name: displayName } })
    }
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    const handler = routes[key] ?? defaults[key]
    if (!handler) throw new Error(`unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The requests made so far, by method and address, such as 'GET /api/collections'.
const requestsOf = (fetchMock: ReturnType<typeof stubBackend>) =>
  fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)

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

// The reminders subscription's identifier, as the client sends it (features/20_realtime_notifications).
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

type Reminder = {
  type: 'review_due_today' | 'review_overdue'
  note_id: number
  title: string
  collection_name: string
  next_review_date: string
  review_state: 'due_today' | 'overdue'
}

// A reminder as a batch holds it: due today (Nov 10, 2026), or overdue since Nov 9.
const reminder = (noteId: number, title: string, reviewState: Reminder['review_state'] = 'due_today'): Reminder => ({
  type: `review_${reviewState}`,
  note_id: noteId,
  title,
  collection_name: 'Work',
  next_review_date: reviewState === 'due_today' ? '2026-11-10' : '2026-11-09',
  review_state: reviewState,
})

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
const sendBatch = (socket: FakeWebSocket, reminders: Reminder[]) =>
  act(() => socket.receive({ identifier: IDENTIFIER, message: { type: 'review_reminders', reminders } }))

// The bar's buttons, on a narrow screen, and the bar that holds them.
const collectionsButton = () => screen.getByRole('button', { name: 'Collections' })
const menuButton = () => screen.getByRole('button', { name: 'Menu' })
const theBar = () => collectionsButton().parentElement as HTMLElement

// The areas while they show. A query by role leaves out an element inside a hidden panel, so
// these find an area only while its panel is open, or on a wide screen.
const collectionsArea = () => screen.getByRole('complementary', { name: 'Collections' })
const tagsArea = () => screen.getByRole('complementary', { name: 'Tags' })
const queryCollectionsArea = () => screen.queryByRole('complementary', { name: 'Collections' })
const queryTagsArea = () => screen.queryByRole('complementary', { name: 'Tags' })
// The areas, shown or hidden. They are found by their headings: an element inside a hidden
// panel has no accessible name, so a query by role and name cannot find it.
const anyArea = (heading: string) => screen.getByText(heading, { selector: 'h2' }).closest('aside') as HTMLElement
const anyCollectionsArea = () => anyArea('Collections')

const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })
const remindersPanel = () => screen.getByRole('region', { name: 'Review reminders' })

// Whether the first element comes before the second in the page, outside it.
const isBefore = (first: Element, second: Element) =>
  !first.contains(second) && Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

// The nearest element that holds both: for an area and the notes area, the row of the left
// area and the main area.
const commonParent = (first: Element, second: Element) => {
  let parent = first.parentElement
  while (parent && !parent.contains(second)) parent = parent.parentElement
  return parent as HTMLElement
}

// The left area: the row's child that holds the areas, shown or hidden.
const leftAreaOf = (notesArea: HTMLElement) => {
  const row = commonParent(anyCollectionsArea(), notesArea)
  return [...row.children].find((child) => child.contains(anyCollectionsArea())) as HTMLElement
}

// The classes that set an element's width.
const widthClasses = (element: Element) => [...element.classList].filter((name) => /^(w|min-w|max-w|basis)-/.test(name))

// The side padding an element's classes give it, in Tailwind's spacing units: '4' for px-4 or p-4.
const sidePadding = (element: Element) => {
  const names = [...element.classList]
  const found = names.find((name) => /^px-/.test(name)) ?? names.find((name) => /^p-/.test(name))
  return found?.replace(/^px?-/, '') ?? null
}

// Whether the element's text may break between any two letters: it, or an element around it,
// has wrap-anywhere, which sets overflow-wrap, an inherited property.
const breaksAnywhere = (element: Element) => element.closest('.wrap-anywhere') !== null

// Whether an element shows: no hidden attribute, and no class that hides it, on it or around it.
// jsdom applies no Tailwind class, so the classes are read.
const shows = (element: Element) => element.closest('[hidden], .hidden, .invisible, .sr-only') === null

// The texts a user sees in an element: its headings, terms, values, labels, legends, buttons,
// links, and choices, each with its tag, in the page's order.
const shownTexts = (root: Element) =>
  [...root.querySelectorAll('h3, dt, dd, label, legend, button, a, option')]
    .filter(shows)
    .map((element) => `${element.tagName.toLowerCase()}: ${element.textContent}`)

// The largest height an element's classes allow, in rem: max-h-48 is 12rem, Tailwind's spacing
// scale being 0.25rem a step; null with no max-h- class.
const maxHeightRem = (element: Element) => {
  const name = [...element.classList].find((className) => className.startsWith('max-h-'))
  const step = name && /^max-h-(\d+(?:\.\d+)?)$/.exec(name)
  if (step) return Number(step[1]) / 4
  const rem = name && /^max-h-\[(\d+(?:\.\d+)?)rem\]$/.exec(name)
  return rem ? Number(rem[1]) : null
}

// The classes that keep a text on one line, or give an element a fixed width.
const oneLineOrFixedWidth = (element: Element) =>
  [...element.classList].filter(
    (name) =>
      ['whitespace-nowrap', 'whitespace-pre', 'text-nowrap', 'truncate'].includes(name) || /^(w|min-w)-(\d|\[|px)/.test(name),
  )

// The choices of a select, in its order.
const choices = (control: HTMLElement) => within(control).getAllByRole('option').map((option) => option.textContent)

// The filter bar's "Collection" and "Tag", found in the notes area: the note form has a
// "Collection" too.
const filterChoices = (notesArea: HTMLElement, name: 'Collection' | 'Tag') =>
  choices(within(notesArea).getByRole('combobox', { name }))

// The names an area lists, in its order, once loaded.
const findNames = async (area: HTMLElement, testId: string) =>
  (await within(area).findAllByTestId(testId)).map((name) => name.textContent)

// The tests that walk several views take 1 to 2 s on a busy machine; they get more than Vitest's
// default of 5 s, as in src/UiStates.test.tsx.
const LONG_TEST_MS = 15_000

// Renders the app in a window of this width, and waits for the main layout.
async function renderAt(width: number) {
  setWindowWidth(width)
  const rendered = render(<App />)
  const notesArea = await findNotesArea()
  return { ...rendered, notesArea }
}

describe('the layout on narrow screens (features/25_responsive_layout)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-25 below 768 px a bar shows Collections and Menu and hides the left area, and from 768 px the left area shows with no bar', async () => {
    stubBackend()

    // 767 px is narrow: the bar, with both panels closed, and no area of the left column.
    const narrow = await renderAt(767)
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(isBefore(screen.getByRole('banner'), theBar())).toBe(true)
    expect(isBefore(theBar(), narrow.notesArea)).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Collections' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tags' })).not.toBeInTheDocument()
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    expect(queryTagsArea()).not.toBeInTheDocument()
    narrow.unmount()

    // 768 px and 1280 px are wide: no bar, and the collections area above the tags area, both
    // before the notes area.
    for (const width of [768, 1280]) {
      const wide = await renderAt(width)
      expect(screen.queryByRole('button', { name: 'Collections' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
      expect(within(collectionsArea()).getByRole('heading', { name: 'Collections' })).toBeVisible()
      expect(within(tagsArea()).getByRole('heading', { name: 'Tags' })).toBeVisible()
      expect(isBefore(collectionsArea(), tagsArea())).toBe(true)
      expect(isBefore(tagsArea(), wide.notesArea)).toBe(true)
      wide.unmount()
    }
  })

  it('AC-25 Collections opens the collections area below the bar', async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(375)

    await user.click(collectionsButton())

    // The collections area, whole: its heading, its list, and "New collection".
    const area = collectionsArea()
    expect(within(area).getByRole('heading', { name: 'Collections' })).toBeVisible()
    expect(await findNames(area, 'collection-name')).toEqual(['Books', 'Work'])
    expect(within(area).getByRole('button', { name: 'New collection' })).toBeVisible()
    // It opens below the bar, before the reminders panel and the notes area, which the row
    // stacks under it, and it sets no width of its own, so it spans the window.
    expect(isBefore(theBar(), area)).toBe(true)
    expect(isBefore(area, remindersPanel())).toBe(true)
    expect(isBefore(area, notesArea)).toBe(true)
    expect(commonParent(area, notesArea)).toHaveClass('flex', 'flex-col')
    expect(widthClasses(leftAreaOf(notesArea))).toEqual([])
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'true')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryTagsArea()).not.toBeInTheDocument()
  })

  it('AC-25 Menu opens the tags area below the bar', async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(375)

    await user.click(menuButton())

    // The tags area, whole: its heading, its list, and "New tag".
    const area = tagsArea()
    expect(within(area).getByRole('heading', { name: 'Tags' })).toBeVisible()
    expect(await findNames(area, 'tag-name')).toEqual(['ruby'])
    expect(within(area).getByRole('button', { name: 'New tag' })).toBeVisible()
    expect(isBefore(theBar(), area)).toBe(true)
    expect(isBefore(area, remindersPanel())).toBe(true)
    expect(isBefore(area, notesArea)).toBe(true)
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryCollectionsArea()).not.toBeInTheDocument()
  })

  it('AC-25 opening one panel closes the other', async () => {
    const user = userEvent.setup()
    stubBackend()
    await renderAt(375)

    await user.click(collectionsButton())
    expect(collectionsArea()).toBeVisible()
    await user.click(menuButton())

    expect(tagsArea()).toBeVisible()
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')

    // And the other way round.
    await user.click(collectionsButton())
    expect(collectionsArea()).toBeVisible()
    expect(queryTagsArea()).not.toBeInTheDocument()
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'true')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it("AC-25 a panel's button closes its open panel", async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(375)

    await user.click(collectionsButton())
    expect(collectionsArea()).toBeVisible()
    await user.click(collectionsButton())

    // Closed: the area is hidden again, and so is the left area, so nothing is left between
    // the bar and the reminders panel and the notes area.
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    expect(leftAreaOf(notesArea)).not.toBeVisible()
    expect(isBefore(theBar(), remindersPanel())).toBe(true)
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')

    // The same for "Menu".
    await user.click(menuButton())
    expect(tagsArea()).toBeVisible()
    await user.click(menuButton())
    expect(queryTagsArea()).not.toBeInTheDocument()
    expect(leftAreaOf(notesArea)).not.toBeVisible()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it("AC-25 the bar's buttons are reached with Tab and toggled with Enter and Space", async () => {
    const user = userEvent.setup()
    stubBackend()
    await renderAt(375)

    // From "Log out", Tab reaches "Collections" and then "Menu".
    act(() => screen.getByRole('button', { name: 'Log out' }).focus())
    await user.tab()
    expect(collectionsButton()).toHaveFocus()
    await user.tab()
    expect(menuButton()).toHaveFocus()

    // Enter on "Collections" opens its panel, and Enter again closes it.
    await user.tab({ shift: true })
    expect(collectionsButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'true')
    expect(collectionsArea()).toBeVisible()
    await user.keyboard('{Enter}')
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryCollectionsArea()).not.toBeInTheDocument()

    // Space on "Menu" does the same.
    await user.tab()
    expect(menuButton()).toHaveFocus()
    await user.keyboard(' ')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(tagsArea()).toBeVisible()
    await user.keyboard(' ')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryTagsArea()).not.toBeInTheDocument()
  })

  it("AC-25 the bar's buttons have hover and focus states and the outlined look, and the bar has the header's side padding", async () => {
    stubBackend()
    const { notesArea } = await renderAt(375)

    const logOut = screen.getByRole('button', { name: 'Log out' })
    for (const button of [collectionsButton(), menuButton()]) {
      expect(hoverClasses(button)).not.toEqual([])
      expect(keepsFocusVisible(button)).toBe(true)
      // The outlined kind of features/24_ui_states question 4, as "Log out" has it.
      expect(lookOf(button)).toMatchObject({
        fontSize: 'sm',
        padding: ['px-3', 'py-1'],
        rounding: 'rounded',
        border: ['border', 'border-slate-300'],
        background: null,
      })
      expect(lookOf(button)).toEqual(lookOf(logOut))
    }
    // The bar's side padding is the header's and the notes area's: 16 px.
    expect(sidePadding(theBar())).toBe('4')
    expect(sidePadding(screen.getByRole('banner'))).toBe('4')
    expect(sidePadding(notesArea)).toBe('4')
  })

  it('AC-25 a closed panel keeps its open form, what was typed, and its confirmation, with no request', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend({
      // "Books" still has notes, so its delete is refused (features/07_collection_delete_rule).
      'DELETE /api/collections/2': () => json(409, { error: 'collection_not_empty' }),
    })
    await renderAt(375)
    await user.click(collectionsButton())
    await findNames(collectionsArea(), 'collection-name')

    // "Wo" typed in the new-collection form stays through a close and an open, with no request.
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    await user.type(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' }), 'Wo')
    const typed = requestsOf(fetchMock).length
    await user.click(collectionsButton())
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    await user.click(collectionsButton())
    expect(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' })).toHaveValue('Wo')

    // The form stays open, with "Wo", while the tags panel is used, and the tags keep theirs.
    await user.click(menuButton())
    await user.click(within(tagsArea()).getByRole('button', { name: 'New tag' }))
    await user.type(within(tagsArea()).getByRole('textbox', { name: 'Tag name' }), 'ru')
    await user.click(collectionsButton())
    expect(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' })).toHaveValue('Wo')
    await user.click(menuButton())
    expect(within(tagsArea()).getByRole('textbox', { name: 'Tag name' })).toHaveValue('ru')
    expect(requestsOf(fetchMock)).toHaveLength(typed)

    // An open delete confirmation, with its refusal, stays as it was.
    await user.click(collectionsButton())
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Delete Books' }))
    const confirmation = within(collectionsArea()).getByRole('group', { name: /Delete “Books”/ })
    await user.click(within(confirmation).getByRole('button', { name: 'Delete' }))
    expect(await within(confirmation).findByRole('alert')).toHaveTextContent(
      'This collection still has notes. Move or delete them first.',
    )
    const refused = requestsOf(fetchMock).length
    await user.click(collectionsButton())
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    await user.click(collectionsButton())
    const kept = within(collectionsArea()).getByRole('group', { name: /Delete “Books”/ })
    expect(within(kept).getByRole('alert')).toHaveTextContent('This collection still has notes. Move or delete them first.')
    expect(requestsOf(fetchMock)).toHaveLength(refused)
  }, LONG_TEST_MS)

  it('AC-25 Escape and choices outside a panel leave it open', async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(375)
    await user.click(menuButton())
    await findNames(tagsArea(), 'tag-name')

    // Escape in the new-tag form's field closes the form, as on a wide screen; the panel stays.
    await user.click(within(tagsArea()).getByRole('button', { name: 'New tag' }))
    await user.type(within(tagsArea()).getByRole('textbox', { name: 'Tag name' }), 'ru')
    await user.keyboard('{Escape}')
    expect(within(tagsArea()).queryByRole('textbox', { name: 'Tag name' })).not.toBeInTheDocument()
    expect(within(tagsArea()).getByRole('button', { name: 'New tag' })).toBeVisible()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')

    // Escape in a delete confirmation cancels it; the panel stays.
    await user.click(within(tagsArea()).getByRole('button', { name: 'Delete ruby' }))
    expect(within(tagsArea()).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(within(tagsArea()).queryByRole('group')).not.toBeInTheDocument()
    expect(within(tagsArea()).getByTestId('tag-name')).toHaveTextContent('ruby')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')

    // Choosing the notes area, or a note's title in it, leaves the panel open.
    await user.click(notesArea)
    expect(tagsArea()).toBeVisible()
    await user.click(await within(notesArea).findByRole('button', { name: 'Rails tips' }))
    expect(await within(notesArea).findByRole('heading', { name: 'Rails tips' })).toHaveFocus()
    expect(tagsArea()).toBeVisible()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('AC-25 collections and tags are managed inside their panels, which stay open, and the filter bar follows', async () => {
    const user = userEvent.setup()
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 2, name: 'Books' }] }),
      'GET /api/tags': () => json(200, { tags: [] }),
      'POST /api/collections': () => json(201, { collection: { id: 5, name: 'Work' } }),
      'PATCH /api/collections/5': () => json(200, { collection: { id: 5, name: 'Job' } }),
      'DELETE /api/collections/5': () => new Response(null, { status: 204 }),
      'POST /api/tags': () => json(201, { tag: { id: 7, name: 'ruby' } }),
    })
    const { notesArea } = await renderAt(375)
    await waitFor(() => expect(filterChoices(notesArea, 'Collection')).toEqual(['All', 'Books']))
    await user.click(collectionsButton())
    const area = collectionsArea()
    const stillOpen = () => {
      expect(collectionsButton()).toHaveAttribute('aria-expanded', 'true')
      expect(collectionsArea()).toBeVisible()
    }

    // Create "Work".
    await user.click(within(area).getByRole('button', { name: 'New collection' }))
    await user.type(within(area).getByRole('textbox', { name: 'Collection name' }), 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    expect(await findNames(area, 'collection-name')).toEqual(['Books', 'Work'])
    stillOpen()
    await waitFor(() => expect(filterChoices(notesArea, 'Collection')).toEqual(['All', 'Books', 'Work']))

    // Rename it to "Job".
    await user.click(within(area).getByRole('button', { name: 'Rename Work' }))
    const field = within(area).getByRole('textbox', { name: 'Collection name' })
    await user.clear(field)
    await user.type(field, 'Job')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(area).getAllByTestId('collection-name').map((name) => name.textContent)).toEqual(['Books', 'Job']))
    stillOpen()
    await waitFor(() => expect(filterChoices(notesArea, 'Collection')).toEqual(['All', 'Books', 'Job']))

    // Delete it.
    await user.click(within(area).getByRole('button', { name: 'Delete Job' }))
    await user.click(within(within(area).getByRole('group')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(area).getAllByTestId('collection-name').map((name) => name.textContent)).toEqual(['Books']))
    stillOpen()
    await waitFor(() => expect(filterChoices(notesArea, 'Collection')).toEqual(['All', 'Books']))

    // A tag created in the tags panel reaches "Tag" the same way.
    await user.click(menuButton())
    await user.click(within(tagsArea()).getByRole('button', { name: 'New tag' }))
    await user.type(within(tagsArea()).getByRole('textbox', { name: 'Tag name' }), 'ruby')
    await user.click(within(tagsArea()).getByRole('button', { name: 'Create' }))
    expect(await findNames(tagsArea(), 'tag-name')).toEqual(['ruby'])
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(filterChoices(notesArea, 'Tag')).toEqual(['All', 'ruby']))
  }, LONG_TEST_MS)

  it('AC-25 the collections and tags load while their panels are closed and fill the filter bar', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend()
    const { notesArea } = await renderAt(375)

    // No panel is open, and the bar's lists offer the left area's records.
    await waitFor(() => expect(filterChoices(notesArea, 'Collection')).toEqual(['All', 'Books', 'Work']))
    await waitFor(() => expect(filterChoices(notesArea, 'Tag')).toEqual(['All', 'ruby']))
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    const asked = (key: string) => requestsOf(fetchMock).filter((request) => request === key)
    expect(asked('GET /api/collections')).toHaveLength(1)
    expect(asked('GET /api/tags')).toHaveLength(1)

    // Opening and closing both panels sends no request.
    const before = requestsOf(fetchMock).length
    await user.click(collectionsButton())
    expect(await findNames(collectionsArea(), 'collection-name')).toEqual(['Books', 'Work'])
    await user.click(menuButton())
    expect(await findNames(tagsArea(), 'tag-name')).toEqual(['ruby'])
    await user.click(menuButton())
    await user.click(collectionsButton())
    await user.click(collectionsButton())
    expect(requestsOf(fetchMock)).toHaveLength(before)
  })

  it('AC-25 a list that cannot load shows its failure in its panel, and a 401 shows the sign-in screen at once', async () => {
    const user = userEvent.setup()
    // The collections get no answer at first, and their list on "Try again". The tags wait for
    // the test, then are empty.
    let collectionsAsked = 0
    const tags = later()
    stubBackend({
      'GET /api/collections': (init) => (collectionsAsked++ === 0 ? noAnswer(init) : json(200, { collections: COLLECTIONS })),
      'GET /api/tags': tags.handler,
    })
    const first = await renderAt(375)

    await user.click(collectionsButton())
    expect(await within(collectionsArea()).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Try again' }))
    expect(await findNames(collectionsArea(), 'collection-name')).toEqual(['Books', 'Work'])

    // The tags panel shows "Loading…", then "No tags yet".
    await user.click(menuButton())
    expect(within(tagsArea()).getByRole('status')).toHaveTextContent('Loading…')
    await tags.requested
    tags.answer(json(200, { tags: [] }))
    expect(await within(tagsArea()).findByText('No tags yet')).toBeVisible()
    first.unmount()

    // A collections request answered 401 shows the sign-in screen at once, with both panels closed.
    stubBackend({ 'GET /api/collections': () => json(401, { error: 'unauthenticated' }) })
    setWindowWidth(375)
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeVisible()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('AC-25 crossing 768 px switches the layout at once, keeps what was typed, and starts narrow with the panels closed', async () => {
    const user = userEvent.setup()
    const fetchMock = stubBackend()
    const { notesArea } = await renderAt(1280)
    await findNames(collectionsArea(), 'collection-name')
    await user.click(await within(notesArea).findByRole('button', { name: 'Rails tips' }))
    expect(await within(notesArea).findByRole('heading', { name: 'Rails tips' })).toBeVisible()
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    await user.type(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' }), 'Wo')
    const before = requestsOf(fetchMock).length

    // Narrow: the bar, with both panels closed, and the detail of "Rails tips" as it was.
    setWindowWidth(375)
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    expect(queryTagsArea()).not.toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Notes' })).toBe(notesArea)
    expect(within(notesArea).getByRole('heading', { name: 'Rails tips' })).toBeVisible()
    await user.click(collectionsButton())
    expect(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' })).toHaveValue('Wo')

    // Wide again: the left column beside the notes, with the form and "Wo".
    setWindowWidth(1280)
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
    expect(within(collectionsArea()).getByRole('textbox', { name: 'Collection name' })).toHaveValue('Wo')
    expect(tagsArea()).toBeVisible()
    expect(commonParent(collectionsArea(), notesArea)).not.toHaveClass('flex-col')
    expect(leftAreaOf(notesArea)).toHaveClass('w-64')
    expect(within(notesArea).getByRole('heading', { name: 'Rails tips' })).toBeVisible()

    // Narrow once more: the panel opened before starts closed.
    setWindowWidth(375)
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(queryCollectionsArea()).not.toBeInTheDocument()
    expect(within(notesArea).getByRole('heading', { name: 'Rails tips' })).toBeVisible()
    expect(requestsOf(fetchMock)).toHaveLength(before)
  })

  it('AC-25 the header wraps, cuts a long display name, and keeps Log out whole', async () => {
    const user = userEvent.setup()
    const name = 'Maximilian Alexander von Habsburg-Lothringen'
    stubBackend({ 'DELETE /api/session': () => json(500, { error: 'internal' }) }, { displayName: name })
    await renderAt(320)

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('heading', { name: 'Personal Knowledge Base' })).toBeVisible()
    const shownName = within(header).getByText(name)
    const logOut = within(header).getByRole('button', { name: 'Log out' })
    // The header goes onto a second line when its parts do not fit on one.
    expect(header).toHaveClass('flex', 'flex-wrap')
    // The name is cut with "…": it, and the element that holds it, may be narrower than the text.
    expect(shownName).toHaveClass('truncate', 'min-w-0')
    expect(shownName.parentElement).toHaveClass('min-w-0')
    // "Log out" never shrinks.
    expect(logOut).toHaveClass('shrink-0')

    // A failed logout shows its alert under the header, outside it, across the layout.
    await user.click(logOut)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not log out. Try again.')
    expect(header).not.toContainElement(alert)
    expect(isBefore(header, alert)).toBe(true)
    expect(alert.parentElement).toBe(header.parentElement)
    expect(widthClasses(alert)).toEqual([])
  })

  it('AC-25 the filter bar wraps with Search on a line of its own on a narrow screen', async () => {
    stubBackend()
    // The bar's element, and the element of the bar that holds a control.
    const barOf = (notesArea: HTMLElement) =>
      commonParent(
        within(notesArea).getByRole('searchbox', { name: 'Search' }),
        within(notesArea).getByRole('combobox', { name: 'Review' }),
      )
    const controlOf = (bar: HTMLElement, element: Element) =>
      [...bar.children].find((child) => child.contains(element)) as HTMLElement

    // On a wide screen the bar also wraps when its controls do not fit.
    const wide = await renderAt(1280)
    expect(barOf(wide.notesArea)).toHaveClass('flex', 'flex-wrap')
    wide.unmount()

    const { notesArea } = await renderAt(320)
    const bar = barOf(notesArea)
    expect(bar).toHaveClass('flex', 'flex-wrap')
    // "Search" takes a line of its own, and its field the rest of that line.
    const search = within(notesArea).getByRole('searchbox', { name: 'Search' })
    const searchControl = controlOf(bar, search)
    expect(searchControl).toHaveClass('basis-full')
    expect(within(searchControl).getByText('Search', { selector: 'label' })).toBeVisible()
    expect(search).toHaveClass('w-full')
    // "Collection", "Tag", "Status", and "Review" follow it in that order, each label kept with
    // its select.
    const controls = ['Collection', 'Tag', 'Status', 'Review'].map((name) => {
      const control = controlOf(bar, within(notesArea).getByRole('combobox', { name }))
      expect(within(control).getByText(name, { selector: 'label' })).toBeVisible()
      expect(control).toHaveClass('shrink-0')
      return control
    })
    expect(new Set([searchControl, ...controls]).size).toBe(5)
    ;[searchControl, ...controls].reduce((before, control) => {
      expect(isBefore(before, control)).toBe(true)
      return control
    })
  })

  it('AC-25 the notes list, the detail, and the note forms fit the width, with long words breaking and buttons wrapping', async () => {
    const user = userEvent.setup()
    // A title of 200 letters with no space, and a source URL of 2,000 characters.
    const longTitle = 'a'.repeat(200)
    const longUrl = `https://example.com/${'b'.repeat(1980)}`
    const long = summary(5, longTitle, {
      tags: [{ id: 2, name: 'ruby' }],
      review_interval: 'weekly',
      next_review_date: '2026-11-16',
    })
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [long, NEWER, RAILS_TIPS, OLDER] }),
      'GET /api/notes/5': () => json(200, { note: fullNote(long, { body: 'c'.repeat(300), source_url: longUrl }) }),
    })
    const { notesArea } = await renderAt(320)
    const socket = await mainLayoutSocket()

    // The main area may be narrower than its content, which then wraps inside it.
    expect(commonParent(remindersPanel(), notesArea)).toHaveClass('min-w-0')

    // The list is one column, newest first, and each entry's title, collection, tags, and review
    // line break inside the entry.
    const titles = await within(notesArea).findAllByTestId('note-title')
    expect(titles.map((title) => title.textContent)).toEqual([longTitle, 'Newer', 'Rails tips', 'Older'])
    expect(within(notesArea).getByRole('list')).toHaveClass('flex', 'flex-col')
    for (const title of titles) {
      const entry = title.closest('li') as HTMLElement
      const texts = ['note-title', 'note-collection', 'note-tags', 'note-review'].flatMap((id) => within(entry).queryAllByTestId(id))
      for (const text of texts) {
        expect(text).toHaveClass('min-w-0')
        expect(breaksAnywhere(text)).toBe(true)
      }
    }

    // The detail: the title, the rows' values, the body, and the source URL break; the actions
    // wrap, and so do the delete confirmation's buttons.
    await user.click(titles[0])
    const heading = await within(notesArea).findByRole('heading', { name: longTitle })
    expect(heading).toHaveClass('min-w-0')
    expect(breaksAnywhere(heading)).toBe(true)
    expect(breaksAnywhere(within(notesArea).getByRole('link', { name: longUrl }))).toBe(true)
    expect(breaksAnywhere(within(notesArea).getByTestId('note-body'))).toBe(true)
    for (const value of notesArea.querySelectorAll('dd')) expect(breaksAnywhere(value)).toBe(true)
    const actions = within(notesArea).getByRole('button', { name: 'Mark as reviewed' }).parentElement as HTMLElement
    expect(actions).toHaveClass('flex', 'flex-wrap')
    await user.click(within(actions).getByRole('button', { name: 'Delete' }))
    const confirmation = within(notesArea).getByRole('group', { name: `Delete “${longTitle}”` })
    expect(breaksAnywhere(within(confirmation).getByText(/This cannot be undone/))).toBe(true)
    expect(within(confirmation).getByRole('button', { name: 'Delete' }).parentElement).toHaveClass('flex', 'flex-wrap')
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))

    // A note form takes the notes area's width and each field the form's, its groups may be
    // narrower than their content, its tag names break, and its buttons wrap.
    const fitsTheWidth = async (form: HTMLElement, submit: string) => {
      await within(form).findByRole('checkbox', { name: 'ruby' })
      await user.selectOptions(within(form).getByRole('combobox', { name: 'Review interval' }), 'custom')
      expect(form).toHaveClass('w-full')
      const fields = [...form.querySelectorAll('input:not([type="checkbox"]), select, textarea')]
      expect(fields).toHaveLength(7)
      for (const field of fields) expect(field).toHaveClass('w-full')
      for (const group of form.querySelectorAll('fieldset')) expect(group).toHaveClass('min-w-0')
      expect(breaksAnywhere(within(form).getByRole('checkbox', { name: 'ruby' }).closest('label') as HTMLElement)).toBe(true)
      expect(within(form).getByRole('button', { name: submit }).parentElement).toHaveClass('flex', 'flex-wrap')
    }
    await user.click(within(notesArea).getByRole('button', { name: 'Edit' }))
    const editForm = await within(notesArea).findByRole('form', { name: 'Edit note' })
    await fitsTheWidth(editForm, 'Save')
    await user.click(within(editForm).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(notesArea).findByRole('button', { name: 'Back to notes' }))
    await user.click(await within(notesArea).findByRole('button', { name: 'New note' }))
    await fitsTheWidth(await within(notesArea).findByRole('form', { name: 'New note' }), 'Create')

    // The left area's names break, and its name form's and delete confirmation's buttons wrap.
    await user.click(collectionsButton())
    const area = collectionsArea()
    for (const name of await within(area).findAllByTestId('collection-name')) {
      expect(name).toHaveClass('min-w-0')
      expect(breaksAnywhere(name)).toBe(true)
    }
    await user.click(within(area).getByRole('button', { name: 'New collection' }))
    expect(within(area).getByRole('button', { name: 'Create' }).parentElement).toHaveClass('flex', 'flex-wrap')
    await user.click(within(area).getByRole('button', { name: 'Delete Books' }))
    const question = within(area).getByRole('group', { name: /Delete “Books”/ })
    expect(breaksAnywhere(within(question).getByText(/This cannot be undone/))).toBe(true)
    expect(within(question).getByRole('button', { name: 'Delete' }).parentElement).toHaveClass('flex', 'flex-wrap')

    // The reminders panel's titles and collection names break too.
    confirm(socket)
    sendBatch(socket, [reminder(5, longTitle)])
    const entry = within(remindersPanel()).getByText(longTitle).closest('li') as HTMLElement
    for (const text of [within(entry).getByText(longTitle), within(entry).getByText('Work')]) {
      expect(text).toHaveClass('min-w-0')
      expect(breaksAnywhere(text)).toBe(true)
    }
    expect(entry).toHaveClass('flex', 'flex-wrap')
  }, LONG_TEST_MS)

  it('AC-25 every field, label, and value of the wide layout shows on a narrow screen', async () => {
    const user = userEvent.setup()
    stubBackend()
    // What the notes area shows, at a width, of the detail of "Rails tips", of its edit form, and
    // of the new-note form, each form with "Every N days" chosen.
    const seenAt = async (width: number) => {
      const { notesArea, unmount } = await renderAt(width)
      await user.click(await within(notesArea).findByRole('button', { name: 'Rails tips' }))
      await within(notesArea).findByRole('heading', { name: 'Rails tips' })
      const detail = shownTexts(notesArea)
      const formTexts = async (form: HTMLElement) => {
        await within(form).findByRole('checkbox', { name: 'ruby' })
        await user.selectOptions(within(form).getByRole('combobox', { name: 'Review interval' }), 'custom')
        return shownTexts(form)
      }
      await user.click(within(notesArea).getByRole('button', { name: 'Edit' }))
      const edit = await formTexts(await within(notesArea).findByRole('form', { name: 'Edit note' }))
      await user.click(within(notesArea).getByRole('button', { name: 'Cancel' }))
      await user.click(await within(notesArea).findByRole('button', { name: 'Back to notes' }))
      await user.click(await within(notesArea).findByRole('button', { name: 'New note' }))
      const create = await formTexts(await within(notesArea).findByRole('form', { name: 'New note' }))
      unmount()
      return { detail, edit, create }
    }

    const wide = await seenAt(1280)
    // The wide layout shows the rows and the buttons the spec names.
    expect(wide.detail).toEqual(
      expect.arrayContaining([
        'dt: Collection',
        'dt: Tags',
        'dd: ai, ruby',
        'dt: Source URL',
        'a: https://guides.rubyonrails.org',
        'dt: Review interval',
        'dd: Weekly',
        'dt: Next review',
        'dd: Nov 16, 2026',
        'dt: Last reviewed',
        'dd: Nov 9, 2026',
        'button: Back to notes',
        'button: Mark as reviewed',
        'button: Edit',
        'button: Archive',
        'button: Delete',
      ]),
    )
    for (const form of [wide.edit, wide.create]) {
      expect(form).toEqual(
        expect.arrayContaining([
          'label: Title',
          'label: Body',
          'label: Source URL (optional)',
          'legend: Collection',
          'legend: Tags',
          'label: Review interval',
          'label: Number of days',
          'label: Next review date (optional)',
        ]),
      )
    }
    // The narrow one shows the same.
    expect(await seenAt(320)).toEqual(wide)
  }, LONG_TEST_MS)

  it('AC-25 the reminders panel stays at the top of the main area with a list that scrolls inside it', async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(320)
    const socket = await mainLayoutSocket()
    const panel = remindersPanel()

    // Its states, as on a wide screen: "Loading…" before the first batch, then
    // "No review reminders" for an empty one.
    expect(within(panel).getByRole('status')).toHaveTextContent('Loading…')
    confirm(socket)
    sendBatch(socket, [])
    expect(within(panel).getByText('No review reminders')).toBeVisible()

    // 10 reminders: the list scrolls inside the panel, at most 16rem high.
    sendBatch(
      socket,
      Array.from({ length: 10 }, (_, index) => reminder(100 + index, `Due note ${index + 1}`, index < 5 ? 'due_today' : 'overdue')),
    )
    const list = within(panel).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(list).toHaveClass('overflow-y-auto')
    expect(maxHeightRem(list)).not.toBeNull()
    expect(maxHeightRem(list)).toBeLessThanOrEqual(16)

    // With no panel of the bar open: after the bar, before the notes area, and inside neither panel.
    expect(isBefore(theBar(), panel)).toBe(true)
    expect(isBefore(panel, notesArea)).toBe(true)
    expect(leftAreaOf(notesArea)).not.toContainElement(panel)
    // With the collections panel open, it comes after that panel.
    await user.click(collectionsButton())
    expect(isBefore(collectionsArea(), panel)).toBe(true)
    expect(isBefore(panel, notesArea)).toBe(true)
    expect(collectionsArea()).not.toContainElement(panel)

    // After a loss: "Review reminders are offline. Reconnecting…" above the last list.
    act(() => socket.closeFromServer(1006))
    expect(within(panel).getByRole('alert')).toHaveTextContent('Review reminders are offline. Reconnecting…')
    expect(within(panel).getAllByRole('listitem')).toHaveLength(10)
  })

  it('AC-25 Open on a narrow screen shows the note with the focus on its title', async () => {
    const user = userEvent.setup()
    stubBackend()
    const { notesArea } = await renderAt(320)
    const socket = await mainLayoutSocket()
    confirm(socket)
    sendBatch(socket, [reminder(3, 'Rails tips')])
    const openReminder = () => user.click(within(remindersPanel()).getByRole('button', { name: 'Open' }))

    // With the tags panel open, "Open" shows the detail below, and the panel stays open.
    await user.click(menuButton())
    await openReminder()
    const heading = await within(notesArea).findByRole('heading', { name: 'Rails tips' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(tagsArea()).toBeVisible()
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')

    // With no panel open, the same, and both panels stay closed.
    await user.click(menuButton())
    await user.click(within(notesArea).getByRole('button', { name: 'Back to notes' }))
    await openReminder()
    const again = await within(notesArea).findByRole('heading', { name: 'Rails tips' })
    await waitFor(() => expect(again).toHaveFocus())
    expect(collectionsButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('AC-25 the full-page screens are one centered column whose texts wrap', async () => {
    // A draw that fails shows the page alert: React reports the error it caught.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // The screen's main element is one centered column of texts and buttons, and no element in
    // it keeps a text on one line or has a fixed width.
    const isOneCenteredColumn = (text: HTMLElement) => {
      const page = text.closest('main') as HTMLElement
      expect(page).toHaveClass('flex', 'min-h-screen', 'items-center', 'justify-center')
      expect(page.children).toHaveLength(1)
      const content = page.children[0]
      if (content.classList.contains('flex')) expect(content).toHaveClass('flex-col', 'items-center')
      for (const element of [page, ...page.querySelectorAll('*')]) expect(oneLineOrFixedWidth(element)).toEqual([])
    }
    const at320 = (routes: Record<string, Handler>, options: StubOptions) => {
      stubBackend(routes, options)
      setWindowWidth(320)
      return render(<App />)
    }

    // The loading screen.
    const loading = at320({}, { session: 'held' })
    isOneCenteredColumn(screen.getByRole('status'))
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    loading.unmount()

    // The server-error screen.
    const serverError = at320({}, { session: 'error' })
    const unreachable = await screen.findByRole('alert')
    expect(unreachable).toHaveTextContent('Could not reach the server. Try again.')
    isOneCenteredColumn(unreachable)
    serverError.unmount()

    // The sign-in screen with its error.
    window.history.replaceState({}, '', '/?sign_in_error=google')
    const signIn = at320({}, { session: 'signed-out' })
    const failed = await screen.findByRole('alert')
    expect(failed).toHaveTextContent('Sign-in with Google did not complete. Try again.')
    isOneCenteredColumn(failed)
    signIn.unmount()

    // The page alert of features/24_ui_states: a notes list whose note has no collection fails
    // to draw.
    at320({ 'GET /api/notes': () => json(200, { notes: [{ ...OLDER, collection: null }] }) }, {})
    const pageAlert = await screen.findByRole('alert')
    expect(pageAlert).toHaveTextContent('Something went wrong. Reload the page.')
    isOneCenteredColumn(pageAlert)
  })
})
