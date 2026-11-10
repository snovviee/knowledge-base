# API contract

## Conventions

- **Base path.** JSON endpoints are under `/api`. The sign-in routes are under `/auth`, and they are browser redirects, not JSON. The WebSocket is at `/cable` (see [WebSocket](#websocket); AC-22).
- **Authentication.** The signed-in user is held in the session cookie `_knowledge_base_session` (`httponly`, `samesite=lax`). The cookie holds the user's id and the token of this browser's sign-in, and the server checks that the sign-in still exists (AC-05). There is no bearer token. Endpoints that need a user return 401 when no one is signed in: never signed in, logged out, or the sign-in ended (AC-05, AC-06). The WebSocket at `/cable` is authorized by the same cookie and the same check, with no token of its own (see [WebSocket](#websocket); AC-22).
- **Error body.** Every JSON error is `{ "error": "<code>" }`. The codes used: `unauthenticated` (401), `invalid_csrf_token` (403), `bad_request` (400), `not_found` (404), `collection_not_empty` (409), and `validation_failed` (422), which also has `fields`, one code per field or query parameter that breaks a rule (AC-05, AC-06, AC-07, AC-17).
- **Status codes used.** 200 for a success that answers with data: a read, an edit, or a review. 201 for a created record, and 204 with no body for a delete or a logout. 302 for every sign-in redirect. 400 for a body that is not JSON, 401 for a request with no signed-in user, 403 for a missing or wrong anti-forgery token, 404 for a record the user does not have, 409 for a delete that the rules refuse, and 422 for a request whose fields or query parameters break a rule: a name, a note's fields and tags, or the notes list's search and filters (AC-06, AC-07, AC-09, AC-10, AC-13, AC-17).
- **Session lifetime.** The session cookie expires 30 days after the last request that carries it, and each such request renews it. A cookie kept past its date gets 401 `unauthenticated` (AC-04).
- **Anti-forgery.** A request that changes data (`POST`, `PATCH`, `PUT`, `DELETE`) under `/api` sends the header `X-CSRF-Token` with the token from `GET /api/csrf` in the same session. Without it, or with another session's token, the answer is 403 `invalid_csrf_token`, and nothing changes. `GET` requests are not checked. The sign-in start routes use their own form field, `authenticity_token` (AC-05, AC-06). Logout is the exception to the order below: when no one is signed in, it answers 204 before the token is checked.
- **Order of checks.** For a request that changes data: 401 when no one is signed in, then 400 for a body that is not JSON, then 403 for the token, then 404 for a record the user does not have, then the rules of the request: 409 for a delete that they refuse, or 422 for the fields that break them. Nothing changes unless every check passes. A request refused at its write, after the checks passed, changes nothing either: a note whose collection or tag is deleted while the request runs answers 422 `not_found` for that field (AC-06, AC-07, AC-10, AC-11).
- **Dates and times.** Stored in UTC, and sent in response bodies as ISO 8601 in UTC with milliseconds, such as `2026-11-09T08:22:41.000Z` (AC-09). Review dates (`next_review_date`, `last_reviewed_date`) are calendar dates instead, with no time or zone, written `"YYYY-MM-DD"`, such as `"2026-11-16"`, in requests and in answers. A review date counts from the user's "today", the date in their saved time zone (see [domain/reviews.md](domain/reviews.md#rules)) (AC-12).
- **Note field errors.** A note create or edit that breaks a rule answers 422 with one code per field that breaks it (see [Notes](#notes)). The order of checks is the same as for collections (AC-09).
- **Caching.** Every answer of an endpoint under `/api` carries `Cache-Control: no-store`, so the browser keeps no copy of a user's data: successes (200, 201, 204) and errors (400, 401, 403, 404, 409, 422) alike, `GET /api/csrf`, `GET /api/session`, and `DELETE /api/session` included. It is set before any check runs, so the 401 and the 204 of a logout with no sign-in carry it too. The sign-in routes under `/auth` keep Rails' own headers (AC-21, spec question 3).
- **Other origins.** No answer under `/api` carries `Access-Control-Allow-Origin` or any other CORS header: CORS is off (no `rack-cors`; `backend/config/initializers/cors.rb` holds only comments). A preflight `OPTIONS` finds no route and answers 404 with no permission header, so the browser sends no request that would follow it. A page of another origin, a page on another port of the same host included, can have the browser send the user's cookie with a simple request such as `GET /api/notes`, but cannot read the answer, cannot read an anti-forgery token (so cannot change data), and cannot send the `X-Time-Zone` header. The WebSocket answers 404 to another origin (see [WebSocket](#websocket); AC-21, spec question 5).
- **Another user's records.** A request that names another user's record gets exactly the answer of a missing one, in the format of the place that names it, and nothing changes for either user: 404 `{ "error": "not_found" }` for an id in the address (collections, tags, notes, and a note's review); 422 `validation_failed` with `collection_id` or `tag_ids` `not_found` for an id in a request body; 200 `{ "notes": [] }` for a `collection_id` or `tag_id` filter; and `{ "type": "error", "error": "not_found" }` for a WebSocket ack. A user id in a body, a query, a subscription, or a message is ignored: the user always comes from the sign-in. Ids are whole numbers that count up, so a guessed id answers as a missing one. No endpoint lists users or another user's records (AC-21, spec questions 1 and 2; the format of each place is in its endpoint's entry below).

## Session

### `GET /api/csrf`

Returns this session's anti-forgery token: for the sign-in forms (AC-01), for the logout request (AC-05), and for every request that changes data (AC-06). The token is kept in the session.

- Request: no body.
- Response `200`: `{ "token": "<string>" }`. The token is the Rails form authenticity token, 86 characters.
- Errors: none.

### `GET /api/session`

Returns the signed-in user (AC-01, AC-03, AC-04, AC-05). It also saves the browser's time zone on the user (AC-12).

- Request: no body. The session cookie identifies the user. The optional header `X-Time-Zone: <IANA name>`, such as `Europe/Berlin`, names the browser's time zone; the app sends it with every session check. With someone signed in, a name the server knows is saved on the user. Any other non-empty value saves none, so the user's "today" is UTC. No header, or an empty or blank one, keeps the saved zone. The rules are in [domain/users.md](domain/users.md#rules) (AC-12).
- Response `200`: `{ "user": { "id": <integer>, "display_name": "<string>" } }`, the same with or without the header.
- Response `401`: `{ "error": "unauthenticated" }`, when no one is signed in: never signed in, logged out (AC-05), the sign-in ended after 30 days without a visit (AC-04), or the user no longer exists. Nothing is saved (AC-12).
- Errors: only the 401 above.

### `DELETE /api/session`

Logs out: ends this browser's sign-in (AC-05), and closes its WebSocket connections (AC-22).

- Request: no body. The header `X-CSRF-Token` with the token from `GET /api/csrf`, when someone is signed in.
- Response `204`: no body. The sign-in is deleted and the session is emptied, so the response sets a new, empty session cookie. After the deletion, every open WebSocket connection of that sign-in, in every tab of this browser, is closed and told not to reconnect. The same user's connections in other browsers stay open (see [WebSocket](#websocket); AC-22). When no one is signed in, the answer is also 204, with or without a token, and nothing changes: no connection is closed (AC-22).
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
  On success, each open WebSocket connection of the user receives a new `review_reminders` batch (see [WebSocket](#websocket); AC-20).
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

- Summary: `{ "id": <integer>, "title": "<string>", "status": "active" | "archived", "collection": { "id": <integer>, "name": "<string>" }, "tags": [ { "id": <integer>, "name": "<string>" } ], "review_interval": "none" | "daily" | "weekly" | "monthly" | "custom", "review_interval_days": <integer> | null, "next_review_date": "YYYY-MM-DD" | null, "last_reviewed_date": "YYYY-MM-DD" | null, "review_state": "due_today" | "overdue" | null, "created_at": "<ISO 8601>", "updated_at": "<ISO 8601>" }`. `tags` lists the note's tags in alphabetical order, ignoring case, and is `[]` for a note with none (AC-10).
- The review fields (AC-12): `review_interval_days` is a whole number from 1 to 365 when the interval is `"custom"`, else null. `next_review_date` is set exactly when the interval is not `"none"`. `last_reviewed_date` is null until the note is marked as reviewed, with [`POST /api/notes/:id/review`](#post-apinotesidreview) (AC-13). A note with no schedule has `"none"` and three nulls. The rules are in [domain/notes.md](domain/notes.md#rules) and [domain/reviews.md](domain/reviews.md).
- `review_state` (AC-15) is in the summary and so in every detail and every answer of a create, an edit, and a review: `"due_today"` for an Active note with a schedule whose `next_review_date` is the user's today, `"overdue"` when it is before today, and `null` for any other note: an archived note whatever its dates, a note with `review_interval` `"none"` (whose `next_review_date` is null), or a note dated later. `review=due_today` and `review=overdue` never list an archived note or a note with the interval `none`, and of the `review` values only `unscheduled` lists the latter (AC-18, AC-19). The rules are in [domain/reviews.md](domain/reviews.md#due-today) and [domain/reviews.md](domain/reviews.md#overdue) (AC-16).
- Detail: the summary, plus `"body": "<string>"` and `"source_url": "<string>" | null`.

### `GET /api/notes`

Lists the signed-in user's notes, newest first, by the date the note was created (AC-09).

- Request: no body. Five optional query parameters search and filter the list (AC-15, AC-16, AC-17). They combine (AND), the list stays newest first, and a parameter left out or empty (`review=`) does not filter. Values are written exactly so, in lower case.

  | Parameter | Value | Keeps |
  |---|---|---|
  | `search` | text, at most 2,000 characters after tidying | the notes whose title, body, or source URL contains it. Letter case is ignored in any alphabet, accents are kept, the ends are trimmed, each run of whitespace counts as one space, and `%` and `_` match as themselves. Only whitespace is no search (see [domain/notes.md](domain/notes.md#rules)) |
  | `collection_id` | a collection's id | the notes in that collection |
  | `tag_id` | a tag's id | the notes with that tag |
  | `status` | `active` or `archived` | the notes with that status |
  | `review` | `due_today`, `overdue`, `next_7_days`, or `unscheduled` | the notes in that review state (see [domain/reviews.md](domain/reviews.md#due-today), [overdue](domain/reviews.md#overdue), and [next 7 days and no review scheduled](domain/reviews.md#next-7-days-and-no-review-scheduled)). Due today, overdue, and next 7 days never share a note |

- Response `200`: `{ "notes": [ <summary>, ... ] }`. A `collection_id` or `tag_id` that is not the user's, that is deleted, or that is not a whole number (`999999`, `abc`, `1.5`) answers `200` `{ "notes": [] }`, so it never tells whether another user's record exists.
- Errors: `401` `unauthenticated`, checked first, whatever the parameters. `422` `{ "error": "validation_failed", "fields": { ... } }`, with every parameter that breaks a rule in one answer, in the order `search`, `status`, `review`: `search` is `too_long` (more than 2,000 characters after tidying) or `invalid` (not text, such as `search[]=rails`); `status` is `invalid` for any value but `active` and `archived` (`deleted`, `Active`); `review` is `invalid` for any other value (`soon`, `Due_Today`, `review[]=due_today`). For example `?status=deleted&review=soon` answers `{ "error": "validation_failed", "fields": { "status": "invalid", "review": "invalid" } }`. The responses and the codes are checked in `spec/requests/review_due_today_spec.rb`, `review_overdue_spec.rb`, `note_search_spec.rb`, and `note_filters_spec.rb`.

### `GET /api/notes/:id`

Returns one of the user's notes, in full (AC-09).

- Request: no body.
- Response `200`: `{ "note": <detail> }`.
- Response `404`: `{ "error": "not_found" }`, for another user's note, a deleted one, or an id that is not a number.
- Errors: `401` `unauthenticated`.

### `POST /api/notes`

Creates a note in one of the user's collections. It is `active` (AC-09).

- Request: a JSON body `{ "title": "<string>", "body": "<string>", "source_url": "<string>" | null, "collection_id": <integer>, "tag_ids": [ <integer>, ... ] }`, and the header `X-CSRF-Token`. `tag_ids` is optional: without it the note has no tags. Each id is one of the user's tags (AC-10; see [domain/notes.md](domain/notes.md#note-tags)). A `status` or a user id in the body is ignored. A title or a body that is missing or not text is `blank`; a `source_url` that is missing or null is none, and one that is not text is `invalid`; a `collection_id` that is missing or null is `blank`.
- Request, the review schedule (AC-12): the body may also hold `"review_interval"` (`"none"`, `"daily"`, `"weekly"`, `"monthly"`, or `"custom"`), `"review_interval_days"` (a JSON integer from 1 to 365, needed with `"custom"`), and `"next_review_date"` (`"YYYY-MM-DD"` or null). Without `review_interval` the interval is `"none"`. A schedule without a date, missing or null, gets the user's today plus the interval (see [domain/reviews.md](domain/reviews.md#rules)), and a given date is kept, a past one included. Ignored, whatever they hold: days with an interval other than `"custom"`, a date with `"none"`, and `last_reviewed_date`.
- Response `201`: `{ "note": <detail> }`, with the title tidied, the source URL trimmed, and the next review date of a schedule (AC-12).
  On success, each open WebSocket connection of the user receives a new `review_reminders` batch (see [WebSocket](#websocket); AC-20).
- Response `422`: `{ "error": "validation_failed", "fields": { ... } }`, naming every field that breaks a rule, with one code each. Nothing is created. The codes are:
  - `title`: `blank`, `too_long`;
  - `body`: `blank`, `too_long`;
  - `source_url`: `invalid`, `too_long`;
  - `collection_id`: `blank` (none given), or `not_found` (another user's collection, a deleted one, or a value that is not a whole number). `not_found` is the same answer for all three, so it never shows whether another user's collection exists.
  - `tag_ids`: `invalid` (a value that is not a list, null included), or `not_found` (a tag that is not one of the user's tags, another user's, a deleted one (one deleted while the request runs included), or a value that is not a whole number; the same answer for each). The same id twice counts once (AC-10).
  - `review_interval`: `invalid`, for any value but the five, null and values that are not text included (AC-12);
  - `review_interval_days`: with `"custom"`, `blank` when it is missing or null, and `invalid` for anything but a JSON integer from 1 to 365, such as `0`, `366`, `1.5`, `7.0`, or `"7"` (AC-12);
  - `next_review_date`: with a schedule, `invalid` for anything but text `YYYY-MM-DD` that names a real date, such as `"20261109"`, `"2026-02-30"`, `"tomorrow"`, or `""`. No date is computed in its place (AC-12).
- Errors: `401` `unauthenticated`; `400` `bad_request`, when the body is not JSON; `403` `invalid_csrf_token`.

### `PATCH /api/notes/:id`

Changes the fields the request sends, and no others. `PUT` to the same path does the same (AC-09, spec question 9). A `collection_id` moves the note to another of the user's collections (AC-11).

- Request: a JSON body with any of `title`, `body`, `source_url`, `status` (`"active"` or `"archived"`), `collection_id` (AC-11), `tag_ids` (AC-10), and the header `X-CSRF-Token`. A `tag_ids` sent is the whole set of the note's tags; an empty list removes every tag, and without `tag_ids` the tags stay as they are. An archive sends `{ "status": "archived" }` and a restore `{ "status": "active" }`. A move sends `{ "collection_id": <integer> }`, the id of one of the user's collections; without `collection_id` the note stays in its collection. The rules of a move are in [domain/notes.md](domain/notes.md#rules) (AC-11).
- Request, the review schedule (AC-12): `review_interval`, `review_interval_days`, and `next_review_date`, as for `POST`, each changed only when the body has it. The interval after the edit decides: days count only for a note whose interval is then `"custom"`, and a date only for a note with a schedule. An edit that sends only `review_interval` keeps the date, or gives a note that had `"none"` today plus the interval. `"next_review_date": null` restarts the schedule from today. `"none"` removes the date and the days, and keeps `last_reviewed_date`. A note changed to `"custom"` needs its days. `last_reviewed_date` is ignored.
- Response `200`: `{ "note": <detail> }`. Archiving an archived note, or restoring an active one, answers `200` and changes nothing. A change of tags changes the note's `updated_at`; the same set changes nothing (AC-10). A move answers with the note's new `collection` and changes its `updated_at`; the note's own collection changes nothing (AC-11).
  On success, each open WebSocket connection of the user receives a new `review_reminders` batch (see [WebSocket](#websocket); AC-20).
- Response `422`: `{ "error": "validation_failed", "fields": { ... } }`, with the codes for `title`, `body`, and `source_url` as for `POST`, and `status`: `invalid` for any other value. `tag_ids` has the codes of `POST`: `invalid` for a value that is not a list, null included, and `not_found` for a tag that is not one of the user's tags, the same answer for another user's tag, a deleted one (one deleted while the request runs included), and a value that is not a whole number (AC-10). The review fields have the codes of `POST` (AC-12). Nothing changes: not the fields the request sent, and not the tags. For a move, `collection_id` is `blank` when it is null, and `not_found` for another user's collection, a deleted one (one deleted while the request runs included), or a value that is not a whole number: the same answer for each. A move sent with other fields that break a rule names every field (AC-11).
- Response `404`: `{ "error": "not_found" }`, for another user's note, a deleted one, or an id that is not a number. Nothing changes.
- Errors: `401`, `400`, and `403`, as for `POST`.

### `DELETE /api/notes/:id`

Deletes the user's note for good (AC-09).

- Request: no body, and the header `X-CSRF-Token`.
- Response `204`: no body. The note is gone from the list.
  On success, each open WebSocket connection of the user receives a new `review_reminders` batch (see [WebSocket](#websocket); AC-20).
- Response `404`: `{ "error": "not_found" }`, as for `PATCH`.
- Errors: `401` and `403`, as for `POST`.

### `POST /api/notes/:id/review`

Marks one of the user's notes as reviewed: its `last_reviewed_date` becomes the user's today (AC-13), and its `next_review_date` today plus its interval (AC-14). The rules are in [domain/reviews.md](domain/reviews.md#marking-a-note-as-reviewed), and the new next review date in [domain/reviews.md](domain/reviews.md#the-next-review-date-after-a-review).

- Request: no body, and the header `X-CSRF-Token`. A JSON body is ignored, whatever it holds: no field it sends changes the note, `last_reviewed_date` included.
- Response `200`: `{ "note": <detail> }`, the same as `GET /api/notes/:id` answers right after, with `"last_reviewed_date"` the user's today and `"next_review_date"` recalculated from it: today plus the interval the note has, both `"YYYY-MM-DD"`, or `null` for the interval `"none"` (AC-14). No other field changes, `updated_at` included. Any of the user's notes can be marked, archived ones and ones with the interval `"none"` included; an archived note gets its new date and stays `"archived"` (AC-14). A second review on the same day answers the same note and changes nothing.
  On success, each open WebSocket connection of the user receives a new `review_reminders` batch (see [WebSocket](#websocket); AC-20).
- Response `404`: `{ "error": "not_found" }`, for another user's note, a deleted one, or an id that is not a number. Nothing changes.
- Errors: `401` `unauthenticated`; `400` `bad_request`, when the body is not JSON; `403` `invalid_csrf_token`. They come in the order of every request that changes data (see Conventions): 401, then 400, then 403, then 404. A refused request changes nothing: neither `last_reviewed_date` nor `next_review_date` (AC-14).

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

## Health check

### `GET /up`

The Rails health check: it answers whether the app booted. It needs no sign-in and no token, and it is not under `/api` (AC-28, found in Polish).

- Request: none.
- Response `200`: a page with a green background (HTML, not JSON), when the app booted with no exceptions.
- Response `500`: when it did not.

## WebSocket

The app keeps one WebSocket connection open in each tab that shows the main layout (AC-22). It carries the review reminders (AC-20). The client sends one message that changes what the server does, the `ack` of a reminder (AC-23). The rules of a connection's sign-in are in [domain/users.md](domain/users.md#rules).

### Connection

- **Address.** `/cable` on the app's own host: `ws://localhost:3000/cable` locally, and `wss://` when the page is served over `https` (AC-22).
- **Protocol.** Action Cable's JSON protocol, with the subprotocol `actioncable-v1-json`. Each message is one JSON text frame. An identifier is a JSON object written as text inside the message, such as `"{\"channel\":\"ReviewRemindersChannel\"}"` (AC-22).
- **Authentication.** The session cookie that the browser sends with the connection request must name a live sign-in, checked as for the HTTP API (see [Conventions](#conventions): Authentication, Session lifetime): a sign-in that logout has not ended, in a cookie that the app made, unchanged and within its 30 days. The server takes the user and the sign-in only from that cookie. There is no token and no user id in the address, in a subscription, or in a message, and a parameter that names a user, such as `/cable?user_id=2` or `"user_id":2` in an identifier, is ignored (AC-22).
- **Origin.** Only pages of the app's own origin may connect: the request's `Origin` header must have the request's own scheme, host, and port, `http://localhost:3000` locally. A connection request from another origin, or with no `Origin` header, is answered `404` with `content-type: text/plain; charset=utf-8` and the body `Page not found`, and no connection opens. The origin is checked before the cookie, so this answer is the same whether or not the cookie names a live sign-in. A request to `/cable` that is not a WebSocket connection request, such as a plain `GET`, gets the same answer. These answers are not the API's JSON error body, because `/cable` is not under `/api` (AC-22).
- **No anti-forgery token.** Commands on the connection carry no token, because only the app's own pages can open it (AC-22).
- **Refusal.** A connection request of the app's own origin with no live sign-in opens, receives the one message `{"type":"disconnect","reason":"unauthorized","reconnect":false}`, and is closed by the server. It receives no `welcome`, and no subscription is accepted. This covers a browser that never signed in, a logout, a cookie past its 30 days, a kept copy of a cookie whose sign-in has ended, and a cookie that the app did not make or that was changed (AC-22).
- **Logout.** `DELETE /api/session` closes every open connection of the sign-in it ends, in every tab of that browser, after the sign-in is deleted: each receives `{"type":"disconnect","reason":"remote","reconnect":false}` and is closed. The same user's connections in other browsers stay open. A logout with no sign-in closes nothing (AC-22).
- **The sign-in is checked again.** Before the server handles each command a client sends, and before it sends each message to a subscriber, it checks that the connection's sign-in still exists. When it does not, the command is not handled, the message is not sent, and the connection is closed with `{"type":"disconnect","reason":"unauthorized","reconnect":false}` (AC-22).
- **`reconnect`.** `"reconnect": false` tells the client not to connect again, because its sign-in has ended. The app then shows the sign-in screen ([conventions: Sign-in ended](conventions.md#ui)). Action Cable's other closes are not the end of a sign-in: `{"type":"disconnect","reason":"server_restart","reconnect":true}` when the server restarts, and a connection that drops with no message (AC-22).

### Server → client messages

| Message | Sent |
|---|---|
| `{"type":"welcome"}` | Once, when the server accepts the connection. The client sends nothing before it. |
| `{"type":"ping","message":<integer>}` | Every 3 seconds while the connection is open. `message` is the server's time in Unix seconds, such as `1794259356`. |
| `{"identifier":"<identifier>","type":"confirm_subscription"}` | When a subscription is accepted. `identifier` is the subscription's identifier as the client sent it. |
| `{"identifier":"<identifier>","message":{"type":"review_reminders","reminders":[...]}}` | A review reminders batch, on a subscription to `ReviewRemindersChannel` (see [`ReviewRemindersChannel`](#reviewreminderschannel)). |
| `{"identifier":"<identifier>","message":{"type":"error","error":"invalid"}}` or `..."error":"not_found"...` | The answer to a message of the client that is not accepted, to the sender only (see [`ack`](#ack)). |
| `{"type":"disconnect","reason":"unauthorized","reconnect":false}` | For a refused connection, and for a connection whose sign-in is gone. The server then closes the connection. |
| `{"type":"disconnect","reason":"remote","reconnect":false}` | For a connection whose sign-in a logout ended. The server then closes the connection. |

### Client → server commands

Each command names a subscription by its identifier.

| Command | Message |
|---|---|
| Subscribe | `{"command":"subscribe","identifier":"{\"channel\":\"ReviewRemindersChannel\"}"}` |
| Unsubscribe | `{"command":"unsubscribe","identifier":"{\"channel\":\"ReviewRemindersChannel\"}"}` |
| Message | `{"command":"message","identifier":"{\"channel\":\"ReviewRemindersChannel\"}","data":"<the message as JSON text>"}` |

The app sends one `subscribe`, right after the `welcome`, and a `message` for each "Dismiss" (AC-22, AC-23).

### `ReviewRemindersChannel`

The signed-in user's review reminders (AC-22).

- Identifier: `{"channel":"ReviewRemindersChannel"}`.
- Subscribe: every subscription on a live connection is confirmed, for the connection's own user, with `{"identifier":"{\"channel\":\"ReviewRemindersChannel\"}","type":"confirm_subscription"}`. Other keys in the identifier are ignored: `{"channel":"ReviewRemindersChannel","user_id":2}` is confirmed with that identifier, and it is still the connection user's subscription (AC-22).
- Messages to the client: the batch, one message of the type `review_reminders` that holds the whole current list of the user's review reminders (AC-20):

  ```json
  {
    "identifier": "{\"channel\":\"ReviewRemindersChannel\"}",
    "message": {
      "type": "review_reminders",
      "reminders": [
        { "type": "review_overdue", "note_id": 12, "title": "Old idea", "collection_name": "Work", "next_review_date": "2026-11-02", "review_state": "overdue" },
        { "type": "review_due_today", "note_id": 7, "title": "Rails tips", "collection_name": "Books", "next_review_date": "2026-11-09", "review_state": "due_today" }
      ]
    }
  }
  ```

  - A reminder: `type` is `"review_due_today"` or `"review_overdue"`; `note_id` is the note's id; `title` and `collection_name` are the note's title and its collection's name when the batch is made; `next_review_date` is `"YYYY-MM-DD"`; `review_state` is `"due_today"` or `"overdue"`, the note's `review_state` in the notes API. The fields and the rules are in [domain/notifications.md](domain/notifications.md).
  - The reminders come in order of next review date, the oldest first, and notes with the same date in the order they were created. No batch holds an archived note, a note with the interval `none`, or another user's note, whatever its dates (AC-18, AC-19); an archive or a restore of a note, and a save that sets its interval to `none`, is one of the changes that send a new batch ([domain/reviews.md](domain/reviews.md#no-reminders-for-archived-notes-and-notes-with-no-schedule)). A batch with no reminders is `"reminders": []`.
  - Sent: at once, when the subscription is accepted (the batch may arrive before the `confirm_subscription` message); every 60 seconds while the subscription lives (`ReviewRemindersChannel::CHECK_INTERVAL`), whether or not anything changed; and right after a change that a batch shows: each success of `POST /api/notes`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`, `POST /api/notes/:id/review`, and `PATCH /api/collections/:id` sends the user's new batch to each of their open connections. A change made outside these requests shows at the next 60-second check.
  - Each batch is the whole current list, so the client replaces its list with it (duplicate prevention: [domain/notifications.md](domain/notifications.md#rules)).
- Actions: `ack` (and `perform_action`, which Action Cable dispatches through and which answers `invalid` when named by a client). Any message of another action, with no action, or with `data` that is not a JSON object answers `invalid` (AC-23).

#### `ack`

Dismisses a reminder: the server stops sending it while the note keeps that next review date (AC-23).

```json
{"command":"message","identifier":"{\"channel\":\"ReviewRemindersChannel\"}","data":"{\"action\":\"ack\",\"note_id\":7,\"next_review_date\":\"2026-11-09\"}"}
```

- `data` is JSON text of an object: `action` is `"ack"`, `note_id` is a JSON whole number (not text, not `7.0`), and `next_review_date` is a real date written `"YYYY-MM-DD"` (`"2026-02-30"` is not). The user comes only from the connection, never from the message.
- Accepted: the ack names a current reminder of the user, one that a batch sent now would hold, with that date. The sender receives no answer. The server records a dismissal ([domain/notifications.md](domain/notifications.md#review-dismissal)) and sends the user's new batch, without that reminder, to each of the user's open connections at once. Every later batch leaves it out while the note's next review date stays the same. The same ack again is accepted too.
- `{"identifier":"{\"channel\":\"ReviewRemindersChannel\"}","message":{"type":"error","error":"invalid"}}`: the ack is not well-formed, or the message is not an ack: another action (`{"action":"snooze"}`), no action, `data` that is not a JSON object, or `data` that is not JSON at all (`"not json"`). Nothing is recorded.
- `{"identifier":"{\"channel\":\"ReviewRemindersChannel\"}","message":{"type":"error","error":"not_found"}}`: no current reminder of the user has that note and date: another user's note, a missing note, an archived or unscheduled note, a note not due yet, a reminder that has moved on (a review or an edit changed the date), or a date that is not the note's. Nothing is recorded. Another user's note answers like a missing one.
- `invalid` is checked first. An error answer goes only to the sender, sends no batch, and leaves the connection open.
