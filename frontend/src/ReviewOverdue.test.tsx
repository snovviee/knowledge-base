import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/16_review_overdue. The stub and the fixtures are those of
// src/ReviewDueToday.test.tsx (features/15_review_due_today). The tests render the whole app
// with a signed-in user and replace fetch, so no request leaves the test (requirements.md
// section 7). The server decides each note's review state on the user's today and sends it as
// review_state; the app shows it and never computes a date, so these tests need no fake clock.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections ("Work") and tags (none) lists unless the test names them, and the notes
// requests that the test names by method and address, query included, such as
// 'GET /api/notes?review=overdue'. Any other request fails.
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
  review_state: 'due_today' | 'overdue' | null
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

// A note as the list shows it (GET /api/notes), in "Work", with no schedule unless the
// test gives one.
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

// A weekly note due today, 2026-11-09, as the server answers it on that day.
const DUE_TODAY: Partial<Summary> = { review_interval: 'weekly', next_review_date: '2026-11-09', review_state: 'due_today' }

// A weekly note overdue since 2026-11-02, as the server answers it on 2026-11-09.
const OVERDUE: Partial<Summary> = { review_interval: 'weekly', next_review_date: '2026-11-02', review_state: 'overdue' }

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

// The list entry of the note with this title, once the list shows it.
const findEntry = async (area: HTMLElement, title: string) =>
  (await within(area).findByRole('button', { name: title })).closest('li') as HTMLElement

// The value of a row of the note's detail: the definition after its term.
const detailRow = (area: HTMLElement, term: string) =>
  within(area).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement

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

// The notes of the scenario "Show only the overdue notes", newest first: "Older idea" and
// "Old idea" are overdue, and "Rails tips" is due today.
const OLDER_IDEA = summary(3, 'Older idea', { ...OVERDUE, next_review_date: '2026-10-01' })
const RAILS_TIPS = summary(2, 'Rails tips', DUE_TODAY)
const OLD_IDEA = summary(1, 'Old idea', OVERDUE)

// The choices of a select, in its order.
const choices = (select: HTMLElement) => within(select).getAllByRole('option').map((option) => option.textContent)

