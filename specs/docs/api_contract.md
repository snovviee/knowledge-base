# API contract

## Conventions

- **Base path.** JSON endpoints are under `/api`. The sign-in routes are under `/auth`, and they are browser redirects, not JSON.
- **Authentication.** The signed-in user is held in the session cookie `_knowledge_base_session` (`httponly`, `samesite=lax`). The cookie holds the user's id and the token of this browser's sign-in, and the server checks that the sign-in still exists (AC-05). There is no bearer token. Endpoints that need a user return 401 when no one is signed in: never signed in, logged out, or the sign-in ended (AC-05, AC-06).
- **Error body.** Every JSON error is `{ "error": "<code>" }`. The codes used: `unauthenticated` (401), `invalid_csrf_token` (403), `bad_request` (400), `not_found` (404), `collection_not_empty` (409), and `validation_failed` (422), which also has `fields`, one code per field (AC-05, AC-06, AC-07).
- **Status codes used.** 200 for a successful read, 201 for a created record, and 204 with no body for a delete or a logout. 302 for every sign-in redirect. 400 for a body that is not JSON, 401 for a request with no signed-in user, 403 for a missing or wrong anti-forgery token, 404 for a record the user does not have, 409 for a delete that the rules refuse, and 422 for a name that breaks a rule (AC-07).
- **Session lifetime.** The session cookie expires 30 days after the last request that carries it, and each such request renews it. A cookie kept past its date gets 401 `unauthenticated` (AC-04).
- **Anti-forgery.** A request that changes data (`POST`, `PATCH`, `PUT`, `DELETE`) under `/api` sends the header `X-CSRF-Token` with the token from `GET /api/csrf` in the same session. Without it, or with another session's token, the answer is 403 `invalid_csrf_token`, and nothing changes. `GET` requests are not checked. The sign-in start routes use their own form field, `authenticity_token` (AC-05, AC-06). Logout is the exception to the order below: when no one is signed in, it answers 204 before the token is checked.
- **Order of checks.** For a request that changes data: 401 when no one is signed in, then 400 for a body that is not JSON, then 403 for the token, then 404 for a record the user does not have, then 422 for a name that breaks a rule. Nothing changes unless every check passes (AC-06).
- **Dates and times.** Stored in UTC, and sent in response bodies as ISO 8601 in UTC with milliseconds, such as `2026-11-09T08:22:41.000Z` (AC-09).
- **Note field errors.** A note create or edit that breaks a rule answers 422 with one code per field that breaks it (see [Notes](#notes)). The order of checks is the same as for collections (AC-09).

## Session

### `GET /api/csrf`

Returns this session's anti-forgery token: for the sign-in forms (AC-01), for the logout request (AC-05), and for every request that changes data (AC-06). The token is kept in the session.

- Request: no body.
- Response `200`: `{ "token": "<string>" }`. The token is the Rails form authenticity token, 86 characters.
- Errors: none.

### `GET /api/session`

Returns the signed-in user (AC-01, AC-03, AC-04, AC-05).

- Request: no body. The session cookie identifies the user.
- Response `200`: `{ "user": { "id": <integer>, "display_name": "<string>" } }`.
- Response `401`: `{ "error": "unauthenticated" }`, when no one is signed in: never signed in, logged out (AC-05), the sign-in ended after 30 days without a visit (AC-04), or the user no longer exists.
- Errors: only the 401 above.

### `DELETE /api/session`

Logs out: ends this browser's sign-in (AC-05).

- Request: no body. The header `X-CSRF-Token` with the token from `GET /api/csrf`, when someone is signed in.
- Response `204`: no body. The sign-in is deleted and the session is emptied, so the response sets a new, empty session cookie. When no one is signed in, the answer is also 204, with or without a token, and nothing changes.
- Response `403`: `{ "error": "invalid_csrf_token" }`, when someone is signed in and the token is missing or is not this session's. The sign-in stays.
- Errors: only the 403 above.

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
- Response `302` to `/`, with the user signed in: after a successful sign-in. The user record is created on the first sign-in and found on later ones (AC-03). Two sign-ins for the same new account that finish at the same time both get this response, with one record created (AC-03).
- Response `302` to `/?sign_in_error=google`: when the user cancels at Google, Google reports an error, the `state` does not match the one stored in this session (`csrf_detected`), or Google cannot be reached. The provider's error text is not passed on. It also applies when Google sends no name and no login for the account, since no record can be stored without a display name (AC-03).

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
- Response `302` to `/`, with the user signed in: after a successful sign-in. The user record is created on the first sign-in and found on later ones (AC-02, AC-03). A GitHub account with no email signs in without one. Two sign-ins for the same new account that finish at the same time both get this response, with one record created (AC-03).
- Response `302` to `/?sign_in_error=github`: when the user cancels at GitHub, GitHub reports an error, the `state` does not match the one stored in this session (`csrf_detected`), or GitHub cannot be reached. The provider's error text is not passed on. It also applies when GitHub sends no name and no login for the account. GitHub always sends a login, so in practice this does not happen (AC-03).

Logging: as for the Google callback above, `code` and `state` appear as `[FILTERED]`.

## Collections

The signed-in user's collections (AC-06). Every endpoint needs a sign-in. Requests that change data also need the anti-forgery header (see Conventions). The name rules, including tidying, length, and case, are in [domain/collections.md](domain/collections.md).

### `GET /api/collections`

Lists the signed-in user's collections (AC-06).

- Request: no body.
- Response `200`: `{ "collections": [ { "id": <integer>, "name": "<string>" } ] }`, in alphabetical order, ignoring case.
- Errors: `401` `unauthenticated`.

### `POST /api/collections`

Creates a collection (AC-06).

- Request: a JSON body `{ "name": "<string>" }`, and the header `X-CSRF-Token`. A name that is missing or not text counts as `blank`.
- Response `201`: `{ "collection": { "id": <integer>, "name": "<string>" } }`, with the name as tidied.
- Response `422`: `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }`. Nothing is created.
- Errors: `401` `unauthenticated`; `400` `bad_request`, when the body is not JSON; `403` `invalid_csrf_token`.

### `PATCH /api/collections/:id`

Renames a collection (AC-06). `PUT` to the same path does the same.

- Request: a JSON body `{ "name": "<string>" }`, and the header `X-CSRF-Token`.
- Response `200`: `{ "collection": { "id": <integer>, "name": "<string>" } }`.
- Response `422`: `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }`. The name is unchanged.
- Response `404`: `{ "error": "not_found" }`, for another user's collection, a missing one, or an id that is not a number. Nothing changes.
- Errors: `401`, `400`, and `403`, as for `POST`.

### `DELETE /api/collections/:id`

Deletes a collection (AC-06).

- Request: no body, and the header `X-CSRF-Token`.
- Response `204`: no body. A collection with no notes is deleted (AC-06, AC-07).
- Response `409`: `{ "error": "collection_not_empty" }`, when the collection has notes, archived notes included. Nothing changes: the collection and its notes stay. The rule is in [domain/collections.md](domain/collections.md) (AC-07).
- Response `404`: `{ "error": "not_found" }`, as for `PATCH`. A collection deleted in another tab also answers 404.
- Errors: `401` and `403`, as for `POST`. The checks come in this order: 401, then 403, then 404, then 409, so a refusal for notes is never given for a collection that is not the user's (AC-07).

## Notes

The signed-in user's notes (AC-09). Every endpoint needs a sign-in. Requests that change data also need the anti-forgery header (see Conventions). The rules for a note's fields and its tags are in [domain/notes.md](domain/notes.md).

A note's list entry holds the summary fields. Its detail holds the same plus `body` and `source_url`:

- Summary: `{ "id": <integer>, "title": "<string>", "status": "active" | "archived", "collection": { "id": <integer>, "name": "<string>" }, "tags": [ { "id": <integer>, "name": "<string>" } ], "created_at": "<ISO 8601>", "updated_at": "<ISO 8601>" }`. `tags` lists the note's tags in alphabetical order, ignoring case, and is `[]` for a note with none (AC-10).
- Detail: the summary, plus `"body": "<string>"` and `"source_url": "<string>" | null`.

### `GET /api/notes`

Lists the signed-in user's notes, newest first, by the date the note was created (AC-09).

- Request: no body.
- Response `200`: `{ "notes": [ <summary>, ... ] }`.
- Errors: `401` `unauthenticated`.

### `GET /api/notes/:id`

Returns one of the user's notes, in full (AC-09).

- Request: no body.
- Response `200`: `{ "note": <detail> }`.
- Response `404`: `{ "error": "not_found" }`, for another user's note, a deleted one, or an id that is not a number.
- Errors: `401` `unauthenticated`.

### `POST /api/notes`

Creates a note in one of the user's collections. It is `active` (AC-09).

- Request: a JSON body `{ "title": "<string>", "body": "<string>", "source_url": "<string>" | null, "collection_id": <integer>, "tag_ids": [ <integer>, ... ] }`, and the header `X-CSRF-Token`. `tag_ids` is optional: without it the note has no tags. Each id is one of the user's tags (AC-10; see [domain/notes.md](domain/notes.md#note-tags)). A `status` or a user id in the body is ignored. A title or a body that is missing or not text is `blank`; a `source_url` that is missing or null is none, and one that is not text is `invalid`; a `collection_id` that is missing or null is `blank`.
- Response `201`: `{ "note": <detail> }`, with the title tidied and the source URL trimmed.
- Response `422`: `{ "error": "validation_failed", "fields": { ... } }`, naming every field that breaks a rule, with one code each. Nothing is created. The codes are:
  - `title`: `blank`, `too_long`;
  - `body`: `blank`, `too_long`;
  - `source_url`: `invalid`, `too_long`;
  - `collection_id`: `blank` (none given), or `not_found` (another user's collection, a deleted one, or a value that is not a whole number). `not_found` is the same answer for all three, so it never shows whether another user's collection exists.
  - `tag_ids`: `invalid` (a value that is not a list), or `not_found` (a tag that is not one of the user's tags, another user's, a deleted one, or a value that is not a whole number; the same answer for each). The same id twice counts once (AC-10).
- Errors: `401` `unauthenticated`; `400` `bad_request`, when the body is not JSON; `403` `invalid_csrf_token`.

### `PATCH /api/notes/:id`

Changes the fields the request sends, and no others. `PUT` to the same path does the same (AC-09, spec question 9).

- Request: a JSON body with any of `title`, `body`, `source_url`, `status` (`"active"` or `"archived"`), `tag_ids` (AC-10), and the header `X-CSRF-Token`. A `tag_ids` sent is the whole set of the note's tags; an empty list removes every tag, and without `tag_ids` the tags stay as they are. An archive sends `{ "status": "archived" }` and a restore `{ "status": "active" }`. A `collection_id` in the body is ignored: moving a note is AC-11.
- Response `200`: `{ "note": <detail> }`. Archiving an archived note, or restoring an active one, answers `200` and changes nothing. A change of tags changes the note's `updated_at`; the same set changes nothing (AC-10).
- Response `422`: `{ "error": "validation_failed", "fields": { ... } }`, with the codes for `title`, `body`, and `source_url` as for `POST`, and `status`: `invalid` for any other value. Nothing changes.
- Response `404`: `{ "error": "not_found" }`, for another user's note, a deleted one, or an id that is not a number. Nothing changes.
- Errors: `401`, `400`, and `403`, as for `POST`.

### `DELETE /api/notes/:id`

Deletes the user's note for good (AC-09).

- Request: no body, and the header `X-CSRF-Token`.
- Response `204`: no body. The note is gone from the list.
- Response `404`: `{ "error": "not_found" }`, as for `PATCH`.
- Errors: `401` and `403`, as for `POST`.

## Tags

The signed-in user's tags (AC-08). The shape is the same as for collections (see Collections). Every endpoint needs a sign-in. Requests that change data also need the anti-forgery header (see Conventions). The name rules are in [domain/tags.md](domain/tags.md). Tags add no error or status codes of their own.

### `GET /api/tags`

Lists the signed-in user's tags (AC-08).

- Request: no body.
- Response `200`: `{ "tags": [ { "id": <integer>, "name": "<string>" } ] }`, in alphabetical order, ignoring case.
- Errors: `401` `unauthenticated`.

### `POST /api/tags`

Creates a tag (AC-08).

- Request: a JSON body `{ "name": "<string>" }`, and the header `X-CSRF-Token`. A name that is missing or not text counts as `blank`.
- Response `201`: `{ "tag": { "id": <integer>, "name": "<string>" } }`, with the name as tidied.
- Response `422`: `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }`. Nothing is created.
- Errors: `401` `unauthenticated`; `400` `bad_request`, when the body is not JSON; `403` `invalid_csrf_token`.

### `PATCH /api/tags/:id`

Renames a tag (AC-08). `PUT` to the same path does the same.

- Request: a JSON body `{ "name": "<string>" }`, and the header `X-CSRF-Token`.
- Response `200`: `{ "tag": { "id": <integer>, "name": "<string>" } }`.
- Response `422`: `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }`. The name is unchanged.
- Response `404`: `{ "error": "not_found" }`, for another user's tag, a missing one, or an id that is not a number. Nothing changes.
- Errors: `401`, `400`, and `403`, as for `POST`.

### `DELETE /api/tags/:id`

Deletes a tag (AC-08).

- Request: no body, and the header `X-CSRF-Token`.
- Response `204`: no body. The tag is deleted, with its links to notes, and no note is deleted (see the rule in [domain/tags.md](domain/tags.md); AC-10).
- Response `404`: `{ "error": "not_found" }`, as for `PATCH`. A tag deleted in another tab also answers 404.
- Errors: `401` and `403`.

## WebSocket

None in feature 01. The WebSocket connection, its channels, and its messages are defined by feature 22 and later.
