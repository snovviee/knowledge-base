# Feature: 21_data_privacy

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-21: Data is private per user and cannot be accessed cross-account

Sources: requirements.md 1 (a private workspace; each user reaches only their own data; no sharing of any kind), 3.1 (no account linking), 3.7 (review notifications; the client → server message), 5 (authorization for every operation on collections, tags, notes, review reminders, and notification acknowledgements; authorization on WebSocket connections and notification delivery; a user never receives another user's data or notifications), 6 (sample data belongs to the authenticated user), 7 (a user cannot access another user's collections, tags, notes, or reminders; the README explains known limitations); [docs/api_contract.md](../../docs/api_contract.md#conventions) (Conventions: Authentication, Error body, Anti-forgery, Order of checks; Notes: a user id in the body is ignored); [docs/domain/users.md](../../docs/domain/users.md#rules) (Rules: identity, no account linking, logout ends only this browser's sign-in); [docs/domain/collections.md](../../docs/domain/collections.md#rules), [docs/domain/tags.md](../../docs/domain/tags.md#rules), and [docs/domain/notes.md](../../docs/domain/notes.md#rules) (a user reaches only their own records); [docs/conventions.md](../../docs/conventions.md#ui) (UI: Sign-in ended, Logout); [features/05_logout/spec.md](../05_logout/spec.md) (question 5; the edge case of a tab left open), [features/10_note_tags/spec.md](../10_note_tags/spec.md) (question 5), [features/11_note_move/spec.md](../11_note_move/spec.md) (question 2), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1, 19: the time zone saved on the account), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 5), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) to [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (review states, search, and filters; feature 17 question 9), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (questions 1, 5, 8, 10), [features/22_websocket_auth/spec.md](../22_websocket_auth/spec.md) (questions 1 to 6), [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (questions 2, 3), and [features/26_local_run/spec.md](../26_local_run/spec.md) (sample data), not yet in `docs/`.

Not part of this feature: how the WebSocket connection is authorized (AC-22, feature 22), and what a batch holds and what an ack changes (AC-20, AC-23, features 20 and 23). This feature checks, across the whole app, that none of them crosses accounts.

## Questions

1. Does feature 06's rule that another user's record answers like a missing one (its question 3) apply to every area, later ones included: tags on notes, moves, reviews, filters, notifications, and WebSocket messages?
   - Options: yes, everywhere (recommended: later features need this rule); other options: TBD (the research names none).
   - Answer: yes. Any id in the address, the request body, a query parameter, or a WebSocket message that names another user's record gets exactly the answer of a missing record, in that feature's own format, and nothing changes for either user. The formats are: 404 `{ "error": "not_found" }` for an id in the address (features 06, 08, 09, 13); 422 `{ "error": "validation_failed", "fields": { ... } }` with `collection_id` or `tag_ids` `not_found` for an id in a request body (features 09, 10, 11); 200 `{ "notes": [] }` for a `collection_id` or `tag_id` filter (feature 17 question 9); and `{ "type": "error", "error": "not_found" }` for an ack (feature 23 question 3). A subscription parameter that names another user is ignored (feature 22 question 1). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. Do record ids stay whole numbers that count up?
   - Options: yes (recommended: every lookup is limited to the signed-in user, so a guessed id answers 404); no.
   - Answer: yes. Every lookup is limited to the signed-in user, so a guessed id gets the answer of a missing record (question 1). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. May the browser keep copies of API answers?
   - Options: no (recommended: the workspace is private, and computers may be shared); yes.
   - Answer: no. Every answer of the endpoints under `/api` carries `Cache-Control: no-store`: successes (200, 201, 204) and errors (400, 401, 403, 404, 409, 422) alike, `GET /api/csrf` and `GET /api/session` included. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. A tab left open after a logout in another tab keeps showing its loaded data until its next request (a feature 05 edge case). On a shared computer, the next person can see it. How is this handled?
   - Options: listed in the README's known limitations (recommended in the research); other options: TBD (the research names none).
   - Answer: it is listed in the README's Known limitations (requirements.md 7). Since feature 22 (its question 4), logout closes the connections of every tab of this browser, and each of those tabs shows the sign-in screen at once. What remains, and is listed: a tab whose connection is lost at the moment of the logout keeps showing what it loaded until its next request, which answers 401, or until its next connection attempt is refused, at most 30 seconds later while the server can be reached (feature 20 question 8; feature 22 question 3). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. May pages of other sites read the API's answers? (a question the agent added)
   - Options: no, only the app's own pages, of the same origin (recommended: the app needs nothing else; the session cookie is `samesite=lax`, so the browser sends it with requests from a page on another port of the same host, and only the browser's same-origin rule then keeps that page from reading my data, as feature 22 question 6 also relies on for the WebSocket); yes, for listed origins.
   - Answer: no. No answer under `/api` gives another origin permission to read it: no answer carries an `Access-Control-Allow-Origin` header, and a preflight request (`OPTIONS`) from another origin gets no such permission, so the browser does not send the request that would follow it. A page of another origin, a page on another port of the same host included, therefore cannot read my answers, even when the browser sends my cookie with its request; cannot read an anti-forgery token, and so cannot change my data; and cannot send the time zone header of feature 12. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
