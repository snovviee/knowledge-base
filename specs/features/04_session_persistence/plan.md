# Plan: 04_session_persistence

**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05)
**Depends on:** 01

## Approach

- Data: none. The session stays in the cookie ([api_contract: Conventions](../../docs/api_contract.md#conventions)).
- API: no new endpoint. The session cookie store in `backend/config/application.rb` gets `expire_after: 30.days`. The cookie then carries an `expires` 30 days ahead, and every response to a request that reads the session sends it again with a new date. Rails puts the expiry inside the encrypted cookie too, so the server refuses a cookie that a client kept past its date. `GET /api/session` keeps its responses.
- UI: `frontend/src/App.tsx` gets a fourth session state, `error`, for a failed check that is not a 401 (network error or any other non-OK answer). It shows "Could not reach the server. Try again." with `role="alert"` and a "Try again" button. The button sets the state back to `loading` and checks the session again.
- Decisions: a sliding expiry on the cookie store, not a session table: the session already lives only in the cookie, and one option gives both the browser expiry and the server-side check.

## Checklist

- [x] 1. [BE] A sign-in lasts until 30 days pass without a visit: the cookie is set with a 30-day expiry at sign-in, renewed by a later request, and refused by the server 30 days after the last request
  - Test first: AC-04 a sign-in lasts until 30 days pass without a visit (spec/requests/session_spec.rb)
- [x] 2. [FE] A page load with a live session never shows the sign-in screen: "Loading…" first, then the main layout with the display name. Feature 01 built this, so the test is expected to pass at once; it is kept as the AC-04 regression test
  - Test first: AC-04 a page load with a live session never shows the sign-in screen (src/App.test.tsx)
- [x] 3. [FE] A network error on the session check shows the error message and the "Try again" button, not the sign-in screen
  - Test first: AC-04 shows the server error state when the session check cannot reach the server (src/App.test.tsx)
- [x] 4. [FE] A 5xx answer to the session check shows the same error state; a 401 still shows the sign-in screen
  - Test first: AC-04 shows the server error state when the session check answers 500 (src/App.test.tsx)
- [x] 5. [FE] "Try again" shows "Loading…", checks the session again, and shows the main layout when the server answers; the error shows again if it still fails
  - Test first: AC-04 Try again checks the session again and shows the main layout (src/App.test.tsx)

Coverage: scenarios 1 to 5 and the cookie edge cases: item 1 (API) and item 2 (UI). A missing or unreadable cookie and a deleted user are the existing 401 tests in `spec/requests/session_spec.rb` (AC-01). Scenarios 6 and 7 and the last two edge cases: items 3 to 5.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand.

1. Refresh keeps the user signed in
   - Steps: sign in with Google. Press reload.
   - Expected: the main layout with your display name. No sign-in screen.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
2. No sign-in screen while the session is checked
   - Steps: signed in, open DevTools → Network, set throttling to "Slow 4G", reload.
   - Expected: "Loading…", then the main layout. The sign-in buttons never show.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
3. A new tab or a reopened browser keeps the user signed in
   - Steps: open http://localhost:3000 in a new tab. Then quit the browser completely, start it again, and open the app.
   - Expected: the main layout with your name both times.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
4. Each visit renews the sign-in
   - Steps: DevTools → Application → Cookies → `_knowledge_base_session`: note `Expires`. Wait a minute, reload, and look again.
   - Expected: `Expires` is about 30 days ahead, and it moved forward after the reload.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
5. The sign-in ends after 30 days without a visit
   - Steps: not possible to wait 30 days by hand. Check the cookie's `Expires` from item 4, and run `docker compose run --rm backend bundle exec rspec spec/requests/session_spec.rb -e "AC-04"`.
   - Expected: `Expires` is 30 days after the last request, and the test passes.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed; the RSpec example `AC-04 a sign-in lasts until 30 days pass without a visit` passes)
6. The server cannot be reached on page load
   - Steps: signed in, DevTools → Network → right-click a request to `/api/session` → "Block request URL". Reload.
   - Expected: "Could not reach the server. Try again." and a "Try again" button. No sign-in screen.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
7. Try again after a failed check
   - Steps: from item 6, unblock `/api/session` (Network request blocking panel), then choose "Try again".
   - Expected: "Loading…", then the main layout with your name.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/api_contract.md` (update): Conventions → Authentication: the session cookie expires 30 days after the last request that carries it, each such request renews it, and an expired cookie gets 401 `unauthenticated` (AC-04)
  - Check: `curl -si http://localhost:3000/api/session` with a signed-in cookie shows `set-cookie: _knowledge_base_session=...; expires=` 30 days ahead
- [x] 2. `docs/domain/users.md` (update): `## Chosen approaches` gets the sign-in lifetime (until logout or 30 days without a visit, renewed by each visit, survives a browser restart) (AC-04)
  - Check: the answer to spec question 1 appears in `users.md`
- [x] 3. `docs/conventions.md` (update): UI → the server error state on page load ("Could not reach the server. Try again.", `role="alert"`, "Try again" button) (AC-04)
  - Check: the message and the button label in `conventions.md` match `frontend/src/App.tsx`

## Deviations

- 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end). The owner has not reviewed them one by one.
