import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/18_archived_no_reminders. An archived note has no review state: the server sends
// review_state null for it, whatever its dates, and the list and the detail show no "Due
// today" or "Overdue" label for it (spec question 1). The app shows the label from
// review_state alone and never computes a date, so the browser's clock, faked here to the
// day of "Today's plan", changes nothing. The tests render the whole app with a signed-in user
// and replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections ("Work") and tags (none) lists, and the notes requests that the test names by
// method and address. Any other request fails.
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

// A weekly note in "Work" with this next review date, as the list shows it (GET /api/notes).
const weekly = (id: number, title: string, fields: Partial<Summary>): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
  tags: [],
  review_interval: 'weekly',
  review_interval_days: null,
  next_review_date: null,
  last_reviewed_date: null,
  review_state: null,
  created_at: '2026-11-09T10:00:00.000Z',
  updated_at: '2026-11-09T10:00:00.000Z',
  ...fields,
})

// The archived notes of the spec's scenario, as the server answers them on 2026-11-09, and an
// active note with the date of "Old plan", the control.
const OLD_PLAN = weekly(1, 'Old plan', { status: 'archived', next_review_date: '2026-11-02' })
const TODAYS_PLAN = weekly(2, "Today's plan", { status: 'archived', next_review_date: '2026-11-09' })
const OLD_IDEA = weekly(3, 'Old idea', { next_review_date: '2026-11-02', review_state: 'overdue' })

// A note as its detail shows it (GET /api/notes/:id).
const fullNote = (note: Summary) => ({ ...note, body: `Body of ${note.title}`, source_url: null })

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// The list entry of the note with this title, once the list shows it.
const findEntry = async (area: HTMLElement, title: string) =>
  (await within(area).findByRole('button', { name: title })).closest('li') as HTMLElement

// The value of a row of the note's detail: the definition after its term.
const detailRow = (area: HTMLElement, term: string) =>
  within(area).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement

describe('App archived notes and review reminders (features/18_archived_no_reminders)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AC-18 the list and the detail show an archived note with no Due today or Overdue label', async () => {
    // The browser's clock says 2026-11-09, but only review_state decides a label.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [OLD_IDEA, TODAYS_PLAN, OLD_PLAN] }),
      'GET /api/notes/1': () => json(200, { note: fullNote(OLD_PLAN) }),
      'GET /api/notes/2': () => json(200, { note: fullNote(TODAYS_PLAN) }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // The control: an active note with a review state shows its label.
    expect(within(await findEntry(area, 'Old idea')).getByTestId('note-review-state')).toHaveTextContent('Overdue')

    const archived = [
      { title: 'Old plan', date: 'Nov 2, 2026' },
      { title: "Today's plan", date: 'Nov 9, 2026' },
    ]
    for (const { title, date } of archived) {
      const entry = await findEntry(area, title)
      expect(within(entry).getByText('Archived')).toBeInTheDocument()
      expect(within(entry).getByTestId('note-review')).toHaveTextContent(`Next review: ${date}`)
      expect(within(entry).queryByTestId('note-review-state')).not.toBeInTheDocument()
      expect(within(entry).queryByText('Due today')).not.toBeInTheDocument()
      expect(within(entry).queryByText('Overdue')).not.toBeInTheDocument()
    }

    for (const { title, date } of archived) {
      await user.click(await within(area).findByRole('button', { name: title }))
      const heading = await within(area).findByRole('heading', { name: title })
      expect(within(heading.parentElement as HTMLElement).getByText('Archived')).toBeInTheDocument()
      expect(detailRow(area, 'Next review').textContent).toBe(date)
      expect(within(area).queryByTestId('note-review-state')).not.toBeInTheDocument()
      expect(within(area).queryByText('Due today')).not.toBeInTheDocument()
      expect(within(area).queryByText('Overdue')).not.toBeInTheDocument()
      await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    }
  })
})
