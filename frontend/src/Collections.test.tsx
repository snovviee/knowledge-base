import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/06_collections_crud. The tests render the whole app with a signed-in
// user and replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf,
// and the collections requests that the test names by method and path, such as
// 'GET /api/collections'. Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session') return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    // The tags and notes areas ask for their lists too (features/08_tags_crud,
    // features/09_notes_crud).
    if (key === 'GET /api/tags') return json(200, { tags: [] })
    if (key === 'GET /api/notes') return json(200, { notes: [] })
    const handler = routes[key]
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

// The collections area of the main layout.
const findCollectionsArea = () => screen.findByRole('complementary', { name: 'Collections' })

// The names the list shows, in its order.
const listedNames = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('collection-name')
    .map((name) => name.textContent)

describe('App collections (features/06_collections_crud)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("AC-06 the collections area shows Loading… and then the user's collections", async () => {
    const list = later()
    stubBackend({ 'GET /api/collections': list.handler })

    render(<App />)

    const area = await findCollectionsArea()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await list.requested
    list.answer(
      json(200, {
        collections: [
          { id: 1, name: 'Art' },
          { id: 2, name: 'books <b>bold</b>' },
          { id: 3, name: 'Work' },
        ],
      }),
    )

    // The server's order, and markup in a name is plain text.
    await waitFor(() => expect(listedNames(area)).toEqual(['Art', 'books <b>bold</b>', 'Work']))
    expect(within(area).queryByRole('status')).not.toBeInTheDocument()
    expect(area.querySelector('b')).toBeNull()
  })

  it('AC-06 a list that cannot load shows the error, and Try again loads it', async () => {
    const third = later()
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    const fetchMock = stubBackend({ 'GET /api/collections': (init) => answers.shift()!(init) })
    const listRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/collections').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()

    // No answer.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')

    // An error answer.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(listRequests()).toBe(2))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load collections. Try again.')

    // The server answers: "Loading…" while the list loads, then the list.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, { collections: [{ id: 1, name: 'Art' }] }))
    await waitFor(() => expect(listedNames(area)).toEqual(['Art']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-06 the collections area shows No collections yet and New collection when the user has none', async () => {
    stubBackend({ 'GET /api/collections': () => json(200, { collections: [] }) })

    render(<App />)
    const area = await findCollectionsArea()

    expect(await within(area).findByText('No collections yet')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'New collection' })).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
  })

  it('AC-06 New collection creates a collection and shows it in alphabetical order', async () => {
    const list = later()
    const fetchMock = stubBackend({
      'GET /api/collections': list.handler,
      'POST /api/collections': () => json(201, { collection: { id: 3, name: 'books' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()

    // "New collection" shows once the list has loaded.
    expect(within(area).queryByRole('button', { name: 'New collection' })).not.toBeInTheDocument()
    await list.requested
    list.answer(json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Work' }] }))
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))

    const field = within(area).getByRole('textbox', { name: 'Collection name' })
    expect(field).toHaveFocus()
    await user.type(field, 'books')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // Ignoring case, "books" goes between "Art" and "Work".
    await waitFor(() => expect(listedNames(area)).toEqual(['Art', 'books', 'Work']))
    expect(within(area).queryByRole('textbox', { name: 'Collection name' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/collections', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'books' }),
    })
  })

  it('AC-06 a refused name shows its validation message under the field', async () => {
    const answers = ['blank', 'too_long', 'taken'].map((code) =>
      json(422, { error: 'validation_failed', fields: { name: code } }),
    )
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/collections': () => answers.shift()!,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))
    const field = within(area).getByRole('textbox', { name: 'Collection name' })

    for (const [typed, message] of [
      ['   ', 'Enter a name.'],
      ['a'.repeat(101), 'Use at most 100 characters.'],
      ['work', 'A collection with this name already exists.'],
    ]) {
      await user.clear(field)
      await user.click(field)
      await user.paste(typed)
      await user.click(within(area).getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent(message))
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription(message)
      expect(field).toHaveValue(typed)
      expect(listedNames(area)).toEqual(['Work'])
    }
  })

  it('AC-06 a create that fails shows the error and keeps the form', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/collections': (init) => answers.shift()!(init),
    })
    const createRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))
    const field = within(area).getByRole('textbox', { name: 'Collection name' })
    await user.type(field, 'Reading')

    // No answer, then 403, then 500.
    for (const attempt of [1, 2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(createRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not create the collection. Try again.'),
      )
      expect(field).toHaveValue('Reading')
      expect(field).not.toHaveAttribute('aria-invalid')
      expect(listedNames(area)).toEqual(['Work'])
    }
  })

  it('AC-06 Rename renames a collection and keeps the list in alphabetical order', async () => {
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Work' }] }),
      'PATCH /api/collections/2': () => json(200, { collection: { id: 2, name: 'agenda' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename Work' }))

    // The row turns into a form with the current name.
    const field = within(area).getByRole('textbox', { name: 'Collection name' })
    expect(field).toHaveValue('Work')
    expect(field).toHaveFocus()
    expect(listedNames(area)).toEqual(['Art'])
    await user.clear(field)
    await user.type(field, 'agenda')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    // Ignoring case, "agenda" goes before "Art".
    await waitFor(() => expect(listedNames(area)).toEqual(['agenda', 'Art']))
    expect(within(area).queryByRole('textbox', { name: 'Collection name' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/collections/2', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'agenda' }),
    })
  })

  it('AC-06 a rename that is refused or fails shows the message and keeps the form', async () => {
    const answers: Handler[] = [
      () => json(422, { error: 'validation_failed', fields: { name: 'taken' } }),
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Home' }, { id: 2, name: 'Work' }] }),
      'PATCH /api/collections/1': (init) => answers.shift()!(init),
    })
    const renameRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename Home' }))
    const field = within(area).getByRole('textbox', { name: 'Collection name' })
    await user.clear(field)
    await user.type(field, 'WORK')

    // A refused name.
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(within(area).getByRole('alert')).toHaveTextContent('A collection with this name already exists.'),
    )
    expect(field).toHaveAttribute('aria-invalid', 'true')

    // No answer, then 500.
    for (const attempt of [2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(renameRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not rename the collection. Try again.'),
      )
      expect(field).not.toHaveAttribute('aria-invalid')
    }
    expect(field).toHaveValue('WORK')
    expect(listedNames(area)).toEqual(['Work'])
  })

  it('AC-06 renaming a collection that no longer exists removes it and says so', async () => {
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Work' }] }),
      'PATCH /api/collections/2': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename Work' }))
    await user.type(within(area).getByRole('textbox', { name: 'Collection name' }), ' notes')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent('This collection no longer exists.'))
    expect(listedNames(area)).toEqual(['Art'])
    expect(within(area).queryByRole('textbox', { name: 'Collection name' })).not.toBeInTheDocument()
  })

  it('AC-06 Create and Save show a busy state and ignore a second click', async () => {
    const create = later()
    const rename = later()
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/collections': create.handler,
      'PATCH /api/collections/1': rename.handler,
    })
    const requests = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()

    // Create.
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))
    await user.type(within(area).getByRole('textbox', { name: 'Collection name' }), 'Reading')
    const createButton = within(area).getByRole('button', { name: 'Create' })
    await user.click(createButton)
    await user.click(createButton)
    await create.requested
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('aria-busy', 'true')
    create.answer(json(201, { collection: { id: 2, name: 'Reading' } }))
    await waitFor(() => expect(listedNames(area)).toEqual(['Reading', 'Work']))
    expect(requests('POST')).toBe(1)

    // Save.
    await user.click(within(area).getByRole('button', { name: 'Rename Work' }))
    const saveButton = within(area).getByRole('button', { name: 'Save' })
    await user.click(saveButton)
    await user.click(saveButton)
    await rename.requested
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('aria-busy', 'true')
    rename.answer(json(200, { collection: { id: 1, name: 'Work' } }))
    await waitFor(() => expect(within(area).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
    expect(requests('PATCH')).toBe(1)
  })

  it('AC-06 Cancel, Escape, or another form closes the open form without a request', async () => {
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Work' }] }),
      'POST /api/collections': () => json(422, { error: 'validation_failed', fields: { name: 'taken' } }),
    })
    const requests = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    const nameFields = () => within(area).queryAllByRole('textbox', { name: 'Collection name' })

    // Cancel after a refused name. The form opens again empty, with no message.
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))
    await user.type(nameFields()[0], 'work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    await within(area).findByRole('alert')
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(nameFields()).toHaveLength(0)
    await user.click(within(area).getByRole('button', { name: 'New collection' }))
    expect(nameFields()[0]).toHaveValue('')
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()

    // Escape closes the create form.
    await user.type(nameFields()[0], 'Draft')
    await user.keyboard('{Escape}')
    expect(nameFields()).toHaveLength(0)

    // Opening a rename form closes the create form, and Escape closes the rename form.
    await user.click(within(area).getByRole('button', { name: 'New collection' }))
    await user.click(within(area).getByRole('button', { name: 'Rename Work' }))
    expect(nameFields()).toHaveLength(1)
    expect(nameFields()[0]).toHaveValue('Work')
    await user.keyboard('{Escape}')
    expect(nameFields()).toHaveLength(0)

    // Opening the create form closes a rename form, and Cancel closes a rename form.
    await user.click(within(area).getByRole('button', { name: 'Rename Art' }))
    await user.click(within(area).getByRole('button', { name: 'New collection' }))
    expect(nameFields()).toHaveLength(1)
    expect(nameFields()[0]).toHaveValue('')
    await user.click(within(area).getByRole('button', { name: 'Rename Art' }))
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(nameFields()).toHaveLength(0)

    expect(listedNames(area)).toEqual(['Art', 'Work'])
    expect(requests('POST')).toBe(1)
    expect(requests('PATCH')).toBe(0)
  })

  it('AC-06 Delete asks for confirmation, and Cancel or Escape keeps the collection', async () => {
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Work' }] }),
    })
    // Requests that change data carry a method. The session, token, and list requests do not.
    const changes = () => fetchMock.mock.calls.filter(([, init]) => init?.method !== undefined).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()

    // Opening the confirmation closes an open form.
    await user.click(await within(area).findByRole('button', { name: 'New collection' }))
    await user.click(within(area).getByRole('button', { name: 'Delete Work' }))
    expect(within(area).queryByRole('textbox', { name: 'Collection name' })).not.toBeInTheDocument()

    expect(within(area).getByText('Delete “Work”? This cannot be undone.')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(listedNames(area)).toEqual(['Art'])

    // Cancel brings the row back.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(listedNames(area)).toEqual(['Art', 'Work'])
    expect(within(area).queryByText(/This cannot be undone/)).not.toBeInTheDocument()

    // So does Escape.
    await user.click(within(area).getByRole('button', { name: 'Delete Work' }))
    await user.keyboard('{Escape}')
    expect(listedNames(area)).toEqual(['Art', 'Work'])

    expect(changes()).toBe(0)
  })

  it('AC-06 confirming a delete removes the collection, also when it was already deleted', async () => {
    const fetchMock = stubBackend({
      'GET /api/collections': () =>
        json(200, { collections: [{ id: 1, name: 'Art' }, { id: 2, name: 'Home' }, { id: 3, name: 'Work' }] }),
      'DELETE /api/collections/3': () => new Response(null, { status: 204 }),
      'DELETE /api/collections/2': () => json(404, { error: 'not_found' }),
    })
    const confirmation = () => within(screen.getByRole('complementary', { name: 'Collections' })).queryByText(/This cannot be undone/)
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()

    await user.click(await within(area).findByRole('button', { name: 'Delete Work' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument())
    expect(listedNames(area)).toEqual(['Art', 'Home'])
    expect(fetchMock).toHaveBeenCalledWith('/api/collections/3', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'csrf-token' },
    })

    // Already deleted elsewhere: the row leaves the list too, with no alert.
    await user.click(within(area).getByRole('button', { name: 'Delete Home' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument())
    expect(listedNames(area)).toEqual(['Art'])
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-06 a delete that fails shows the error and keeps the confirmation', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'DELETE /api/collections/1': (init) => answers.shift()!(init),
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Delete Work' }))

    // No answer, then 403, then 500.
    for (const attempt of [1, 2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(deleteRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not delete the collection. Try again.'),
      )
      expect(within(area).getByText('Delete “Work”? This cannot be undone.')).toBeInTheDocument()
    }
  })

  it('AC-06 Delete shows a busy state and ignores a second click', async () => {
    const remove = later()
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'DELETE /api/collections/1': remove.handler,
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Delete Work' }))
    const deleteButton = within(area).getByRole('button', { name: 'Delete' })
    await user.click(deleteButton)
    await user.click(deleteButton)
    await remove.requested
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveAttribute('aria-busy', 'true')

    remove.answer(new Response(null, { status: 204 }))
    await waitFor(() => expect(within(area).queryByText(/This cannot be undone/)).not.toBeInTheDocument())
    expect(deleteRequests()).toBe(1)
  })

  it('AC-06 a list request answered 401 shows the sign-in screen', async () => {
    stubBackend({ 'GET /api/collections': () => json(401, { error: 'unauthenticated' }) })

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('AC-06 a change answered 401 shows the sign-in screen', async () => {
    const unauthenticated = () => json(401, { error: 'unauthenticated' })
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'POST /api/collections': unauthenticated,
      'PATCH /api/collections/1': unauthenticated,
      'DELETE /api/collections/1': unauthenticated,
    })
    const user = userEvent.setup()

    // A create, a rename, and a delete, each in a fresh app.
    const changes = [
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'New collection' }))
        await user.type(within(area).getByRole('textbox', { name: 'Collection name' }), 'Reading')
        await user.click(within(area).getByRole('button', { name: 'Create' }))
      },
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'Rename Work' }))
        await user.click(within(area).getByRole('button', { name: 'Save' }))
      },
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'Delete Work' }))
        await user.click(within(area).getByRole('button', { name: 'Delete' }))
      },
    ]

    for (const change of changes) {
      const { unmount } = render(<App />)
      await change(await findCollectionsArea())

      expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      unmount()
    }
  })
})
