import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/15_review_due_today. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7). The server
// decides each note's review state on the user's today and sends it as review_state; the
// app shows it and never computes a date, so these tests need no fake clock (one fakes
// Date to show that the clock changes nothing).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections ("Work") and tags (none) lists unless the test names them, and the notes
// requests that the test names by method and address, query included, such as
// 'GET /api/notes?review=due_today'. Any other request fails.
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

// The notes of the scenario "Show only the notes due today", newest first: "Ruby tips" and
// "Rails tips" are due today, and "Tomorrow tip" is not.
const RUBY_TIPS = summary(3, 'Ruby tips', DUE_TODAY)
const TOMORROW_TIP = summary(2, 'Tomorrow tip', { review_interval: 'weekly', next_review_date: '2026-11-10' })
const RAILS_TIPS = summary(1, 'Rails tips', DUE_TODAY)

// The choices of a select, in its order.
const choices = (select: HTMLElement) => within(select).getAllByRole('option').map((option) => option.textContent)

// Whether the first element comes before the second in the page.
const isBefore = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('App review due today (features/15_review_due_today)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC-15 the list marks a note due today with Due today, from its review_state alone', async () => {
    // The clock says 2026-11-09, but only review_state decides the label.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            summary(5, 'Rails tips', DUE_TODAY),
            summary(4, 'Late tip', { review_interval: 'weekly', next_review_date: '2026-11-08', review_state: 'overdue' }),
            summary(3, 'Dated today', { review_interval: 'weekly', next_review_date: '2026-11-09', review_state: null }),
            summary(2, 'Someday'),
            // An answer with no review_state reads as a note that is not due.
            {
              id: 1,
              title: 'Older answer',
              status: 'active',
              collection: { id: 1, name: 'Work' },
              tags: [],
              created_at: '2026-11-09T10:00:00.000Z',
              updated_at: '2026-11-09T10:00:00.000Z',
            },
          ],
        }),
    })

    render(<App />)
    const area = await findNotesArea()
    const railsTips = await findEntry(area, 'Rails tips')

    // "Due today" comes right after the next review date.
    const review = within(railsTips).getByTestId('note-review')
    expect(review).toHaveTextContent('Next review: Nov 9, 2026')
    expect(review.nextElementSibling).toBe(within(railsTips).getByTestId('note-review-state'))
    expect(within(railsTips).getByTestId('note-review-state')).toHaveTextContent('Due today')

    for (const title of ['Late tip', 'Dated today', 'Someday', 'Older answer']) {
      const entry = await findEntry(area, title)
      expect(within(entry).queryByText('Due today')).not.toBeInTheDocument()
    }
    expect(within(await findEntry(area, 'Dated today')).getByTestId('note-review')).toHaveTextContent(
      'Next review: Nov 9, 2026',
    )
  })

  it('AC-15 the detail marks a note due today next to its next review date', async () => {
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            summary(2, 'Rails tips', DUE_TODAY),
            summary(1, 'Tomorrow tip', { review_interval: 'weekly', next_review_date: '2026-11-10' }),
          ],
        }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips', DUE_TODAY) }),
      'GET /api/notes/1': () =>
        json(200, { note: fullNote(1, 'Tomorrow tip', { review_interval: 'weekly', next_review_date: '2026-11-10' }) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()

    // The date, and then the label.
    const nextReview = detailRow(area, 'Next review')
    expect(nextReview.textContent).toBe('Nov 9, 2026 Due today')
    expect(within(nextReview).getByTestId('note-review-state')).toHaveTextContent('Due today')

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Tomorrow tip' }))
    expect(await within(area).findByRole('heading', { name: 'Tomorrow tip' })).toBeInTheDocument()

    expect(detailRow(area, 'Next review').textContent).toBe('Nov 10, 2026')
    expect(within(area).queryByText('Due today')).not.toBeInTheDocument()
  })

  it('AC-15 the Review filter shows above the list with All chosen, and not with a note or a form', async () => {
    // The first list load is held and then fails, "Try again" finds no note, and each load
    // after it (a reload) finds "Rails tips".
    const firstLoad = later()
    let listLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': (init) => {
        listLoads += 1
        if (listLoads === 1) return firstLoad.handler(init)
        if (listLoads === 2) return json(200, { notes: [] })
        return json(200, { notes: [summary(2, 'Rails tips', DUE_TODAY)] })
      },
      'GET /api/notes?review=due_today': () => json(200, { notes: [summary(2, 'Rails tips', DUE_TODAY)] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips', DUE_TODAY) }),
    })
    const user = userEvent.setup()

    const first = render(<App />)
    let area = await findNotesArea()
    await firstLoad.requested

    // While the list loads: "Review" shows before it, with "All" chosen.
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    const review = within(area).getByLabelText('Review')
    expect(review).toHaveDisplayValue('All')
    // Features 16 and 17 add choices after these two.
    expect(choices(review).slice(0, 2)).toEqual(['All', 'Due today'])
    expect(isBefore(review, within(area).getByRole('status'))).toBe(true)
    expect(listRequests(fetchMock)).toEqual(['/api/notes'])

    // When the list cannot load.
    firstLoad.answer(json(500, { error: 'internal' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('All')
    expect(isBefore(within(area).getByLabelText('Review'), within(area).getByRole('alert'))).toBe(true)

    // When the list is empty.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('All')

    // Not with the new-note form.
    await user.click(within(area).getByRole('button', { name: 'New note' }))
    expect(await within(area).findByLabelText('Title')).toBeInTheDocument()
    expect(within(area).queryByLabelText('Review')).not.toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(within(area).getByLabelText('Review')).toBeInTheDocument()

    // A reload: with notes, and not with a note's detail.
    first.unmount()
    const second = render(<App />)
    area = await findNotesArea()
    const list = (await findEntry(area, 'Rails tips')).closest('ul') as HTMLElement
    expect(isBefore(within(area).getByLabelText('Review'), list)).toBe(true)
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(within(area).queryByLabelText('Review')).not.toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Due today')

    // A reload after "Due today": "Review" shows "All", and the list asks for every note.
    second.unmount()
    const requestsBefore = listRequests(fetchMock).length
    render(<App />)
    area = await findNotesArea()
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('All')
    expect(listRequests(fetchMock).slice(requestsBefore)).toEqual(['/api/notes'])
  })

  it('AC-15 choosing Due today asks for review=due_today, and All asks for every note', async () => {
    const dueTodayLoad = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': dueTodayLoad.handler,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()

    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')
    await dueTodayLoad.requested

    // While it waits: "Loading…" in place of the entries, and the choice in "Review".
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today'])
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Due today')

    // The answer, in its order.
    dueTodayLoad.answer(json(200, { notes: [RUBY_TIPS, RAILS_TIPS] }))
    expect(await findEntry(area, 'Rails tips')).toBeInTheDocument()
    expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips'])
    expect(within(area).queryByRole('status')).not.toBeInTheDocument()

    // "All" asks for every note again.
    await user.selectOptions(within(area).getByLabelText('Review'), 'All')
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    expect(listedTitles(area)).toEqual(['Ruby tips', 'Tomorrow tip', 'Rails tips'])
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today', '/api/notes'])
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('All')
  })

  it('AC-15 an empty list under Due today says no notes are due for review today', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/notes?review=due_today': () => json(200, { notes: [] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()

    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')

    expect(await within(area).findByText('No notes are due for review today.')).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
    expect(within(area).queryByText('No notes yet')).not.toBeInTheDocument()

    await user.selectOptions(within(area).getByLabelText('Review'), 'All')

    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    expect(within(area).queryByText('No notes are due for review today.')).not.toBeInTheDocument()
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today', '/api/notes'])
  })

  it('AC-15 the Review filter keeps its choice while a note or a form is open, with no list request', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': () => json(200, { notes: [RUBY_TIPS, RAILS_TIPS] }),
      'GET /api/notes/1': () => json(200, { note: fullNote(1, 'Rails tips', DUE_TODAY) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips']))

    // A note's detail, and back.
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Due today')
    expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips'])

    // The new-note form, and back.
    await user.click(within(area).getByRole('button', { name: 'New note' }))
    expect(await within(area).findByLabelText('Title')).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))

    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Due today')
    expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips'])
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today'])
  })

  it('AC-15 a filtered list that cannot load shows the error, and Try again asks again with the filter', async () => {
    // The first filtered request gets no answer, the second an error answer, and the third
    // is held and then answered.
    const retried = later()
    let dueTodayLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': (init) => {
        dueTodayLoads += 1
        if (dueTodayLoads === 1) throw new TypeError('Failed to fetch')
        if (dueTodayLoads === 2) return json(500, { error: 'internal' })
        return retried.handler(init)
      },
    })
    const user = userEvent.setup()
    const review = (area: HTMLElement) => within(area).getByLabelText('Review')

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()

    // No answer.
    await user.selectOptions(review(area), 'Due today')
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(within(area).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(review(area)).toHaveDisplayValue('Due today')

    // An error answer.
    await user.selectOptions(review(area), 'All')
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    await user.selectOptions(review(area), 'Due today')
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    expect(within(area).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(review(area)).toHaveDisplayValue('Due today')

    // "Try again" asks again with the filter, and shows "Loading…" while it waits.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?review=due_today',
      '/api/notes',
      '/api/notes?review=due_today',
      '/api/notes?review=due_today',
    ])
    await retried.requested
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(review(area)).toHaveDisplayValue('Due today')

    retried.answer(json(200, { notes: [RUBY_TIPS, RAILS_TIPS] }))
    await waitFor(() => expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-15 only the answer to the latest Review choice is shown', async () => {
    // "Due today" is held, then "All" is chosen again and held too; the answer for "All"
    // arrives first. It has a note the first answer did not have.
    const dueTodayLoad = later()
    const secondAllLoad = later()
    let allLoads = 0
    const fetchMock = stubBackend({
      'GET /api/notes': (init) => {
        allLoads += 1
        if (allLoads === 1) return json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] })
        return secondAllLoad.handler(init)
      },
      'GET /api/notes?review=due_today': dueTodayLoad.handler,
    })
    const user = userEvent.setup()
    const review = (area: HTMLElement) => within(area).getByLabelText('Review')

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()

    await user.selectOptions(review(area), 'Due today')
    await dueTodayLoad.requested
    await user.selectOptions(review(area), 'All')
    await secondAllLoad.requested

    // While the answer for "All" has not arrived, the list shows "Loading…", and no answer.
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(listedTitles(area)).toEqual([])

    secondAllLoad.answer(json(200, { notes: [summary(4, 'Newest tip'), RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }))
    const everyNote = ['Newest tip', 'Ruby tips', 'Tomorrow tip', 'Rails tips']
    await waitFor(() => expect(listedTitles(area)).toEqual(everyNote))

    // The late answer for "Due today" changes nothing.
    dueTodayLoad.answer(json(200, { notes: [RUBY_TIPS, RAILS_TIPS] }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)))

    expect(listedTitles(area)).toEqual(everyNote)
    expect(review(area)).toHaveDisplayValue('All')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today', '/api/notes'])
  })

  it('AC-15 a filtered list request answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()

    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')

    // The sign-in screen, with no message.
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-15 a note created under the Due today filter shows at the top until the list loads again', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': () => json(200, { notes: [RUBY_TIPS, RAILS_TIPS] }),
      // A note with the interval None is not due today.
      'POST /api/notes': () => json(201, { note: fullNote(5, 'New idea', { body: 'B' }) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    await user.selectOptions(within(area).getByLabelText('Review'), 'Due today')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips']))

    await user.click(within(area).getByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'New idea')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    expect(await within(area).findByRole('heading', { name: 'New idea' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(listedTitles(area)).toEqual(['New idea', 'Ruby tips', 'Rails tips'])
    expect(within(await findEntry(area, 'New idea')).queryByText('Due today')).not.toBeInTheDocument()
    expect(within(area).getByLabelText('Review')).toHaveDisplayValue('Due today')
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today'])
  })

  it('AC-15 a note changed in its detail keeps its place in the filtered list with its new label until the list loads again', async () => {
    // The second filtered load has no "Rails tips": it was reviewed.
    let dueTodayLoads = 0
    const railsTips = fullNote(1, 'Rails tips', DUE_TODAY)
    const rubyTips = fullNote(3, 'Ruby tips', DUE_TODAY)
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [RUBY_TIPS, TOMORROW_TIP, RAILS_TIPS] }),
      'GET /api/notes?review=due_today': () => {
        dueTodayLoads += 1
        return json(200, { notes: dueTodayLoads === 1 ? [RUBY_TIPS, RAILS_TIPS] : [RUBY_TIPS] })
      },
      'GET /api/notes/1': () => json(200, { note: railsTips }),
      'POST /api/notes/1/review': () =>
        json(200, {
          note: { ...railsTips, next_review_date: '2026-11-16', last_reviewed_date: '2026-11-09', review_state: null },
        }),
      'GET /api/notes/3': () => json(200, { note: rubyTips }),
      'PATCH /api/notes/3': () => json(200, { note: { ...rubyTips, status: 'archived', review_state: null } }),
    })
    const user = userEvent.setup()
    const review = (area: HTMLElement) => within(area).getByLabelText('Review')

    render(<App />)
    const area = await findNotesArea()
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    await user.selectOptions(review(area), 'Due today')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips']))
    expect(within(await findEntry(area, 'Rails tips')).getByTestId('note-review-state')).toHaveTextContent('Due today')

    // A review: the note stays in its place with its new date, and without the label.
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Mark as reviewed' }))
    expect(await within(area).findByRole('status')).toHaveTextContent('Marked as reviewed.')
    expect(within(area).queryByText('Due today')).not.toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    expect(listedTitles(area)).toEqual(['Ruby tips', 'Rails tips'])
    const reviewed = await findEntry(area, 'Rails tips')
    expect(within(reviewed).getByTestId('note-review')).toHaveTextContent('Next review: Nov 16, 2026')
    expect(within(reviewed).queryByText('Due today')).not.toBeInTheDocument()
    expect(listRequests(fetchMock)).toEqual(['/api/notes', '/api/notes?review=due_today'])

    // The list loads again, and "Rails tips" is no longer in it.
    await user.selectOptions(review(area), 'All')
    expect(await findEntry(area, 'Tomorrow tip')).toBeInTheDocument()
    await user.selectOptions(review(area), 'Due today')
    await waitFor(() => expect(listedTitles(area)).toEqual(['Ruby tips']))
    expect(listRequests(fetchMock)).toEqual([
      '/api/notes',
      '/api/notes?review=due_today',
      '/api/notes',
      '/api/notes?review=due_today',
    ])

    // An archive: the detail loses the label, and the entry stays, archived and without it.
    await user.click(within(area).getByRole('button', { name: 'Ruby tips' }))
    expect(await within(area).findByRole('heading', { name: 'Ruby tips' })).toBeInTheDocument()
    expect(within(detailRow(area, 'Next review')).getByTestId('note-review-state')).toHaveTextContent('Due today')
    await user.click(within(area).getByRole('button', { name: 'Archive' }))
    expect(await within(area).findByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(within(area).queryByText('Due today')).not.toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    const archived = await findEntry(area, 'Ruby tips')
    expect(within(archived).getByText('Archived')).toBeInTheDocument()
    expect(within(archived).queryByText('Due today')).not.toBeInTheDocument()
    expect(listedTitles(area)).toEqual(['Ruby tips'])
    expect(listRequests(fetchMock)).toHaveLength(4)
  })
})
