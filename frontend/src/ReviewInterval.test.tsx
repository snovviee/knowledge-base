import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/12_review_interval_setting. The tests render the whole app with a signed-in
// user and replace fetch, so no request leaves the test (requirements.md section 7).
// The app never computes "today": the server does, so these tests need no fake clock.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections ("Work") and tags (none) lists unless the test names them, and the notes
// requests that the test names by method and path, such as 'GET /api/notes'. Any other
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

// The review fields of the note form that show: "Number of days" and "Next review date
// (optional)".
const shownReviewFields = (area: HTMLElement) =>
  ['Number of days', 'Next review date (optional)'].filter((label) => within(area).queryByLabelText(label))

// The JSON bodies of the requests sent with this method to this path, in order.
const sentBodies = (fetchMock: ReturnType<typeof stubBackend>, method: string, path: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => url === path && init?.method === method)
    .map(([, init]) => JSON.parse(String(init?.body)))

type User = ReturnType<typeof userEvent.setup>

// Opens the new-note form from the list and fills its title, its body ("B"), and its
// collection ("Work").
async function startNewNote(user: User, area: HTMLElement, title: string) {
  await user.click(await within(area).findByRole('button', { name: 'New note' }))
  await user.type(await within(area).findByLabelText('Title'), title)
  await user.type(within(area).getByLabelText('Body'), 'B')
  await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
}

