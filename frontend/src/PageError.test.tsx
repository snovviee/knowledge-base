import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { reloadPage } from './reloadPage'

// jsdom cannot reload a page, and its window.location.reload cannot be spied on, so the
// module that reloads is replaced in this whole file.
vi.mock('./reloadPage')

// features/24_ui_states question 2. A part of the page that throws while it is drawn replaces
// the whole page with the alert "Something went wrong. Reload the page." and "Reload page". The
// tests render the whole app with a signed-in user and replace fetch, so no request leaves the
// test (requirements.md section 7). The trigger is a notes list answer whose note has no
// collection: the list reads the collection's name while it draws, so the draw throws.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user, as in src/NoteFilters.test.tsx: the session
// check, GET /api/csrf, the collections ("Work") and tags (none) lists unless the test names
// them, and the requests the test names by method and address. Any other request fails.
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

// A note as the list shows it (GET /api/notes), in "Work", with no tags and no schedule.
const summary = (id: number, title: string) => ({
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
  created_at: '2026-11-09T00:00:00.000Z',
  updated_at: '2026-11-09T00:00:00.000Z',
})

// A list answer that the app cannot draw: its note has no collection.
const BROKEN_LIST = { notes: [{ ...summary(999, 'Broken'), collection: null }] }

const PAGE_ALERT = 'Something went wrong. Reload the page.'

describe('a screen that fails to draw (features/24_ui_states)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-24 a screen that fails to draw shows only Something went wrong with Reload page', async () => {
    // React reports an error that a boundary caught with console.error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubBackend({ 'GET /api/notes': () => json(200, BROKEN_LIST) })

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(PAGE_ALERT)
    expect(screen.getByRole('main')).toContainElement(alert)
    // Only the alert and its button: no header, no "Log out", no area.
    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Reload page' })])
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Review reminders' })).not.toBeInTheDocument()
    expect(screen.queryByText('Personal Knowledge Base')).not.toBeInTheDocument()
    expect(document.body.textContent).toBe(`${PAGE_ALERT}Reload page`)
  })

  it('AC-24 Reload page reloads the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubBackend({ 'GET /api/notes': () => json(200, BROKEN_LIST) })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Reload page' }))

    // The reloaded page checks the session as every page load does (features/04_session_persistence).
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('AC-24 a failed request keeps its own message and never shows the page alert', async () => {
    // The first list load answers 500, the next one lists "Rails tips"; its detail gets no
    // answer; a new collection answers 500.
    let listLoads = 0
    stubBackend({
      'GET /api/notes': () => {
        listLoads += 1
        return listLoads === 1 ? json(500, { error: 'internal' }) : json(200, { notes: [summary(7, 'Rails tips')] })
      },
      'GET /api/notes/7': () => {
        throw new TypeError('Failed to fetch')
      },
      'POST /api/collections': () => json(500, { error: 'internal' }),
    })
    const user = userEvent.setup()
    render(<App />)
    const area = await screen.findByRole('main', { name: 'Notes' })
    const noPageAlert = () => expect(screen.queryByText(PAGE_ALERT)).not.toBeInTheDocument()

    // The list: its alert in the notes area, with "Try again".
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    noPageAlert()

    // The note: its alert in the notes area, in place of the detail.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load the note. Try again.')
    expect(within(area).getByRole('button', { name: 'Back to notes' })).toBeInTheDocument()
    noPageAlert()

    // The create: its alert in the collections area, with the form open and the name kept.
    const collections = screen.getByRole('complementary', { name: 'Collections' })
    await user.click(within(collections).getByRole('button', { name: 'New collection' }))
    await user.type(within(collections).getByLabelText('Collection name'), 'Ideas')
    await user.click(within(collections).getByRole('button', { name: 'Create' }))
    expect(await within(collections).findByRole('alert')).toHaveTextContent('Could not create the collection. Try again.')
    expect(within(collections).getByLabelText('Collection name')).toHaveValue('Ideas')
    noPageAlert()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })
})
