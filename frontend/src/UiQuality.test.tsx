import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../index.html?raw'
import App from './App'
import { FakeWebSocket } from './test/fakeWebSocket'
import { type Look, hoverClasses, interactiveElements, keepsFocusVisible, lookOf } from './test/ui'

// features/24_ui_states questions 1, 3 to 5: hover and focus states, one look per kind of
// element, and the light theme only. jsdom applies no CSS, so these tests read the Tailwind
// classes through the helpers of src/test/ui.ts; the Verify walkthrough checks the real look
// in a browser. The tests render the whole app and replace fetch, so no request leaves the
// test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// The left area's lists, in the server's order: the collections "Books" (id 2) and "Work"
// (id 1), and the tags "ai" (id 1) and "ruby" (id 2).
const COLLECTIONS = [
  { id: 2, name: 'Books' },
  { id: 1, name: 'Work' },
]
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

// "Rails tips", every 10 days, due today, with the tag "ruby" and a source URL in its detail,
// so its detail and its edit form show every field.
const RAILS_TIPS = summary(7, 'Rails tips', {
  tags: [{ id: 2, name: 'ruby' }],
  review_interval: 'custom',
  review_interval_days: 10,
  next_review_date: '2026-11-09',
  review_state: 'due_today',
})
const RAILS_TIPS_NOTE = { ...RAILS_TIPS, body: 'Short tips.', source_url: 'https://guides.rubyonrails.org' }
// "Old idea", archived and overdue, so the list shows its labels.
const OLD_IDEA = summary(12, 'Old idea', {
  status: 'archived',
  review_interval: 'weekly',
  next_review_date: '2026-11-02',
  review_state: 'overdue',
})

// What the session check answers: a signed-in user, the sign-in screen (401), a server error
// (500), or nothing yet.
type Session = 'signed-in' | 'signed-out' | 'error' | 'held'

