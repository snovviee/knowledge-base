# Feature: 04_session_persistence

**Stage:** Done
**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question)

## Acceptance criterion

> AC-04: Authentication persists across page refresh

Sources: requirements.md 3.1, 4 (`<ui_quality_checks>`), 5; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication; Session: `GET /api/session`); [docs/conventions.md](../../docs/conventions.md) (UI: Loading)

Not part of this feature: signing in (AC-01, AC-02), logging out (AC-05).

## Questions

1. How long does a sign-in last when the user does not log out?
   - Options: until 30 days pass without a visit, renewed by each visit (recommended); until the browser closes; a fixed 30 days from sign-in.
   - Answer: until the user logs out or 30 days pass without a visit. Every request the app makes while signed in starts the 30 days again. The sign-in survives closing and reopening the browser. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
2. What does the app show when the session check on page load fails for a reason other than "not signed in" (the server cannot be reached, or it answers with a server error)?
   - Options: an error message with a "Try again" button (recommended); the sign-in screen.
   - Answer: an error message, not the sign-in screen, because the user may still be signed in: "Could not reach the server. Try again." with a "Try again" button that checks the session again. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)

## Scenarios

**Refresh keeps the user signed in**
- Given a signed-in user on the main layout
- When they refresh the page
- Then the main layout shows again with their display name, and they are not asked to sign in

**No sign-in screen while the session is checked**
- Given a signed-in user
- When the page loads
- Then "Loading…" shows until the session is known ([conventions: Loading](../../docs/conventions.md#ui)), and the sign-in screen never shows in between

**A new tab or a reopened browser keeps the user signed in**
- Given a user whose last visit was less than 30 days ago
- When they open the app in a new tab, or close the browser, reopen it, and open the app
- Then the main layout shows with their display name

**Each visit renews the sign-in**
- Given a user who signed in, then visited the app 20 days later
- When they open the app 25 days after that visit (45 days after signing in)
- Then they are still signed in

**The sign-in ends after 30 days without a visit**
- Given a user whose last visit was more than 30 days ago
- When they open the app
- Then the sign-in screen shows, and `GET /api/session` returns 401 `{ "error": "unauthenticated" }`

**The server cannot be reached on page load**
- Given a signed-in user
- When the page loads and the session check fails with a network error or a 5xx answer
- Then the app shows "Could not reach the server. Try again." as an alert, with a "Try again" button, and not the sign-in screen

**Try again after a failed check**
- Given the app shows "Could not reach the server. Try again."
- When the user chooses "Try again" and the server answers that they are signed in
- Then "Loading…" shows while the session is checked, and then the main layout with their display name

## Edge cases

- No session cookie (never signed in, or cookies cleared): `GET /api/session` returns 401 `{ "error": "unauthenticated" }`, and the sign-in screen shows.
- A session cookie that was changed by hand or cannot be read: treated as no session: 401 `{ "error": "unauthenticated" }`, and the sign-in screen shows.
- A browser that kept a session cookie past its 30 days (for example a copied cookie): the server refuses it with 401 `{ "error": "unauthenticated" }`.
- The session's user no longer exists: 401 `{ "error": "unauthenticated" }` ([api_contract: `GET /api/session`](../../docs/api_contract.md#get-apisession)).
- "Try again" while the server still cannot be reached: the error message shows again.
- A 401 answer is "not signed in", not a server error: the sign-in screen shows, not the error message.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
