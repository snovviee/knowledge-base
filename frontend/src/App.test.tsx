import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

// The app asks the backend for the session before it shows anything else.
// These tests replace fetch so no request leaves the test (requirements.md section 7).
function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('App sign-in (features/01_google_sign_in)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-01 shows a loading state while the session is checked', () => {
    // A fetch that never resolves keeps the app in the loading state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('AC-01 shows the sign-in screen with Continue with Google when not signed in', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(401, { error: 'unauthenticated' }))

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  it('AC-01 Continue with Google submits a POST form with the CSRF token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    const { container } = render(<App />)

    await screen.findByRole('button', { name: 'Continue with Google' })
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/auth/google_oauth2')

    // The token arrives from GET /api/csrf after the button shows, so wait for it.
    await waitFor(() => {
      expect(form!.querySelector('input[name="authenticity_token"]')).toHaveAttribute(
        'value',
        'csrf-token-123',
      )
    })
  })

  it('AC-01 Continue with Google shows a busy state and ignores a second click', async () => {
    const submit = vi.fn((e: Event) => e.preventDefault())
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    const { container } = render(<App />)

    const button = await screen.findByRole('button', { name: 'Continue with Google' })
    container.querySelector('form')!.addEventListener('submit', submit)

    await userEvent.click(button)
    await userEvent.click(button)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('AC-02 the sign-in screen offers Continue with GitHub as a POST form with the CSRF token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    const { container } = render(<App />)

    const button = await screen.findByRole('button', { name: 'Continue with GitHub' })
    expect(button).toBeInTheDocument()
    const form = button.closest('form')
    expect(form).not.toBeNull()
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/auth/github')

    await waitFor(() => {
      expect(form!.querySelector('input[name="authenticity_token"]')).toHaveAttribute(
        'value',
        'csrf-token-123',
      )
    })
    // Google's button is still there, next to GitHub's.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(container.querySelectorAll('form')).toHaveLength(2)
  })

  it('AC-02 Continue with GitHub shows a busy state and ignores a second click', async () => {
    const submit = vi.fn((e: Event) => e.preventDefault())
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    render(<App />)

    const button = await screen.findByRole('button', { name: 'Continue with GitHub' })
    button.closest('form')!.addEventListener('submit', submit)

    await userEvent.click(button)
    await userEvent.click(button)

    expect(submit).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('AC-02 the sign-in error for GitHub names GitHub and clears the address', async () => {
    window.history.replaceState({}, '', '/?sign_in_error=github')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    render(<App />)

    expect(
      await screen.findByText('Sign-in with GitHub did not complete. Try again.'),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('')
    window.history.replaceState({}, '', '/')
  })

  it('AC-01 the sign-in error for Google names Google and clears the address', async () => {
    window.history.replaceState({}, '', '/?sign_in_error=google')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    render(<App />)

    expect(
      await screen.findByText('Sign-in with Google did not complete. Try again.'),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('')
    window.history.replaceState({}, '', '/')
  })

  it('AC-01 shows the sign-in error and removes it from the address', async () => {
    window.history.replaceState({}, '', '/?sign_in_error=google')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session') {
          return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token: 'csrf-token-123' }), { status: 200 })
      }),
    )

    render(<App />)

    expect(
      await screen.findByText('Sign-in with Google did not complete. Try again.'),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('')
    window.history.replaceState({}, '', '/')
  })

  it('AC-01 signed-in user sees the main layout with their display name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ user: { id: 1, display_name: 'Ada Lovelace' } }), {
          status: 200,
        }),
      ),
    )

    render(<App />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument()
  })

  it('AC-01 main layout shows the no collections and no notes empty states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ user: { id: 1, display_name: 'Ada Lovelace' } }), {
          status: 200,
        }),
      ),
    )

    render(<App />)

    expect(await screen.findByText('No collections yet')).toBeInTheDocument()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })
})