// Answers like the backend, as in src/NoteFilters.test.tsx: the session check, GET /api/csrf,
// the collections and tags lists above and the list of "Rails tips" unless the test names
// them, and the requests the test names by method and address, query included. Any other
// request fails.
function stubBackend(routes: Record<string, Handler> = {}, session: Session = 'signed-in') {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: COLLECTIONS }),
    'GET /api/tags': () => json(200, { tags: TAGS }),
    'GET /api/notes': () => json(200, { notes: [RAILS_TIPS] }),
    'GET /api/notes/7': () => json(200, { note: RAILS_TIPS_NOTE }),
  }
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session') {
      if (session === 'signed-out') return json(401, { error: 'unauthenticated' })
      if (session === 'error') return json(500, { error: 'internal' })
      if (session === 'held') return new Promise<Response>(() => {})
      return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    }
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    const handler = routes[key] ?? defaults[key]
    if (!handler) throw new Error(`unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The areas of the main layout. Queries are scoped to an area: "Collection", "Tags", and
// "Due today" each name more than one element.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })
const collectionsArea = () => screen.getByRole('complementary', { name: 'Collections' })
const tagsArea = () => screen.getByRole('complementary', { name: 'Tags' })

// The fields of a note form with "Every N days" chosen, by their labels. "Collection" is the
// legend that labels its select.
const NOTE_FORM_FIELDS = [
  'Title',
  'Body',
  'Source URL (optional)',
  'Collection',
  'Review interval',
  'Number of days',
  'Next review date (optional)',
]

const error500 = () => json(500, { error: 'internal' })
// A request the server never answers.
const held = () => new Promise<Response>(() => {})

// The reminders subscription's identifier, as the client sends it (features/20_realtime_notifications).
const IDENTIFIER = '{"channel":"ReviewRemindersChannel"}'

// A reminder as a batch holds it.
const reminder = (noteId: number, title: string, nextReviewDate: string, state: 'due_today' | 'overdue') => ({
  type: `review_${state}`,
  note_id: noteId,
  title,
  collection_name: 'Work',
  next_review_date: nextReviewDate,
  review_state: state,
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

// The server accepts the main layout's connection and sends its first batch.
async function sendFirstBatch(reminders: ReturnType<typeof reminder>[]) {
  const socket = await mainLayoutSocket()
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome' })
    socket.receive({ identifier: IDENTIFIER, type: 'confirm_subscription' })
  })
  act(() => socket.receive({ identifier: IDENTIFIER, message: { type: 'review_reminders', reminders } }))
}

// A name for an element in a failure message: its tag, and its label or its text.
function nameOf(element: Element): string {
  if (element === document.body) return 'the page'
  const labelledBy = element.getAttribute('aria-labelledby')
  const labels = 'labels' in element ? (element as HTMLInputElement).labels : null
  const name =
    element.getAttribute('aria-label') ??
    ((labelledBy && document.getElementById(labelledBy)?.textContent) ||
      labels?.[0]?.textContent ||
      element.textContent)
  return `${element.tagName.toLowerCase()} "${(name ?? '').trim()}"`
}

// One screen of the tour, by its name. The page is in the document while it is visited.
type Visit = (screenName: string) => Promise<void>

// Walks the screens of spec questions 1 and 3 to 5 and calls visit on each: the loading, the
// server-error, and the sign-in screens and the page alert; the main layout with the list and
// two reminders in the panel, a create form and a delete confirmation in each left area, a
// note's detail and its delete confirmation, the new-note form with "Every N days", the edit
// form, and the list after a search that finds nothing ("Clear search and filters"); the main
// layout of a user with nothing, and its new-note form; the main layout, a note, and the note
// forms while they load; and the main layout whose lists, note, and form lists cannot load.
// Forms and confirmations show their messages and alerts, so that every kind of element of
// question 4 shows somewhere.
async function tour(visit: Visit) {
  const user = userEvent.setup()

  // The full-page screens.
  stubBackend({}, 'held')
  let page = render(<App />)
  await screen.findByRole('status')
  await visit('the loading screen')
  page.unmount()

  stubBackend({}, 'error')
  page = render(<App />)
  await screen.findByRole('button', { name: 'Try again' })
  await visit('the server-error screen')
  page.unmount()

  window.history.replaceState({}, '', '/?sign_in_error=github')
  stubBackend({}, 'signed-out')
  page = render(<App />)
  await screen.findByText('Sign-in with GitHub did not complete. Try again.')
  await visit('the sign-in screen')
  page.unmount()

  // React reports the error that the page's boundary caught with console.error.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  stubBackend({ 'GET /api/notes': () => json(200, { notes: [{ ...RAILS_TIPS, collection: null }] }) })
  page = render(<App />)
  await screen.findByRole('button', { name: 'Reload page' })
  consoleError.mockRestore()
  await visit('the page alert')
  page.unmount()

  // The main layout of a user with notes, with two reminders in the panel.
  stubBackend({
    'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
    'POST /api/collections': () => json(422, { error: 'validation_failed', fields: { name: 'blank' } }),
    'DELETE /api/collections/1': () => json(409, { error: 'collection_not_empty' }),
    'POST /api/tags': () => json(422, { error: 'validation_failed', fields: { name: 'taken' } }),
    'DELETE /api/tags/1': error500,
    'POST /api/notes/7/review': error500,
    'DELETE /api/notes/7': error500,
    'PATCH /api/notes/7': () => json(422, { error: 'validation_failed', fields: { tag_ids: 'not_found' } }),
    'GET /api/notes?search=zzz': () => json(200, { notes: [] }),
  })
  page = render(<App />)
  let area = await findNotesArea()
  await within(area).findByRole('button', { name: 'Rails tips' })
  await sendFirstBatch([reminder(12, 'Old idea', '2026-11-02', 'overdue'), reminder(7, 'Rails tips', '2026-11-09', 'due_today')])
  const collections = collectionsArea()
  const tags = tagsArea()

  // The collections create form with a refused name, and the tags delete confirmation with a
  // failure.
  await user.click(await within(collections).findByRole('button', { name: 'New collection' }))
  await user.click(within(collections).getByRole('button', { name: 'Create' }))
  await within(collections).findByText('Enter a name.')
  await user.click(await within(tags).findByRole('button', { name: 'Delete ai' }))
  await user.click(within(tags).getByRole('button', { name: 'Delete' }))
  await within(tags).findByText('Could not delete the tag. Try again.')
  await visit('the main layout with the collections create form and the tags delete confirmation')

  // The collections delete confirmation with the refusal, and the tags create form with a
  // refused name.
  await user.click(within(collections).getByRole('button', { name: 'Delete Work' }))
  await user.click(within(collections).getByRole('button', { name: 'Delete' }))
  await within(collections).findByText('This collection still has notes. Move or delete them first.')
  await user.click(within(tags).getByRole('button', { name: 'New tag' }))
  await user.type(within(tags).getByLabelText('Tag name'), 'ruby')
  await user.click(within(tags).getByRole('button', { name: 'Create' }))
  await within(tags).findByText('A tag with this name already exists.')
  await visit('the main layout with the collections delete confirmation and the tags create form')

  // A note's detail, after a failed review, and its delete confirmation, after a failed delete.
  await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
  await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))
  await within(area).findByText('Could not mark the note as reviewed. Try again.')
  await visit("a note's detail")
  await user.click(within(area).getByRole('button', { name: 'Delete' }))
  await user.click(within(area).getByRole('button', { name: 'Delete' }))
  await within(area).findByText('Could not delete the note. Try again.')
  await visit("a note's delete confirmation")

  // The new-note form with "Every N days", after "Create" with every field empty.
  await user.click(within(area).getByRole('button', { name: 'Cancel' }))
  await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
  await user.click(await within(area).findByRole('button', { name: 'New note' }))
  await user.selectOptions(await within(area).findByLabelText('Review interval'), 'Every N days')
  await within(area).findAllByRole('checkbox')
  await user.click(within(area).getByRole('button', { name: 'Create' }))
  await within(area).findByText('Enter a title.')
  await visit('the new-note form')

  // The edit form of "Rails tips", after a save refused for a tag that no longer exists.
  await user.click(within(area).getByRole('button', { name: 'Cancel' }))
  await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
  await user.click(await within(area).findByRole('button', { name: 'Edit' }))
  await within(area).findAllByRole('checkbox')
  await user.click(within(area).getByRole('button', { name: 'Save' }))
  await within(area).findByText('A chosen tag no longer exists. Check the tags again.')
  await within(area).findAllByRole('checkbox')
  await visit('the edit form')

  // The list after a search that finds nothing.
  await user.click(within(area).getByRole('button', { name: 'Cancel' }))
  await user.click(await within(area).findByRole('button', { name: 'Back to notes' }))
  await user.type(within(area).getByRole('searchbox', { name: 'Search' }), 'zzz')
  await within(area).findByRole('button', { name: 'Clear search and filters' })
  await visit('the list after a search that finds nothing')
  page.unmount()

  // The main layout of a user with nothing, and the new-note form with no collection.
  stubBackend({
    'GET /api/collections': () => json(200, { collections: [] }),
    'GET /api/tags': () => json(200, { tags: [] }),
    'GET /api/notes': () => json(200, { notes: [] }),
  })
  page = render(<App />)
  area = await findNotesArea()
  await within(area).findByText('No notes yet')
  await sendFirstBatch([])
  await within(collectionsArea()).findByText('No collections yet')
  await within(tagsArea()).findByText('No tags yet')
  await visit('the main layout of a user with nothing')
  await user.click(within(area).getByRole('button', { name: 'New note' }))
  await within(area).findByText('Create a collection first. Every note belongs to a collection.')
  await visit('the new-note form with no collection')
  page.unmount()

  // The main layout while its lists and the reminders load.
  stubBackend({ 'GET /api/collections': held, 'GET /api/tags': held, 'GET /api/notes': held })
  page = render(<App />)
  await mainLayoutSocket()
  await visit('the main layout while its lists and the reminders load')
  page.unmount()

  // A note while it loads, and the note forms while their collections and tags load. The
  // new-note form comes last: while it loads, it shows no "Cancel".
  let heldDetails = 0
  stubBackend({
    'GET /api/collections': held,
    'GET /api/tags': held,
    'GET /api/notes/7': () => (++heldDetails === 1 ? held() : json(200, { note: RAILS_TIPS_NOTE })),
  })
  page = render(<App />)
  area = await findNotesArea()
  await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
  await within(area).findByRole('status')
  await visit('a note while it loads')

  await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
  await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
  await user.click(await within(area).findByRole('button', { name: 'Edit' }))
  expect(await within(area).findAllByRole('status')).toHaveLength(2)
  await visit('the edit form while its collections and tags load')

  await user.click(within(area).getByRole('button', { name: 'Cancel' }))
  await user.click(await within(area).findByRole('button', { name: 'Back to notes' }))
  await user.click(await within(area).findByRole('button', { name: 'New note' }))
  await within(area).findByRole('status')
  await visit('the new-note form while its collections load')
  page.unmount()

  // The main layout whose lists cannot load, with the panel offline; then a note that cannot
  // load, and the note forms whose collections and tags cannot load.
  let listLoads = 0
  let detailLoads = 0
  stubBackend({
    'GET /api/collections': error500,
    'GET /api/tags': error500,
    'GET /api/notes': () => (++listLoads === 1 ? error500() : json(200, { notes: [RAILS_TIPS] })),
    'GET /api/notes/7': () => (++detailLoads === 1 ? error500() : json(200, { note: RAILS_TIPS_NOTE })),
  })
  page = render(<App />)
  area = await findNotesArea()
  await within(area).findByText('Could not load notes. Try again.')
  await within(collectionsArea()).findByText('Could not load collections. Try again.')
  await within(tagsArea()).findByText('Could not load tags. Try again.')
  const socket = await mainLayoutSocket()
  act(() => socket.failToOpen())
  await visit('the main layout whose lists cannot load')

  await user.click(within(area).getByRole('button', { name: 'Try again' }))
  await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
  await within(area).findByText('Could not load the note. Try again.')
  await visit('a note that cannot load')

  await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
  await user.click(await within(area).findByRole('button', { name: 'New note' }))
  await within(area).findByText('Could not load collections. Try again.')
  await visit('the new-note form whose collections cannot load')

  await user.click(within(area).getByRole('button', { name: 'Cancel' }))
  await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
  await user.click(await within(area).findByRole('button', { name: 'Edit' }))
  await within(area).findByText('Could not load collections. Try again.')
  await within(area).findByText('Could not load tags. Try again.')
  await visit('the edit form whose collections and tags cannot load')
  page.unmount()
}

// The sweeps walk many screens in one test each: 2 to 10 s each, while other test files run.
const SWEEP_TIMEOUT_MS = 60_000

// The empty states of the main layout, by their text (spec question 4: one size and one gray).
const EMPTY_STATES = [
  'No collections yet',
  'No tags yet',
  'No notes yet',
  'No review reminders',
  'No notes match your search and filters.',
  'No notes are due for review today.',
  'No notes are overdue for review.',
  'No notes are due for review in the next 7 days.',
  'Every note has a review schedule.',
  'Create a collection first. Every note belongs to a collection.',
]

// The text of a style sheet under src, such as './index.css'. Vitest hands a test an empty text
// for every style sheet it imports, ?raw included, so it is read from the disk with Node's fs.
// The app's TypeScript settings have no Node types, so fs is imported by a computed name and
// typed here.
type FileSystem = { readFileSync: (path: URL, encoding: 'utf8') => string }
async function styleSheetText(file: string): Promise<string> {
  const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as FileSystem
  return fs.readFileSync(new URL(file, import.meta.url), 'utf8')
}

// Whether a look has each of the given values.
const hasLook = (look: Look, values: Partial<Look>) =>
  Object.entries(values).every(([key, value]) => JSON.stringify(look[key as keyof Look]) === JSON.stringify(value))

// The four kinds of button of the main layout (spec question 4), each by the parts of its
// look that make it: filled (dark, or red for a delete), outlined, plain, and row actions.
const BUTTON_KINDS: ((look: Look) => boolean)[] = [
  (look) =>
    hasLook(look, { fontSize: 'sm', padding: ['px-3', 'py-1'], rounding: 'rounded', border: [], color: 'white' }) &&
    ['bg-slate-900', 'bg-red-700'].includes(look.background ?? ''),
  (look) => hasLook(look, { fontSize: 'sm', padding: ['px-3', 'py-1'], rounding: 'rounded' }) && look.border.includes('border'),
  (look) => hasLook(look, { fontSize: 'sm', padding: ['px-2', 'py-1'], rounding: 'rounded', border: [], background: null }),
  (look) => hasLook(look, { fontSize: 'xs', padding: ['px-1.5', 'py-1'], rounding: 'rounded', border: [], background: null }),
]

// Whether an element holds text of its own, not only in its children.
const hasOwnText = (element: Element) =>
  [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')

// The texts of the list entries: each element of a list item that holds text of its own, but
// not a button (the notes' titles, which read as the entry's text, excepted), a label
// ("Archived", "Due today", "Overdue"), or a part of a form or a delete confirmation shown in
// place of a row.
const entryTexts = () =>
  [...document.body.querySelectorAll('li, li *')].filter(
    (element) =>
      hasOwnText(element) &&
      element.closest('form, [role="group"]') === null &&
      !element.matches('button:not([data-testid="note-title"]), [data-testid="note-review-state"]') &&
      element.textContent !== 'Archived',
  )

describe('hover, focus, and the look of each kind (features/24_ui_states)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("AC-24 the sign-in buttons, the server error's Try again, the name fields, and the note form fields have a hover state", async () => {
    const user = userEvent.setup()
    // Each element without a hover state, by the screen it is on and its name.
    const missing: string[] = []
    const check = (name: string, element: HTMLElement) => {
      if (hoverClasses(element).length === 0) missing.push(name)
    }

    // The sign-in screen.
    stubBackend({}, 'signed-out')
    const signIn = render(<App />)
    check('sign-in: Continue with Google', await screen.findByRole('button', { name: 'Continue with Google' }))
    check('sign-in: Continue with GitHub', screen.getByRole('button', { name: 'Continue with GitHub' }))
    signIn.unmount()

    // The server-error screen.
    stubBackend({}, 'error')
    const serverError = render(<App />)
    check('server error: Try again', await screen.findByRole('button', { name: 'Try again' }))
    serverError.unmount()

    // The create forms of the left areas.
    stubBackend()
    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(collectionsArea()).findByRole('button', { name: 'New collection' }))
    check('collections: Collection name', within(collectionsArea()).getByLabelText('Collection name'))
    await user.click(await within(tagsArea()).findByRole('button', { name: 'New tag' }))
    check('tags: Tag name', within(tagsArea()).getByLabelText('Tag name'))

    // Every field of the new-note form, with "Every N days" chosen so that "Number of days" and
    // "Next review date (optional)" show, and each checkbox of its "Tags" group.
    const noteFormFields = async (form: string) => {
      for (const label of NOTE_FORM_FIELDS) check(`${form}: ${label}`, await within(area).findByLabelText(label))
      for (const box of await within(area).findAllByRole('checkbox')) {
        check(`${form}: the checkbox ${box.closest('label')?.textContent}`, box)
      }
    }
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.selectOptions(await within(area).findByLabelText('Review interval'), 'Every N days')
    await noteFormFields('new-note form')

    // Every field of the edit form of "Rails tips", which is every 10 days.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await noteFormFields('edit form')

    expect(missing).toEqual([])
  })

  it(
    'AC-24 every interactive element on every screen has a hover state',
    async () => {
      // Each shown and enabled element without a hover state, by its screen. Disabled elements,
      // such as "Open" while a note form is open, are left out (spec question 5).
      const missing: string[] = []
      await tour(async (screenName) => {
        for (const element of interactiveElements(document.body)) {
          if (hoverClasses(element).length === 0) missing.push(`${screenName}: ${nameOf(element)}`)
        }
      })
      expect(missing).toEqual([])
    },
    SWEEP_TIMEOUT_MS,
  )

  it(
    'AC-24 Tab reaches every shown interactive element in turn and each keeps a visible focus',
    async () => {
      // No pause between key presses: the sweep presses Tab several hundred times.
      const keyboard = userEvent.setup({ delay: null })
      const problems: string[] = []
      await tour(async (screenName) => {
        const expected = interactiveElements(document.body)
        // From the top of the page: nothing has the focus.
        ;(document.activeElement as HTMLElement | null)?.blur()
        const reached: Element[] = []
        for (let press = 0; press <= expected.length; press += 1) {
          await keyboard.tab()
          reached.push(document.activeElement ?? document.body)
        }
        // Each element in document order, then back to the page. Elements that only the app
        // focuses (tabIndex -1) are never reached.
        const wanted = [...expected, document.body]
        if (reached.some((element, index) => element !== wanted[index])) {
          problems.push(
            `${screenName}: Tab reached ${reached.map(nameOf).join(', ')}; expected ${wanted.map(nameOf).join(', ')}`,
          )
        }
        for (const element of expected) {
          if (!keepsFocusVisible(element)) problems.push(`${screenName}: no visible focus on ${nameOf(element)}`)
        }
      })
      expect(problems).toEqual([])
    },
    SWEEP_TIMEOUT_MS,
  )

  it(
    'AC-24 the elements of each kind have one look on every major screen',
    async () => {
      // Each element whose look is not its kind's, by its screen (the Approach's table).
      const problems: string[] = []
      await tour(async (screenName) => {
        const all = (selector: string) => [...document.body.querySelectorAll(selector)]
        const expectLook = (kind: string, element: Element, values: Partial<Look>) => {
          const look = lookOf(element)
          const wrong = Object.keys(values).filter((key) => !hasLook(look, { [key]: values[key as keyof Look] }))
          if (wrong.length > 0) {
            const found = wrong.map((key) => `${key} ${JSON.stringify(look[key as keyof Look])}`).join(', ')
            problems.push(`${screenName}: ${kind} ${nameOf(element)} has ${found}`)
          }
        }

        // One font family on every screen.
        for (const element of all('.font-mono, .font-serif')) problems.push(`${screenName}: another font on ${nameOf(element)}`)

        const header = document.body.querySelector('header')
        if (header === null) {
          // A full-page screen: its texts at the base size, its alerts red and its status gray,
          // and its buttons filled, larger than in the main layout.
          for (const text of all('p')) expectLook('full-page text', text, { fontSize: 'base', fontWeight: 'normal' })
          for (const alert of all('[role="alert"]')) expectLook('full-page alert', alert, { color: 'red-700' })
          for (const status of all('[role="status"]')) expectLook('full-page status', status, { color: 'slate-600' })
          for (const button of all('button')) {
            expectLook('full-page button', button, {
              fontSize: 'base',
              padding: ['px-4', 'py-2'],
              rounding: 'rounded',
              border: [],
              color: 'white',
              background: 'bg-slate-900',
            })
          }
          return
        }

        // The main layout. Headings: the areas', then the views', which are larger.
        for (const heading of all('h2')) expectLook('area heading', heading, { fontSize: 'base', fontWeight: 'semibold' })
        for (const heading of all('h3')) expectLook('view heading', heading, { fontSize: 'lg', fontWeight: 'semibold' })
        // Field labels, in every form and in the filter bar.
        for (const label of all('label[for], legend')) {
          expectLook('field label', label, { fontSize: 'xs', fontWeight: 'medium', color: 'slate-600' })
        }
        // A field's message is tied to its control (aria-describedby), or is its group's own
        // ("A chosen tag no longer exists."); every other alert is the area's.
        const described = new Set(all('[aria-describedby]').flatMap((element) => element.getAttribute('aria-describedby')!.split(' ')))
        for (const alert of all('[role="alert"]')) {
          if (described.has(alert.id) || alert.parentElement?.tagName === 'FIELDSET') {
            expectLook('field message', alert, { fontSize: 'xs', color: 'red-700' })
          } else {
            expectLook('alert', alert, { fontSize: 'sm', color: 'red-700' })
          }
        }
        // Empty states and "Loading…" lines: one size and one gray.
        for (const status of all('[role="status"]').filter((element) => element.textContent === 'Loading…')) {
          expectLook('Loading line', status, { fontSize: 'sm', color: 'slate-600' })
        }
        for (const empty of all('p').filter((element) => EMPTY_STATES.includes(element.textContent ?? ''))) {
          expectLook('empty state', empty, { fontSize: 'sm', color: 'slate-600' })
        }
        // The text of list entries, and of a detail's fields and body.
        for (const text of entryTexts()) expectLook('entry text', text, { fontSize: 'sm' })
        for (const text of all('dt, dd, [data-testid="note-body"]')) expectLook("detail's text", text, { fontSize: 'sm' })
        // Each button of the main layout but the notes' titles is of one of the four kinds.
        for (const button of all('button:not([data-testid="note-title"])')) {
          const look = lookOf(button)
          if (!BUTTON_KINDS.some((kind) => kind(look))) {
            problems.push(`${screenName}: button ${nameOf(button)} is of no kind: ${JSON.stringify(look)}`)
          }
        }
        // The header, each section of the left area, the panel, and the notes area: 16 px at
        // the sides.
        const sections = [header, ...all('aside'), screen.getByRole('region', { name: 'Review reminders' }), await findNotesArea()]
        for (const section of sections) {
          const sides = lookOf(section).padding.filter((name) => /^p[xlrse]?-/.test(name))
          if (!['["p-4"]', '["px-4"]'].includes(JSON.stringify(sides))) {
            problems.push(`${screenName}: ${section.tagName.toLowerCase()} ${nameOf(section)} has side padding ${JSON.stringify(sides)}`)
          }
        }
      })
      expect(problems).toEqual([])
    },
    SWEEP_TIMEOUT_MS,
  )

  it('AC-24 no style follows a dark system theme', async () => {
    // The app's own files, as text: every source file and style sheet but the tests and their
    // helpers, and the page's HTML.
    const sources: Record<string, string> = {
      ...import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}', '!./test/**'], {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
      '../index.html': indexHtml,
    }
    for (const file of Object.keys(import.meta.glob('./**/*.css'))) sources[file] = await styleSheetText(file)
    expect(Object.keys(sources)).toEqual(expect.arrayContaining(['./App.tsx', './index.css', './main.tsx', '../index.html']))
    expect(sources['./index.css']).toContain('@import "tailwindcss"')

    // Each place that would follow a dark system theme: a class with the dark: variant, a
    // media query on the system's scheme, or a color scheme with dark in it (the CSS property,
    // the meta tag, or Tailwind's scheme- classes).
    const followers: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      if (/(^|[^\w-])dark:/m.test(text)) followers.push(`${file}: the dark: variant`)
      if (text.includes('prefers-color-scheme')) followers.push(`${file}: prefers-color-scheme`)
      if (/(color-scheme|colorScheme)\W[^\n]*dark/i.test(text)) followers.push(`${file}: a dark color scheme`)
      if (/(^|[^\w-])scheme-(dark|light-dark|only-dark)\b/m.test(text)) followers.push(`${file}: a dark scheme- class`)
    }
    expect(followers).toEqual([])
  })
})
