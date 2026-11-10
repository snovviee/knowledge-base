import { useCallback, useEffect, useRef, useState } from 'react'
import Collections from './Collections'
import type { NamedRecord } from './NameListArea'
import Notes, { type NotesHandle } from './Notes'
import { PageErrorBoundary } from './PageError'
import ReviewReminders from './ReviewReminders'
import Tags from './Tags'
import { useNarrowScreen } from './useNarrowScreen'

// The sign-in providers, by the short name the backend puts in the address.
type SignInProvider = 'google' | 'github'
const PROVIDER_NAMES: Record<SignInProvider, string> = { google: 'Google', github: 'GitHub' }

// The panels of the bar on a narrow screen (features/25_responsive_layout question 3).
type Panel = 'collections' | 'menu'

// The bar's buttons are outlined buttons, with their hover and focus states
// (features/24_ui_states questions 3 to 5).
const BAR_BUTTON =
  'rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300'

// features/01_google_sign_in: the app checks the session before it shows anything.
type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  // features/04_session_persistence: the check failed for a reason other than
  // "not signed in", so the user may still be signed in.
  | { status: 'error' }
  | { status: 'signed-in'; displayName: string }

// The browser's IANA time zone, such as "Europe/Berlin", or undefined when it reports none.
function browserTimeZone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
}

// Asks the backend who is signed in, on page load and on "Try again". A 401 means
// signed out. Any other failure is a server error: the user may still be signed in
// (features/04_session_persistence). The check reports the browser's time zone in
// X-Time-Zone, and the server saves it, so "today" is the user's own date
// (features/12_review_interval_setting question 1). A browser that reports no zone
// sends no header.
async function fetchSession(): Promise<SessionState> {
  try {
    const timeZone = browserTimeZone()
    const res = await fetch('/api/session', timeZone ? { headers: { 'X-Time-Zone': timeZone } } : undefined)
    if (res.status === 401) return { status: 'signed-out' }
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as { user: { display_name: string } }
    return { status: 'signed-in', displayName: body.user.display_name }
  } catch {
    return { status: 'error' }
  }
}