6. May the app keep my data in the browser's storage? (a question the agent added)
   - Options: no, only in the open page (recommended: nothing of my workspace stays on a shared computer after the tab closes or after a logout, in line with question 3); yes, to load faster.
   - Answer: no. The app writes none of my data (records, names, my display name, reminders, or what I search for) to the browser's storage: local storage, session storage, and IndexedDB stay empty, and the only cookie is the session cookie, which logout empties (feature 05). (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above. "Another user" is a second account, signed in in another browser. They have the collection "Secret", the tag "private", and the active weekly note "Secret plan" in "Secret", with the tag "private", due today.

**My lists hold only my records**
- Given another user has "Secret", "private", and "Secret plan"
- When my collections, tags, and notes load
- Then none of them is in my lists, and the filter bar's "Collection" and "Tag" do not offer "Secret" or "private" (requirements.md 1; feature 17 question 16)

**An id in the address answers like a missing one**
- Given the ids of "Secret", "private", and "Secret plan"
- When I send each request that names one of them in the address: `PATCH`, `PUT`, or `DELETE /api/collections/:id`; `PATCH`, `PUT`, or `DELETE /api/tags/:id`; `GET`, `PATCH`, `PUT`, or `DELETE /api/notes/:id`, archive and restore included; and `POST /api/notes/:id/review`
- Then each answers 404 `{ "error": "not_found" }`, the same answer as for an id that does not exist, and their records are unchanged (question 1; features 06, 08, 09, 13)

**An id in a request body answers like a missing one**
- Given the ids of "Secret" and "private"
- When I create a note in "Secret", create or edit my note with the id of "private" in `tag_ids`, or move my note into "Secret"
- Then each answers 422 `{ "error": "validation_failed", "fields": { "collection_id": "not_found" } }`, or the same with `"tag_ids": "not_found"`, the same answer as for a missing one, and nothing changes (question 1; features 09, 10, 11)

**A filter by another user's collection or tag finds nothing**
- Given the ids of "Secret" and "private", which hold "Secret plan"
- When I send `GET /api/notes` with `collection_id` set to the id of "Secret", or with `tag_id` set to the id of "private"
- Then it answers 200 `{ "notes": [] }`, the same answer as for a collection or tag that does not exist (question 1; feature 17 question 9)

**A search finds only my notes**
- Given another user's note "Secret plan", and my note "Plan B"
- When I type "plan" in "Search"
- Then the list shows "Plan B", and not "Secret plan" (requirements.md 1; feature 17)

**The review choices hold only my notes**
- Given another user has notes that are due today, overdue, due in the next 7 days, and without a schedule
- When I choose "Due today", "Overdue", "Next 7 days", and "No review scheduled" in "Review", one after another
- Then each list holds only my notes, and none of theirs (requirements.md 1; features 15 to 17)

**Another user's note cannot be marked as reviewed**
- Given "Secret plan" is due today
- When I send `POST /api/notes/:id/review` for its id
- Then it answers 404 `{ "error": "not_found" }`, its last reviewed date and next review date are unchanged, and it is still in the other user's batches (question 1; feature 13 question 5)

**My time zone is my own**
- Given my saved time zone is "Asia/Tokyo", it is 2026-11-09 20:00 UTC (2026-11-10 in Tokyo), and my active weekly note "Rails tips" has the next review date 2026-11-10
- When another user's session check names the time zone "America/New_York"
- Then my saved zone is still "Asia/Tokyo", and my list still gives "Rails tips" the `review_state` `"due_today"` (feature 12 questions 1, 19)

