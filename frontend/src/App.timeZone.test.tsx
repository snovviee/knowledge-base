import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// features/12_review_interval_setting. The session check reports the browser's time
// zone, and the server saves it: "today" is the date there (spec question 1). These
// tests replace fetch, so no request leaves the test (requirements.md section 7).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Makes the browser report the given time zone, or none, as Intl reports it.
function reportTimeZone(timeZone: string | undefined) {
  const options = new Intl.DateTimeFormat().resolvedOptions()
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone,
  } as Intl.ResolvedDateTimeFormatOptions)
}

// Answers like the backend for a signed-in user, with empty lists. The first session
// check gets no answer when `firstFails` is set, so the page shows "Try again".
function stubBackend({ firstFails }: { firstFails: boolean }) {
  let sessionChecks = 0
  const lists: Record<string, unknown> = {
    '/api/collections': { collections: [] },
    '/api/tags': { tags: [] },
    '/api/notes': { notes: [] },
  }
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    if (url === '/api/session') {
      sessionChecks += 1
      if (firstFails && sessionChecks === 1) throw new TypeError('Failed to fetch')
      return json(200, { user: { id: 1, display_name: 'Ada Lovelace' } })
    }
    if (url in lists) return json(200, lists[url])
    throw new Error(`unexpected request ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App time zone (features/12_review_interval_setting)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("AC-12 the session check sends the browser's time zone in X-Time-Zone", async () => {
    reportTimeZone('Asia/Tokyo')
    const fetchMock = stubBackend({ firstFails: true })
    const user = userEvent.setup()

    const { unmount } = render(<App />)

    // The page load gets no answer, and "Try again" checks the session again.
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session')).toEqual([
      ['/api/session', { headers: { 'X-Time-Zone': 'Asia/Tokyo' } }],
      ['/api/session', { headers: { 'X-Time-Zone': 'Asia/Tokyo' } }],
    ])
    unmount()

    // A browser that reports no zone sends no header.
    reportTimeZone(undefined)
    const withoutZone = stubBackend({ firstFails: false })

    render(<App />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    const checks = withoutZone.mock.calls.filter(([url]) => url === '/api/session')
    expect(checks).toHaveLength(1)
    expect(new Headers(checks[0][1]?.headers).has('X-Time-Zone')).toBe(false)
  })
})
