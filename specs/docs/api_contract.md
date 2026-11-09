# API contract

## Conventions

- **Base path.** JSON endpoints are under `/api`. The sign-in routes are under `/auth`, and they are browser redirects, not JSON.
- **Authentication.** The signed-in user is held in the session cookie `_knowledge_base_session` (`httponly`, `samesite=lax`). The cookie holds only the user's id. There is no bearer token. Endpoints that need a user return 401 when no user is signed in.
- **Error body.** Every JSON error is `{ "error": "<code>" }`. The codes used so far: `unauthenticated` (401).
- **Status codes used.** 200 for a successful read. 401 for a request with no signed-in user. 302 for every sign-in redirect.
- **Dates and times.** Stored in UTC. Not yet present in any response body.

## Session

### `GET /api/csrf`

Returns a token for the sign-in form. The token is kept in the session (AC-01).

- Request: no body.
- Response `200`: `{ "token": "<string>" }`. The token is the Rails form authenticity token, 86 characters.
- Errors: none.

### `GET /api/session`

Returns the signed-in user (AC-01, AC-03, AC-04).

- Request: no body. The session cookie identifies the user.
- Response `200`: `{ "user": { "id": <integer>, "display_name": "<string>" } }`.
- Response `401`: `{ "error": "unauthenticated" }`, when no user is signed in or the session's user no longer exists.
- Errors: only the 401 above.

## Google sign-in

These routes are browser redirects. They have no JSON body, so the error body does not apply. Each failure ends in the same redirect (AC-01).

### `POST /auth/google_oauth2`

Starts a sign-in with Google (AC-01).

- Request: a form POST with the field `authenticity_token`, which must match the token from `GET /api/csrf` in the same session.
- Response `302`: to Google's sign-in page, with a `state` value stored in the session.
- Response `302` to `/?sign_in_error=google`: when the token is missing or does not match. Google is not contacted.

### `GET /auth/google_oauth2/callback`

Google returns here after the user approves or cancels (AC-01, AC-03).

- Request: the query string Google sends (`code`, `state`, or `error`). OmniAuth checks `state` before any token exchange.
- Response `302` to `/`, with the user signed in: after a successful sign-in. The user record is created on the first sign-in and found on later ones (AC-03).
- Response `302` to `/?sign_in_error=google`: when the user cancels at Google, Google reports an error, the `state` does not match the one stored in this session (`csrf_detected`), or Google cannot be reached. The provider's error text is not passed on.

Logging: the callback's `code` and `state` are filtered from the request log (`backend/config/initializers/filter_parameter_logging.rb`). They appear as `[FILTERED]`.

## GitHub sign-in

These routes are browser redirects, like the Google ones. Each failure ends in the same redirect, with `github` in the address (AC-02).

### `POST /auth/github`

Starts a sign-in with GitHub (AC-02).

- Request: a form POST with the field `authenticity_token`, which must match the token from `GET /api/csrf` in the same session.
- Response `302`: to `https://github.com/login/oauth/authorize`, requesting the `user:email` scope, with a `state` value stored in the session.
- Response `302` to `/?sign_in_error=github`: when the token is missing or does not match. GitHub is not contacted.

### `GET /auth/github/callback`

GitHub returns here after the user approves or cancels (AC-02, AC-03).

- Request: the query string GitHub sends (`code`, `state`, or `error`). OmniAuth checks `state` before any token exchange.
- Response `302` to `/`, with the user signed in: after a successful sign-in. The user record is created on the first sign-in and found on later ones (AC-02, AC-03). A GitHub account with no email signs in without one.
- Response `302` to `/?sign_in_error=github`: when the user cancels at GitHub, GitHub reports an error, the `state` does not match the one stored in this session (`csrf_detected`), or GitHub cannot be reached. The provider's error text is not passed on.

Logging: as for the Google callback above, `code` and `state` appear as `[FILTERED]`.

## WebSocket

None in feature 01. The WebSocket connection, its channels, and its messages are defined by feature 22 and later.
