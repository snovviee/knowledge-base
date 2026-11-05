# Plan: 01_google_sign_in

**Approved:** yes, 2026-11-05
**Depends on:** none

## Approach

- Data: `users` table: `provider` (string, not null), `provider_user_id` (string, not null), `email` (string, nullable), `display_name` (string, not null), `avatar_url` (string, nullable), timestamps. Unique index on `provider` + `provider_user_id`.
- API:
  - `GET /api/csrf` → 200 `{ "token": "<string>" }`. The token is kept in the session.
  - `POST /auth/google_oauth2` (sign-in start) with form field `authenticity_token` → 302 to Google. Without a token that matches the session, the request is refused and no redirect to Google happens.
  - `GET /auth/google_oauth2/callback` → 302 to `/` with the user signed in. Any failure → 302 to `/?sign_in_error=google`.
  - `GET /api/session` → 200 `{ "user": { "id", "display_name" } }`, or 401 `{ "error": "unauthenticated" }` when no user is signed in.
  - Error body for all API errors: `{ "error": "<code>" }`.
- WebSocket: none in this feature.
- UI: one screen at `/`.
  - While `GET /api/session` is pending: a loading state.
  - 401: sign-in screen with a "Continue with Google" button. The button is a form that POSTs to `/auth/google_oauth2` with the CSRF token. It shows the sign-in error when `?sign_in_error=google` is in the address.
  - 200: main layout. Left area "Collections" with the empty state "No collections yet". Main area "Notes" with the empty state "No notes yet". Header profile area with the display name.
- Decisions:
  - Sign-in starts with a POST form, not a link. OmniAuth 2 accepts the sign-in start only as POST. The token stops another site from starting a sign-in in the user's browser.
  - Rails API mode has no cookies or session middleware. Both are added. The session holds only `user_id`.
  - Gems: `omniauth-google-oauth2` (scopes `email`, `profile`) and `omniauth-rails_csrf_protection`. GitHub is AC-02.
  - Identity is `provider` + `provider_user_id` (requirements 3.1). Email is stored only when Google sends it.
  - Profile fields are written when the record is created. Later sign-ins do not change them in this feature. Record rules belong to AC-03.
  - `display_name` is NOT NULL. Google sends `name` when the `profile` scope is granted, and the scopes are fixed here.
  - All failures share one path: OmniAuth's failure handler redirects to `/?sign_in_error=<provider>`, where the provider is `google` for Google and `github` for GitHub (changed 2026-11-05, see Deviations). The provider's error text is not passed on.
  - Test mode is on in every example, through `spec/support/omniauth.rb`. The one exception is the state-mismatch test (item 13), which turns test mode off for its example. Test mode skips OmniAuth's real state check, so only the off setting exercises it. OmniAuth checks `state` before it contacts Google, so that test needs no network.
  - Configuration: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are read in `config/initializers/omniauth.rb`. Rails generates `secret_key_base` in development and test. Production needs `SECRET_KEY_BASE` set.
  - Callback URL: `http://localhost:3000/auth/google_oauth2/callback`.

## Checklist

- [x] 1. [SETUP] Add `omniauth-google-oauth2` and `omniauth-rails_csrf_protection` to `backend/Gemfile`, and let Bundler update `Gemfile.lock`.
  - Check: `docker compose run --rm backend bundle list`: lists both gems.
- [x] 2. [SETUP] Add the cookie and session middleware that API mode leaves out (`backend/config/application.rb`).
  - Check: `docker compose run --rm backend bin/rails middleware`: lists `ActionDispatch::Cookies` and `ActionDispatch::Session::CookieStore`.
- [x] 3. [SETUP] Add `spec/support/omniauth.rb`: turns on OmniAuth test mode and resets mocks after each example. Add a `spec/support/**/*.rb` require to `spec/rails_helper.rb`, which does not load support files yet.
  - Check: `docker compose run --rm backend bundle exec rspec`: exits 0, "0 examples, 0 failures".
- [x] 4. [BE] Create the `users` table and the `User` model.
  - Test first: AC-01 identifies a user by provider and provider_user_id, unique together (`spec/models/user_spec.rb`)
- [x] 5. [BE] `GET /api/csrf` returns a token kept in the session.
  - Test first: AC-01 GET /api/csrf returns a token for the session (`spec/requests/csrf_spec.rb`)
