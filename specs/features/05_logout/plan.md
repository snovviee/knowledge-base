# Plan: 05_logout

**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05)
**Depends on:** 01, 02, 03, 04

## Approach

- Data: new table `sign_ins`, one row per browser where a user is signed in: `user_id` (not null, foreign key, index), `token` (string, not null, unique index), timestamps. `SignIn` belongs to a user and gets its token from `has_secure_token`. `User` has many sign-ins (`dependent: :delete_all`).
- API:
  - Sign-in callbacks (`GET /auth/google_oauth2/callback`, `GET /auth/github/callback`): after the user is found or created, a sign-in is created, and its token is kept in the session as `sign_in_token`, next to `user_id`. The redirects do not change.
  - `GET /api/session`: the user is signed in only while a sign-in with the session's `sign_in_token` exists for the session's `user_id`. Otherwise 401 `{ "error": "unauthenticated" }`. The responses do not change ([api_contract: `GET /api/session`](../../docs/api_contract.md#get-apisession)).
  - `DELETE /api/session` (new): header `X-CSRF-Token: <token from GET /api/csrf>`, no body.
    - 204, no body: the sign-in is deleted and the session is reset, so the response sets a new, empty session cookie.
    - 204, no body: no one is signed in. No token check, nothing changes (spec question 2).
    - 403 `{ "error": "invalid_csrf_token" }`: someone is signed in and the token is missing or is not this session's. The sign-in stays (spec question 1).
- UI: `frontend/src/App.tsx`. The header's profile area shows the display name and a "Log out" button. Choosing it makes the button busy (disabled, `aria-busy="true"`), gets a token from `GET /api/csrf`, and sends `DELETE /api/session` with it. On a 2xx answer the session state becomes signed out, so the sign-in screen shows and fetches its own new token, as it does today. On a network error or any other answer, an alert "Could not log out. Try again." (`role="alert"`) shows under the header, and the button can be chosen again. The UI stays one component.
- Decisions:
  - A sign-in record on the server, not the cookie alone: a cookie-store session cannot be revoked, and logout must refuse a kept copy of the cookie (spec question 5). Feature 04's sliding 30-day cookie expiry stays as it is.
  - A random token, not the record id, names the sign-in in the session, so a reset database or a reused id cannot revive an old cookie.
  - `session[:user_id]` stays: the sign-in tests of features 01 to 03 read it, and the lookup checks that the sign-in belongs to that user. A cookie from before this feature has no `sign_in_token`, so that browser must sign in once more.
  - `current_user` lives in `ApplicationController`, built on the live sign-in, so every later endpoint uses the same check and a logged-out cookie reaches no data.
  - Forgery protection in `ApplicationController` (`include ActionController::RequestForgeryProtection`, `protect_from_forgery with: :exception`): logout is the first request that changes state, and later write endpoints get the same check. GET requests are not checked, so the existing endpoints and the sign-in callbacks do not change. `rescue_from ActionController::InvalidAuthenticityToken` answers 403 `invalid_csrf_token`.
  - The "no one signed in" answer runs before the token check (`prepend_before_action` in `Api::SessionController`, spec question 2).
  - The token travels in the `X-CSRF-Token` header, which Rails reads for requests that are not forms.
  - Forgery protection is on in tests for API controllers. The test environment's `allow_forgery_protection = false` applies to `ActionController::Base` only (checked: `Api::CsrfController.allow_forgery_protection` is `true` in test). Request specs for a non-GET API request first get a real token from `GET /api/csrf` in the same session.
  - The frontend gets the token right before the logout request, so it always belongs to the current session. It keeps that token out of the sign-in forms' state, so the sign-in screen after logout fetches a new one.
  - Test files: the AC-05 request specs go in a new `spec/requests/logout_spec.rb`, and the frontend tests in a new `src/App.logout.test.tsx`. Feature 04's tests in `spec/requests/session_spec.rb` and `src/App.test.tsx` are not committed yet, so the two features' changes stay in separate test files.

## Checklist

- [x] 1. [BE] Create the `sign_ins` table and the `SignIn` model: a sign-in belongs to a user and gets its own random token. Deleting the user deletes their sign-ins, so the existing rule "the session's user no longer exists: 401" can still happen ([api_contract: `GET /api/session`](../../docs/api_contract.md#get-apisession)).
  - Test first: AC-05 a sign-in belongs to a user, gets its own random token, and is deleted with the user (spec/models/sign_in_spec.rb)
- [x] 2. [BE] A successful sign-in records a sign-in for this browser and keeps its token in the session. The shared callback method serves Google and GitHub.
  - Test first: AC-05 a successful sign-in records a live sign-in for this browser (spec/requests/logout_spec.rb)
- [x] 3. [BE] `GET /api/session` returns 401 when the session's sign-in no longer exists. Adds `current_sign_in` and `current_user` to `ApplicationController`.
  - Test first: AC-05 GET /api/session returns 401 once the session's sign-in has ended (spec/requests/logout_spec.rb)
- [x] 4. [BE] `DELETE /api/session` logs out: 204 with no body, and `GET /api/session` then returns 401.
  - Test first: AC-05 logging out answers 204 and GET /api/session then returns 401 (spec/requests/logout_spec.rb)
- [x] 5. [BE] Logout deletes this browser's sign-in, so a copy of the session cookie kept from before the logout is refused.
  - Test first: AC-05 a copy of the session cookie kept from before logout does not sign the user back in (spec/requests/logout_spec.rb)
- [x] 6. [BE] Logout ends only this browser's sign-in: the same user, signed in in another browser, stays signed in. Expected to pass once item 5 deletes only the current sign-in. It is kept as the regression test for spec question 5.
  - Test first: AC-05 logging out in one browser keeps the user signed in in another browser (spec/requests/logout_spec.rb)
- [x] 7. [BE] A logout without this session's token, or with another session's token, is refused with 403 `{ "error": "invalid_csrf_token" }`, and the user stays signed in. Adds forgery protection and the 403 handler to `ApplicationController`.
  - Test first: AC-05 refuses a logout without this session's anti-forgery token with 403 and keeps the user signed in (spec/requests/logout_spec.rb)
- [x] 8. [BE] A logout when no one is signed in answers 204 with no token, and ends no other sign-in.
  - Test first: AC-05 a logout when no one is signed in answers 204 without a token and ends no other sign-in (spec/requests/logout_spec.rb)
- [x] 9. [FE] The profile area shows the display name and a "Log out" button.
  - Test first: AC-05 the profile area shows the display name and a Log out button (src/App.logout.test.tsx)
- [x] 10. [FE] "Log out" sends `DELETE /api/session` with the token from `GET /api/csrf` in `X-CSRF-Token`. On 204 it shows the sign-in screen with both buttons and no alert.
  - Test first: AC-05 Log out sends the logout request with the CSRF token and shows the sign-in screen (src/App.logout.test.tsx)
- [x] 11. [FE] After logout, the sign-in forms carry a new token from `GET /api/csrf`, never the token the logout used. Expected to pass once item 10 keeps the logout token out of the form state, because the sign-in screen already fetches its token (feature 01). It is kept as the regression test.
  - Test first: AC-05 after logout the sign-in forms carry a new CSRF token, not the logout one (src/App.logout.test.tsx)
- [x] 12. [FE] While the logout request is pending, "Log out" is busy, and a second click sends no second request.
  - Test first: AC-05 Log out shows a busy state and ignores a second click (src/App.logout.test.tsx)
- [x] 13. [FE] A logout that cannot reach the server keeps the main layout with the display name, shows "Could not log out. Try again." as an alert, and "Log out" is enabled again.
  - Test first: AC-05 a logout that cannot reach the server keeps the main layout and shows the logout error (src/App.logout.test.tsx)
- [x] 14. [FE] A logout that the server answers with an error (403 or 5xx) shows the same alert and keeps the main layout. Choosing "Log out" again, when the server answers 204, shows the sign-in screen.
  - Test first: AC-05 a logout the server refuses shows the logout error, and Log out again signs out (src/App.logout.test.tsx)

Coverage:
- Scenario "The main layout offers Log out": item 9.
- Scenario "Log out": items 4 and 10.
- Scenario "Logout ends the sign-in": items 3 and 4.
- Scenario "A kept copy of the session cookie does not sign me back in": items 2, 3 and 5.
- Scenario "Logout ends only this browser's sign-in": item 6.
- Scenario "Sign in again after logout": item 11, with the sign-in tests of features 01 and 02.
- Scenarios "Logout fails" and "Log out again after a failure": items 13 and 14.
- Edge cases: the refused token is item 7. "No one is signed in" and the other tab are items 8 and 10. The busy button is item 12. "Only its own sign-in" is items 6 and 8. The new token after logout is item 11. A failed logout and the UI states are items 12 to 14.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. A browser that signed in before this feature must sign in once more (see Decisions).

1. The main layout offers Log out
   - Steps: sign in with Google.
   - Expected: the header shows your display name and a "Log out" button next to it.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
2. Log out
   - Steps: on the main layout, open DevTools → Network, then choose "Log out".
   - Expected: a `DELETE /api/session` request with status 204 and no response body. The sign-in screen shows "Continue with Google" and "Continue with GitHub", with no message.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
3. Logout ends the sign-in
   - Steps: after item 2, reload the page.
   - Expected: the sign-in screen. In Network, `GET /api/session` has status 401 and the body `{"error":"unauthenticated"}`.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
4. A kept copy of the session cookie does not sign me back in
   - Steps: sign in. In DevTools → Application → Cookies, copy the value of `_knowledge_base_session`. Run `curl -s -H "Cookie: _knowledge_base_session=<value>" http://localhost:3000/api/session`. Choose "Log out" in the browser. Run the same `curl` again.
   - Expected: the first `curl` prints your user. The second prints `{"error":"unauthenticated"}`.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
5. Logout ends only this browser's sign-in
   - Steps: sign in with the same account in a normal window and in a private window. Choose "Log out" in the private window. Reload the normal window.
   - Expected: the private window shows the sign-in screen. The normal window shows the main layout with your display name.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
6. Sign in again after logout
   - Steps: after a logout, choose "Continue with Google" at once and approve. Log out again, then choose "Continue with GitHub" and approve.
   - Expected: the main layout with your display name each time. No sign-in error.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
7. Logout fails
   - Steps: signed in, DevTools → Network → set throttling to "Offline". Choose "Log out".
   - Expected: the main layout stays with your display name, and the alert "Could not log out. Try again." shows. "Log out" can be chosen again.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
8. Log out again after a failure
   - Steps: from item 7, set throttling back to "No throttling". Choose "Log out".
   - Expected: the sign-in screen. A reload still shows the sign-in screen.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
9. Edge case: a logout without the token is refused
   - Steps: sign in and copy the cookie value as in item 4. Run `curl -s -i -X DELETE -H "Cookie: _knowledge_base_session=<value>" http://localhost:3000/api/session`. Reload the browser.
   - Expected: status 403 with the body `{"error":"invalid_csrf_token"}`. The browser still shows the main layout after the reload.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
10. Edge case: a logout when no one is signed in
    - Steps: run `curl -s -i -X DELETE http://localhost:3000/api/session`.
    - Expected: status 204 with no body.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/users.md` (update): a `## Sign-in` entity (user, token, timestamps; one per browser where the user is signed in; created at sign-in, deleted at logout); `## Rules`: logout ends only this browser's sign-in, and a session cookie whose sign-in is gone signs no one in; `## Chosen approaches`: the answers to spec questions 2 and 5 (AC-05)
  - Check: every column of the `sign_ins` migration appears with its validation, and the answers to questions 2 and 5 appear
- [x] 2. `docs/api_contract.md` (update): Conventions → Authentication (the cookie holds the user's id and the token of this browser's sign-in; a session whose sign-in has ended gets 401); a new convention for anti-forgery (every non-GET JSON request sends `X-CSRF-Token` with the token from `GET /api/csrf`, otherwise 403 `invalid_csrf_token`); the error codes (`invalid_csrf_token`) and the status codes (204, 403); `GET /api/csrf` serves the logout request too; `GET /api/session` returns 401 when the sign-in has ended; the new `DELETE /api/session` with its request, responses, and errors (AC-05)
  - Check: `docker compose run --rm backend bin/rails routes` lists `DELETE /api/session`, and each of its status codes in the request spec is documented
- [x] 3. `docs/conventions.md` (update): UI → the profile area with "Log out", its busy state, and the logout error "Could not log out. Try again."; Code → forgery protection and its 403 handler in `ApplicationController`, `current_user` in `ApplicationController` for every endpoint, request specs that get a real token before a non-GET request (forgery protection is on in tests for API controllers), the frontend gets the token right before a request that changes state, and the AC-05 frontend tests in `src/App.logout.test.tsx`. The note that `Api::CsrfController` includes the forgery module itself is updated (AC-05)
  - Check: the message and the button label in `conventions.md` match `frontend/src/App.tsx`, and each file named in `## Code` exists
- [x] 4. `README.md` (update): Known limitations: sign-in records of browsers that never log out stay in the database after their cookie expires; such a record can no longer be used, but it is not cleaned up (AC-05)
  - Check: the limitation is listed under Known limitations
- [x] 5. `README.md` (update): the intro names features 01 to 05 as built, and the "Sign-out is not built" limitation is removed (AC-05) (found in Polish)
  - Check: the README has no "Sign-out is not built" line, and its intro names the logout feature

## Deviations

- 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end). The owner has not reviewed them one by one.
- 2026-11-05: Build started while dependencies are not at Done: 02 (GitHub sign-in), 03 (user record) and 04 (session persistence) are at Verify. 01 is at Done. Started under the owner's standing instruction of 2026-11-05.
- 2026-11-05: Item 6 was ticked as covered. Its test passed before any code of its own, because item 5 deletes only this browser's sign-in. A mutation check showed the test is not empty: with logout changed to delete every sign-in of the user, the test failed (401 in the other browser). The test stays as the regression test for spec question 5, as the plan expected.
- 2026-11-05: Item 11 was ticked as covered. Its test passed before any code of its own, because item 10 keeps the logout's token in a local variable and the sign-in screen already fetches its own token (feature 01), as the plan expected. The first version of the test was too weak: a mutation that put the logout's token into the sign-in forms' state still passed, because the sign-in screen replaced it at once. The test now holds the sign-in screen's token request open and checks the forms during that window, and the same mutation fails it. The test stays as the regression test.