**A session check with no sign-in saves no time zone**
- Given no one is signed in in this browser
- When its session check names the time zone "Asia/Tokyo"
- Then it answers 401 `{ "error": "unauthenticated" }`, and no account's saved zone changes (feature 12 question 1)

**My reminders hold only my notes**
- Given another user and I both have notes due today, and we are both connected
- When batches are sent: when a connection opens, every 60 seconds, and after a change
- Then every batch I receive holds only my notes, and every batch they receive holds only theirs (features 20, 22; requirements.md 5)

**My change sends a batch only to my connections**
- Given another user and I are both connected
- When I mark my note "Rails tips" as reviewed, which sends a new batch at once (feature 20 question 5)
- Then my connections receive that batch, and theirs receive none from my change (features 20, 22)

**A subscription cannot ask for another user's reminders**
- Given another user has the id 2 and notes due today
- When my client subscribes to the reminders with the parameter `"user_id": 2`
- Then the parameter is ignored, and my batches hold only my notes (question 1; feature 22 question 1)

**An ack for another user's note changes nothing**
- Given another user's note 42 is due today
- When my connection sends `{ "action": "ack", "note_id": 42, "next_review_date": "2026-11-09" }`
- Then my connection receives `{ "type": "error", "error": "not_found" }`, nothing is recorded, and their batches still hold their note (question 1; feature 23 question 3)

**A guessed id finds nothing**
- Given my newest note has the id 41, and another user's note has the id 42
- When I send `GET /api/notes/42`
- Then it answers 404 `{ "error": "not_found" }` (question 2)

**API answers are not kept by the browser**
- Given any request to an endpoint under `/api`
- When it answers 200, 201, 204, 400, 401, 403, 404, 409, or 422
- Then the answer carries `Cache-Control: no-store` (question 3)

**Another site cannot read my answers**
- Given I am signed in, and a page at `http://localhost:8080` requests `http://localhost:3000/api/notes`, and my browser sends my cookie with it
- When the answer arrives
- Then it carries no `Access-Control-Allow-Origin` header, and the browser does not let that page read it (question 5)

**Nothing of my data is kept in the browser's storage**
- Given I am signed in, and I used every area: collections, tags, notes, the search and filters, and the reminders panel
- When the browser's storage for the app is read
- Then local storage, session storage, and IndexedDB are empty, and the only cookie is the session cookie (question 6)

**After logout, the page shows none of my data**
- Given I am signed in, and my collections, tags, notes, and reminders show
- When I log out
- Then the sign-in screen shows, none of my records, my name, or my reminders remains in the page, and my connection is closed (feature 05; feature 22 question 4)

**My other tabs follow the logout**
- Given I am signed in, and the main layout is open in two tabs of this browser, each connected
- When I log out in one tab
- Then the other tab shows the sign-in screen at once, with none of my data (feature 22 question 4)

**A tab whose connection was lost at the logout**
- Given the main layout is open in two tabs, and the second tab shows "Review reminders are offline. Reconnecting…"
- When I log out in the first tab, and the server can be reached
- Then the second tab keeps showing what it loaded until its next request answers 401 `{ "error": "unauthenticated" }`, or its next connection attempt is refused, at most 30 seconds later; then it shows the sign-in screen (question 4; features 20, 22)

**A second account of the same person is a separate workspace**
- Given I signed in with Google and made the collection "Work", and the same person signs in with GitHub, with the same email
- When the GitHub account's lists load
- Then they hold none of the Google account's records, because the two accounts are two users ([domain/users.md: Rules](../../docs/domain/users.md#rules); requirements.md 3.1)

## Edge cases

Based on the answers to the questions above.

