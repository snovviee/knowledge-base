import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/10_note_tags. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// lists of the other areas (empty unless the test names them), and the requests the test
// names by method and path, such as 'GET /api/notes'. Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const defaults: Record<string, Handler> = {
    'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
    'GET /api/tags': () => json(200, { tags: [] }),
    'GET /api/notes': () => json(200, { notes: [] }),
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

const findNotesArea = () => screen.findByRole('main', { name: 'Notes' })

const TAGS = {
  'GET /api/tags': () =>
    json(200, {
      tags: [
        { id: 1, name: 'ruby' },
        { id: 2, name: 'web' },
      ],
    }),
}

describe('App note tags (features/10_note_tags)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-10 the form lists my tags as checkboxes, with the note own tags checked in the edit form', async () => {
    stubBackend({
      ...TAGS,
      'GET /api/notes': () =>
        json(200, {
          notes: [
            {
              id: 2,
              title: 'Rails tips',
              status: 'active',
              collection: { id: 1, name: 'Work' },
              tags: [{ id: 2, name: 'web' }],
              created_at: '2026-11-09T10:00:00.000Z',
              updated_at: '2026-11-09T10:00:00.000Z',
            },
          ],
        }),
      'GET /api/notes/2': () =>
        json(200, {
          note: {
            id: 2,
            title: 'Rails tips',
            body: 'Body',
            source_url: null,
            status: 'active',
            collection: { id: 1, name: 'Work' },
            tags: [{ id: 2, name: 'web' }],
            created_at: '2026-11-09T10:00:00.000Z',
            updated_at: '2026-11-09T10:00:00.000Z',
          },
        }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // The new-note form lists both tags, unchecked.
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    const group = await within(area).findByRole('group', { name: 'Tags' })
    expect(within(group).getByRole('checkbox', { name: 'ruby' })).not.toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'web' })).not.toBeChecked()

    // The edit form checks the note's own tag.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))
    const editGroup = await within(area).findByRole('group', { name: 'Tags' })
    expect(within(editGroup).getByRole('checkbox', { name: 'web' })).toBeChecked()
    expect(within(editGroup).getByRole('checkbox', { name: 'ruby' })).not.toBeChecked()
  })

  it('AC-10 the Tags group loads on its own, shows its failure, and Try again loads it', async () => {
    // The Tags area of the left column asks for the tags once when the app loads (it
    // answers 200 here). Only the form's requests, which come after "New note", fail.
    // The area mounts with the layout, before a form can open, so its request is the
    // first, however late React sends it.
    let formAttempts = 0
    let areaAsked = false
    stubBackend({
      'GET /api/tags': () => {
        if (!areaAsked) {
          areaAsked = true
          return json(200, { tags: [] })
        }
        formAttempts += 1
        if (formAttempts === 1) throw new TypeError('Failed to fetch')
        if (formAttempts === 2) return json(500, { error: 'internal' })
        return json(200, { tags: [{ id: 1, name: 'ruby' }] })
      },
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    // The rest of the form works while the group fails: the title can be typed.
    const title = await within(area).findByLabelText('Title')
    await user.type(title, 'Rails tips')
    expect(title).toHaveValue('Rails tips')
    expect(await within(area).findByText('Could not load tags. Try again.')).toBeInTheDocument()

    // A second failure, then Try again shows Loading… and then the checkboxes.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(await within(area).findByText('Could not load tags. Try again.')).toBeInTheDocument()
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(await within(area).findByRole('checkbox', { name: 'ruby' })).toBeInTheDocument()
    expect(within(area).queryByText('Could not load tags. Try again.')).not.toBeInTheDocument()
  })

  it('AC-10 Create sends the checked tags as tag_ids, and sends none when none is checked', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () =>
        json(200, {
          tags: [
            { id: 1, name: 'ruby' },
            { id: 2, name: 'web' },
          ],
        }),
      'POST /api/notes': () =>
        json(201, {
          note: {
            id: 9,
            title: 'T',
            body: 'B',
            source_url: null,
            status: 'active',
            collection: { id: 1, name: 'Work' },
            tags: [],
            created_at: '2026-11-09T10:00:00.000Z',
            updated_at: '2026-11-09T10:00:00.000Z',
          },
        }),
    })
    const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'T')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')

    // Check "ruby" and "web", then Create: the request sends both ids.
    await within(area).findByRole('checkbox', { name: 'ruby' })
    await user.click(within(area).getByRole('checkbox', { name: 'ruby' }))
    await user.click(within(area).getByRole('checkbox', { name: 'web' }))
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(posts()[0][1]!.body as string)).toMatchObject({ tag_ids: [1, 2] })
  })

  it('AC-10 Create sends no tag_ids when no tag is checked', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'ruby' }] }),
      'POST /api/notes': () =>
        json(201, {
          note: {
            id: 9, title: 'T', body: 'B', source_url: null, status: 'active',
            collection: { id: 1, name: 'Work' }, tags: [],
            created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z',
          },
        }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'T')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    await within(area).findByRole('checkbox', { name: 'ruby' })
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1))
    const body = JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as string)
    expect(body).not.toHaveProperty('tag_ids')
  })

  it('AC-10 Save sends tag_ids only when the checked tags changed', async () => {
    const note = {
      id: 2, title: 'Rails tips', body: 'Body', source_url: null, status: 'active',
      collection: { id: 1, name: 'Work' }, tags: [{ id: 2, name: 'web' }],
      created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z',
    }
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }] }),
      'GET /api/notes': () => json(200, { notes: [{ ...note, body: undefined, source_url: undefined }] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note: { ...note, title: 'Rails guides' } }),
    })
    const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))

    // Only the title changes: the request sends no tag_ids.
    const title = within(area).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Rails guides')
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).not.toHaveProperty('tag_ids')
  })

  it('AC-10 Save sends the new tag_ids when the user changes the checked tags', async () => {
    const note = {
      id: 2, title: 'Rails tips', body: 'Body', source_url: null, status: 'active',
      collection: { id: 1, name: 'Work' }, tags: [{ id: 2, name: 'web' }],
      created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z',
    }
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }] }),
      'GET /api/notes': () =>
        json(200, { notes: [{ id: 2, title: 'Rails tips', status: 'active', collection: { id: 1, name: 'Work' }, tags: note.tags, created_at: note.created_at, updated_at: note.updated_at }] }),
      'GET /api/notes/2': () => json(200, { note }),
      'PATCH /api/notes/2': () => json(200, { note: { ...note, tags: [{ id: 1, name: 'ruby' }] } }),
    })
    const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'Rails tips' }))
    await user.click(await within(area).findByRole('button', { name: 'Edit' }))

    // Take "web" off and put "ruby" on: the save sends the new set.
    const group = await within(area).findByRole('group', { name: 'Tags' })
    await user.click(within(group).getByRole('checkbox', { name: 'web' }))
    await user.click(within(group).getByRole('checkbox', { name: 'ruby' }))
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(patches()[0][1]!.body as string)).toMatchObject({ tag_ids: [1] })
  })

  it('AC-10 the Tags group shows No tags yet when the user has none', async () => {
    stubBackend({ 'GET /api/tags': () => json(200, { tags: [] }) })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))

    expect(await within(area).findByText('No tags yet')).toBeInTheDocument()
    expect(within(area).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('AC-10 a chosen tag deleted elsewhere shows the message under the group and reloads it', async () => {
    // The Tags area of the left column loads the tags on start (both tags). The form's
    // group loads them when it opens (both), and again after the refusal, when "ruby" is
    // gone. Only the form's second load, after the refusal, answers without "ruby". The
    // area's request is the first, however late React sends it.
    let areaAsked = false
    let formLoads = 0
    stubBackend({
      'GET /api/tags': () => {
        if (!areaAsked) {
          areaAsked = true
          return json(200, { tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }] })
        }
        formLoads += 1
        const list = formLoads === 1 ? [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }] : [{ id: 2, name: 'web' }]
        return json(200, { tags: list })
      },
      'POST /api/notes': () =>
        json(422, { error: 'validation_failed', fields: { tag_ids: 'not_found' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await user.type(await within(area).findByLabelText('Title'), 'T')
    await user.type(within(area).getByLabelText('Body'), 'B')
    await user.selectOptions(within(area).getByLabelText('Collection'), 'Work')
    const group = await within(area).findByRole('group', { name: 'Tags' })
    await within(group).findByRole('checkbox', { name: 'ruby' })
    await user.click(within(group).getByRole('checkbox', { name: 'ruby' }))
    await user.click(within(group).getByRole('checkbox', { name: 'web' }))
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // The message shows under the group, and the group loads the tags again.
    expect(await within(area).findByText('A chosen tag no longer exists. Check the tags again.')).toBeInTheDocument()
    await waitFor(() => expect(within(area).queryByRole('checkbox', { name: 'ruby' })).not.toBeInTheDocument())
    // The tag that still exists keeps its check, and the focus moves to the group.
    expect(within(area).getByRole('checkbox', { name: 'web' })).toBeChecked()
    expect(within(area).getByRole('group', { name: 'Tags' })).toHaveFocus()
    // The form keeps what was typed.
    expect(within(area).getByLabelText('Title')).toHaveValue('T')
  })

  it('AC-10 the list and the detail show a note tags, and nothing for a note with none', async () => {
    stubBackend({
      'GET /api/tags': () => json(200, { tags: [] }),
      'GET /api/notes': () =>
        json(200, {
          notes: [
            { id: 2, title: 'Rails tips', status: 'active', collection: { id: 1, name: 'Work' },
              tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }],
              created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z' },
            { id: 1, title: 'Plain', status: 'active', collection: { id: 1, name: 'Work' },
              tags: [], created_at: '2026-11-08T10:00:00.000Z', updated_at: '2026-11-08T10:00:00.000Z' },
          ],
        }),
      'GET /api/notes/2': () =>
        json(200, {
          note: { id: 2, title: 'Rails tips', body: 'Body', source_url: null, status: 'active',
            collection: { id: 1, name: 'Work' }, tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }],
            created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z' },
        }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()

    // The list entry shows "Work", then "ruby" and "web", in order.
    const entry = (await within(area).findByRole('button', { name: 'Rails tips' })).closest('li') as HTMLElement
    expect(within(entry).getByTestId('note-tags')).toHaveTextContent('ruby')
    expect(within(entry).getByTestId('note-tags')).toHaveTextContent('web')
    // A note with no tags shows no tag names.
    const plain = (await within(area).findByRole('button', { name: 'Plain' })).closest('li') as HTMLElement
    expect(within(plain).queryByTestId('note-tags')).not.toBeInTheDocument()

    // The detail shows "Tags" with the names.
    await user.click(within(area).getByRole('button', { name: 'Rails tips' }))
    expect(await within(area).findByText('Tags')).toBeInTheDocument()
    expect(within(area).getByText('ruby, web')).toBeInTheDocument()
  })

  it('AC-10 a renamed tag shows its new name on its notes, with no notes request', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 2, name: 'web' }] }),
      'GET /api/notes': () =>
        json(200, {
          notes: [
            { id: 2, title: 'Rails tips', status: 'active', collection: { id: 1, name: 'Work' },
              tags: [{ id: 2, name: 'web' }], created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z' },
          ],
        }),
      'PATCH /api/tags/2': () => json(200, { tag: { id: 2, name: 'frontend' } }),
    })
    const notesRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    const tags = await screen.findByRole('complementary', { name: 'Tags' })
    await user.click(await within(tags).findByRole('button', { name: 'Rename web' }))
    const field = within(tags).getByLabelText('Tag name')
    await user.clear(field)
    await user.type(field, 'frontend')
    await user.click(within(tags).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(tags).getByText('frontend')).toBeInTheDocument())

    // The list shows the new name on the note, with no notes request.
    expect(within(area).getByTestId('note-tags')).toHaveTextContent('frontend')
    expect(notesRequests()).toBe(1)
  })

  it('AC-10 a deleted tag leaves the notes shown tags at once, with no notes request', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }] }),
      'GET /api/notes': () =>
        json(200, {
          notes: [
            { id: 2, title: 'Rails tips', status: 'active', collection: { id: 1, name: 'Work' },
              tags: [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }],
              created_at: '2026-11-09T10:00:00.000Z', updated_at: '2026-11-09T10:00:00.000Z' },
          ],
        }),
      'DELETE /api/tags/2': () => new Response(null, { status: 204 }),
    })
    const notesRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/notes').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    const tags = await screen.findByRole('complementary', { name: 'Tags' })
    await user.click(await within(tags).findByRole('button', { name: 'Delete web' }))
    await user.click(within(tags).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(tags).queryByText('web')).not.toBeInTheDocument())

    // "Rails tips" stays, and no longer shows "web"; no notes request was made.
    expect(within(area).getByTestId('note-tags')).toHaveTextContent('ruby')
    expect(within(area).getByTestId('note-tags')).not.toHaveTextContent('web')
    expect(within(area).getByRole('button', { name: 'Rails tips' })).toBeInTheDocument()
    expect(notesRequests()).toBe(1)
  })

  it('AC-10 the tag delete confirmation says the notes are kept', async () => {
    stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 2, name: 'web' }] }),
    })
    const user = userEvent.setup()

    render(<App />)
    await findNotesArea()
    const tags = await screen.findByRole('complementary', { name: 'Tags' })
    await user.click(await within(tags).findByRole('button', { name: 'Delete web' }))

    // The question, then the added line under it.
    expect(within(tags).getByText('Delete “web”? This cannot be undone.')).toBeInTheDocument()
    expect(within(tags).getByText('Notes with this tag are kept.')).toBeInTheDocument()
  })

  it('AC-10 an open note form keeps its loaded tags until it is opened again', async () => {
    let tagList = [{ id: 1, name: 'ruby' }]
    stubBackend({
      'GET /api/tags': () => json(200, { tags: tagList }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findNotesArea()
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    await within(area).findByRole('checkbox', { name: 'ruby' })

    // A tag is created while the form is open. The form keeps the list it loaded.
    tagList = [{ id: 1, name: 'ruby' }, { id: 2, name: 'web' }]
    expect(within(area).queryByRole('checkbox', { name: 'web' })).not.toBeInTheDocument()

    // Closing and opening the form again shows the new tag.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    await user.click(await within(area).findByRole('button', { name: 'New note' }))
    expect(await within(area).findByRole('checkbox', { name: 'web' })).toBeInTheDocument()
  })
})
