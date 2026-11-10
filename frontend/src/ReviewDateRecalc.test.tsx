import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/14_review_date_recalc. After a review, the detail shows the note the server
// answered, with its new next review date. The tests render the whole app with a
// signed-in user and replace fetch, as features/13_mark_reviewed's tests do, so no request
// leaves the test (requirements.md section 7). The server decides "today" and the new date,
// and the app writes the dates it answers in UTC, so these tests need no fake clock.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections and tags lists (empty), and the notes requests that the test names by
// method and path, such as 'GET /api/notes'. Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: [] }),
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

type Schedule = {
  review_interval: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  review_interval_days: number | null
  next_review_date: string | null
  last_reviewed_date: string | null
}

type Summary = Schedule & {
  id: number
  title: string
  status: 'active' | 'archived'
  collection: { id: number; name: string }
  tags: { id: number; name: string }[]
  created_at: string
  updated_at: string
}

// A note as the list shows it (GET /api/notes), in "Work": weekly and due 2026-11-12
// unless the test says otherwise, and never reviewed. A review on 2026-11-09 moves the
// date to 2026-11-16, so a test sees the new date.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
  tags: [],
  review_interval: 'weekly',
  review_interval_days: null,
  next_review_date: '2026-11-12',
  last_reviewed_date: null,
  created_at: '2026-11-09T10:00:00.000Z',
  updated_at: '2026-11-09T10:00:00.000Z',
  ...fields,
})

type Note = Summary & { body: string; source_url: string | null }

// A note as its detail shows it (GET /api/notes/:id).
const fullNote = (id: number, title: string, fields: Partial<Note> = {}): Note => ({
  ...summary(id, title),
  body: `Body of ${title}`,
  source_url: null,
  ...fields,
})

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// The value of a row of the note's detail: the definition after its term.
const detailRow = (area: HTMLElement, term: string) =>
  within(area).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent

// The titles the list shows, in its order.
const listedTitles = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('note-title')
    .map((title) => title.textContent)

// What the list entry of the note with this title shows of its schedule, once the list shows it.
const entryReview = async (area: HTMLElement, title: string) => {
  const entry = (await within(area).findByRole('button', { name: title })).closest('li') as HTMLElement
  return within(entry).getByTestId('note-review').textContent
}

describe('App review date recalc (features/14_review_date_recalc)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-14 after a review the detail shows the new next review date and the last reviewed date', async () => {
    const railsTips = fullNote(2, 'Rails tips')
    const someday = fullNote(1, 'Someday', { review_interval: 'none', next_review_date: null })
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [summary(2, 'Rails tips'), summary(1, 'Someday', { review_interval: 'none', next_review_date: null })],
        }),
      'GET /api/notes/2': () => json(200, { note: railsTips }),
      'GET /api/notes/1': () => json(200, { note: someday }),
      'POST /api/notes/2/review': () =>
        json(200, { note: { ...railsTips, next_review_date: '2026-11-16', last_reviewed_date: '2026-11-09' } }),
      'POST /api/notes/1/review': () => json(200, { note: { ...someday, last_reviewed_date: '2026-11-09' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(detailRow(area, 'Next review')).toBe('Nov 12, 2026')
    expect(detailRow(area, 'Last reviewed')).toBe('Never')

    await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))

    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(detailRow(area, 'Next review')).toBe('Nov 16, 2026')
    expect(detailRow(area, 'Last reviewed')).toBe('Nov 9, 2026')

    // A note with no schedule keeps none.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Someday' }))
    expect(await within(area).findByRole('heading', { name: 'Someday' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))

    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(detailRow(area, 'Next review')).toBe('Not set')
    expect(detailRow(area, 'Last reviewed')).toBe('Nov 9, 2026')
  })

  it('AC-14 after a review the list shows the new next review date in the same place', async () => {
    const railsTips = fullNote(2, 'Rails tips')
    const fetchMock = stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            summary(3, 'Newer', { next_review_date: '2026-11-20' }),
            summary(2, 'Rails tips'),
            summary(1, 'Older', { next_review_date: '2026-11-25' }),
          ],
        }),
      'GET /api/notes/2': () => json(200, { note: railsTips }),
      'POST /api/notes/2/review': () =>
        json(200, { note: { ...railsTips, next_review_date: '2026-11-16', last_reviewed_date: '2026-11-09' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await entryReview(area, 'Rails tips')).toBe('Next review: Nov 12, 2026')
    expect(listedTitles(area)).toEqual(['Newer', 'Rails tips', 'Older'])

    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))
    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(await entryReview(area, 'Rails tips')).toBe('Next review: Nov 16, 2026')
    expect(listedTitles(area)).toEqual(['Newer', 'Rails tips', 'Older'])
    // The list shows the review's answer: it is not asked for again.
    expect(fetchMock.mock.calls.filter(([url, init]) => url === '/api/notes' && !init?.method)).toHaveLength(1)
  })

  it('AC-14 a review that fails keeps both dates in the detail and the list', async () => {
    const reviewed = { last_reviewed_date: '2026-11-02' }
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips', reviewed)] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips', reviewed) }),
      'POST /api/notes/2/review': () => json(500, { error: 'internal' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))

    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not mark the note as reviewed. Try again.')
    expect(detailRow(area, 'Next review')).toBe('Nov 12, 2026')
    expect(detailRow(area, 'Last reviewed')).toBe('Nov 2, 2026')

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(await entryReview(area, 'Rails tips')).toBe('Next review: Nov 12, 2026')
  })
})
