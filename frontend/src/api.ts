// A request that changes data (features/06_collections_crud). It carries this
// session's anti-forgery token in X-CSRF-Token (features/05_logout). The token is
// fetched from GET /api/csrf right before the request, so it always belongs to the
// current session. A body, when there is one, is sent as JSON.
export async function sendWithCsrfToken(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<Response> {
  const tokenRes = await fetch('/api/csrf')
  const { token } = (await tokenRes.json()) as { token: string }
  if (body === undefined) return fetch(url, { method, headers: { 'X-CSRF-Token': token } })
  return fetch(url, {
    method,
    headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
