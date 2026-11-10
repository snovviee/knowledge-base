import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/08_tags_crud. The tests render the whole app with a signed-in user and
// replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf,
// the collections and notes lists (empty unless the test names them), and the tags
// requests that the test names by method and path, such as 'GET /api/tags'. Any other
// request fails.
function stubBackend(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session') return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    const lists: Record<string, Handler> = {
      'GET /api/collections': () => json(200, { collections: [] }),
      'GET /api/notes': () => json(200, { notes: [] }),
    }
    const handler = routes[key] ?? lists[key]
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

// The tags area of the main layout.
const findTagsArea = () => screen.findByRole('complementary', { name: 'Tags' })

// The names the list shows, in its order.
const listedNames = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('tag-name')
    .map((name) => name.textContent)

describe('App tags (features/08_tags_crud)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("AC-08 the tags area shows Loading… and then the user's tags, below the collections area", async () => {
    const list = later()
    stubBackend({
      // The collections list cannot load. The tags area does not wait for it.
      'GET /api/collections': () => json(500, { error: 'internal' }),
      'GET /api/tags': list.handler,
    })

    render(<App />)

    const area = await findTagsArea()
    expect(within(area).getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await list.requested
    list.answer(
      json(200, {
        tags: [
          { id: 4, name: '#work' },
          { id: 1, name: 'art' },
          { id: 2, name: 'Books <b>bold</b>' },
          { id: 3, name: 'rails' },
        ],
      }),
    )

    // The server's order, and markup in a name is plain text.
    await waitFor(() => expect(listedNames(area)).toEqual(['#work', 'art', 'Books <b>bold</b>', 'rails']))
    expect(within(area).queryByRole('status')).not.toBeInTheDocument()
    expect(area.querySelector('b')).toBeNull()

    // In the left area, below the collections area, and not beside the notes.
    const collections = screen.getByRole('complementary', { name: 'Collections' })
    const leftArea = collections.parentElement!
    expect(leftArea).toContainElement(area)
    expect(leftArea).not.toContainElement(screen.getByRole('main'))
    expect(collections.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(collections).getByRole('alert')).toHaveTextContent('Could not load collections. Try again.')
  })

  it('AC-08 a tags list that cannot load shows the error, and Try again loads it', async () => {
    const third = later()
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
      third.handler,
    ]
    const fetchMock = stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'GET /api/tags': (init) => answers.shift()!(init),
    })
    const listRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/tags').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    const collections = screen.getByRole('complementary', { name: 'Collections' })

    // No answer. Only the tags area shows the error: the collections area shows its list.
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load tags. Try again.')
    expect(await within(collections).findByText('Work')).toBeInTheDocument()
    expect(within(collections).queryByRole('alert')).not.toBeInTheDocument()

    // An error answer.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(listRequests()).toBe(2))
    expect(await within(area).findByRole('alert')).toHaveTextContent('Could not load tags. Try again.')

    // The server answers: "Loading…" while the list loads, then the list.
    await user.click(within(area).getByRole('button', { name: 'Try again' }))
    expect(within(area).getByRole('status')).toHaveTextContent('Loading…')
    await third.requested
    third.answer(json(200, { tags: [{ id: 1, name: 'art' }] }))
    await waitFor(() => expect(listedNames(area)).toEqual(['art']))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-08 New tag creates a tag and shows it in alphabetical order', async () => {
    const list = later()
    const fetchMock = stubBackend({
      'GET /api/tags': list.handler,
      'POST /api/tags': () => json(201, { tag: { id: 3, name: 'Books' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()

    // "New tag" shows once the list has loaded.
    expect(within(area).queryByRole('button', { name: 'New tag' })).not.toBeInTheDocument()
    await list.requested
    list.answer(json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'work' }] }))
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))

    const field = within(area).getByRole('textbox', { name: 'Tag name' })
    expect(field).toHaveFocus()
    await user.type(field, 'Books')
    await user.click(within(area).getByRole('button', { name: 'Create' }))

    // Ignoring case, "Books" goes between "art" and "work".
    await waitFor(() => expect(listedNames(area)).toEqual(['art', 'Books', 'work']))
    expect(within(area).queryByRole('textbox', { name: 'Tag name' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/tags', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Books' }),
    })
  })

  it('AC-08 the tags area shows No tags yet and New tag when the user has none', async () => {
    stubBackend({ 'GET /api/tags': () => json(200, { tags: [] }) })

    render(<App />)
    const area = await findTagsArea()

    expect(await within(area).findByText('No tags yet')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'New tag' })).toBeInTheDocument()
    expect(within(area).queryByRole('list')).not.toBeInTheDocument()
  })

  it('AC-08 a refused tag name shows its validation message under the field', async () => {
    const answers = ['blank', 'too_long', 'taken'].map((code) =>
      json(422, { error: 'validation_failed', fields: { name: code } }),
    )
    stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'POST /api/tags': () => answers.shift()!,
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))
    const field = within(area).getByRole('textbox', { name: 'Tag name' })

    for (const [typed, message] of [
      ['   ', 'Enter a name.'],
      ['t'.repeat(101), 'Use at most 100 characters.'],
      ['Work', 'A tag with this name already exists.'],
    ]) {
      await user.clear(field)
      await user.click(field)
      await user.paste(typed)
      await user.click(within(area).getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent(message))
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription(message)
      expect(field).toHaveValue(typed)
      expect(listedNames(area)).toEqual(['work'])
    }
  })

  it('AC-08 a tag create that fails shows the error and keeps the form', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'POST /api/tags': (init) => answers.shift()!(init),
    })
    const createRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))
    const field = within(area).getByRole('textbox', { name: 'Tag name' })
    await user.type(field, 'reading')

    // No answer, then 403, then 500.
    for (const attempt of [1, 2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(createRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not create the tag. Try again.'),
      )
      expect(field).toHaveValue('reading')
      expect(field).not.toHaveAttribute('aria-invalid')
      expect(listedNames(area)).toEqual(['work'])
    }
  })

  it('AC-08 Rename renames a tag and keeps the list in alphabetical order', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'work' }] }),
      'PATCH /api/tags/2': () => json(200, { tag: { id: 2, name: 'Agenda' } }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename work' }))

    // The row turns into a form with the current name.
    const field = within(area).getByRole('textbox', { name: 'Tag name' })
    expect(field).toHaveValue('work')
    expect(field).toHaveFocus()
    expect(listedNames(area)).toEqual(['art'])
    await user.clear(field)
    await user.type(field, 'Agenda')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    // Ignoring case, "Agenda" goes before "art".
    await waitFor(() => expect(listedNames(area)).toEqual(['Agenda', 'art']))
    expect(within(area).queryByRole('textbox', { name: 'Tag name' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/tags/2', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Agenda' }),
    })
  })

  it('AC-08 a tag rename that is refused or fails shows the message and keeps the form', async () => {
    const answers: Handler[] = [
      () => json(422, { error: 'validation_failed', fields: { name: 'taken' } }),
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'home' }, { id: 2, name: 'work' }] }),
      'PATCH /api/tags/1': (init) => answers.shift()!(init),
    })
    const renameRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename home' }))
    const field = within(area).getByRole('textbox', { name: 'Tag name' })
    await user.clear(field)
    await user.type(field, 'WORK')

    // A refused name.
    await user.click(within(area).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(within(area).getByRole('alert')).toHaveTextContent('A tag with this name already exists.'),
    )
    expect(field).toHaveAttribute('aria-invalid', 'true')

    // No answer, then 500.
    for (const attempt of [2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(renameRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not rename the tag. Try again.'),
      )
      expect(field).not.toHaveAttribute('aria-invalid')
    }
    expect(field).toHaveValue('WORK')
    expect(listedNames(area)).toEqual(['work'])
  })

  it('AC-08 renaming a tag that no longer exists removes it and says so', async () => {
    stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'work' }] }),
      'PATCH /api/tags/1': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'Rename art' }))
    await user.type(within(area).getByRole('textbox', { name: 'Tag name' }), ' history')
    await user.click(within(area).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent('This tag no longer exists.'))
    expect(listedNames(area)).toEqual(['work'])
    expect(within(area).queryByRole('textbox', { name: 'Tag name' })).not.toBeInTheDocument()
  })

  it('AC-08 Create and Save in the tags area show a busy state and ignore a second click', async () => {
    const create = later()
    const rename = later()
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'POST /api/tags': create.handler,
      'PATCH /api/tags/1': rename.handler,
    })
    const requests = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()

    // Create.
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))
    await user.type(within(area).getByRole('textbox', { name: 'Tag name' }), 'reading')
    const createButton = within(area).getByRole('button', { name: 'Create' })
    await user.click(createButton)
    await user.click(createButton)
    await create.requested
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('aria-busy', 'true')
    create.answer(json(201, { tag: { id: 2, name: 'reading' } }))
    await waitFor(() => expect(listedNames(area)).toEqual(['reading', 'work']))
    expect(requests('POST')).toBe(1)

    // Save.
    await user.click(within(area).getByRole('button', { name: 'Rename work' }))
    const saveButton = within(area).getByRole('button', { name: 'Save' })
    await user.click(saveButton)
    await user.click(saveButton)
    await rename.requested
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('aria-busy', 'true')
    rename.answer(json(200, { tag: { id: 1, name: 'work' } }))
    await waitFor(() => expect(within(area).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
    expect(requests('PATCH')).toBe(1)
  })

  it('AC-08 Cancel, Escape, or another tag form closes the open tag form without a request', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'work' }] }),
      'POST /api/tags': () => json(422, { error: 'validation_failed', fields: { name: 'taken' } }),
    })
    const requests = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    const nameFields = () => within(area).queryAllByRole('textbox', { name: 'Tag name' })

    // Cancel after a refused name. The form opens again empty, with no message.
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))
    await user.type(nameFields()[0], 'work')
    await user.click(within(area).getByRole('button', { name: 'Create' }))
    await within(area).findByRole('alert')
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(nameFields()).toHaveLength(0)
    await user.click(within(area).getByRole('button', { name: 'New tag' }))
    expect(nameFields()[0]).toHaveValue('')
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()

    // Escape closes the create form.
    await user.type(nameFields()[0], 'draft')
    await user.keyboard('{Escape}')
    expect(nameFields()).toHaveLength(0)

    // Opening a rename form closes the create form, and Escape closes the rename form.
    await user.click(within(area).getByRole('button', { name: 'New tag' }))
    await user.click(within(area).getByRole('button', { name: 'Rename work' }))
    expect(nameFields()).toHaveLength(1)
    expect(nameFields()[0]).toHaveValue('work')
    await user.keyboard('{Escape}')
    expect(nameFields()).toHaveLength(0)

    // Opening the create form closes a rename form, and Cancel closes a rename form.
    await user.click(within(area).getByRole('button', { name: 'Rename art' }))
    await user.click(within(area).getByRole('button', { name: 'New tag' }))
    expect(nameFields()).toHaveLength(1)
    expect(nameFields()[0]).toHaveValue('')
    await user.click(within(area).getByRole('button', { name: 'Rename art' }))
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(nameFields()).toHaveLength(0)

    expect(listedNames(area)).toEqual(['art', 'work'])
    expect(requests('POST')).toBe(1)
    expect(requests('PATCH')).toBe(0)
  })

  it('AC-08 Delete asks for confirmation, and Cancel or Escape keeps the tag', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'work' }] }),
    })
    // Requests that change data carry a method. The session, token, and list requests do not.
    const changes = () => fetchMock.mock.calls.filter(([, init]) => init?.method !== undefined).length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()

    // Opening the confirmation closes an open form.
    await user.click(await within(area).findByRole('button', { name: 'New tag' }))
    await user.click(within(area).getByRole('button', { name: 'Delete work' }))
    expect(within(area).queryByRole('textbox', { name: 'Tag name' })).not.toBeInTheDocument()

    expect(within(area).getByText('Delete “work”? This cannot be undone.')).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(area).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(listedNames(area)).toEqual(['art'])

    // Cancel brings the row back.
    await user.click(within(area).getByRole('button', { name: 'Cancel' }))
    expect(listedNames(area)).toEqual(['art', 'work'])
    expect(within(area).queryByText(/This cannot be undone/)).not.toBeInTheDocument()

    // So does Escape.
    await user.click(within(area).getByRole('button', { name: 'Delete work' }))
    await user.keyboard('{Escape}')
    expect(listedNames(area)).toEqual(['art', 'work'])

    expect(changes()).toBe(0)
  })

  it('AC-08 confirming a delete removes the tag, also when it was already deleted', async () => {
    const fetchMock = stubBackend({
      'GET /api/tags': () =>
        json(200, { tags: [{ id: 1, name: 'art' }, { id: 2, name: 'home' }, { id: 3, name: 'work' }] }),
      'DELETE /api/tags/3': () => new Response(null, { status: 204 }),
      'DELETE /api/tags/2': () => json(404, { error: 'not_found' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    const confirmation = () => within(area).queryByText(/This cannot be undone/)

    await user.click(await within(area).findByRole('button', { name: 'Delete work' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument())
    expect(listedNames(area)).toEqual(['art', 'home'])
    expect(fetchMock).toHaveBeenCalledWith('/api/tags/3', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'csrf-token' },
    })

    // Already deleted elsewhere: the row leaves the list too, with no alert.
    await user.click(within(area).getByRole('button', { name: 'Delete home' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument())
    expect(listedNames(area)).toEqual(['art'])
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('AC-08 a tag delete that fails shows the error and keeps the confirmation', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
      () => json(403, { error: 'invalid_csrf_token' }),
      () => json(500, { error: 'internal' }),
    ]
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'DELETE /api/tags/1': (init) => answers.shift()!(init),
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'Delete work' }))

    // No answer, then 403, then 500.
    for (const attempt of [1, 2, 3]) {
      await user.click(within(area).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(deleteRequests()).toBe(attempt))
      await waitFor(() =>
        expect(within(area).getByRole('alert')).toHaveTextContent('Could not delete the tag. Try again.'),
      )
      expect(within(area).getByText('Delete “work”? This cannot be undone.')).toBeInTheDocument()
    }
  })

  it('AC-08 Delete in the tags area shows a busy state and ignores a second click', async () => {
    const remove = later()
    const fetchMock = stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'DELETE /api/tags/1': remove.handler,
    })
    const deleteRequests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const area = await findTagsArea()
    await user.click(await within(area).findByRole('button', { name: 'Delete work' }))
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

  it('AC-08 a tags list request answered 401 shows the sign-in screen', async () => {
    stubBackend({ 'GET /api/tags': () => json(401, { error: 'unauthenticated' }) })

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('AC-08 a tag change answered 401 shows the sign-in screen', async () => {
    const unauthenticated = () => json(401, { error: 'unauthenticated' })
    stubBackend({
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'work' }] }),
      'POST /api/tags': unauthenticated,
      'PATCH /api/tags/1': unauthenticated,
      'DELETE /api/tags/1': unauthenticated,
    })
    const user = userEvent.setup()

    // A create, a rename, and a delete, each in a fresh app.
    const changes = [
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'New tag' }))
        await user.type(within(area).getByRole('textbox', { name: 'Tag name' }), 'reading')
        await user.click(within(area).getByRole('button', { name: 'Create' }))
      },
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'Rename work' }))
        await user.click(within(area).getByRole('button', { name: 'Save' }))
      },
      async (area: HTMLElement) => {
        await user.click(await within(area).findByRole('button', { name: 'Delete work' }))
        await user.click(within(area).getByRole('button', { name: 'Delete' }))
      },
    ]

    for (const change of changes) {
      const { unmount } = render(<App />)
      await change(await findTagsArea())

      expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('AC-08 a collection form and a tag form can be open at the same time', async () => {
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'GET /api/tags': () => json(200, { tags: [{ id: 1, name: 'art' }] }),
    })
    const user = userEvent.setup()

    render(<App />)
    const tags = await findTagsArea()
    const collections = screen.getByRole('complementary', { name: 'Collections' })
    const collectionField = () => within(collections).queryByRole('textbox', { name: 'Collection name' })
    const tagField = () => within(tags).queryByRole('textbox', { name: 'Tag name' })

    // A tag form leaves an open collection form as it is, with its typed name.
    await user.click(await within(collections).findByRole('button', { name: 'New collection' }))
    await user.type(collectionField()!, 'Reading')
    await user.click(await within(tags).findByRole('button', { name: 'New tag' }))
    expect(tagField()).toHaveFocus()
    expect(collectionField()).toHaveValue('Reading')

    // Escape in the tag form closes only the tag form, and so does a tag confirmation.
    await user.keyboard('{Escape}')
    expect(tagField()).not.toBeInTheDocument()
    expect(collectionField()).toHaveValue('Reading')
    await user.click(within(tags).getByRole('button', { name: 'Delete art' }))
    expect(within(tags).getByText('Delete “art”? This cannot be undone.')).toBeInTheDocument()
    expect(collectionField()).toHaveValue('Reading')
    await user.click(within(tags).getByRole('button', { name: 'Cancel' }))
    expect(collectionField()).toHaveValue('Reading')

    // The other way round: a collection confirmation leaves an open tag form as it is.
    await user.click(within(tags).getByRole('button', { name: 'Rename art' }))
    await user.type(tagField()!, ' history')
    await user.click(within(collections).getByRole('button', { name: 'Delete Work' }))
    expect(within(collections).getByText('Delete “Work”? This cannot be undone.')).toBeInTheDocument()
    expect(tagField()).toHaveValue('art history')
  })
})
