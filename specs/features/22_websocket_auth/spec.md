# Feature: 22_websocket_auth

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-22: WebSocket connection is authorized

Sources: requirements.md 1 (a private workspace; each user reaches only their own data), 3.7 (two-way communication over WebSocket), 5 (authorization on WebSocket connections and on notification delivery; a user never receives another user's data or notifications; secure SSO), 8 (README: WebSocket message format); [docs/api_contract.md](../../docs/api_contract.md#conventions) (Conventions: Authentication, Session lifetime, Anti-forgery); [docs/domain/users.md](../../docs/domain/users.md) (Sign-in; Rules: a sign-in ends at logout, logout ends only this browser's sign-in, a sign-in that is gone signs no one in); [docs/conventions.md](../../docs/conventions.md#ui) (UI: Sign-in ended); [features/04_session_persistence/spec.md](../04_session_persistence/spec.md) and [features/05_logout/spec.md](../05_logout/spec.md) (questions 2, 5: logout with no sign-in, a kept copy of a cookie), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (the batches and the panel), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (the `ack` message), not yet in `docs/`.

Not part of this feature: what a batch holds and when it is sent (AC-20, feature 20); the `ack` message (AC-23, feature 23); the privacy of the HTTP API (AC-21, feature 21).

## Questions

1. How is the WebSocket connection authorized?
   - Options: by the browser's sign-in, the same as the HTTP API: the session cookie that the browser sends with the connection request must name a live sign-in (recommended: the sign-in already ends at logout and after 30 days without a visit, features 04 and 05, and the page needs no token of its own); a separate token from an HTTP endpoint, sent in the connection's address or in a first message.
   - Answer: by the browser's sign-in, the same as the HTTP API. The app's WebSocket is at `/cable` on the app's own address: `ws://localhost:3000/cable` locally, and `wss://` when the app is served over `https`. When a connection opens, the server reads the session cookie that the browser sends with the connection request. The cookie must name a live sign-in: one that logout has not ended (feature 05), in a cookie within its 30 days (feature 04). The server takes the user only from that sign-in, never from anything the client sends. There is no user id or token in the address, in the subscription, or in a message, and a parameter that names a user is ignored. So a user only ever receives their own reminders. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What does the server do with a connection that has no live sign-in?
   - Options: it refuses it: it sends `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }`, closes the connection, and sends nothing else (recommended: the client learns why, and that trying again will not help); it keeps the connection open and sends nothing.
   - Answer: it refuses it. The server sends the one message `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }` and closes the connection. It sends no reminders and accepts no subscription. This covers a browser that never signed in, a logout, a cookie past its 30 days (feature 04), a kept copy of a cookie whose sign-in has ended (feature 05 question 5), and a cookie that the app did not make or that was changed. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. What does the app show when the server refuses its connection, or closes it because the sign-in ended?
   - Options: the sign-in screen with no message, as for a 401 answer (recommended: a refused connection means the same as a 401, and [conventions: Sign-in ended](../../docs/conventions.md#ui) already shows the sign-in screen for it); a message in the reminders panel, with the main layout kept.
   - Answer: the sign-in screen with no message, as for an HTTP request answered 401 ([conventions: Sign-in ended](../../docs/conventions.md#ui)). The app does not try to connect again until the user signs in again. A connection that is lost for any other reason, such as a server that stops or a network that fails, is feature 20's: the app tries again on its own (feature 20 question 8). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
4. What does logout do to open connections?
   - Options: logout closes every open connection of the sign-in it ends, that is, of this browser, in all its tabs, and the same user's connections in other browsers stay open (recommended: logout ends only this browser's sign-in, [domain/users.md](../../docs/domain/users.md#rules)); logout closes every connection of the user, everywhere; logout closes nothing, and the connections run on until they drop.
   - Answer: logout closes, at once, every open connection of the sign-in it ends: this browser's, in all its tabs. The server tells each of them not to reconnect, and each such tab shows the sign-in screen with no message (question 3). No batch reaches a closed connection. The same user's connections in other browsers and on other devices stay open and keep receiving their batches. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. Is the sign-in checked again while a connection stays open?
   - Options: yes: before each batch it sends and each message it handles, the server checks that the connection's sign-in still exists, and closes the connection as in question 2 when it does not (recommended: requirements.md 5 asks for authorization on notification delivery and on acknowledgements, not only when a connection opens); no: a connection is checked only when it opens.
   - Answer: yes. Before each batch it sends (feature 20) and each message it handles (feature 23), the server checks that the connection's sign-in still exists. When it does not, the server sends no batch, handles no message, and closes the connection as in question 2. Logout already closes the connection (question 4); this check covers any other way a sign-in is deleted. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
6. Which pages may open the connection?
   - Options: only pages of the same origin as the WebSocket (the same scheme, host, and port), and a connection request from any other origin, or with no origin, is refused before it opens (recommended: the session cookie is `samesite=lax`, which still lets a page on another port of the same host, such as another local app, open the connection with the user's cookie); any page; any page, with an anti-forgery token in the connection's address.
   - Answer: only pages of the same origin as the WebSocket: the same scheme, host, and port, which is `http://localhost:3000` locally. A connection request whose `Origin` header names another origin, or that has no `Origin` header, is answered 404, and no connection opens, even when the browser sends the user's cookie. Nothing is sent. Because only the app's own pages can open the connection, the messages on it carry no anti-forgery token (feature 23). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**A signed-in browser connects**
- Given I am signed in, and the main layout shows
- When the app opens its connection to `/cable` and subscribes to my reminders
- Then the connection opens and stays open, and the first batch arrives (feature 20) (question 1)

**A browser with no sign-in is refused**
- Given no one is signed in in this browser
- When a connection to `/cable` is opened from the app's page
- Then the server sends `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }`, closes the connection, and sends no reminders (question 2)

**A kept copy of a logged-out cookie is refused**
- Given someone copied my session cookie before I logged out
- When they open a connection to `/cable` with that copy
- Then the server refuses it with the same message and closes it (question 2; feature 05 question 5)

**A cookie past its 30 days is refused**
- Given my session cookie is more than 30 days past the last request that carried it
- When a connection to `/cable` is opened with it
- Then the server refuses it with the same message and closes it (question 2; feature 04)

**The app shows the sign-in screen when its connection is refused**
- Given the main layout shows
- When the server refuses the app's connection with `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }`
- Then the sign-in screen shows with no message, and the app does not try to connect again (question 3)

**Logout closes this browser's connections**
- Given I am signed in, and the main layout is open in two tabs of this browser, each with an open connection
- When I log out in one tab
- Then the server closes both connections at once and tells them not to reconnect, the other tab shows the sign-in screen with no message, and no batch reaches either tab (questions 3, 4)

**Logout leaves my other browsers connected**
- Given I am signed in with the same account in two browsers, each with an open connection
- When I log out in one browser
- Then the other browser's connection stays open, and it keeps receiving my batches (question 4; [domain/users.md](../../docs/domain/users.md#rules))

**A connection whose sign-in is gone receives nothing more**
- Given my connection is open, and my sign-in is deleted on the server without the connection being closed
- When the next batch is due, or my client sends a message
- Then the server sends no batch, handles no message, and closes the connection with `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }` (question 5)

**Each user receives only their own reminders**
- Given another user and I both have notes due today, and we are both connected
- When batches are sent
- Then every batch I receive holds only my notes, and every batch they receive holds only theirs (question 1; requirements.md 5)

**A subscription cannot ask for another user's reminders**
- Given another user has the id 2 and notes due today
- When my client subscribes to the reminders with a parameter such as `"user_id": 2`
- Then the parameter is ignored, and my batches hold only my own notes (question 1)

**A page of another origin cannot connect**
- Given I am signed in, and a page at `http://localhost:8080` opens a connection to `ws://localhost:3000/cable`, and my browser sends my cookie with it
- When the connection request reaches the server
- Then it is answered 404, no connection opens, and nothing is sent (question 6)

## Edge cases

- A connection request with no `Origin` header, such as one from a script: 404, and no connection opens. A script that tests the WebSocket sends the app's own origin, `http://localhost:3000` locally (question 6).
- A request to `/cable` that is not a WebSocket connection request, such as a plain `GET`: 404, and no connection opens. The API's JSON error body does not apply to these 404 answers, because `/cable` is not under `/api` ([api_contract: Conventions](../../docs/api_contract.md#conventions)).
- The checks come in this order: the origin, then the sign-in. A request from another origin is answered 404 whether or not its cookie names a live sign-in, so the answer never tells whether the cookie is good (questions 2, 6).
- No live sign-in: a browser that never signed in, a logout, a cookie past its 30 days, a kept copy of a cookie whose sign-in has ended, and a cookie that the app did not make or that was changed. Each is refused with `{ "type": "disconnect", "reason": "unauthorized", "reconnect": false }`, and the connection is closed. No subscription is accepted and no batch is sent (question 2).
- A refused connection is not tried again by the app. The next connection opens after the next sign-in (question 3).
- Logout closes this browser's connections, in every tab, at once. The same user's other browsers stay connected (question 4). A logout when no one is signed in closes nothing (feature 05 question 2).
- The server takes the user only from the connection's sign-in. A parameter of the subscription, or a user id in a message, never chooses the user (question 1).
- A user may have several open connections: tabs, browsers, and devices. Each receives that user's batches, and only theirs (question 1).
- Before each batch and each message, the sign-in is checked again. A connection whose sign-in is gone is closed with the refusal message (question 5).
- Messages on the connection carry no anti-forgery token, because only the app's own pages can open it (question 6).
- UI states (requirements.md 4 `<ui_quality_checks>`): a refusal shows the sign-in screen, as a 401 does (question 3). The panel's own states, while it connects and after a connection is lost, are feature 20's (its question 8).
- README (requirements.md 5, 8; AC-30): it documents the WebSocket's address `/cable`, that a connection uses the browser's sign-in and carries no token, the refusal message, what logout does to open connections, and that only pages of the app's own origin may connect.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
