# Feature: 05_logout

**Stage:** Done
**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question)

## Acceptance criterion

> AC-05: A user can log out

Sources: requirements.md 1, 3.1, 4 (main layout: user profile area and logout action; `<ui_quality_checks>`), 5; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body; Session: `GET /api/csrf`, `GET /api/session`; `POST /auth/google_oauth2`); [docs/conventions.md](../../docs/conventions.md) (UI: Busy button)

Not part of this feature: signing in (AC-01, AC-02), how long a sign-in lasts without a logout (AC-04), closing the real-time connection at logout (AC-20, AC-22), and the profile area on narrow screens (AC-25).

## Questions

1. How is the logout request protected against a request that another site makes the browser send (cross-site request forgery)? requirements.md 5 asks for secure SSO, and the sign-in forms already carry the anti-forgery token from `GET /api/csrf` (feature 01).
   - Options: the logout request must carry this session's anti-forgery token from `GET /api/csrf`, and without it the request is refused with 403 `{ "error": "invalid_csrf_token" }` and the user stays signed in (recommended: the token is already in place for sign-in, another site cannot read it, and 403 keeps 422 free for validation errors); no token, relying on the cookie's `samesite=lax` setting alone; the same token check, refused with 422 `{ "error": "invalid_csrf_token" }`.
   - Answer: the logout request must carry this session's anti-forgery token from `GET /api/csrf`. A request without it, or with a token from another session, is refused with 403 `{ "error": "invalid_csrf_token" }`, and the user stays signed in. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
2. What does the logout request answer when no one is signed in (never signed in, already logged out in another tab, or the sign-in ended after 30 days without a visit)?
   - Options: 204 with no body, the same as a successful logout, with no token check and no change (recommended: there is nothing to end, and the user is signed out either way, so a second tab or an ended sign-in shows no error); 401 `{ "error": "unauthenticated" }`, like the endpoints that need a signed-in user.
   - Answer: 204 with no body, with or without a token, and nothing changes. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
3. What does the user see after logging out?
   - Options: the sign-in screen, as on a first visit, with no message (recommended: the change of screen shows that the logout worked, and the sign-in buttons are ready to use); the sign-in screen with the line "You have logged out."; a separate "You have logged out" page with a link to sign in again.
   - Answer: the sign-in screen, as on a first visit, with no message. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
4. What does the user see when the logout request fails (the server cannot be reached, or it answers with an error)?
   - Options: the main layout stays, the user is still signed in, and an alert says "Could not log out. Try again.", with "Log out" ready to choose again (recommended: the server may still hold the sign-in, so the sign-in screen would tell the user they are signed out when they may not be, which matters on a shared computer); the sign-in screen anyway, as if the logout had worked.
   - Answer: the main layout stays, and the user is still signed in. An alert says "Could not log out. Try again.", and "Log out" can be chosen again. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
5. What does logout end?
   - Options: this browser's sign-in, on the server too, so a copy of the session cookie kept from before the logout no longer signs anyone in, while other browsers and devices stay signed in (recommended: logout must end the session for good, requirements.md 5 asks for secure SSO, and nothing in requirements.md asks to sign out other devices); this browser's sign-in, in the browser only, so a kept copy of the cookie works until its 30 days run out (feature 04); every sign-in of the user, on every browser and device.
   - Answer: this browser's sign-in, on the server too. After logout, a kept copy of the session cookie gets 401 `{ "error": "unauthenticated" }`. Other browsers and devices stay signed in until they log out or 30 days pass without a visit (feature 04). (Recommended option, taken under the owner's standing instruction of 2026-11-05.)

## Scenarios

**The main layout offers Log out**
- Given I am signed in
- When the main layout shows
- Then the profile area shows my display name and a "Log out" button (requirements.md 4)

**Log out**
- Given I am signed in and on the main layout
- When I choose "Log out"
- Then the logout request answers 204 with no body
- Then I see the sign-in screen with "Continue with Google" and "Continue with GitHub", and no message (question 3)

**Logout ends the sign-in**
- Given I have logged out
- When I reload the page
- Then the sign-in screen shows, and `GET /api/session` answers 401 `{ "error": "unauthenticated" }`

**A kept copy of the session cookie does not sign me back in**
- Given someone copied my session cookie before I logged out
- When they send a request with that copy after my logout
- Then `GET /api/session` answers 401 `{ "error": "unauthenticated" }` (question 5)

**Logout ends only this browser's sign-in**
- Given I am signed in with the same account in two browsers
- When I log out in one of them
- Then the other browser is still signed in, and a reload there shows the main layout with my display name (question 5)

**Sign in again after logout**
- Given I have logged out
- When I choose "Continue with Google" or "Continue with GitHub" and approve the sign-in at the provider
- Then I am signed in and see the main layout (features 01 and 02)

**Logout fails**
- Given I am signed in and on the main layout
- When I choose "Log out" and the server cannot be reached or answers with an error
- Then I stay on the main layout, still signed in, and see "Could not log out. Try again." as an alert (question 4)

**Log out again after a failure**
- Given the main layout shows "Could not log out. Try again."
- When I choose "Log out" again and the server answers
- Then I see the sign-in screen

## Edge cases

- A logout request without this session's anti-forgery token, for example one that another site makes my browser send: 403 `{ "error": "invalid_csrf_token" }`, and I stay signed in. A token from another session is refused the same way (question 1).
- A logout request when no one is signed in: 204 with no body, with or without a token, and nothing changes (question 2). This covers a second logout, a sign-in that ended after 30 days without a visit (feature 04), and a kept copy of a session cookie whose sign-in has ended.
- Logged out in another tab: this tab still shows the main layout until it next asks the server. Choosing "Log out" here shows the sign-in screen with no error (question 2). A reload here shows the sign-in screen, because `GET /api/session` answers 401 (feature 04).
- "Log out" chosen again while the logout is in progress: the button shows a busy state, and no second logout request is sent ([conventions: Busy button](../../docs/conventions.md#ui)).
- The logout request takes no input. It ends only the sign-in that its own session cookie names, so it cannot end another user's sign-in or the same user's sign-in in another browser (requirements.md 1, 5; question 5).
- A sign-in started right after logout is not refused. The sign-in screen gets a new anti-forgery token for the new session, as on a first visit ([api_contract: `POST /auth/google_oauth2`](../../docs/api_contract.md#post-authgoogle_oauth2)).
- A failed logout leaves the app signed in: the main layout and the display name stay, and the sign-in screen does not show (question 4). An answer of 403 or 5xx counts as a failure, the same as a network error.
- UI states (requirements.md 4 `<ui_quality_checks>`): the loading state is the busy "Log out" button, and the error state is the alert "Could not log out. Try again.". The logout has no input, so it has no validation or empty state.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
