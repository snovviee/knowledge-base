import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/11_note_move. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// lists of the left column (empty tags; the collections below unless the test names
// them), and the requests the test names by method and path. Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, COLLECTIONS),
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

// The user's collections, in the server's order: alphabetical.
const COLLECTIONS = {
  collections: [
    { id: 2, name: 'Books' },
    { id: 1, name: 'Work' },
  ],
}

type Summary = {
  id: number
  title: string
  status: 'active' | 'archived'
  collection: { id: number; name: string }
  tags: { id: number; name: string }[]
  created_at: string
  updated_at: string
}

// A note as the list shows it (GET /api/notes), in "Work" unless the test says otherwise.
const summary = (id: number, title: string, fields: Partial<Summary> = {}): Summary => ({
  id,
  title,
  status: 'active',
  collection: { id: 1, name: 'Work' },
  tags: [],
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

// Answers GET /api/collections. The collections area asks first, when the app loads,
// before a note form can open: it gets COLLECTIONS. The edit form asks after it, when it
// opens and on "Try again": its requests get the given answers, in order.
function collectionsForForm(...formAnswers: Handler[]): Handler {
  let requests = 0
  return (init) => ((requests += 1) === 1 ? json(200, COLLECTIONS) : formAnswers.shift()!(init))
}

// The notes area of the main layout.
const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

// Opens the note's detail from the list, then its edit form.
async function openEditForm(user: ReturnType<typeof userEvent.setup>, area: HTMLElement, title: string) {
  await user.click(await within(area).findByRole('button', { name: title }))
  await user.click(await within(area).findByRole('button', { name: 'Edit' }))
}

describe('App note move (features/11_note_move)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("AC-11 the edit form shows the note's collection chosen among my collections", async () => {
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')

    // The same field as in the new-note form, with the note's collection chosen.
    const collection = await within(area).findByLabelText('Collection')
    expect(within(collection).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a collection',
      'Books',
      'Work',
    ])
    expect(collection).toHaveDisplayValue('Work')
  })

  it('AC-11 the Collection field loads on its own while the rest of the edit form works', async () => {
    const formCollections = later()
    stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () =>
        json(200, {
          note: fullNote(2, 'Rails tips', { body: 'Use bin/rails.', source_url: 'https://guides.rubyonrails.org' }),
        }),
      'GET /api/collections': collectionsForForm(formCollections.handler),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')

    // The title, body, and source URL show at once, and the title can be typed in.
    const title = within(area).getByLabelText('Title')
    expect(title).toHaveValue('Rails tips')
    expect(within(area).getByLabelText('Body')).toHaveValue('Use bin/rails.')
    expect(within(area).getByLabelText('Source URL (optional)')).toHaveValue('https://guides.rubyonrails.org')
    await user.type(title, ' and more')
    expect(title).toHaveValue('Rails tips and more')

    // The Collection field shows "Loading…" in its place until the collections arrive.
    const field = within(area).getByRole('group', { name: 'Collection' })
    expect(within(field).getByRole('status')).toHaveTextContent('Loading…')
    expect(within(area).queryByLabelText('Collection')).not.toBeInTheDocument()
    await formCollections.requested
    formCollections.answer(json(200, COLLECTIONS))

    expect(await within(area).findByLabelText('Collection')).toHaveDisplayValue('Work')
    expect(within(field).queryByRole('status')).not.toBeInTheDocument()
    expect(title).toHaveValue('Rails tips and more')
  })

  it('AC-11 the Collection field shows its failure and Try again loads it', async () => {
    const third = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      'GET /api/collections': collectionsForForm(
        () => {
          throw new TypeError('Failed to fetch')
        },
        () => json(500, { error: 'internal' }),
        third.handler,
      ),
    })
    // The edit form's requests: every collections request but the collections area's.
    const formRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/collections').length - 1
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')
    const field = within(area).getByRole('group', { name: 'Collection' })

    // No answer. The rest of the form works: the title can be typed in.
    expect(await within(field).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
    const title = within(area).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rails guides')
    expect(title).toHaveValue('Rails guides')

    // An error answer.
    await user.click(within(field).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(formRequests()).toBe(2))
    expect(await within(field).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')

    // The server answers: "Loading…" while the collections load, then the field with
    // the note's collection chosen.
    await user.click(within(field).getByRole('button', { name: 'Try again' }))
    expect(within(field).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, COLLECTIONS))
    expect(await within(area).findByLabelText('Collection')).toHaveDisplayValue('Work')
    expect(within(field).queryByRole('alert')).not.toBeInTheDocument()
    expect(title).toHaveValue('Rails guides')
  })

  it('AC-11 Save moves the note to the chosen collection and the detail and list show it in its place', async () => {
    const note = fullNote(2, 'Rails tips', { body: 'Use bin/rails.' })
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(3, 'Newer'), summary(2, 'Rails tips'), summary(1, 'Older')] }),
      'GET /api/notes/2': () => json(200, { note }),
      // Answers as the server does: the note is in the collection the request names.
      'PATCH /api/notes/2': (init) => {
        const sent = JSON.parse(init!.body as string) as { collection_id?: number }
        return json(200, { note: sent.collection_id === 2 ? { ...note, collection: { id: 2, name: 'Books' } } : note })
      },
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')
    await user.selectOptions(await within(area).findByLabelText('Collection'), 'Books')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    // The request names the chosen collection, and the detail shows it.
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(patch[1]!.body as string)).toEqual({
      title: 'Rails tips',
      body: 'Use bin/rails.',
      source_url: '',
      collection_id: 2,
    })
    expect(within(area).getByText('Books')).toBeInTheDocument()
    expect(within(area).queryByText('Work')).not.toBeInTheDocument()

    // The list shows the new collection, with the note in its place.
    await user.click(within(area).getByRole('button', { name: 'Back to notes' }))
    expect(
      within(area)
        .getAllByTestId('note-title')
        .map((title) => title.textContent),
    ).toEqual(['Newer', 'Rails tips', 'Older'])
    const [, moved] = within(area).getAllByRole('listitem')
    expect(within(moved).getByTestId('note-collection')).toHaveTextContent('Books')
  })

  it('AC-11 a save without a move sends no collection_id', async () => {
    const note = fullNote(2, 'Rails tips')
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note: { ...note, title: 'Rails guides' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')

    // Only the title changes. "Books" is chosen and then "Work" again, so the note's
    // collection is the one chosen.
    const collection = await within(area).findByLabelText('Collection')
    await user.selectOptions(collection, 'Books')
    await user.selectOptions(collection, 'Work')
    const title = within(area).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rails guides')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    expect(await within(area).findByRole('heading', { name: 'Rails guides' })).toBeInTheDocument()
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0][1]!.body as string)).not.toHaveProperty('collection_id')
    expect(within(area).getByText('Work')).toBeInTheDocument()
  })

  it("AC-11 a save before the collections load keeps the note's collection", async () => {
    const note = fullNote(2, 'Rails tips')
    const firstForm = later()
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      // The first edit form waits for its collections, and the second cannot load them.
      'GET /api/collections': collectionsForForm(firstForm.handler, () => {
        throw new TypeError('Failed to fetch')
      }),
      'PATCH /api/notes/2': (init) => {
        const sent = JSON.parse(init!.body as string) as { title: string }
        return json(200, { note: { ...note, title: sent.title } })
      },
    })
    const patchBodies = () =>
      fetchMock.mock.calls
        .filter(([, init]) => init?.method === 'PATCH')
        .map(([, init]) => JSON.parse(init!.body as string) as Record<string, unknown>)
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')

    // A save while the field shows "Loading…".
    const loading = within(area).getByRole('group', { name: 'Collection' })
    expect(within(loading).getByRole('status')).toHaveTextContent('Loading…')
    await user.clear(within(area).getByLabelText('Title'))
    await user.type(within(area).getByLabelText('Title'), 'Rails guides')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('heading', { name: 'Rails guides' })).toBeInTheDocument()
    expect(within(area).getByText('Work')).toBeInTheDocument()

    // A save while the field shows its failure.
    await user.click(within(area).getByRole('button', { name: 'Edit' }))
    const failed = within(area).getByRole('group', { name: 'Collection' })
    expect(await within(failed).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
    await user.clear(within(area).getByLabelText('Title'))
    await user.type(within(area).getByLabelText('Title'), 'Rails notes')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('heading', { name: 'Rails notes' })).toBeInTheDocument()
    expect(within(area).getByText('Work')).toBeInTheDocument()

    expect(patchBodies()).toHaveLength(2)
    for (const body of patchBodies()) expect(body).not.toHaveProperty('collection_id')
  })

  it('AC-11 a move into a collection deleted elsewhere shows the message under Collection', async () => {
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note: fullNote(2, 'Rails tips') }),
      // "Books" was deleted in another tab after this form loaded the collections.
      'PATCH /api/notes/2': () => json(422, { error: 'validation_failed', fields: { collection_id: 'not_found' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')
    const collection = await within(area).findByLabelText('Collection')
    const title = within(area).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rails guides')
    await user.selectOptions(collection, 'Books')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(collection).toHaveAccessibleDescription('This collection no longer exists. Choose another.'),
    )
    expect(collection).toHaveAttribute('aria-invalid', 'true')
    expect(collection).toHaveFocus()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(patch[1]!.body as string)).toMatchObject({ collection_id: 2 })

    // The form stays open with what was typed and chosen.
    expect(within(area).getByRole('heading', { name: 'Edit note' })).toBeInTheDocument()
    expect(title).toHaveValue('Rails guides')
    expect(collection).toHaveDisplayValue('Books')
  })

  it('AC-11 choosing no collection shows Choose a collection and sends nothing', async () => {
    const note = fullNote(2, 'Rails tips')
    const fetchMock = stubBackend({
      'GET /api/notes': () => json(200, { notes: [summary(2, 'Rails tips')] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note }),
    })
    const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await openEditForm(user, area, 'Rails tips')
    const collection = await within(area).findByLabelText('Collection')

    // The empty choice is checked in the browser, as in the new-note form: nothing is sent.
    await user.selectOptions(collection, 'Choose a collection')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(collection).toHaveAccessibleDescription('Choose a collection.')
    expect(collection).toHaveAttribute('aria-invalid', 'true')
    expect(collection).toHaveFocus()
    expect(patches()).toHaveLength(0)

    // With the note's collection chosen again, the save is sent, with no move.
    await user.selectOptions(collection, 'Work')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    expect(await within(area).findByRole('heading', { name: 'Rails tips' })).toBeInTheDocument()
    expect(patches()).toHaveLength(1)
    expect(JSON.parse(patches()[0][1]!.body as string)).not.toHaveProperty('collection_id')
  })
})