// The page: the loading, server-error, and sign-in screens, or the main layout.
function AppPage() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  // The collections renamed in this visit, by id, so the notes show each new name with no
  // notes request (features/09_notes_crud). Every rename stays: a later one does not
  // undo an earlier one.
  const [renamedCollections, setRenamedCollections] = useState<Record<number, string>>({})
  // The tags renamed or deleted in this visit, by id: a deleted tag maps to null, so the
  // notes drop it (features/10_note_tags). Every change stays, as for collections.
  const [changedTags, setChangedTags] = useState<Record<number, string | null>>({})
  // The left area's collections and tags as it lists them, or null while a list loads or
  // cannot load. The notes filters offer them (features/17_search_and_filter question 16).
  const [collections, setCollections] = useState<NamedRecord[] | null>(null)
  const [tags, setTags] = useState<NamedRecord[] | null>(null)
  // The notes area's handle: "Open" in the review reminders panel shows a note through it
  // (features/20_realtime_notifications question 6).
  const notesRef = useRef<NotesHandle>(null)
  // Whether the notes area shows a note form: "Open" in the panel waits until it closes
  // (features/20_realtime_notifications question 9).
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  // Below 768 px the left area moves into the panels of the bar (features/25_responsive_layout).
  const narrow = useNarrowScreen()
  // The panel of the bar that is open, if any (features/25_responsive_layout question 4).
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  // When the window turns narrow, both panels start closed (features/25_responsive_layout
  // question 10). The width of the previous render is kept in state and compared while drawing,
  // React's pattern for state that follows a change, so no effect sets state.
  const [narrowBefore, setNarrowBefore] = useState(narrow)
  if (narrow !== narrowBefore) {
    setNarrowBefore(narrow)
    if (narrow) setOpenPanel(null)
  }
  // A bar button opens its panel, which closes the other one, or closes its own open panel.
  const togglePanel = (panel: Panel) => setOpenPanel((current) => (current === panel ? null : panel))
  // The notes area's sign-in callback, the same on every render. A note form and a detail
  // load their lists and their note again when it changes, and App renders again when a
  // form opens or closes (noteFormOpen).
  const notesSignedOut = useCallback(() => setSession({ status: 'signed-out' }), [])
  const renameTag = (tag: NamedRecord) => setChangedTags((current) => ({ ...current, [tag.id]: tag.name }))
  const deleteTag = (id: number) => setChangedTags((current) => ({ ...current, [id]: null }))
  const renameCollection = (collection: NamedRecord) =>
    setRenamedCollections((current) => ({ ...current, [collection.id]: collection.name }))
  // The backend sends ?sign_in_error=<provider> after a failed or cancelled sign-in
  // (google or github). The provider is read once, when the app starts, and the
  // parameter is then removed from the address.
  const [signInError] = useState<SignInProvider | null>(() => {
    const value = new URL(window.location.href).searchParams.get('sign_in_error')
    return value === 'google' || value === 'github' ? value : null
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('sign_in_error')) {
      url.searchParams.delete('sign_in_error')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  }, [])

  useEffect(() => {
    fetchSession().then(setSession)
  }, [])

  const retrySessionCheck = () => {
    setSession({ status: 'loading' })
    fetchSession().then(setSession)
  }

  // features/05_logout. The token comes from GET /api/csrf right before the logout,
  // so it belongs to this browser's current session. It is not kept for the sign-in
  // forms: the sign-in screen fetches a new one for the new session. A failed logout
  // (no answer, or any answer but 2xx) keeps the main layout, because the server may
  // still hold the sign-in.
  const logOut = async () => {
    setLoggingOut(true)
    try {
      const tokenRes = await fetch('/api/csrf')
      const { token } = (await tokenRes.json()) as { token: string }
      const res = await fetch('/api/session', { method: 'DELETE', headers: { 'X-CSRF-Token': token } })
      if (res.ok) setSession({ status: 'signed-out' })
      else setLogoutFailed(true)
    } catch {
      setLogoutFailed(true)
    } finally {
      setLoggingOut(false)
    }
  }

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

  if (session.status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <p role="alert" className="text-red-700">
            Could not reach the server. Try again.
          </p>
          <button
            type="button"
            onClick={retrySessionCheck}
            className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
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
              Sign-in with {PROVIDER_NAMES[signInError]} did not complete. Try again.
            </p>
          )}
          <div className="flex flex-col gap-3">
            <form method="post" action="/auth/google_oauth2" onSubmit={() => setSigningIn(true)}>
              <input type="hidden" name="authenticity_token" value={csrfToken ?? ''} />
              <button
                type="submit"
                disabled={signingIn}
                aria-busy={signingIn}
                className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-60"
              >
                Continue with Google
              </button>
            </form>
            <form method="post" action="/auth/github" onSubmit={() => setSigningIn(true)}>
              <input type="hidden" name="authenticity_token" value={csrfToken ?? ''} />
              <button
                type="submit"
                disabled={signingIn}
                aria-busy={signingIn}
                className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-60"
              >
                Continue with GitHub
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* On a narrow screen the header may take two lines: the name is cut with "…", and
          "Log out" shows whole (features/25_responsive_layout question 5). */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Personal Knowledge Base</h1>
        <div className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 truncate text-sm text-slate-700">{displayName}</span>
          <button
            type="button"
            onClick={logOut}
            disabled={loggingOut}
            aria-busy={loggingOut}
            className="shrink-0 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-60"
          >
            Log out
          </button>
        </div>
      </header>
      {logoutFailed && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Could not log out. Try again.
        </p>
      )}
      {narrow && (
        // The bar of a narrow screen: its buttons open the left area's panels
        // (features/25_responsive_layout question 3).
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2">
          <button
            type="button"
            aria-expanded={openPanel === 'collections'}
            onClick={() => togglePanel('collections')}
            className={BAR_BUTTON}
          >
            Collections
          </button>
          <button type="button" aria-expanded={openPanel === 'menu'} onClick={() => togglePanel('menu')} className={BAR_BUTTON}>
            Menu
          </button>
        </div>
      )}
      {/* A row on a wide screen; on a narrow one, a column, so an open panel pushes the main area down. */}
      <div className={narrow ? 'flex flex-1 flex-col' : 'flex flex-1'}>
        {/* The left area: the collections and, below them, the tags (features/08_tags_crud question 1).
            On a narrow screen each area is a panel of the bar; a closed panel is hidden, never
            unmounted, so it keeps its list and its form (features/25_responsive_layout question 4). */}
        <div
          className={narrow ? 'border-b border-slate-200' : 'w-64 border-r border-slate-200'}
          hidden={narrow && openPanel === null}
        >
          <Collections
            onSignedOut={() => setSession({ status: 'signed-out' })}
            onRenamed={renameCollection}
            onRecords={setCollections}
            hidden={narrow && openPanel !== 'collections'}
          />
          <Tags
            onSignedOut={() => setSession({ status: 'signed-out' })}
            onRenamed={renameTag}
            onDeleted={deleteTag}
            onRecords={setTags}
            hidden={narrow && openPanel !== 'menu'}
          />
        </div>
        {/* The main area: the review reminders panel above the notes area, whatever the notes
            area shows (features/20_realtime_notifications question 6). The panel owns the
            real-time connection, which lives with the main layout (features/22_websocket_auth). */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ReviewReminders
            onSignedOut={() => setSession({ status: 'signed-out' })}
            onOpen={(id) => notesRef.current?.openNote(id)}
            openDisabled={noteFormOpen}
          />
          <Notes
            ref={notesRef}
            onFormOpenChange={setNoteFormOpen}
            onSignedOut={notesSignedOut}
            renamedCollections={renamedCollections}
            changedTags={changedTags}
            collections={collections}
            tags={tags}
          />
        </div>
      </div>
    </div>
  )
}

// The whole page, inside the boundary that replaces it with the page alert when a part of it
// fails to draw (features/24_ui_states question 2).
function App() {
  return (
    <PageErrorBoundary>
      <AppPage />
    </PageErrorBoundary>
  )
}

export default App
