import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/13_mark_reviewed. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7). The server
// decides "today", and the app writes the dates it answers in UTC, so these tests need no
// fake clock.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections and tags lists (empty unless the test names them), and the notes requests
// that the test names by method and path, such as 'GET /api/notes'. Any other request
// fails.
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

// A note as the list shows it (GET /api/notes), in "Work": weekly and due 2026-11-16
// unless the test says otherwise, and never reviewed.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
  tags: [],
  review_interval: 'weekly',
  review_interval_days: null,
  next_review_date: '2026-11-16',
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

// The titles the list shows, in its order.
const listedTitles = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('note-title')
    .map((title) => title.textContent)

// The value of a row of the note's detail: the definition after its term.
const detailRow = (area: HTMLElement, term: string) =>
  within(area).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent

// The terms of the note's detail, in their order.
const detailTerms = (area: HTMLElement) => Array.from(area.querySelectorAll('dt')).map((term) => term.textContent)

describe('App mark as reviewed (features/13_mark_reviewed)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-13 the detail shows Last reviewed with the date, or Never', async () => {
    const olderAnswer: Partial<Note> = fullNote(1, 'Older answer')
    delete olderAnswer.last_reviewed_date
    const notes = [
      fullNote(3, 'Never reviewed'),
      fullNote(2, 'Reviewed before', { last_reviewed_date: '2026-11-02' }),
      // An answer with no last_reviewed_date reads as a note never reviewed.
      olderAnswer,
    ]
    stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    for (const [title, lastReviewed] of [
      ['Never reviewed', 'Never'],
      ['Reviewed before', 'Nov 2, 2026'],
      ['Older answer', 'Never'],
    ]) {
      await user.click(await within(area).findByRole('button', { name: title }))
      expect(await within(area).findByRole('heading', { name: title })).toBeInTheDocument()
      // The row comes right after "Next review".
      const terms = detailTerms(area)
      expect(terms[terms.indexOf('Next review') + 1]).toBe('Last reviewed')
      expect(detailRow(area, 'Last reviewed')).toBe(lastReviewed)
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }
  })

  it('AC-13 Mark as reviewed sends the review request and shows Marked as reviewed and the last reviewed date', async () => {
    const note = fullNote(2, 'Rails tips')
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'POST /api/notes/2/review': () => json(200, { note: { ...note, last_reviewed_date: '2026-11-09' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(detailRow(area, 'Last reviewed')).toBe('Never')

    await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))

    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(detailRow(area, 'Last reviewed')).toBe('Nov 9, 2026')
    // The request carries this session's token and no body.
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/2/review', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token' },
    })
    const reviews = fetchMock.mock.calls.filter(([url]) => url === '/api/notes/2/review')
    expect(reviews).toHaveLength(1)
    expect(reviews[0][1]).not.toHaveProperty('body')
  })

  it('AC-13 Mark as reviewed is busy while its request waits and ignores a second click', async () => {
    const note = fullNote(2, 'Rails tips')
    const review = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'POST /api/notes/2/review': review.handler,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    const button = await within(area).findByRole('button', { name: 'Mark as reviewed' })

    await user.click(button)
    await review.requested

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    // A second click sends no second request.
    await user.click(button)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/notes/2/review')).toHaveLength(1)

    review.answer(json(200, { note: { ...note, last_reviewed_date: '2026-11-09' } }))

    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-busy', 'false')
  })

  it('AC-13 a mark that fails shows the error and keeps the detail as it was', async () => {
    const note = fullNote(2, 'Rails tips')
    const third = later()
    let reviews = 0
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'POST /api/notes/2/review': (init) => {
        reviews += 1
        // No answer: the request fails, as fetch does when the server cannot be reached.
        if (reviews === 1) throw new TypeError('Failed to fetch')
        if (reviews === 2) return json(500, { error: 'internal' })
        return third.handler(init)
      },
    })
    const user = userEvent.setup()
    const failure = 'Could not mark the note as reviewed. Try again.'

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    const button = await within(area).findByRole('button', { name: 'Mark as reviewed' })
    // The detail as it was before the review.
    const keptAsItWas = () => {
      expect(within(area).getByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
      expect(detailRow(area, 'Last reviewed')).toBe('Never')
      expect(button).toBeEnabled()
      expect(within(area).queryByText('Marked as reviewed.')).not.toBeInTheDocument()
    }

    // No answer.
    await user.click(button)

    expect(await within(area).findByRole('alert')).toHaveTextContent(failure)
    keptAsItWas()

    // An error answer.
    await user.click(button)
    await waitFor(() => {
      expect(reviews).toBe(2)
      expect(button).toBeEnabled()
    })

    expect(within(area).getByRole('alert')).toHaveTextContent(failure)
    keptAsItWas()

    // A third review removes the failure when it starts, and then succeeds.
    await user.click(button)
    await third.requested

    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
    third.answer(json(200, { note: { ...note, last_reviewed_date: '2026-11-09' } }))
    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
    expect(detailRow(area, 'Last reviewed')).toBe('Nov 9, 2026')
  })

  it('AC-13 marking a note that no longer exists removes it from the list and says so', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'Other note')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'POST /api/notes/2/review': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))

    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(listedTitles(area)).toEqual(['Other note'])
    expect(within(area).queryByRole('button', { name: 'Back to notes' })).not.toBeInTheDocument()
  })

  it('AC-13 a mark answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'POST /api/notes/2/review': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Mark as reviewed' }))

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('AC-13 an archived note and a note with no schedule can be marked as reviewed', async () => {
    const notes = [
      fullNote(3, 'Old idea', { status: 'archived' }),
      fullNote(2, 'Someday', { review_interval: 'none', next_review_date: null }),
    ]
    stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
      ...Object.fromEntries(
        notes.map((note) => [
          `POST /api/notes/${note.id}/review`,
          () => json(200, { note: { ...note, last_reviewed_date: '2026-11-09' } }),
        ]),
      ),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    for (const title of ['Old idea', 'Someday']) {
      await user.click(await within(area).findByRole('button', { name: title }))
      expect(await within(area).findByRole('heading', { name: title })).toBeInTheDocument()
      await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))
      expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
      expect(detailRow(area, 'Last reviewed')).toBe('Nov 9, 2026')
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }
  })
})
