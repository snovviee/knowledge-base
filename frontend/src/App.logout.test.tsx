import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// features/05_logout. These tests replace fetch, so no request leaves the test
// (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const signedIn = () => json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })

// Answers like the backend for a signed-in user: the session check, the logout, and
// GET /api/csrf. The first token is the logout's; nextToken answers every later one,
// such as the token the sign-in screen gets after the logout.
function stubBackend(
  logout: () => Promise<Response>,
  nextToken: () => Promise<Response> = async () => json(200, { token: 'sign-in-token' }),
) {
  let csrfRequests = 0
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/session' && init?.method === 'DELETE') return logout()
    if (url === '/api/session') return signedIn()
    // The collections, tags, and notes areas ask for their lists (features/06_collections_crud,
    // features/08_tags_crud, features/09_notes_crud).
    if (url === '/api/collections') return json(200, { collections: [] })
    if (url === '/api/tags') return json(200, { tags: [] })
    if (url === '/api/notes') return json(200, { notes: [] })
    if (url === '/api/csrf') {
      csrfRequests += 1
      return csrfRequests === 1 ? json(200, { token: 'logout-token' }) : nextToken()
    }
    throw new Error(`unexpected request ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const loggedOut = async () => new Response(null, { status: 204 })

describe('App logout (features/05_logout)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-05 the profile area shows the display name and a Log out button', async () => {
    vi.stubGlobal(
      'fetch',
      // The collections, tags, and notes areas ask for their lists too
      // (features/06_collections_crud, features/08_tags_crud, features/09_notes_crud).
      vi.fn(async (url: string) =>
        url === '/api/collections'
          ? json(200, { collections: [] })
          : url === '/api/tags'
            ? json(200, { tags: [] })
            : url === '/api/notes'
              ? json(200, { notes: [] })
              : signedIn(),
      ),
    )

    render(<App />)

    const header = await screen.findByRole('banner')
    expect(within(header).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('AC-05 Log out sends the logout request with the CSRF token and shows the sign-in screen', async () => {
    const fetchMock = stubBackend(loggedOut)
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/session', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'logout-token' },
    })
  })

  it('AC-05 after logout the sign-in forms carry a new CSRF token, not the logout one', async () => {
    // The sign-in screen's token stays on its way until the test answers it.
    let answerToken: (res: Response) => void = () => {}
    stubBackend(loggedOut, () => new Promise<Response>((resolve) => (answerToken = resolve)))
    const user = userEvent.setup()

    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    await screen.findByRole('button', { name: 'Continue with Google' })

    // The logout's token belonged to the ended session, so no form may hold it, not
    // even while the new token is on its way.
    const tokens = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[name="authenticity_token"]')).map(
        (input) => input.value,
      )
    expect(tokens()).not.toContain('logout-token')
    answerToken(json(200, { token: 'sign-in-token' }))
    await waitFor(() => expect(tokens()).toEqual(['sign-in-token', 'sign-in-token']))
  })

  it('AC-05 Log out shows a busy state and ignores a second click', async () => {
    let answerLogout: (res: Response) => void = () => {}
    const fetchMock = stubBackend(() => new Promise<Response>((resolve) => (answerLogout = resolve)))
    const logoutRequests = () =>
      fetchMock.mock.calls.filter(([url, init]) => url === '/api/session' && init?.method === 'DELETE').length
    const user = userEvent.setup()

    render(<App />)
    const button = await screen.findByRole('button', { name: 'Log out' })
    await user.click(button)
    await user.click(button)

    await waitFor(() => expect(logoutRequests()).toBeGreaterThan(0))
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    answerLogout(new Response(null, { status: 204 }))
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(logoutRequests()).toBe(1)
  })

  it('AC-05 a logout that cannot reach the server keeps the main layout and shows the logout error', async () => {
    stubBackend(async () => {
      throw new TypeError('Failed to fetch')
    })
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log out. Try again.')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Continue with/ })).not.toBeInTheDocument()
  })

  it('AC-05 a logout the server refuses shows the logout error, and Log out again signs out', async () => {
    const answers = [json(403, { error: 'invalid_csrf_token' }), new Response(null, { status: 204 })]
    stubBackend(async () => answers.shift()!)
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log out. Try again.')
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue with/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
