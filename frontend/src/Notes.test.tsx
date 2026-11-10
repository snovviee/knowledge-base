import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/09_notes_crud. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// collections and tags lists (empty unless the test names them), and the notes
// requests that the test names by method and path, such as 'GET /api/notes'. Any other
// request fails.
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

type Summary = {
  id: number
  title: string
  status: 'active' | 'archived'
  collection: { id: number; name: string }
  created_at: string
  updated_at: string
}

// A note as the list shows it (GET /api/notes), in "Work" unless the test says otherwise.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
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

describe('App notes (features/09_notes_crud)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("AC-09 the notes area shows Loading… and then the user's notes with their collections and archived status", async () => {
    const list = later()
    stubBackend({ 'GET /api/notes': list.handler })

    render(<App />)

    const area = await findNotesArea()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await list.requested
    list.answer(
      json(200, {
        notes: [
          summary(3, 'Third', { status: 'archived', collection: { id: 2, name: 'Books' } }),
          summary(2, 'Second <b>bold</b>', { collection: { id: 2, name: 'Books' } }),
          summary(1, 'First'),
        ],
      }),
    )

    // The server's order, and markup in a title is plain text.
    await waitFor(() => expect(listedTitles(area)).toEqual(['Third', 'Second <b>bold</b>', 'First']))
    const [third, second, first] = within(area).getAllByRole('listitem')
    expect(within(third).getByTestId('note-collection')).toHaveTextContent('Books')
    expect(within(third).getByText('Archived')).toBeInTheDocument()
    expect(within(second).queryByText('Archived')).not.toBeInTheDocument()
    expect(within(first).getByTestId('note-collection')).toHaveTextContent('Work')
    expect(within(area).queryByRole('status')).not.toBeInTheDocument()
    expect(area.querySelector('b')).toBeNull()
  })

  it('AC-09 the notes area shows No notes yet and New note when the user has none', async () => {
    const list = later()
    stubBackend({ 'GET /api/notes': list.handler })

    render(<App />)
    const area = await findNotesArea()

    // "New note" shows once the list has loaded.
    expect(within(area).queryByRole('button', { name: 'New note' })).not.toBeInTheDocument()
    await list.requested
    list.answer(json(200, { notes: [] }))

    expect(await within(area).findByText('No notes yet')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'New note' })).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
  })

  it('AC-09 a notes list that cannot load shows the error, and Try again loads it', async () => {
    const third = later()
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': (init) => answers.shift()!(init),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
    })
    const listRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // No answer. The collections area shows its list all the same.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')
    const collections = screen.getByRole('complementary', { name: 'Collections' })
    expect(await within(collections).findByText('Work')).toBeInTheDocument()

    // An error answer.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(listRequests()).toBe(2))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load notes. Try again.')

    // The server answers: "Loading…" while the list loads, then the list.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, { notes: [summary(1, 'First')] }))
    await waitFor(() => expect(listedTitles(area)).toEqual(['First']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-09 a notes list request answered 401 shows the sign-in screen', async () => {
    stubBackend({ 'GET /api/notes': () => json(401, { error: 'unauthenticated' }) })

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-09 choosing a note opens its detail with its fields and actions', async () => {
    const read = later()
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': read.handler,
    })
    const user = userEvent.setup()

    const { unmount } = render(<App />)
    let area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))

    // "Loading…" in place of the list while the note loads.
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
    await read.requested
    read.answer(
      json(200, {
        note: fullNote(2, 'Rails tips', {
          body: 'Line one\nLine two <b>bold</b>',
          source_url: 'https://guides.rubyonrails.org',
        }),
      }),
    )

    // The detail focuses its title in an effect, which can run after the title shows on a
    // loaded machine (features/27_local_tests).
    const title = await within(area).findByRole('heading', { name: 'Rails tips' })
    await waitFor(() => expect(title).toHaveFocus())
    expect(within(area).getByText('Work')).toBeInTheDocument()
    const link = within(area).getByRole('link', { name: 'https://guides.rubyonrails.org' })
    expect(link).toHaveAttribute('href', 'https://guides.rubyonrails.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // The body as plain text, with its line breaks.
    expect(within(area).getByTestId('note-body').textContent).toBe('Line one\nLine two <b>bold</b>')
    expect(area.querySelector('b')).toBeNull()
    for (const name of ['Back to notes', 'Edit', 'Archive', 'Delete']) {
      expect(within(area).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(area).queryByText('Archived')).not.toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'New note' })).not.toBeInTheDocument()

    // An archived note with no source URL: "Archived", "Restore", and no source URL.
    unmount()
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(1, 'Old idea', { status: 'archived' })] }),
      'GET /api/notes/1': () => json(200, { note: fullNote(1, 'Old idea', { status: 'archived' }) }),
    })
    render(<App />)
    area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))

    expect(await within(area).findByRole('heading', { name: 'Old idea' })).toBeInTheDocument()
    expect(within(area).getByText('Archived')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    expect(within(area).queryByText('Source URL')).not.toBeInTheDocument()
    expect(within(area).queryByRole('link')).not.toBeInTheDocument()
  })

  it('AC-09 Back to notes shows the list again', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
    })
    const listRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await within(area).findByRole('heading', { name: 'Rails tips' })

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))

    // The list as it was, with no new list request.
    expect(listedTitles(area)).toEqual(['Rails tips', 'First'])
    expect(within(area).getByRole('button', { name: 'New note' })).toBeInTheDocument()
    expect(within(area).queryByRole('heading', { name: 'Rails tips' })).not.toBeInTheDocument()
    expect(listRequests()).toBe(1)
  })

  it('AC-09 a note that cannot load shows the error, and Try again loads it', async () => {
    const third = later()
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': (init) => answers.shift()!(init),
    })
    const readRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes/2').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))

    // No answer.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load the note. Try again.')
    expect(within(area).getByRole('button', { name: 'Back to notes' })).toBeInTheDocument()

    // An error answer.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(readRequests()).toBe(2))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load the note. Try again.')

    // The server answers: "Loading…" while the note loads, then its detail.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, { note: fullNote(2, 'Rails tips') }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-09 opening a note that no longer exists removes it from the list and says so', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))

    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(listedTitles(area)).toEqual(['First'])
    expect(within(area).queryByRole('button', { name: 'Back to notes' })).not.toBeInTheDocument()
  })

  it("AC-09 New note opens the form with the user's collections and none chosen", async () => {
    const collections = { collections: [{ id: 2, name: 'Books' }, { id: 1, name: 'Work' }] }
    const formCollections = later()
    let collectionRequests = 0
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(1, 'First')] }),
      // The collections area asks first; the form asks when it opens.
      'GET /api/collections': (init) =>
        (collectionRequests += 1) === 1 ? json(200, collections) : formCollections.handler(init),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    // The form in place of the list: "Loading…" until the collections arrive.
    expect(within(area).getByRole('heading', { name: 'New note' })).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'New note' })).not.toBeInTheDocument()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await formCollections.requested
    formCollections.answer(json(200, collections))

    expect(await within(area).findByLabelText('Title')).toHaveFocus()
    expect(within(area).getByLabelText('Body')).toBeInTheDocument()
    expect(within(area).getByLabelText('Source URL (optional)')).toBeInTheDocument()
    const collection = within(area).getByLabelText('Collection')
    expect(collection).toHaveDisplayValue('Choose a collection')
    expect(within(collection).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a collection',
      'Books',
      'Work',
    ])
    expect(within(area).getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    // The collections have loaded: no collections status is left. The Tags group has its
    // own status while its tags load (features/10_note_tags), so this checks the
    // collections alone.
    expect(within(area).queryByText('Could not load collections. Try again.')).not.toBeInTheDocument()
    expect(within(collection.closest('div') as HTMLElement).queryByRole('status')).not.toBeInTheDocument()
  })

  it('AC-09 New note with no collections says to create a collection first', async () => {
    const fetchMock = stubBackend({ 'GET /api/notes': () => json(200, { notes: [summary(1, 'First')] }) })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    expect(
      await within(area).findByText('Create a collection first. Every note belongs to a collection.'),
    ).toBeInTheDocument()
    expect(within(area).queryByLabelText('Title')).not.toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()

    await user.click(within(area).getByRole('button', { name: 'Cancel' }))

    expect(listedTitles(area)).toEqual(['First'])
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it("AC-09 the form's collections that cannot load show the error, and Try again loads them", async () => {
    const third = later()
    const formAnswers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    let collectionRequests = 0
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      // The collections area asks first; the form asks when it opens and on "Try again".
      'GET /api/collections': (init) =>
        (collectionRequests += 1) === 1 ? json(200, { collections: [] }) : formAnswers.shift()!(init),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    // No answer.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
    expect(within(area).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    // An error answer.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(collectionRequests).toBe(3))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')

    // The server answers: "Loading…" while the collections load, then the fields.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, { collections: [{ id: 1, name: 'Work' }] }))
    expect(await within(area).findByLabelText('Title')).toBeInTheDocument()
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-09 Create sends the note and shows its detail, and the list has it at the top', async () => {
    const created = fullNote(3, 'Rails tips', { body: 'Use bin/rails.', source_url: 'https://guides.rubyonrails.org' })
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(1, 'First')] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 2, name: 'Books' }, { id: 1, name: 'Work' }] }),
      'POST /api/notes': () => json(201, { note: created }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Rails tips')
    await user.type(within(area).getByLabelText('Body'), 'Use bin/rails.')
    await user.type(within(area).getByLabelText('Source URL (optional)'), 'https://guides.rubyonrails.org')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // The new note's detail, from the answer: no read request.
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(within(area).getByTestId('note-body')).toHaveTextContent('Use bin/rails.')
    expect(fetchMock).toHaveBeenCalledWith('/api/notes', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Rails tips',
        body: 'Use bin/rails.',
        source_url: 'https://guides.rubyonrails.org',
        collection_id: 1,
      }),
    })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/notes/3')).toBe(false)

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expect(listedTitles(area)).toEqual(['Rails tips', 'First'])
  })

  it('AC-09 Cancel closes the new-note form without a request, and Escape does not close it', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(1, 'First')] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Draft')

    // Escape keeps the form with what was typed (spec question 13).
    await user.keyboard('{Escape}')
    expect(within(area).getByLabelText('Title')).toHaveValue('Draft')

    await user.click(within(area).getByRole('button', { name: 'Cancel' }))

    expect(listedTitles(area)).toEqual(['First'])
    expect(within(area).queryByLabelText('Title')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  })

  it('AC-09 Create checks the fields in the browser and sends nothing while one breaks a rule', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': () => json(201, { note: fullNote(3, 'Rails tips') }),
    })
    const creates = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const title = await within(area).findByLabelText('Title')
    const body = within(area).getByLabelText('Body')
    const sourceUrl = within(area).getByLabelText('Source URL (optional)')
    const collection = within(area).getByLabelText('Collection')
    await user.type(body, '   ')
    await user.type(sourceUrl, 'example.com')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(creates()).toBe(0)
    expect(title).toHaveAccessibleDescription('Enter a title.')
    expect(body).toHaveAccessibleDescription('Enter a body.')
    expect(sourceUrl).toHaveAccessibleDescription('Enter a URL that starts with http:// or https://.')
    expect(collection).toHaveAccessibleDescription('Choose a collection.')
    for (const field of [title, body, sourceUrl, collection]) expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveFocus()

    // Once the fields are fixed, Create sends.
    await user.type(title, 'Rails tips')
    await user.type(body, 'Use bin/rails.')
    await user.clear(sourceUrl)
    await user.type(sourceUrl, 'HTTPS://Example.com/Page')
    await user.selectOptions(collection, 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(creates()).toBe(1))
  })

  it('AC-09 the form refuses values that are too long and sends values at the limit', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': () => json(201, { note: fullNote(3, 'T') }),
    })
    const creates = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const urlAtLimit = `https://example.com/${'a'.repeat(1980)}`
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const title = await within(area).findByLabelText('Title')
    const body = within(area).getByLabelText('Body')
    const sourceUrl = within(area).getByLabelText('Source URL (optional)')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    const fill = async (field: HTMLElement, text: string) => {
      await user.clear(field)
      await user.paste(text)
    }

    // One character over each limit.
    await fill(title, 't'.repeat(201))
    await fill(body, 'b'.repeat(100_001))
    await fill(sourceUrl, `${urlAtLimit}a`)
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    expect(creates()).toBe(0)
    expect(title).toHaveAccessibleDescription('Use at most 200 characters.')
    expect(body).toHaveAccessibleDescription('Use at most 100,000 characters.')
    expect(sourceUrl).toHaveAccessibleDescription('Use at most 2,000 characters.')

    // At each limit. Spaces the server removes do not count, and an emoji counts as
    // one character, as on the server.
    await fill(title, `  ${'😀'.repeat(200)}  `)
    await fill(body, 'b'.repeat(100_000))
    await fill(sourceUrl, ` ${urlAtLimit} `)
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(creates()).toBe(1))
  })

  it("AC-09 a create the server refuses shows each field's message and keeps the form", async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': () =>
        json(422, { error: 'validation_failed', fields: { source_url: 'invalid', collection_id: 'not_found' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const title = await within(area).findByLabelText('Title')
    const sourceUrl = within(area).getByLabelText('Source URL (optional)')
    const collection = within(area).getByLabelText('Collection')
    await user.type(title, 'Rails tips')
    await user.type(within(area).getByLabelText('Body'), 'Use bin/rails.')
    await user.type(sourceUrl, 'https://example.com/<a>')
    await user.selectOptions(collection, 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // The collection was deleted in another tab, and the server refused the address.
    await waitFor(() =>
      expect(collection).toHaveAccessibleDescription('This collection no longer exists. Choose another.'),
    )
    expect(collection).toHaveAttribute('aria-invalid', 'true')
    expect(sourceUrl).toHaveAccessibleDescription('Enter a URL that starts with http:// or https://.')
    expect(sourceUrl).toHaveFocus()
    expect(title).toHaveValue('Rails tips')
    expect(title).not.toHaveAttribute('aria-invalid')
    expect(within(area).getByLabelText('Body')).toHaveValue('Use bin/rails.')
    expect(within(area).queryByRole('heading', { name: 'Rails tips' })).not.toBeInTheDocument()
  })

  it('AC-09 a note create that fails shows the error and keeps the form', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': (init) => answers.shift()!(init),
    })
    const creates = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Rails tips')
    await user.type(within(area).getByLabelText('Body'), 'Use bin/rails.')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')

    // No answer, a 403, and a 500.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await user.click(within(area).getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(creates()).toBe(attempt))
      expect(await within(area).findByRole('alert')).toHaveTextContent('Could not create the note. Try again.')
      expect(within(area).getByLabelText('Title')).toHaveValue('Rails tips')
      expect(within(area).getByLabelText('Body')).toHaveValue('Use bin/rails.')
      expect(within(area).getByLabelText('Collection')).toHaveDisplayValue('Work')
    }
  })

  it('AC-09 Create shows a busy state and ignores a second click', async () => {
    const create = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': create.handler,
    })
    const creates = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Rails tips')
    await user.type(within(area).getByLabelText('Body'), 'Use bin/rails.')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    const button = within(area).getByRole('button', { name: 'Create' })

    await user.click(button)
    await create.requested
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(creates()).toBe(1)

    create.answer(json(201, { note: fullNote(3, 'Rails tips') }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
  })

  it('AC-09 Edit saves the note and shows its new values in the detail and the list', async () => {
    const note = fullNote(2, 'Rails tips', { body: 'Use bin/rails.', source_url: 'https://guides.rubyonrails.org' })
    const saved = { ...note, title: 'Rails guides', body: 'Read the guides.', source_url: null }
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(3, 'Newer'), summary(2, 'Rails tips'), summary(1, 'Older')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note: saved }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))

    // The form in place of the detail, with the note's values. (Its Collection field
    // moves the note: features/11_note_move, src/NoteMove.test.tsx.)
    expect(within(area).getByRole('heading', { name: 'Edit note' })).toBeInTheDocument()
    const title = within(area).getByLabelText('Title')
    const body = within(area).getByLabelText('Body')
    const sourceUrl = within(area).getByLabelText('Source URL (optional)')
    expect(title).toHaveValue('Rails tips')
    expect(title).toHaveFocus()
    expect(body).toHaveValue('Use bin/rails.')
    expect(sourceUrl).toHaveValue('https://guides.rubyonrails.org')
    expect(within(area).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'Rails guides')
    await user.clear(body)
    await user.type(body, 'Read the guides.')
    await user.clear(sourceUrl)
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    // The detail with the new values, and no source URL.
    expect(await within(area).findByRole('heading', { name: 'Rails guides' })).toBeInTheDocument()
    expect(within(area).getByTestId('note-body')).toHaveTextContent('Read the guides.')
    expect(within(area).queryByRole('link')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/2', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Rails guides', body: 'Read the guides.', source_url: '' }),
    })

    // The list shows the new title in the note's place.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expect(listedTitles(area)).toEqual(['Newer', 'Rails guides', 'Older'])
  })

  it('AC-09 Save checks the fields, and Cancel closes the edit form without a request', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips', { body: 'Use bin/rails.' }) }),
      'PATCH /api/notes/2': () => json(422, { error: 'validation_failed', fields: { title: 'too_long' } }),
    })
    const edits = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const title = within(area).getByLabelText('Title')

    // An empty title is checked in the browser, and nothing is sent.
    await user.clear(title)
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(edits()).toBe(0)
    expect(title).toHaveAccessibleDescription('Enter a title.')
    expect(title).toHaveFocus()

    // The server refuses a field: its message shows under it.
    await user.type(title, 'Rails guides')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(title).toHaveAccessibleDescription('Use at most 200 characters.'))
    expect(edits()).toBe(1)

    // Escape keeps the edit form with what was typed (spec question 13).
    await user.keyboard('{Escape}')
    expect(within(area).getByLabelText('Title')).toHaveValue('Rails guides')

    // Cancel shows the detail as it was, with no edit request.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(within(area).getByTestId('note-body')).toHaveTextContent('Use bin/rails.')
    expect(edits()).toBe(1)
  })

  it('AC-09 a save that fails shows the error and keeps the form, and Save ignores a second click', async () => {
    const third = later()
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': (init) => answers.shift()!(init),
    })
    const edits = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const title = within(area).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rails guides')

    // No answer, and an error answer.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await user.click(within(area).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(edits()).toBe(attempt))
      expect(await within(area).findByRole('alert')).toHaveTextContent('Could not save the note. Try again.')
      expect(title).toHaveValue('Rails guides')
    }

    // While the save waits, "Save" is busy and takes no second click.
    const save = within(area).getByRole('button', { name: 'Save' })
    await user.click(save)
    await third.requested
    expect(save).toBeDisabled()
    expect(save).toHaveAttribute('aria-busy', 'true')
    await user.click(save)
    expect(edits()).toBe(3)
    third.answer(json(200, { note: fullNote(2, 'Rails guides') }))
    expect(await within(area).findByRole('heading', { name: 'Rails guides' })).toBeInTheDocument()
  })

  it('AC-09 saving a note that no longer exists removes it from the list and says so', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(listedTitles(area)).toEqual(['First'])
    expect(within(area).queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('AC-09 Archive archives the note in the detail and the list', async () => {
    const archive = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': archive.handler,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    const button = await within(area).findByRole('button', { name: 'Archive' })
    await user.click(button)

    // No question first. "Archive" is busy while the request waits.
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await archive.requested
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/2', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    archive.answer(json(200, { note: fullNote(2, 'Rails tips', { status: 'archived' }) }))

    expect(await within(area).findByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(within(area).getByText('Archived')).toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    const [archived, other] = within(area).getAllByRole('listitem')
    expect(within(archived).getByText('Archived')).toBeInTheDocument()
    expect(within(other).queryByText('Archived')).not.toBeInTheDocument()
  })

  it('AC-09 Restore restores the note in the detail and the list', async () => {
    const restore = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () =>
        json(200, { notes: [summary(2, 'Old idea', { status: 'archived' }), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Old idea', { status: 'archived' }) }),
      'PATCH /api/notes/2': restore.handler,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
    const button = await within(area).findByRole('button', { name: 'Restore' })
    await user.click(button)

    // No question first. "Restore" is busy while the request waits.
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await restore.requested
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/2', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    restore.answer(json(200, { note: fullNote(2, 'Old idea', { status: 'active' }) }))

    expect(await within(area).findByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(within(area).queryByText('Archived')).not.toBeInTheDocument()
    expect(within(area).queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()

    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    const [restored, other] = within(area).getAllByRole('listitem')
    expect(within(restored).queryByText('Archived')).not.toBeInTheDocument()
    expect(within(other).queryByText('Archived')).not.toBeInTheDocument()
  })

  it('AC-09 an archive or restore that fails shows the error and keeps the detail, and one of a deleted note removes it', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      () => json(404, { error: 'not_found' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': (init) => answers.shift()!(init),
    })
    const patchRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))

    // No answer, then 500: the detail stays, with the archive's message.
    for (const attempt of [1, 2]) {
      await user.click(within(area).getByRole('button', { name: 'Archive' }))
      await waitFor(() => expect(patchRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not archive the note. Try again.'),
      )
      expect(within(area).getByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
      expect(within(area).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    }

    // Deleted in another tab: 404 takes the note off the list, with the message.
    await user.click(within(area).getByRole('button', { name: 'Archive' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent('This note no longer exists.')
    expect(listedTitles(area)).toEqual(['First'])
    expect(within(area).queryByRole('button', { name: 'Back to notes' })).not.toBeInTheDocument()
  })

  it('AC-09 Delete asks for confirmation, and Cancel or Escape keeps the note', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    // The actions turn into the question, with the focus on "Cancel", and no request.
    expect(within(area).getByText('Delete “Rails tips”? This cannot be undone.')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(within(area).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    expect(deleteRequests()).toBe(0)

    // Cancel brings the actions back.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(within(area).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(within(area).queryByText('Delete “Rails tips”? This cannot be undone.')).not.toBeInTheDocument()

    // Escape does the same.
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await user.keyboard('{Escape}')
    expect(within(area).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(deleteRequests()).toBe(0)

    // The note is still in the list.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expect(listedTitles(area)).toEqual(['Rails tips', 'First'])
  })

  it('AC-09 confirming a delete removes the note, also when it was already deleted', async () => {
    const remove = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'DELETE /api/notes/2': remove.handler,
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    // While the delete waits, "Delete" is busy, and a second click sends nothing.
    const confirm = within(area).getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    await user.click(confirm)
    await remove.requested
    expect(deleteRequests()).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/2', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'csrf-token' },
    })

    remove.answer(new Response(null, { status: 204 }))
    // The list shows again, without the note, and with no alert.
    await waitFor(() => expect(listedTitles(area)).toEqual(['First']))
    expect(within(area).queryByRole('heading', { name: 'Rails tips' })).not.toBeInTheDocument()
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-09 a note delete that fails shows the error and keeps the confirmation', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'DELETE /api/notes/2': (init) => answers.shift()!(init),
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    // No answer, then 403, then 500.
    for (const attempt of [1, 2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(deleteRequests()).toBe(attempt))
      await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent('Could not delete the note. Try again.'))
      expect(within(area).getByText('Delete “Rails tips”? This cannot be undone.')).toBeInTheDocument()
    }
  })

  // The sign-in screen, with no message: the app's signed-out state (features/06_collections_crud
  // question 13). The sign-in buttons show; the main layout does not.
  const expectSignInScreen = async () => {
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }

  // Each note request answered 401 shows the sign-in screen (spec question 13). The notes
  // list and the collections area answer 200 unless the test names the 401.
  it('AC-09 a note read answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await expectSignInScreen()
  })

  it("AC-09 the new-note form's collections request answered 401 shows the sign-in screen", async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': (() => {
        // The collections area on the page answers 200; the form's request (the second) answers 401.
        let answer = 0
        return () => (answer++ === 0 ? json(200, { collections: [] }) : json(401, { error: 'unauthenticated' }))
      })(),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await expectSignInScreen()
  })

  it('AC-09 a create answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [] }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/notes': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'Rails tips')
    await user.type(within(area).getByLabelText('Body'), 'Use bin/rails.')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    await expectSignInScreen()
  })

  it('AC-09 a save answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await expectSignInScreen()
  })

  it('AC-09 an archive answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'PATCH /api/notes/2': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Archive' }))
    await expectSignInScreen()
  })

  it('AC-09 a delete answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'DELETE /api/notes/2': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await expectSignInScreen()
  })

  it('AC-09 a restore answered 401 shows the sign-in screen', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Old idea', { status: 'archived' })] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Old idea', { status: 'archived' }) }),
      'PATCH /api/notes/2': () => json(401, { error: 'unauthenticated' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Old idea' }))
    await user.click(await within(area).findByRole('button', { name: 'Restore' }))
    await expectSignInScreen()
  })

  it('AC-09 a renamed collection shows its new name on its notes, with no notes request', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips', { collection: { id: 1, name: 'Work' } })] }),
      'GET /api/notes/2': () =>
        json(200, { note: fullNote(2, 'Rails tips', { collection: { id: 1, name: 'Work' } }) }),
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'PATCH /api/collections/1': () => json(200, { collection: { id: 1, name: 'Job' } }),
    })
    const notesRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    const collections = await screen.findByRole('complementary', { name: 'Collections' })
    await user.click(await within(collections).findByRole('button', { name: 'Rename Work' }))
    const field = within(collections).getByLabelText('Collection name')
    await user.clear(field)
    await user.type(field, 'Job')
    await user.click(within(collections).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(collections).getByTestId('collection-name')).toHaveTextContent('Job'))

    // The list shows the new name on the note, with no notes request.
    expect(within(area).getByTestId('note-collection')).toHaveTextContent('Job')
    expect(notesRequests()).toBe(1)

    // The open detail shows it too.
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByText('Job')).toBeInTheDocument()
    expect(notesRequests()).toBe(1)
  })

  it('AC-09 two renamed collections both show their new names on their notes', async () => {
    stubBackend({
      'GET /api/notes': () =>
        json(200, {
          notes: [
            summary(2, 'Rails tips', { collection: { id: 1, name: 'Work' } }),
            summary(3, 'Pancakes', { collection: { id: 2, name: 'Home' } }),
          ],
        }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips', { collection: { id: 1, name: 'Work' } }) }),
      'GET /api/collections': () =>
        json(200, {
          collections: [
            { id: 2, name: 'Home' },
            { id: 1, name: 'Work' },
          ],
        }),
      'PATCH /api/collections/1': () => json(200, { collection: { id: 1, name: 'Job' } }),
      'PATCH /api/collections/2': () => json(200, { collection: { id: 2, name: 'Chores' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    const collections = await screen.findByRole('complementary', { name: 'Collections' })

    // Rename "Work" to "Job", then "Home" to "Chores".
    await user.click(await within(collections).findByRole('button', { name: 'Rename Work' }))
    await user.clear(within(collections).getByLabelText('Collection name'))
    await user.type(within(collections).getByLabelText('Collection name'), 'Job')
    await user.click(within(collections).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(collections).getByText('Job')).toBeInTheDocument())

    await user.click(within(collections).getByRole('button', { name: 'Rename Home' }))
    await user.clear(within(collections).getByLabelText('Collection name'))
    await user.type(within(collections).getByLabelText('Collection name'), 'Chores')
    await user.click(within(collections).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(collections).getByText('Chores')).toBeInTheDocument())

    // Both notes show their collection's new name, the first rename included.
    expect(within(area).getAllByTestId('note-collection').map((name) => name.textContent)).toEqual(['Job', 'Chores'])
  })

  it('AC-09 deleting a note that was already deleted elsewhere removes it with no alert', async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips'), summary(1, 'First')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'DELETE /api/notes/2': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    // The list shows again without the note, and with no error (spec: "with no error";
    // plan item 47: "with no alert").
    await waitFor(() => expect(listedTitles(area)).toEqual(['First']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })
})
