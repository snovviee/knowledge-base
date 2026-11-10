import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/07_collection_delete_rule. The tests render the whole app with a signed-in
// user and replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Handler = (init?: RequestInit) => Response | Promise<Response>

// Answers like the backend for a signed-in user: the session check, GET /api/csrf, the
// tags and notes lists (empty), and the collections requests that the test names by
// method and path. Any other request fails.
function stubBackend(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (key === 'GET /api/session') return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    if (key === 'GET /api/csrf') return json(200, { token: 'csrf-token' })
    if (key === 'GET /api/tags') return json(200, { tags: [] })
    if (key === 'GET /api/notes') return json(200, { notes: [] })
    const handler = routes[key]
    if (!handler) throw new Error(`unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The collections area of the main layout.
const findCollectionsArea = () => screen.findByRole('complementary', { name: 'Collections' })

// The names the list shows, in its order.
const listedNames = (area: HTMLElement) =>
  within(area)
    .queryAllByTestId('collection-name')
    .map((name) => name.textContent)

const REFUSAL = 'This collection still has notes. Move or delete them first.'
const GENERAL_FAILURE = 'Could not delete the collection. Try again.'

describe('App collection delete rule (features/07_collection_delete_rule)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-07 a delete refused with 409 shows the refusal in the open confirmation and keeps the collection', async () => {
    stubBackend({
      'GET /api/collections': () => json(200, { collections: [{ id: 1, name: 'Work' }] }),
      'DELETE /api/collections/1': () => json(409, { error: 'collection_not_empty' }),
    })
    const user = userEvent.setup()

    render(<App />)
    const area = await findCollectionsArea()
    await user.click(await within(area).findByRole('button', { name: 'Delete Work' }))
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    expect(await within(area).findByRole('alert')).toHaveTextContent(REFUSAL)
    expect(within(area).queryByText(GENERAL_FAILURE)).not.toBeInTheDocument()
    expect(within(area).getByText('Delete “Work”? This cannot be undone.')).toBeInTheDocument()
    // The row stays in the list: the confirmation takes its place, so it is still one item.
    expect(within(area).getAllByRole('listitem')).toHaveLength(1)
  })

  it('AC-07 after a refusal, Delete again removes the collection once its notes are gone, with no alert', async () => {
    const answers: Handler[] = [
      () => json(409, { error: 'collection_not_empty' }),
      () => new Response(null, { status: 204 }),
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
    await user.click(within(area).getByRole('button', { name: 'Delete' }))
    expect(await within(area).findByRole('alert')).toHaveTextContent(REFUSAL)

    // The notes are gone by now: "Delete" again sends the request, which answers 204.
    await user.click(within(area).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteRequests()).toBe(2))
    await waitFor(() => expect(listedNames(area)).toEqual([]))
    expect(within(area).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(area).getByText('No collections yet')).toBeInTheDocument()
  })

  it('AC-07 a delete answered 500 or with no answer shows the general failure, not the refusal', async () => {
    const answers: Handler[] = [
      () => {
        throw new TypeError('Failed to fetch')
      },
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

    // No answer, then 500.
    for (const attempt of [1, 2]) {
      await user.click(within(area).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(deleteRequests()).toBe(attempt))
      await waitFor(() => expect(within(area).getByRole('alert')).toHaveTextContent(GENERAL_FAILURE))
      expect(within(area).queryByText(REFUSAL)).not.toBeInTheDocument()
      expect(within(area).getByText('Delete “Work”? This cannot be undone.')).toBeInTheDocument()
    }
  })
})
