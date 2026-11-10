import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/17_search_and_filter. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7). The bar above the
// list holds "Search" and the filters "Collection", "Tag", "Status", and "Review"; the server
// does the searching and filtering, so the tests check the list requests and show the answers
// they are given. The app computes no date, so these tests need no fake clock.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// The left area's lists, in the server's order (alphabetical): the collections "Books" (id 2)
// and "Work" (id 1), and the tags "ai" (id 1) and "ruby" (id 2).
const COLLECTIONS = [
  { id: 2, name: 'Books' },
  { id: 1, name: 'Work' },
]
const TAGS = [
  { id: 1, name: 'ai' },
  { id: 2, name: 'ruby' },
]

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections and tags lists above unless the test names them, and the notes requests that
// the test names by method and address, query included, such as 'GET /api/notes?status=active'.
// Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: COLLECTIONS }),
    'GET /api/tags': () => json(200, { tags: TAGS }),
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

// An answer that the test gives later. `requested` settles once the request is made,
// so the test never answers a request that has not started yet.
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
const fullNote = (note: Summary): Note => ({ ...note, body: `Body of ${note.title}`, source_url: null })

// The notes of the tests, newest first.
const RAILS_TIPS = summary(3, 'Rails tips', { tags: [{ id: 2, name: 'ruby' }] })
const BOOK_LIST = summary(2, 'Book list', { collection: { id: 2, name: 'Books' } })
const OLD_IDEA = summary(1, 'Old idea', { status: 'archived', tags: [{ id: 2, name: 'ruby' }] })

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// The list entry of the note with this title, once the list shows it.
const findEntry = async (area: HTMLElement, title: string) =>
  (await within(area).findByRole('button', { name: title })).closest('li') as HTMLElement

// The left area's two parts.
const collectionsArea = () => screen.getByRole('complementary', { name: 'Collections' })
const tagsArea = () => screen.getByRole('complementary', { name: 'Tags' })

// The bar's controls, found in the notes area by role and name: "Collection" is also the
// note form's label, so a query outside the area could meet another control.
const searchField = (area: HTMLElement) => within(area).getByRole('searchbox', { name: 'Search' })
const select = (area: HTMLElement, name: string) => within(area).getByRole('combobox', { name })

// The list requests, in order: the addresses of the GET requests whose path is /api/notes,
// query included.
const listRequests = (fetchMock: ReturnType<typeof stubBackend>) =>
  fetchMock.mock.calls
    .filter(([url, init]) => (init?.method ?? 'GET') === 'GET' && new URL(url, 'http://localhost').pathname === '/api/notes')
    .map(([url]) => url)

// The titles the list shows, in its order.
const listedTitles = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('note-title')
    .map((title) => title.textContent)

// The choices of a select, in its order.
const choices = (control: HTMLElement) => within(control).getAllByRole('option').map((option) => option.textContent)

