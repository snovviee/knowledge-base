import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/17_search_and_filter. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7). The server does
// the searching; the tests check the list requests the field "Search" sends, and show the
// answers they are given. The test of the pause fakes only setTimeout and clearTimeout, and
// only while it types, with fireEvent: Testing Library's findBy and waitFor, and each
// user-event action, end by waiting on a setTimeout of 0 ms, which a faked one never fires
// (Testing Library advances fake timers only under Jest). The others use real timers, as the
// 300 ms pause is within findBy's 1 s.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections ("Work") and tags (none) lists, and the notes requests that the test names by
// method and address, query included, such as 'GET /api/notes?search=rails'. Any other
// request fails.
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

// A note as the list shows it (GET /api/notes), in "Work", with no schedule.
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

// The notes of the scenario "Search by title, body, or source URL", newest first: all but
// "Cooking" have "rails" in their title, body, or source URL.
const RAILS_TIPS = summary(4, 'Rails tips')
const RUBY_NOTES = summary(3, 'Ruby notes')
const COOKING = summary(2, 'Cooking')
const FRAMEWORK = summary(1, 'Framework')

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

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// The list entry of the note with this title, once the list shows it.
const findEntry = async (area: HTMLElement, title: string) =>
  (await within(area).findByRole('button', { name: title })).closest('li') as HTMLElement

// The field "Search", found in the notes area by role and name.
const searchField = (area: HTMLElement) => within(area).getByRole('searchbox', { name: 'Search' })

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

// Moves the faked clock on, with React's updates applied.
const advance = async (ms: number) => {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

describe('App note search (features/17_search_and_filter)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC-17 the search runs 300 ms after the last key with one list request', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, RUBY_NOTES, COOKING, FRAMEWORK] }),
      'GET /api/notes?search=rails': () => json(200, { notes: [RAILS_TIPS, RUBY_NOTES, FRAMEWORK] }),
    })

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Cooking')).toBeInTheDocument()

    // One key at a time, 299 ms apart, on the faked clock: no request while typing.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    for (const typed of ['r', 'ra', 'rai', 'rail', 'rails']) {
      fireEvent.change(searchField(area), { target: { value: typed } })
      await advance(299)
      expect(listRequests(fetchMock)).toEqual(['/api/notes'])
    }

    // 300 ms after the last key: one request, and no other after it.
    await advance(1)
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?search=rails'])
    await advance(1000)
    expect(listRequests(fetchMock)).toHaveLength(2)

    // Its answer shows, newest first.
    vi.useRealTimers()
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips', 'Ruby notes', 'Framework']))
    expect(searchField(area)).toHaveValue('rails')
  })

  it('AC-17 the search is sent tidied, and only spaces sends no search', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, RUBY_NOTES] }),
      'GET /api/notes?search=rails+tips': () => json(200, { notes: [RAILS_TIPS] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Ruby notes')).toBeInTheDocument()

    // Three spaces are no search: no request after the first one, and every note stays.
    await user.type(searchField(area), '   ')
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(listRequests(fetchMock)).toEqual(['/api/notes'])
    expect(listedTitles(area)).toEqual(['Rails tips', 'Ruby notes'])

    // The ends trimmed, and each run of spaces one space. The text is pasted, so that the
    // field changes once, whatever the speed of the machine.
    await user.clear(searchField(area))
    await user.paste('  rails   tips ')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips']))
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?search=rails+tips'])
    expect(searchField(area)).toHaveValue('  rails   tips ')
  })

  it('AC-17 only the answer to the latest search is shown', async () => {
    // The answer for "ra" is held until the answer for "rails" has shown.
    const raLoad = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, RUBY_NOTES, COOKING, FRAMEWORK] }),
      'GET /api/notes?search=ra': raLoad.handler,
      'GET /api/notes?search=rails': () => json(200, { notes: [RAILS_TIPS] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Cooking')).toBeInTheDocument()

    await user.click(searchField(area))
    await user.paste('ra')
    await raLoad.requested
    await user.paste('ils')

    await waitFor(() => expect(listedTitles(area)).toEqual(['Rails tips']))

    // The late answer for "ra" changes nothing.
    raLoad.answer(json(200, { notes: [RAILS_TIPS, RUBY_NOTES, FRAMEWORK] }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))

    expect(listedTitles(area)).toEqual(['Rails tips'])
    expect(searchField(area)).toHaveValue('rails')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?search=ra', '/api/notes?search=rails'])
  })

  it('AC-17 the list loads, fails, and tries again with the search and filters kept', async () => {
    // The search is held, and later answered 401. With "Archived", the first request gets no
    // answer, the second an error answer, and the third is held and then answered.
    const searchLoad = later()
    const retried = later()
    let searchLoads = 0
    let archivedLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS, RUBY_NOTES, COOKING] }),
      'GET /api/notes?search=rails': (init) => {
        searchLoads += 1
        return searchLoads === 1 ? searchLoad.handler(init) : json(401, { error: 'unauthenticated' })
      },
      'GET /api/notes?search=rails&status=archived': (init) => {
        archivedLoads += 1
        if (archivedLoads === 1) throw new TypeError('Failed to fetch')
        if (archivedLoads === 2) return json(500, { error: 'internal' })
        return retried.handler(init)
      },
    })
    const user = userEvent.setup()
    const status = (area: HTMLElement) => within(area).getByRole('combobox', { name: 'Status' })

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Cooking')).toBeInTheDocument()

    // While the search loads: "Loading…", and the bar keeps its values and can change.
    await user.click(searchField(area))
    await user.paste('rails')
    await searchLoad.requested
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(listedTitles(area)).toEqual([])
    await user.selectOptions(status(area), 'Archived')
    expect(searchField(area)).toHaveValue('rails')

    // No answer, then an error answer: the alert with "Try again", and the values kept.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(searchField(area)).toHaveValue('rails')
    expect(status(area)).toHaveDisplayValue('Archived')
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(searchField(area)).toHaveValue('rails')

    // "Try again" asks again with the same address, shows "Loading…", and then the notes.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await retried.requested
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    retried.answer(json(200, { notes: [summary(5, 'Old rails', { status: 'archived' })] }))
    await waitFor(() => expect(listedTitles(area)).toEqual(['Old rails']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
    const archived = '/api/notes?search=rails&status=archived'
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?search=rails', archived, archived, archived])

    // A list request answered 401: the sign-in screen.
    await user.selectOptions(status(area), 'All')
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
    expect(listRequests(fetchMock).at(-1)).toBe('/api/notes?search=rails')
  })

  it('AC-17 the Search field takes at most 2,000 characters', async () => {
    const kept = 'a'.repeat(2000)
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS] }),
      [`GET /api/notes?search=${kept}`]: () => json(200, { notes: [] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()

    // A paste of 2,001 characters is cut at 2,000, and those are sent.
    await user.click(searchField(area))
    await user.paste('a'.repeat(2001))

    expect(searchField(area)).toHaveValue(kept)
    expect(await within(area).findByText('No notes match your search and filters.')).toBeInTheDocument()
    expect(listRequests(fetchMock)).toEqual(['/api/notes', `/api/notes?search=${kept}`])
  })
})