- No one signed in: every `/api` endpoint that reaches a user's data answers 401 `{ "error": "unauthenticated" }` before any other check ([api_contract: Order of checks](../../docs/api_contract.md#conventions)), and a WebSocket connection is refused with `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }` (feature 22 question 2).
- Another user's record, a missing one, and an id that is not a whole number get the same answer in each area, so an answer never tells whether another user's record exists (question 1). An ack whose `note_id` is not a JSON whole number answers `{ "type": "error", "error": "invalid" }` before any lookup, whoever owns the note (feature 23 question 3).
- A refused request changes nothing in either user's data. A request that names one of another user's records among its own is refused whole: a note create or edit with one foreign tag in `tag_ids` changes nothing, its other fields included (question 1; feature 10 question 5).
- An answer or a message never holds anything of another user: no name, title, collection name, date, or count of theirs (requirements.md 5).
- A user id sent in a request body, a query parameter, a subscription, or a message is ignored. The user comes only from this browser's sign-in ([api_contract: Notes](../../docs/api_contract.md#post-apinotes); feature 22 question 1).
- Ids are whole numbers that count up. A guessed id answers like a missing one (question 2).
- `Cache-Control: no-store` is on every answer of the endpoints under `/api`, error answers included (question 3).
- No answer under `/api` carries `Access-Control-Allow-Origin`, with or without an `Origin` header in the request. The WebSocket accepts only the app's own origin, and answers 404 to any other (question 5; feature 22 question 6).
- Local storage, session storage, and IndexedDB stay empty, while signed in and after a logout (question 6).
- My saved time zone changes only by my own session check. A session check with no sign-in answers 401 `{ "error": "unauthenticated" }` and saves nothing, and one without a zone keeps mine (feature 12 questions 1, 19). Another site cannot send the zone (question 5).
- My "today" comes only from my saved zone, so another user's zone never changes my review states, my "Review" choices, or my reminders (feature 12 question 1; features 15 to 17, 20).
- `review_state` and every "Review" choice are worked out from my own notes only, and a search looks only in my notes (features 15 to 17).
- Every batch goes only to the connections of the user whose notes it holds: the first batch, the checks every 60 seconds, the batch after a change, and the batch after an ack (features 20, 22, 23).
- A dismissal is recorded for the connection's user only, and it never changes another user's batches (feature 23 question 2).
- Logout ends only this browser's sign-in, and closes only this browser's connections. It cannot end another user's sign-in ([domain/users.md: Rules](../../docs/domain/users.md#rules); feature 22 question 4).
- No sharing of any kind: no invites, public links, shared collections, shared notes, or team roles. No endpoint lists users or another user's records (requirements.md 1).
- Sample data goes only into the workspace of the user it is loaded for, never into another user's (requirements.md 6; feature 26).
- The README's Known limitations lists the tab of question 4 (requirements.md 7; feature 30).
- UI states (requirements.md 4 `<ui_quality_checks>`): a 401, or a refused connection, shows the sign-in screen with no message ([conventions: Sign-in ended](../../docs/conventions.md#ui); feature 22 question 3). A record of another user is shown as missing, with that area's own message, such as "This note no longer exists." (question 1).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Code gap: no `Cache-Control` setting exists in `config/application.rb` or `ApplicationController`, so question 3 is new code. Planned approach: `config.action_dispatch.default_headers`. A `before_action` would miss the 401 that the subclasses' `prepend_before_action :require_signed_in_user` renders.
- Planned tests: one `spec/requests/data_privacy_spec.rb` with two users and a snapshot of the other user's records, checking every endpoint. Most would pass at once and be kept as regression tests after a mutation check. A route-table guard, written last, fails when an `/api` route has no cross-account check. One frontend test checks that logout leaves no user data in the page.
- Later items, each waiting for its feature: 10, 11, 12/13, 15/16, 17, 20, 22, 23.
- Depends on: 04, 05, 06, 08, 09 now; 10 to 13, 15 to 17, 20, 22, 23 for the later items.
- Risk: the specs of 10 to 20, 22, and 23 were empty drafts during the research. Check the cross-feature lines above against them.
- Risk: the open tab after a logout (question 4) is a privacy risk on shared computers. It belongs in the README's Known limitations (AC-30).
- Added 2026-11-09 (Design): the specs of 10 to 20, 22, and 23 were all approved, at Stage Plan or later, when this spec was approved, and its lines were checked against them. Features 18 and 19 add no endpoint or message, only which notes count as reminders.
- Added 2026-11-09 (Design): question 4 changed in substance since the research: feature 22 question 4 closes the other tabs' connections at logout. Only a tab whose connection is lost at that moment keeps its data, for at most 30 seconds while the server can be reached.
- Added 2026-11-09 (Design): question 5 needs no new code if CORS stays off (`config/initializers/cors.rb` holds only comments); a request spec with an `Origin` header and an `OPTIONS` preflight guards it. Question 6 needs no new code if the app keeps using no browser storage; a frontend test and the Verify walkthrough (Playwright reads the storage) guard it.
- Added 2026-11-09 (Design): the Verify walkthrough needs two minted users (harness `mint.sh`), `curl.sh` for the API items, and the harness's cable helper for the WebSocket items.