- [x] 6. [BE] Configure OmniAuth with the Google strategy. A sign-in start without a valid token gets no redirect to Google.
  - Test first: AC-01 refuses a sign-in start without the CSRF token, so no redirect to Google happens (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 7. [BE] The first successful sign-in creates the user and signs them in, then redirects to `/`.
  - Test first: AC-01 first Google sign-in creates the user record and signs the user in (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 8. [BE] A repeat sign-in with the same account signs in the same user and creates no second record.
  - Test first: AC-01 a repeat Google sign-in signs in the same user and creates no second record (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 9. [BE] A changed Google email still signs in the same user.
  - Test first: AC-01 a changed Google email still signs in the same user (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 10. [BE] A Google account without an email signs in, and the record has no email.
  - Test first: AC-01 a Google sign-in without an email stores the user without an email (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 11. [BE] A sign-in cancelled at Google signs nobody in and redirects to `/?sign_in_error=google`. Sets the failure handler.
  - Test first: AC-01 a sign-in cancelled at Google signs nobody in and redirects with the sign-in error (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 12. [BE] A Google sign-in that fails, including when Google cannot be reached, signs nobody in and redirects with the same error.
  - Test first: AC-01 a failed Google sign-in signs nobody in and redirects with the same sign-in error (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 13. [BE] A callback whose `state` does not match the sign-in started in this browser is rejected. The example turns OmniAuth test mode off, so OmniAuth's real state check runs.
  - Test first: AC-01 rejects a callback whose state does not match the sign-in started in this browser (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 14. [BE] `GET /api/session` returns 401 `{ "error": "unauthenticated" }` when no user is signed in.
  - Test first: AC-01 GET /api/session returns 401 when no user is signed in (`spec/requests/session_spec.rb`)
- [x] 15. [BE] `GET /api/session` returns the signed-in user, with the display name Google gave.
  - Test first: AC-01 GET /api/session returns the signed-in user's display name (`spec/requests/session_spec.rb`)
- [x] 16. [FE] While the session is checked, the app shows a loading state.
  - Test first: AC-01 shows a loading state while the session is checked (`src/App.test.tsx`)
- [x] 17. [FE] With no signed-in user, the app shows the sign-in screen with a "Continue with Google" button.
  - Test first: AC-01 shows the sign-in screen with Continue with Google when not signed in (`src/App.test.tsx`)
- [x] 18. [FE] The button is a POST form to `/auth/google_oauth2` that carries the token from `GET /api/csrf`.
  - Test first: AC-01 Continue with Google submits a POST form with the CSRF token (`src/App.test.tsx`)
- [x] 19. [FE] After the button is chosen, it shows a busy state and a second click starts no second sign-in.
  - Test first: AC-01 Continue with Google shows a busy state and ignores a second click (`src/App.test.tsx`)
- [x] 20. [FE] When the address has `?sign_in_error=google`, the sign-in screen shows "Sign-in with Google did not complete. Try again." and removes the parameter from the address.
  - Test first: AC-01 shows the sign-in error and removes it from the address (`src/App.test.tsx`)
- [x] 21. [FE] With a signed-in user, the app shows the main layout and the user's display name in the profile area.
  - Test first: AC-01 signed-in user sees the main layout with their display name (`src/App.test.tsx`)
- [x] 22. [FE] The main layout shows the empty states "No collections yet" and "No notes yet".
  - Test first: AC-01 main layout shows the no collections and no notes empty states (`src/App.test.tsx`)
- [x] 23. [BE] The request log does not record the OAuth `code` or `state` of a callback. Added after Verify found them in plain text. Filter them in `backend/config/initializers/filter_parameter_logging.rb`.
  - Test first: AC-01 the request log of a Google callback does not contain the OAuth code or state (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 24. [BE] The failure redirect names the provider (Changes, 2026-11-05). A failed or cancelled Google sign-in redirects to `/?sign_in_error=google`, as before. The failure handler reads the provider from the failed request, so a GitHub failure can redirect to `/?sign_in_error=github` (feature 02). This item only makes the name come from the provider, and GitHub itself is feature 02.
  - Test first: AC-01 a failed Google sign-in redirects with the provider name in the sign-in error (`spec/requests/auth/google_sign_in_spec.rb`)
- [x] 25. [FE] The sign-in screen shows the message for the provider named in the address: Google shows "Sign-in with Google did not complete. Try again.", GitHub shows "Sign-in with GitHub did not complete. Try again.". Feature 02 adds the GitHub message, so this item covers the Google one only, and it keeps the address clean.
  - Test first: AC-01 the sign-in error for Google names Google and clears the address (`frontend/src/App.test.tsx`)
  - Note (2026-11-05): the Google test passed before this item's code was written, because the Google message already existed. The GitHub message is feature 02's work, and the screen change for it is there. Ticked as covered, with the Google test kept as a regression test.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Use real Google credentials for items 2 to 4.

1. The sign-in screen offers Google
   - Steps: open http://localhost:3000 in a private window.
   - Expected: the sign-in screen with a "Continue with Google" button.
   - Result: Pass, 2026-11-05. Headless Chrome with no cookies: the button shows, the form POSTs to /auth/google_oauth2, the hidden token is filled from /api/csrf (86 characters), and the screenshot shows the sign-in screen. The only console error is the expected 401 from /api/session. The button was not clicked, so no sign-in started.
2. First sign-in with Google
   - Steps: note the user count (`docker compose run --rm backend bin/rails runner 'p User.count'`). Choose "Continue with Google" and approve with a Google account that has not signed in before. Check the count again.
   - Expected: the main layout, with the Google display name in the profile area. The count rose by one.
   - Result: Waived by the owner, 2026-11-05. Not run and not Pass; see the waiver in Deviations. The owner did not confirm the main layout on screen. Partial evidence from the server log only: the callback at 11:59:05 UTC redirected to `/`, and `/api/session` then returned user id 1. The count stayed at 1, since the account already existed (see Deviations). The log shows no raw OAuth code or state; both appear as [FILTERED].
3. Sign in again with the same Google account
   - Steps: sign in again with the account from item 2. Check the count again.
   - Expected: the main layout, with the same name. The count is unchanged.
   - Result: Waived by the owner, 2026-11-05. Not run and not Pass; see the waiver in Deviations. No second sign-in was done on the current code. The repeat-sign-in behavior is covered by the automated test in item 8 (no second record, same user).
4. Google sign-in is cancelled
   - Steps: choose "Continue with Google", then cancel at Google.
   - Expected: the sign-in screen with "Sign-in with Google did not complete. Try again." The app shows no signed-in user.
   - Result: Pass, 2026-11-05. The owner clicked "Continue with Google" and cancelled at Google. The screen showed "Sign-in with Google did not complete. Try again.". The server log at 12:01:48 UTC shows the callback with `error=access_denied` and the failure path. The count stayed at 1.
5. Google sign-in fails
   - Steps: stop the app. Set `GOOGLE_CLIENT_SECRET` to a wrong value and run `docker compose up` again. Choose "Continue with Google" and approve at Google. Restore the secret afterwards.
   - Expected: the sign-in screen with "Sign-in with Google did not complete. Try again."
   - Result: Waived by the owner, 2026-11-05. Marked complete, not run and not Pass, at the owner's request. The failure path is covered by the automated tests in items 11 and 12.

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/users.md` (create): `## User` with each attribute and its validation; `## Rules`: identity is provider + provider_user_id, the record is created at the first sign-in, email is optional; `## Chosen approaches`: profile fields are not refreshed by later sign-ins (AC-01)
  - Check: every column in the `users` migration appears with its validation
- [x] 2. `docs/api_contract.md` (create): `## Conventions` (base path `/api`, authentication by the session cookie, error body `{ "error": "<code>" }`, status codes used); `GET /api/csrf`, `POST /auth/google_oauth2`, `GET /auth/google_oauth2/callback`, `GET /api/session` with requests, responses, and errors; `## WebSocket`: none in this feature (AC-01)
  - Check: each path in `docker compose run --rm backend bin/rails routes` for these endpoints is documented with its status codes
- [x] 3. `docs/conventions.md` (create): `## UI`: the sign-in error comes from `?sign_in_error=`, a loading state while the session is checked, a busy state on the sign-in button; `## Code`: OmniAuth configuration in `backend/config/initializers/omniauth.rb`, the test helper in `backend/spec/support/omniauth.rb` (AC-01)
  - Check: each file named in `## Code` exists
- [x] 4. `README.md` (update): new sections "Google OAuth credentials" (create the OAuth client, redirect URI `http://localhost:3000/auth/google_oauth2/callback`, scopes `email` and `profile`) and "Environment variables" (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`, `SECRET_KEY_BASE` for production; the `.env` file that compose reads). Also a "Known limitations" entry: the SQL log of a user insert shows the email, avatar URL, and Google user ID (feature 21) (AC-01)
  - Check: every variable read in `backend/config` appears in the README with what it is for, and the known limitation is listed

## Deviations

- 2026-11-05: Items 10 to 12 were ticked as covered. Their tests passed before any code of their own was written, because items 4 and 6 already cover the behavior (nullable `email` column; the shared failure handler). The tests stay in the suite as regression tests. The owner chose this on 2026-11-05.
- 2026-11-05: Test-only client id and secret. The Google strategy refuses to build a redirect without a client id, and it reads `ENV` when Rails boots, before `spec/support` loads. `backend/config/initializers/omniauth.rb` supplies placeholder values only when `Rails.env.test?`. In production, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required. Reason: tests run without real credentials (requirements.md section 7).
- 2026-11-05: Test mode is off in the sign-in start example (item 6) as well as the state check (item 13). The plan named only item 13. Item 6 needs OmniAuth's CSRF phase, which test mode skips.
- 2026-11-05: `OmniAuth.config.full_host` comes from the new variable `APP_BASE_URL` (default `http://localhost:3000`). OmniAuth warned that callback URLs built from the request's Host header can be forged. Docs item 4 must list `APP_BASE_URL` in the README.
- 2026-11-05: `Api::CsrfController` includes `ActionController::RequestForgeryProtection`, because API mode leaves out the helper that `form_authenticity_token` needs. Wiring only; the behavior is as planned.
- 2026-11-05: Verify found that the request log records the callback's OAuth `code` and `state` in plain text, because the parameter filter list does not cover them. Item 23 fixes this. The owner chose to fix it in feature 01 on 2026-11-05. No spec change: requirements.md section 5 already requires secure SSO, and log filtering is how that is met.
- 2026-11-05: Verify item 2 ran with the existing account, not a new one. The plan's wording expected the count to rise by one, which needs a Google account that has never signed in. The owner chose to run it with the existing account. A first sign-in creating a record is still covered by the automated test in item 7, and by the database evidence from the first sign-in earlier the same day (id 1, created 11:43 UTC). No new-account walkthrough was run.
- 2026-11-05: Verify items 2, 3 and 5 were skipped at the owner's request, and are not recorded as Pass. Items 1 and 4 passed. The Verify exit gate (every item Pass, see specs/README.md step 5) is not met. Polish starts only if the owner waives the gate, and that waiver must be recorded here with the owner's decision.
- 2026-11-05 (owner waiver): Verify items 2, 3 and 5 are waived. They were not run, and they are not recorded as Pass. The owner asked to mark them complete ("skip these checks and mark as completed"; "mark this as completed, we will not test it") and to start Polish. Items 1 and 4 passed. Not covered by a manual run: the name on screen after a sign-in, the repeat sign-in on the current code, and the failed sign-in in the browser. Covered by automated tests: items 7 and 8 (first and repeat sign-in), items 11 and 12 (failure paths), items 15 and 21 (display name in the main layout). Covered by server-log evidence: the sign-in callback and the redaction of the OAuth code and state.
- 2026-11-05: During Verify, `compose.yaml` was changed to pass `.env` into the backend container (`env_file`, optional), and a root `.gitignore` was added with `.env`. Reason: the Google credentials in `.env` did not reach the container, and `.env` holds secrets. These are the only changes outside `backend/` and `frontend/` for this feature. Polish records them in the README.
- 2026-11-05 (Polish): Drift check found no mismatch between the feature's documents and the code. Verified: each `users` column is in `docs/domain/users.md`; each endpoint is in `docs/api_contract.md` and answers as documented, live; the session holds only `user_id`; the cookie is `httponly` and `samesite=lax`.
- 2026-11-05 (Polish): Found and listed, not fixed. The session cookie is not marked `secure` in the app code. Production sets `force_ssl`, but Rails sets the flag only when the cookie asks for it. The approved spec and plan say nothing about the flag, so this is a gap in the requirements, not a code contradiction. The README lists it under Known limitations for the owner to decide.
- 2026-11-05 (Polish, out of scope): `backend/config/cable.yml` uses Redis in production, but the Gemfile comments out the `redis` gem. Existing scaffold, not part of feature 01. Not fixed here.
- 2026-11-05 (Changes, failure names the provider): Items 24 and 25 were added for the spec change approved on the same day. Item 24 is built: the failure handler names the strategy's provider, so a GitHub failure names `github` (feature 02). The short names come from a map, because OmniAuth's strategy name is `google_oauth2`, and the address uses `google`. Item 25's Google test passed before its code, so it is ticked as covered: the GitHub message is feature 02's work.
- 2026-11-05: Known limitation, not fixed here. The SQL log of a user insert shows the email, the avatar URL, and the Google user ID. Rails does not filter SQL in logs. Feature 21 (data privacy) owns it, and the README lists it.