describe('App review interval (features/12_review_interval_setting)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-12 the list shows the next review date, or No review scheduled', async () => {
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            summary(3, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
            summary(2, 'Plain note'),
            // An answer with no review fields reads as a note with no schedule.
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

    await waitFor(() => expect(within(area).getAllByRole('listitem')).toHaveLength(3))
    const [weekly, plain, older] = within(area).getAllByRole('listitem')
    expect(within(weekly).getByTestId('note-review')).toHaveTextContent('Next review: Nov 16, 2026')
    expect(within(plain).getByTestId('note-review')).toHaveTextContent('No review scheduled')
    expect(within(older).getByTestId('note-review')).toHaveTextContent('No review scheduled')
  })

  it('AC-12 the detail shows the review interval and the next review date', async () => {
    const notes = [
      fullNote(4, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
      fullNote(3, 'Plain note'),
      fullNote(2, 'Custom note', { review_interval: 'custom', review_interval_days: 10, next_review_date: '2026-11-19' }),
      fullNote(1, 'One day', { review_interval: 'custom', review_interval_days: 1, next_review_date: '2026-11-10' }),
    ]
    stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    for (const [title, interval, nextReview] of [
      ['Weekly note', 'Weekly', 'Nov 16, 2026'],
      ['Plain note', 'None', 'Not set'],
      ['Custom note', 'Every 10 days', 'Nov 19, 2026'],
      ['One day', 'Every 1 day', 'Nov 10, 2026'],
    ]) {
      await user.click(await within(area).findByRole('button', { name: title }))
      expect(await within(area).findByRole('heading', { name: title })).toBeInTheDocument()
      expect(detailRow(area, 'Review interval')).toBe(interval)
      expect(detailRow(area, 'Next review')).toBe(nextReview)
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }
  })

  it('AC-12 the form shows the review fields the interval needs', async () => {
    stubBackend({ 'GET /api/notes': () => json(200, { notes: [] }) })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    // A new note has None chosen, and no other review field.
    const interval = await within(area).findByLabelText('Review interval')
    expect(interval).toHaveDisplayValue('None')
    expect(within(interval).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'None',
      'Daily',
      'Weekly',
      'Monthly',
      'Every N days',
    ])
    expect(shownReviewFields(area)).toEqual([])

    await user.selectOptions(interval, 'Every N days')
    expect(shownReviewFields(area)).toEqual(['Number of days', 'Next review date (optional)'])

    await user.selectOptions(interval, 'Weekly')
    expect(shownReviewFields(area)).toEqual(['Next review date (optional)'])

    await user.selectOptions(interval, 'None')
    expect(shownReviewFields(area)).toEqual([])
  })

  it('AC-12 creating a weekly note without a date sends only the interval and shows the next review date', async () => {
    const answers = [
      fullNote(3, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
      fullNote(4, 'Plain note'),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'POST /api/notes': () => json(201, { note: answers.shift() }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await startNewNote(user, area, 'Weekly note')
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Weekly')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // The detail shows the date the server computed.
    expect(await within(area).findByRole('heading', { name: 'Weekly note' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('Weekly')
    expect(detailRow(area, 'Next review')).toBe('Nov 16, 2026')
    expect(sentBodies(fetchMock, 'POST', '/api/notes')).toEqual([
      { title: 'Weekly note', body: 'B', source_url: '', collection_id: 1, review_interval: 'weekly' },
    ])

    // With None, the create sends no review field.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await startNewNote(user, area, 'Plain note')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(await within(area).findByRole('heading', { name: 'Plain note' })).toBeInTheDocument()
    expect(sentBodies(fetchMock, 'POST', '/api/notes')[1]).toEqual({
      title: 'Plain note',
      body: 'B',
      source_url: '',
      collection_id: 1,
    })
  })

  it('AC-12 creating with Every N days sends the number of days as a number', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'POST /api/notes': () =>
        json(201, {
          note: fullNote(3, 'Custom note', {
            review_interval: 'custom',
            review_interval_days: 10,
            next_review_date: '2026-11-19',
          }),
        }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await startNewNote(user, area, 'Custom note')
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Every N days')
    await user.type(within(area).getByLabelText('Number of days'), '10')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(await within(area).findByRole('heading', { name: 'Custom note' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('Every 10 days')
    expect(detailRow(area, 'Next review')).toBe('Nov 19, 2026')
    expect(sentBodies(fetchMock, 'POST', '/api/notes')).toEqual([
      {
        title: 'Custom note',
        body: 'B',
        source_url: '',
        collection_id: 1,
        review_interval: 'custom',
        review_interval_days: 10,
      },
    ])
  })

  it('AC-12 a next review date entered in the form is sent as YYYY-MM-DD', async () => {
    const answers = [
      fullNote(3, 'Picked date', { review_interval: 'weekly', next_review_date: '2026-11-20' }),
      fullNote(4, 'Past date', { review_interval: 'weekly', next_review_date: '2026-11-02' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'POST /api/notes': () => json(201, { note: answers.shift() }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // A date the user picked, and one in the past.
    for (const [title, date, shown] of [
      ['Picked date', '2026-11-20', 'Nov 20, 2026'],
      ['Past date', '2026-11-02', 'Nov 2, 2026'],
    ]) {
      await startNewNote(user, area, title)
      await user.selectOptions(within(area).getByLabelText('Review interval'), 'Weekly')
      await user.type(within(area).getByLabelText('Next review date (optional)'), date)
      await user.click(within(area).getByRole('button', { name: 'Create' }))

      expect(await within(area).findByRole('heading', { name: title })).toBeInTheDocument()
      expect(detailRow(area, 'Next review')).toBe(shown)
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }

    expect(sentBodies(fetchMock, 'POST', '/api/notes')).toEqual([
      { title: 'Picked date', body: 'B', source_url: '', collection_id: 1, review_interval: 'weekly', next_review_date: '2026-11-20' },
      { title: 'Past date', body: 'B', source_url: '', collection_id: 1, review_interval: 'weekly', next_review_date: '2026-11-02' },
    ])
  })

  it('AC-12 the form checks the number of days before sending', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'POST /api/notes': () =>
        json(201, {
          note: fullNote(3, 'Days check', { review_interval: 'custom', review_interval_days: 365, next_review_date: '2027-11-09' }),
        }),
    })
    const changes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await startNewNote(user, area, 'Days check')
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Every N days')
    const days = within(area).getByLabelText('Number of days')

    for (const [typed, message] of [
      ['', 'Enter the number of days.'],
      ['   ', 'Enter the number of days.'],
      ['0', 'Enter a whole number from 1 to 365.'],
      ['366', 'Enter a whole number from 1 to 365.'],
      ['1.5', 'Enter a whole number from 1 to 365.'],
      ['abc', 'Enter a whole number from 1 to 365.'],
      ['-7', 'Enter a whole number from 1 to 365.'],
    ]) {
      await user.clear(days)
      if (typed !== '') await user.type(days, typed)
      await user.click(within(area).getByRole('button', { name: 'Create' }))

      expect(days).toHaveAccessibleDescription(message)
      expect(days).toHaveAttribute('aria-invalid', 'true')
      expect(days).toHaveFocus()
      expect(changes()).toEqual([])
    }

    // A whole number from 1 to 365 is sent.
    await user.clear(days)
    await user.type(days, '365')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    expect(await within(area).findByRole('heading', { name: 'Days check' })).toBeInTheDocument()
    expect(changes()).toHaveLength(1)

    // Save checks the days the same way.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Every N days')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(within(area).getByLabelText('Number of days')).toHaveAccessibleDescription('Enter the number of days.')
    expect(within(area).getByLabelText('Number of days')).toHaveFocus()
    expect(changes()).toHaveLength(1)
  })

  it('AC-12 an incomplete date shows Enter a valid date and sends nothing', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'POST /api/notes': () => json(201, { note: fullNote(3, 'Date check') }),
    })
    const creates = () => sentBodies(fetchMock, 'POST', '/api/notes')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await startNewNote(user, area, 'Date check')
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Weekly')
    const date = within(area).getByLabelText('Next review date (optional)')
    // A browser reports bad input for a date typed in part, such as only its month. jsdom
    // never does, so the field reports it here.
    vi.spyOn(date as HTMLInputElement, 'validity', 'get').mockReturnValue({ badInput: true, valid: false } as ValidityState)
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(date).toHaveAccessibleDescription('Enter a valid date.')
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(date).toHaveFocus()
    expect(creates()).toEqual([])

    // With None, the hidden date field is not checked.
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'None')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(await within(area).findByRole('heading', { name: 'Date check' })).toBeInTheDocument()
    expect(creates()).toEqual([{ title: 'Date check', body: 'B', source_url: '', collection_id: 1 }])
  })

  it("AC-12 the server's review field codes show under their fields", async () => {
    const refusals = [
      { review_interval: 'invalid' },
      { review_interval_days: 'blank' },
      { review_interval_days: 'invalid' },
      { next_review_date: 'invalid' },
    ]
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'POST /api/notes': () => json(422, { error: 'validation_failed', fields: refusals.shift() }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await startNewNote(user, area, 'Refused')
    const interval = within(area).getByLabelText('Review interval')
    await user.selectOptions(interval, 'Every N days')
    const days = within(area).getByLabelText('Number of days')
    const date = within(area).getByLabelText('Next review date (optional)')
    await user.type(days, '10')
    await user.type(date, '2026-11-20')

    for (const [field, message] of [
      [interval, 'Choose a review interval.'],
      [days, 'Enter the number of days.'],
      [days, 'Enter a whole number from 1 to 365.'],
      [date, 'Enter a valid date.'],
    ] as const) {
      await user.click(within(area).getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(field).toHaveAccessibleDescription(message))
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveFocus()
    }

    // The form keeps what was typed.
    expect(within(area).getByLabelText('Title')).toHaveValue('Refused')
    expect(interval).toHaveDisplayValue('Every N days')
    expect(days).toHaveValue('10')
    expect(date).toHaveValue('2026-11-20')
    expect(within(area).queryByRole('heading', { name: 'Refused' })).not.toBeInTheDocument()
  })

  it("AC-12 the edit form shows the note's schedule", async () => {
    const notes = [
      fullNote(2, 'Custom note', { review_interval: 'custom', review_interval_days: 10, next_review_date: '2026-11-19' }),
      fullNote(1, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
    ]
    stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Custom note' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))

    expect(within(area).getByLabelText('Review interval')).toHaveDisplayValue('Every N days')
    expect(within(area).getByLabelText('Number of days')).toHaveValue('10')
    expect(within(area).getByLabelText('Next review date (optional)')).toHaveValue('2026-11-19')

    // A weekly note has no days field.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Weekly note' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))

    expect(within(area).getByLabelText('Review interval')).toHaveDisplayValue('Weekly')
    expect(shownReviewFields(area)).toEqual(['Next review date (optional)'])
    expect(within(area).getByLabelText('Next review date (optional)')).toHaveValue('2026-11-16')
  })

  it('AC-12 a save that changes only the interval sends only review_interval', async () => {
    const notes = [
      fullNote(2, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
      fullNote(1, 'Other weekly', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
      // The server keeps the date when the interval changes, and None removes it.
      'PATCH /api/notes/2': () => json(200, { note: { ...notes[0], review_interval: 'daily' } }),
      'PATCH /api/notes/1': () => json(200, { note: { ...notes[1], review_interval: 'none', next_review_date: null } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // Weekly to Daily.
    await user.click(await within(area).findByRole('button', { name: 'Weekly note' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Daily')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('Daily')
    expect(detailRow(area, 'Next review')).toBe('Nov 16, 2026')
    expect(sentBodies(fetchMock, 'PATCH', '/api/notes/2')).toEqual([
      { title: 'Weekly note', body: 'Body of Weekly note', source_url: '', review_interval: 'daily' },
    ])

    // Weekly to None: the list shows the answer's schedule.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Other weekly' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'None')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('None')
    expect(detailRow(area, 'Next review')).toBe('Not set')
    expect(sentBodies(fetchMock, 'PATCH', '/api/notes/1')).toEqual([
      { title: 'Other weekly', body: 'Body of Other weekly', source_url: '', review_interval: 'none' },
    ])
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    const entry = (await within(area).findByRole('button', { name: 'Other weekly' })).closest('li') as HTMLElement
    expect(within(entry).getByTestId('note-review')).toHaveTextContent('No review scheduled')
  })

  it('AC-12 emptying the date sends next_review_date null', async () => {
    const note = fullNote(2, 'Picked date', { review_interval: 'weekly', next_review_date: '2026-11-20' })
    const answers = [
      // The server restarts the schedule from today.
      { ...note, next_review_date: '2026-11-16' },
      { ...note, next_review_date: '2026-11-23' },
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [note] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note: answers.shift() }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Picked date' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.clear(within(area).getByLabelText('Next review date (optional)'))
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Next review')).toBe('Nov 16, 2026')

    // Another date is sent as it is.
    await user.click(within(area).getByRole('button', { name: 'Edit' }))
    const date = within(area).getByLabelText('Next review date (optional)')
    await user.clear(date)
    await user.type(date, '2026-11-23')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Next review')).toBe('Nov 23, 2026')
    expect(sentBodies(fetchMock, 'PATCH', '/api/notes/2')).toEqual([
      { title: 'Picked date', body: 'Body of Picked date', source_url: '', next_review_date: null },
      { title: 'Picked date', body: 'Body of Picked date', source_url: '', next_review_date: '2026-11-23' },
    ])
  })

  it('AC-12 the edit form sends the number of days only when it changed', async () => {
    const notes = [
      fullNote(2, 'Custom note', { review_interval: 'custom', review_interval_days: 10, next_review_date: '2026-11-19' }),
      fullNote(1, 'Weekly note', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
      'PATCH /api/notes/2': () => json(200, { note: { ...notes[0], review_interval_days: 12 } }),
      'PATCH /api/notes/1': () =>
        json(200, { note: { ...notes[1], review_interval: 'custom', review_interval_days: 10 } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // 10 to 12 days on a custom note.
    await user.click(await within(area).findByRole('button', { name: 'Custom note' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const days = within(area).getByLabelText('Number of days')
    await user.clear(days)
    await user.type(days, '12')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('Every 12 days')
    expect(sentBodies(fetchMock, 'PATCH', '/api/notes/2')).toEqual([
      { title: 'Custom note', body: 'Body of Custom note', source_url: '', review_interval_days: 12 },
    ])

    // Weekly to Every N days with 10.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    await user.click(await within(area).findByRole('button', { name: 'Weekly note' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.selectOptions(within(area).getByLabelText('Review interval'), 'Every N days')
    await user.type(within(area).getByLabelText('Number of days'), '10')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(detailRow(area, 'Review interval')).toBe('Every 10 days')
    expect(sentBodies(fetchMock, 'PATCH', '/api/notes/1')).toEqual([
      { title: 'Weekly note', body: 'Body of Weekly note', source_url: '', review_interval: 'custom', review_interval_days: 10 },
    ])
  })

  it('AC-12 a save that does not touch the schedule sends no review field', async () => {
    const notes = [
      fullNote(2, 'Keep date', { review_interval: 'weekly', next_review_date: '2026-11-16' }),
      fullNote(1, 'Keep days', { review_interval: 'custom', review_interval_days: 10, next_review_date: '2026-11-19' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes }),
      ...Object.fromEntries(notes.map((note) => [`GET /api/notes/${note.id}`, () => json(200, { note })])),
      // Another tab changed the date meanwhile, and the save keeps it.
      'PATCH /api/notes/2': () => json(200, { note: { ...notes[0], title: 'Keep date 2', next_review_date: '2026-11-23' } }),
      'PATCH /api/notes/1': () => json(200, { note: { ...notes[1], title: 'Keep days 2' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    for (const [title, id] of [
      ['Keep date', 2],
      ['Keep days', 1],
    ] as const) {
      await user.click(await within(area).findByRole('button', { name: title }))
      await user.click(await within(area).findByRole('button', { name: 'Edit' }))
      await user.type(within(area).getByLabelText('Title'), ' 2')
      await user.click(within(area).getByRole('button', { name: 'Save' }))

      expect(await within(area).findByRole('heading', { name: `${title} 2` })).toBeInTheDocument()
      expect(sentBodies(fetchMock, 'PATCH', `/api/notes/${id}`)).toEqual([
        { title: `${title} 2`, body: `Body of ${title}`, source_url: '' },
      ])
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }

    // The list shows the date the other tab set.
    const entry = (await within(area).findByRole('button', { name: 'Keep date 2' })).closest('li') as HTMLElement
    expect(within(entry).getByTestId('note-review')).toHaveTextContent('Next review: Nov 23, 2026')
  })
})