describe('App review overdue (features/16_review_overdue)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-16 the list marks an overdue note with Overdue', async () => {
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            RAILS_TIPS,
            OLD_IDEA,
            summary(4, 'Someday'),
            summary(5, 'Archived idea', { status: 'archived', review_interval: 'weekly', next_review_date: '2026-11-02' }),
          ],
        }),
    })

    render(<App />)
    const area = await findNotesArea()

    // "Overdue" comes right after the next review date, and "Due today" does not show.
    const oldIdea = await findEntry(area, 'Old idea')
    const review = within(oldIdea).getByTestId('note-review')
    expect(review).toHaveTextContent('Next review: Nov 2, 2026')
    expect(review.nextElementSibling).toBe(within(oldIdea).getByTestId('note-review-state'))
    expect(within(oldIdea).getByTestId('note-review-state')).toHaveTextContent('Overdue')
    expect(within(oldIdea).queryByText('Due today')).not.toBeInTheDocument()

    // A note due today shows "Due today" and not "Overdue".
    const railsTips = await findEntry(area, 'Rails tips')
    expect(within(railsTips).getByTestId('note-review-state')).toHaveTextContent('Due today')
    expect(within(railsTips).queryByText('Overdue')).not.toBeInTheDocument()

    // A note that is neither shows no label.
    for (const title of ['Someday', 'Archived idea']) {
      const entry = await findEntry(area, title)
      expect(within(entry).queryByTestId('note-review-state')).not.toBeInTheDocument()
    }
  })

  it('AC-16 the detail marks an overdue note next to its next review date', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [OLD_IDEA] }),
      'GET /api/notes/1': () => json(200, { note: fullNote(1, 'Old idea', OVERDUE) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
    expect(await within(area).findByRole('heading', { name: 'Old idea' })).toBeInTheDocument()

    // The date, and then the label.
    const nextReview = detailRow(area, 'Next review')
    expect(nextReview.textContent).toBe('Nov 2, 2026 Overdue')
    expect(within(nextReview).getByTestId('note-review-state')).toHaveTextContent('Overdue')
  })

  it('AC-16 the Review filter offers Overdue and asks for review=overdue', async () => {
    const overdueLoad = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [OLDER_IDEA, RAILS_TIPS, OLD_IDEA] }),
      'GET /api/notes?review=overdue': overdueLoad.handler,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()

    // Feature 17 adds choices after these three.
    const review = within(area).getByLabelText('Review')
    expect(choices(review).slice(0, 3)).toEqual(['All', 'Due today', 'Overdue'])
    expect(review).toHaveDisplayValue('All')

    await user.selectOptions(review, 'Overdue')
    await overdueLoad.requested

    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=overdue'])
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Overdue')

    overdueLoad.answer(json(200, { notes: [OLDER_IDEA, OLD_IDEA] }))
    await waitFor(() => expect(listedTitles(area)).toEqual(['Older idea', 'Old idea']))
  })

  it('AC-16 an empty list under Overdue says no notes are overdue for review', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS] }),
      'GET /api/notes?review=overdue': () => json(200, { notes: [] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()

    await user.selectOptions(within(area).getByLabelText('Review'), 'Overdue')

    expect(await within(area).findByText('No notes are overdue for review.')).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
    expect(within(area).queryByText('No notes yet')).not.toBeInTheDocument()
  })

  it('AC-16 a note created with a past date shows Overdue at once', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RAILS_TIPS] }),
      'POST /api/notes': () => json(201, { note: fullNote(5, 'Late start', { ...OVERDUE, body: 'B' }) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Late start')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Weekly')
    await user.type(within(area).getByLabelText('Next review date (optional)'), '2026-11-02')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // The detail shows the create's answer.
    expect(await within(area).findByRole('heading', { name: 'Late start' })).toBeInTheDocument()
    expect(detailRow(area, 'Next review').textContent).toBe('Nov 2, 2026 Overdue')

    // The list, as it is, with the created note at the top.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expect(listedTitles(area)).toEqual(['Late start', 'Rails tips'])
    const lateStart = await findEntry(area, 'Late start')
    expect(within(lateStart).getByTestId('note-review')).toHaveTextContent('Next review: Nov 2, 2026')
    expect(within(lateStart).getByTestId('note-review-state')).toHaveTextContent('Overdue')
    expect(listRequests(fetchMock)).toEqual(['/api/notes'])
  })

  it('AC-16 with Overdue chosen the list keeps its notes and its choice as with Due today', async () => {
    // The second filtered load fails; "Try again" then lists the notes still overdue.
    let overdueLoads = 0
    const oldIdea = fullNote(1, 'Old idea', OVERDUE)
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [OLDER_IDEA, RAILS_TIPS, OLD_IDEA] }),
      'GET /api/notes?review=overdue': () => {
        overdueLoads += 1
        if (overdueLoads === 1) return json(200, { notes: [OLDER_IDEA, OLD_IDEA] })
        if (overdueLoads === 2) return json(500, { error: 'internal' })
        return json(200, { notes: [OLDER_IDEA] })
      },
      'GET /api/notes/1': () => json(200, { note: oldIdea }),
      'POST /api/notes/1/review': () =>
        json(200, {
          note: { ...oldIdea, next_review_date: '2026-11-16', last_reviewed_date: '2026-11-09', review_state: null },
        }),
    })
    const user = userEvent.setup()
    const review = (area: HTMLElement) => within(area).getByLabelText('Review')

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    await user.selectOptions(review(area), 'Overdue')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Older idea', 'Old idea']))
    expect(within(await findEntry(area, 'Old idea')).getByTestId('note-review-state')).toHaveTextContent('Overdue')

    // A review: the note stays in its place with its new date, without the label.
    await user.click(within(area).getByRole('button', { name: 'Old idea' }))
    expect(await within(area).findByRole('heading', { name: 'Old idea' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))
    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(listedTitles(area)).toEqual(['Older idea', 'Old idea'])
    const reviewed = await findEntry(area, 'Old idea')
    expect(within(reviewed).getByTestId('note-review')).toHaveTextContent('Next review: Nov 16, 2026')
    expect(within(reviewed).queryByText('Overdue')).not.toBeInTheDocument()
    expect(review(area)).toHaveDisplayValue('Overdue')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=overdue'])

    // A list that cannot load, and "Try again" with the filter.
    await user.selectOptions(review(area), 'All')
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    await user.selectOptions(review(area), 'Overdue')
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(review(area)).toHaveDisplayValue('Overdue')

    await user.click(within(area).getByRole('button', { name: 'Try again' }))

    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?review=overdue',
      '/api/notes',
      '/api/notes?review=overdue',
      '/api/notes?review=overdue',
    ])
    await waitFor(() => expect(listedTitles(area)).toEqual(['Older idea']))
    expect(review(area)).toHaveDisplayValue('Overdue')
  })
})
