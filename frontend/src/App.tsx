import { useEffect, useState } from 'react'

// features/01_google_sign_in: the app checks the session before it shows anything.
type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; displayName: string }

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  // The backend sends ?sign_in_error=google after any failed or cancelled sign-in.
  // The message is read once, then the parameter is removed from the address.
  // The address is read once, when the app starts. The flag comes from the address
  // itself, so it needs no effect to set it.
  const [signInError] = useState(
    () => new URL(window.location.href).searchParams.get('sign_in_error') === 'google',
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('sign_in_error')) {
      url.searchParams.delete('sign_in_error')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  useEffect(() => {
    fetch('/api/session')
      .then(async (res) => {
        if (!res.ok) return setSession({ status: 'signed-out' })
        const body = (await res.json()) as { user: { display_name: string } }
        setSession({ status: 'signed-in', displayName: body.user.display_name })
      })
      .catch(() => setSession({ status: 'signed-out' }))
  }, [])

  const displayName = session.status === 'signed-in' ? session.displayName : ''

  // The sign-in start is a POST form that carries this token. Only the sign-in
  // screen needs it, so it is fetched once that screen is shown.
  useEffect(() => {
    if (session.status !== 'signed-out') return
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((body: { token: string }) => setCsrfToken(body.token))
      .catch(() => setCsrfToken(null))
  }, [session.status])

  if (session.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p role="status" className="text-slate-600">
          Loading…
        </p>
      </main>
    )
  }

  if (session.status === 'signed-out') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold">Personal Knowledge Base</h1>
          {signInError && (
            <p role="alert" className="text-red-700">
              Sign-in with Google did not complete. Try again.
            </p>
          )}
          <form method="post" action="/auth/google_oauth2" onSubmit={() => setSigningIn(true)}>
            <input type="hidden" name="authenticity_token" value={csrfToken ?? ''} />
            <button
              type="submit"
              disabled={signingIn}
              aria-busy={signingIn}
              className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Personal Knowledge Base</h1>
        <span className="text-sm text-slate-700">{displayName}</span>
      </header>
      <div className="flex flex-1">
        <aside className="w-64 border-r border-slate-200 p-4">
          <h2 className="mb-2 font-semibold">Collections</h2>
          <p className="text-sm text-slate-600">No collections yet</p>
        </aside>
        <main className="flex-1 p-4">
          <h2 className="mb-2 font-semibold">Notes</h2>
          <p className="text-sm text-slate-600">No notes yet</p>
        </main>
      </div>
    </div>
  )
}

export default App