// Whether the first element comes before the second in the page.
const isBefore = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('App note filters (features/17_search_and_filter)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC-17 the filter bar shows Search, Collection, Tag, Status, and Review with their choices', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?review=next_7_days': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes?review=unscheduled': () => json(200, { notes: [BOOK_LIST, OLD_IDEA] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    const list = (await findEntry(area, 'Rails tips')).closest('ul') as HTMLElement

    // "Search", empty, then the four selects, each at "All", in this order and above the list.
    const controls = [searchField(area), ...['Collection', 'Tag', 'Status', 'Review'].map((name) => select(area, name))]
    expect(searchField(area)).toHaveValue('')
    for (const control of controls.slice(1)) expect(control).toHaveDisplayValue('All')
    for (const [index, control] of [...controls, list].entries()) {
      if (index > 0) expect(isBefore(controls[index - 1], control)).toBe(true)
    }

    expect(choices(select(area, 'Status'))).toEqual(['All', 'Active', 'Archived'])
    expect(choices(select(area, 'Review'))).toEqual(['All', 'Due today', 'Overdue', 'Next 7 days', 'No review scheduled'])

    // The two new review choices ask for their values.
    await user.selectOptions(select(area, 'Review'), 'Next 7 days')
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Book list' })).not.toBeInTheDocument()
    expect(select(area, 'Review')).toHaveDisplayValue('Next 7 days')

    await user.selectOptions(select(area, 'Review'), 'No review scheduled')
    expect(await findEntry(area, 'Old idea')).toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Rails tips' })).not.toBeInTheDocument()
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=next_7_days', '/api/notes?review=unscheduled'])
  })

  it("AC-17 the Collection and Tag choices follow the left area's lists and its load state", async () => {
    // The collections are held and then answered. The first tags load is held and then
    // fails; the left area's "Try again" loads them.
    const collectionsLoad = later()
    const firstTagsLoad = later()
    let tagLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST] }),
      'GET /api/collections': collectionsLoad.handler,
      'GET /api/tags': (init) => {
        tagLoads += 1
        return tagLoads === 1 ? firstTagsLoad.handler(init) : json(200, { tags: TAGS })
      },
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    await collectionsLoad.requested
    await firstTagsLoad.requested

    // While the left area shows "Loading…" for both: only "All".
    expect(within(collectionsArea()).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(tagsArea()).getByRole('status')).toHaveTextContent('Loading…')
    expect(choices(select(area, 'Collection'))).toEqual(['All'])
    expect(choices(select(area, 'Tag'))).toEqual(['All'])

    // The collections load: "Collection" offers them in the left area's order.
    collectionsLoad.answer(json(200, { collections: COLLECTIONS }))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))
    expect(choices(select(area, 'Tag'))).toEqual(['All'])

    // The tags cannot load: "Tag" still offers only "All".
    firstTagsLoad.answer(json(500, { error: 'internal' }))
    expect(await within(tagsArea()).findByRole('alert')).toHaveTextContent('Could not load tags. Try again.')
    expect(choices(select(area, 'Tag'))).toEqual(['All'])

    // The left area's "Try again" loads them, and "Tag" offers them.
    await user.click(within(tagsArea()).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(choices(select(area, 'Tag'))).toEqual(['All', 'ai', 'ruby']))
    expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work'])

    // No request beyond the left area's own, and the list did not load again.
    const requests = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)
    expect(requests.filter((request) => request === 'GET /api/collections')).toHaveLength(1)
    expect(requests.filter((request) => request === 'GET /api/tags')).toHaveLength(2)
    expect(listRequests(fetchMock)).toEqual(['/api/notes'])
  })

  it('AC-17 choosing a collection, a tag, or a status asks for it at once, with the search and the other filters', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?collection_id=1': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
      'GET /api/notes?collection_id=1&tag_id=2': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
      'GET /api/notes?collection_id=1&tag_id=2&status=active': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes?search=rails&collection_id=1&tag_id=2&status=active': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes?search=rails&collection_id=1&tag_id=2&status=archived': () => json(200, { notes: [OLD_IDEA] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await waitFor(() => expect(choices(select(area, 'Tag'))).toEqual(['All', 'ai', 'ruby']))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))

    // A choice asks at once, with no pause.
    await user.selectOptions(select(area, 'Collection'), 'Work')
    expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?collection_id=1')
    expect(await findEntry(area, 'Old idea')).toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Book list' })).not.toBeInTheDocument()

    await user.selectOptions(select(area, 'Tag'), 'ruby')
    expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?collection_id=1&tag_id=2')
    expect(await findEntry(area, 'Old idea')).toBeInTheDocument()

    await user.selectOptions(select(area, 'Status'), 'Active')
    expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?collection_id=1&tag_id=2&status=active')
    await waitFor(() => expect(within(area).queryByRole('button', { name: 'Old idea' })).not.toBeInTheDocument())
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()

    // The search joins the filters, first in the address.
    await user.click(searchField(area))
    await user.paste('rails')
    await waitFor(() =>
      expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?search=rails&collection_id=1&tag_id=2&status=active'),
    )
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()

    // "Archived": its answer's entries show "Archived".
    await user.selectOptions(select(area, 'Status'), 'Archived')
    expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?search=rails&collection_id=1&tag_id=2&status=archived')
    expect(within(await findEntry(area, 'Old idea')).getByText('Archived')).toBeInTheDocument()

    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?collection_id=1',
      '/api/notes?collection_id=1&tag_id=2',
      '/api/notes?collection_id=1&tag_id=2&status=active',
      '/api/notes?search=rails&collection_id=1&tag_id=2&status=active',
      '/api/notes?search=rails&collection_id=1&tag_id=2&status=archived',
    ])
    expect(select(area, 'Collection')).toHaveDisplayValue('Work')
    expect(select(area, 'Tag')).toHaveDisplayValue('ruby')
    expect(select(area, 'Status')).toHaveDisplayValue('Archived')
    expect(searchField(area)).toHaveValue('rails')
  })

  it('AC-17 an empty list says which search or filter found nothing', async () => {
    // Every list request finds no note.
    const noNotes = () => json(200, { notes: [] })
    stubBackend(
      Object.fromEntries(
        [
          '',
          '?search=zzz',
          '?status=archived',
          '?status=archived&review=due_today',
          '?review=due_today',
          '?review=overdue',
          '?review=next_7_days',
          '?review=unscheduled',
        ].map((query) => [`GET /api/notes${query}`, noNotes]),
      ),
    )
    const user = userEvent.setup()
    const clearButton = (area: HTMLElement) => within(area).queryByRole('button', { name: 'Clear search and filters' })
    const NO_MATCH = 'No notes match your search and filters.'

    render(<App />)
    const area = await findNotesArea()

    // Nothing set: no notes yet.
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    expect(clearButton(area)).not.toBeInTheDocument()

    // A search: nothing matches, and the button clears it.
    await user.click(searchField(area))
    await user.paste('zzz')
    expect(await within(area).findByText(NO_MATCH)).toBeInTheDocument()
    expect(clearButton(area)).toBeInTheDocument()
    expect(within(area).queryByText('No notes yet')).not.toBeInTheDocument()
    await user.clear(searchField(area))
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()

    // "Archived" with "Due today": the same, because a note due today is active.
    await user.selectOptions(select(area, 'Status'), 'Archived')
    expect(await within(area).findByText(NO_MATCH)).toBeInTheDocument()
    await user.selectOptions(select(area, 'Review'), 'Due today')
    expect(await within(area).findByText(NO_MATCH)).toBeInTheDocument()
    expect(clearButton(area)).toBeInTheDocument()
    expect(within(area).queryByText('No notes are due for review today.')).not.toBeInTheDocument()

    // Only "Review" set: its own message, and no button.
    await user.selectOptions(select(area, 'Status'), 'All')
    for (const [choice, message] of [
      ['Due today', 'No notes are due for review today.'],
      ['Overdue', 'No notes are overdue for review.'],
      ['Next 7 days', 'No notes are due for review in the next 7 days.'],
      ['No review scheduled', 'Every note has a review schedule.'],
    ]) {
      await user.selectOptions(select(area, 'Review'), choice)
      expect(await within(area).findByText(message)).toBeInTheDocument()
      expect(clearButton(area)).not.toBeInTheDocument()
      expect(within(area).queryByText(NO_MATCH)).not.toBeInTheDocument()
    }

    // Nothing set again: no notes yet.
    await user.selectOptions(select(area, 'Review'), 'All')
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    expect(clearButton(area)).not.toBeInTheDocument()
  })

  it('AC-17 Clear search and filters empties the search, sets every filter to All, and lists every note', async () => {
    // The search and every filter set, one after the other; each finds no note.
    const narrowed = [
      '?search=zzz',
      '?search=zzz&collection_id=1',
      '?search=zzz&collection_id=1&tag_id=2',
      '?search=zzz&collection_id=1&tag_id=2&status=archived',
      '?search=zzz&collection_id=1&tag_id=2&status=archived&review=overdue',
    ].map((query) => `/api/notes${query}`)
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      ...Object.fromEntries(narrowed.map((address) => [`GET ${address}`, () => json(200, { notes: [] })])),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await waitFor(() => expect(choices(select(area, 'Tag'))).toEqual(['All', 'ai', 'ruby']))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))

    await user.click(searchField(area))
    await user.paste('zzz')
    await waitFor(() => expect(listRequests(fetchMock).at(-1)).toBe(narrowed[0]))
    await user.selectOptions(select(area, 'Collection'), 'Work')
    await user.selectOptions(select(area, 'Tag'), 'ruby')
    await user.selectOptions(select(area, 'Status'), 'Archived')
    await user.selectOptions(select(area, 'Review'), 'Overdue')
    expect(await within(area).findByText('No notes match your search and filters.')).toBeInTheDocument()
    expect(listRequests(fetchMock)).toEqual(['/api/notes', ...narrowed])

    await user.click(within(area).getByRole('button', { name: 'Clear search and filters' }))

    // At once: the field empty, every filter at "All", and the list asked for every note.
    expect(searchField(area)).toHaveValue('')
    for (const name of ['Collection', 'Tag', 'Status', 'Review']) expect(select(area, name)).toHaveDisplayValue('All')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', ...narrowed, '/api/notes'])
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    expect(within(area).queryByText('No notes match your search and filters.')).not.toBeInTheDocument()

    // And no request after it: the empty search is not sent again after the pause.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(listRequests(fetchMock)).toHaveLength(narrowed.length + 2)
  })

  it('AC-17 the search and the filters keep their values while a note or a form is open, and a reload resets them', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?search=rails': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
      'GET /api/notes?search=rails&status=active': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes/3': () => json(200, { note: fullNote(RAILS_TIPS) }),
    })
    const user = userEvent.setup()
    // The bar as it was left: "rails" in "Search", "Active" in "Status", the rest at "All".
    const expectKept = (area: HTMLElement) => {
      expect(searchField(area)).toHaveValue('rails')
      expect(select(area, 'Status')).toHaveDisplayValue('Active')
      for (const name of ['Collection', 'Tag', 'Review']) expect(select(area, name)).toHaveDisplayValue('All')
      expect(listedTitles(area)).toEqual(['Rails tips'])
    }

    const first = render(<App />)
    let area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await user.click(searchField(area))
    await user.paste('rails')
    await waitFor(() => expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?search=rails'))
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea']))
    await user.selectOptions(select(area, 'Status'), 'Active')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips']))
    const requests = ['/api/notes', '/api/notes?search=rails', '/api/notes?search=rails&status=active']
    expect(listRequests(fetchMock)).toEqual(requests)

    // A note's detail, and back: the same values and notes, with no list request.
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expectKept(area)

    // The new-note form, and back.
    await user.click(within(area).getByRole('button', { name: 'New note' }))
    expect(await within(area).findByLabelText('Title')).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expectKept(area)
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(listRequests(fetchMock)).toEqual(requests)

    // A reload: the field empty, every filter at "All", and every note.
    first.unmount()
    render(<App />)
    area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    expect(searchField(area)).toHaveValue('')
    for (const name of ['Collection', 'Tag', 'Status', 'Review']) expect(select(area, name)).toHaveDisplayValue('All')
    expect(listRequests(fetchMock)).toEqual([...requests, '/api/notes'])
  })

  it('AC-17 a created or renamed collection reaches the Collection filter, and the choice stays', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?collection_id=1': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
      'POST /api/collections': () => json(201, { collection: { id: 3, name: 'Ideas' } }),
      'PATCH /api/collections/1': () => json(200, { collection: { id: 1, name: 'Job' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))
    await user.selectOptions(select(area, 'Collection'), 'Work')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea']))

    // The collection "Ideas" created in the left area.
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    await user.type(within(collectionsArea()).getByLabelText('Collection name'), 'Ideas')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Ideas', 'Work']))
    expect(select(area, 'Collection')).toHaveDisplayValue('Work')

    // "Work" renamed to "Job": still chosen, with its new name.
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Rename Work' }))
    const field = within(collectionsArea()).getByLabelText('Collection name')
    await user.clear(field)
    await user.type(field, 'Job')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Ideas', 'Job']))
    expect(select(area, 'Collection')).toHaveDisplayValue('Job')

    // No list request after the one for "Work".
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?collection_id=1'])
    expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea'])
  })

  it('AC-17 a chosen collection or tag deleted in the left area goes back to All and the list loads again', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?tag_id=2': () => json(200, { notes: [RAILS_TIPS, OLD_IDEA] }),
      'DELETE /api/tags/2': () => new Response(null, { status: 204 }),
      'POST /api/collections': () => json(201, { collection: { id: 3, name: 'Ideas' } }),
      'GET /api/notes?collection_id=3': () => json(200, { notes: [] }),
      'DELETE /api/collections/3': () => new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await waitFor(() => expect(choices(select(area, 'Tag'))).toEqual(['All', 'ai', 'ruby']))

    // "ruby" chosen, then deleted in the left area.
    await user.selectOptions(select(area, 'Tag'), 'ruby')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea']))
    await user.click(within(tagsArea()).getByRole('button', { name: 'Delete ruby' }))
    await user.click(within(tagsArea()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(choices(select(area, 'Tag'))).toEqual(['All', 'ai']))
    expect(select(area, 'Tag')).toHaveDisplayValue('All')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Book list', 'Old idea']))
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?tag_id=2', '/api/notes'])

    // "Ideas" created and chosen, then deleted: the same for "Collection".
    await user.click(within(collectionsArea()).getByRole('button', { name: 'New collection' }))
    await user.type(within(collectionsArea()).getByLabelText('Collection name'), 'Ideas')
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Ideas', 'Work']))
    await user.selectOptions(select(area, 'Collection'), 'Ideas')
    expect(await within(area).findByText('No notes match your search and filters.')).toBeInTheDocument()
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Delete Ideas' }))
    await user.click(within(collectionsArea()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))
    expect(select(area, 'Collection')).toHaveDisplayValue('All')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Book list', 'Old idea']))
    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?tag_id=2',
      '/api/notes',
      '/api/notes?collection_id=3',
      '/api/notes',
    ])
  })

  it('AC-17 a note changed or created under a search or a filter stays in the list until it loads again', async () => {
    // "Rails tips" moves to "Books": the second list of "Work" no longer has it.
    const moved = { ...fullNote(RAILS_TIPS), collection: { id: 2, name: 'Books' } }
    let workLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, BOOK_LIST, OLD_IDEA] }),
      'GET /api/notes?collection_id=1': () => {
        workLoads += 1
        return json(200, { notes: workLoads === 1 ? [RAILS_TIPS, OLD_IDEA] : [OLD_IDEA] })
      },
      'GET /api/notes/3': () => json(200, { note: fullNote(RAILS_TIPS) }),
      'PATCH /api/notes/3': () => json(200, { note: moved }),
      'GET /api/notes?search=rails': () => json(200, { notes: [moved] }),
      // "Cooking" does not match "rails".
      'POST /api/notes': () => json(201, { note: fullNote(summary(6, 'Cooking')) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await waitFor(() => expect(choices(select(area, 'Collection'))).toEqual(['All', 'Books', 'Work']))
    await user.selectOptions(select(area, 'Collection'), 'Work')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea']))

    // A move to "Books" in the edit form: the note stays in its place, showing "Books".
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.selectOptions(await within(area).findByLabelText('Collection'), 'Books')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(listedTitles(area)).toEqual(['Rails tips', 'Old idea'])
    expect(within(await findEntry(area, 'Rails tips')).getByTestId('note-collection')).toHaveTextContent('Books')
    expect(select(area, 'Collection')).toHaveDisplayValue('Work')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?collection_id=1'])

    // The list loads again: "Rails tips" is no longer in "Work".
    await user.selectOptions(select(area, 'Collection'), 'All')
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await user.selectOptions(select(area, 'Collection'), 'Work')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Old idea']))

    // A note created under a search shows at the top, though it does not match.
    await user.selectOptions(select(area, 'Collection'), 'All')
    expect(await findEntry(area, 'Book list')).toBeInTheDocument()
    await user.click(searchField(area))
    await user.paste('rails')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips']))
    await user.click(within(area).getByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Cooking')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    expect(await within(area).findByRole('heading', { name: 'Cooking' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(listedTitles(area)).toEqual(['Cooking', 'Rails tips'])
    expect(searchField(area)).toHaveValue('rails')
    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?collection_id=1',
      '/api/notes',
      '/api/notes?collection_id=1',
      '/api/notes',
      '/api/notes?search=rails',
    ])
  })
})
