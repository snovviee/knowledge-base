# Plan: 02_github_sign_in

**Approved:** yes, 2026-11-05
**Depends on:** 01

## Approach

- Data: no new table. The `users` table from feature 01 already holds `provider` and `provider_user_id`. GitHub users are stored with provider `github` and the numeric GitHub id as a string. The display name falls back to the GitHub login when GitHub sends no name (spec question 4).
- API: no new endpoints. `POST /auth/github` (sign-in start, with the same CSRF check as Google) and `GET /auth/github/callback`, both mounted by OmniAuth. Failures redirect to `/?sign_in_error=github`.
- WebSocket: none.
- UI: the sign-in screen gets a second button, "Continue with GitHub", in a form like the Google one. The busy state and the failure message are per provider. The failure message is "Sign-in with GitHub did not complete. Try again.".
- Decisions:
  - Gem `omniauth-github` (2.0.1), added with `bundle add`. Its strategy name is `github`, which matches the short name in the failure redirect without a map entry.
  - Scope `user:email`. The strategy reads the verified primary email only when the token has `user` or `user:email`. Without it, GitHub sends no email, which the spec allows.
  - The uid is GitHub's numeric `id` as a string, unique within provider `github`. Identity is `provider` + `provider_user_id`, so a Google and a GitHub user with the same person are two records (spec question 3).
  - Display name: `auth.info.name` if present, otherwise `auth.info.nickname` (the login). `display_name` is required (feature 01), so a `nil` name would fail the record.
  - Test mode, the placeholder client credentials, and the state check follow feature 01's pattern. Placeholders for GitHub are test-only, in `backend/config/initializers/omniauth.rb`.
  - The failure handler already names the provider from the strategy (feature 01, item 24). No change to it is needed for GitHub: the map covers `google_oauth2` and `github`, and `github` passes through.
  - Callback URL: `http://localhost:3000/auth/github/callback`.

## Checklist

- [x] 1. [SETUP] `omniauth-github` is in `backend/Gemfile` and the lock file (added with `bundle add`).
  - Check: `docker compose run --rm backend bundle list`: lists `omniauth-github`.
- [x] 2. [SETUP] Configure the GitHub provider in `backend/config/initializers/omniauth.rb`. Credentials from `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, with test-only placeholders in the test environment. Scope `user:email`.
  - Check: `docker compose run --rm backend bin/rails runner 'puts OmniAuth::Strategies::GitHub.default_options[:scope].inspect'` shows `user:email`, or the provider is listed in `bin/rails middleware`.
- [x] 3. [BE] `POST /auth/github` without a valid CSRF token redirects to `/?sign_in_error=github`, and no redirect to GitHub happens.
  - Test first: AC-02 refuses a GitHub sign-in start without the CSRF token, so no redirect to GitHub happens (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 4. [BE] The first successful GitHub sign-in creates a user with provider `github`, the GitHub id as `provider_user_id`, and signs them in.
  - Test first: AC-02 first GitHub sign-in creates the user record and signs the user in (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 5. [BE] A repeat GitHub sign-in signs in the same user and creates no second record.
  - Test first: AC-02 a repeat GitHub sign-in signs in the same user and creates no second record (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 6. [BE] A GitHub account with no public name is stored with its login as the display name.
  - Test first: AC-02 a GitHub account with no public name uses its login as the display name (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 7. [BE] A GitHub account with no email signs in, and the record has no email.
  - Test first: AC-02 a GitHub account with no email signs in and stores the user without an email (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 8. [BE] A GitHub sign-in whose email changes still signs in the same user, because identity is the GitHub id.
  - Test first: AC-02 a changed GitHub email still signs in the same user (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 9. [BE] A Google account and a GitHub account of the same person are two users.
  - Test first: AC-02 a Google user and a GitHub user with the same email are two separate users (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 10. [BE] A sign-in cancelled at GitHub signs nobody in and redirects to `/?sign_in_error=github`.
  - Test first: AC-02 a GitHub sign-in cancelled at GitHub redirects with the GitHub sign-in error (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 11. [BE] A failed GitHub sign-in, including when GitHub cannot be reached, signs nobody in and redirects with the same error.
  - Test first: AC-02 a failed GitHub sign-in signs nobody in and redirects with the GitHub sign-in error (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 12. [BE] A callback whose `state` does not match the sign-in started in this browser is rejected.
  - Test first: AC-02 rejects a GitHub callback whose state does not match the sign-in started in this browser (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 13. [BE] A failure from GitHub names GitHub in the redirect (feature 01 item 24 covers the handler; this item checks GitHub end to end).
  - Test first: AC-02 a failure from GitHub redirects with the provider name github (`spec/requests/auth/github_sign_in_spec.rb`)
- [x] 14. [FE] The sign-in screen shows a "Continue with GitHub" button, in a POST form with the CSRF token, next to the Google button.
  - Test first: AC-02 the sign-in screen offers Continue with GitHub as a POST form with the CSRF token (`frontend/src/App.test.tsx`)
- [x] 15. [FE] After "Continue with GitHub" is chosen, the button shows a busy state and a second click starts no second sign-in.
  - Test first: AC-02 Continue with GitHub shows a busy state and ignores a second click (`frontend/src/App.test.tsx`)
- [x] 16. [FE] When the address has `?sign_in_error=github`, the screen shows "Sign-in with GitHub did not complete. Try again." and removes the parameter from the address.
  - Test first: AC-02 the sign-in error for GitHub names GitHub and clears the address (`frontend/src/App.test.tsx`)

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Use a real GitHub OAuth app for items 2 to 4. Browser sign-in must be done by the owner by hand: GitHub blocks automated browsers.

1. The sign-in screen offers GitHub
   - Steps: open http://localhost:3000 in a private window.
   - Expected: the sign-in screen with "Continue with Google" and "Continue with GitHub".
   - Result: not run
2. First sign-in with GitHub
   - Steps: note the user count (`docker compose run --rm backend bin/rails runner 'p User.count'`). Choose "Continue with GitHub" and approve with a GitHub account that has not signed in before. Check the count again.
   - Expected: the main layout, with the GitHub display name (or login) in the profile area. The count rose by one.
   - Result: not run
3. Sign in again with the same GitHub account
   - Steps: sign in again with the account from item 2. Check the count again.
   - Expected: the main layout, with the same name. The count is unchanged.
   - Result: not run
4. GitHub sign-in is cancelled
   - Steps: choose "Continue with GitHub", then cancel at GitHub.
   - Expected: the sign-in screen with "Sign-in with GitHub did not complete. Try again.". The app shows no signed-in user.
   - Result: not run
5. Google and GitHub are separate users
   - Steps: note the count. Sign in with a Google account, then with a GitHub account, in separate private windows. Check the count.
   - Expected: two more users, one per provider account.
   - Result: not run

## Docs

Written in Polish, from the code as built.

- [ ] 1. `docs/domain/users.md` (update): `## Chosen approaches` gets the GitHub display name fallback (login when no name) and the GitHub id as `provider_user_id`; `## Rules` gets the GitHub email rule (no email is allowed) (AC-02)
  - Check: each rule from the approved spec's questions 2 to 4 appears in `users.md`
- [ ] 2. `docs/api_contract.md` (update): `POST /auth/github` and `GET /auth/github/callback` with their requests, responses, and the `?sign_in_error=github` redirect (AC-02)
  - Check: each GitHub path answers as documented, live: `curl -X POST http://localhost:3000/auth/github` returns 302 to `/?sign_in_error=github`
- [ ] 3. `docs/conventions.md` (update): the failure message is per provider, and the sign-in screen lists both providers (AC-02)
  - Check: each message named in `conventions.md` appears in `frontend/src/App.tsx`
- [ ] 4. `README.md` (update): "GitHub OAuth credentials" (create the OAuth app, callback `http://localhost:3000/auth/github/callback`, scope `user:email`) and `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the environment table; remove the "Sign-in with GitHub is not built" limitation (AC-02)
  - Check: both variables appear in the README, and the limitation line is gone

## Deviations

- 2026-11-05: Items 3, 10, 11, 12 and 13 were ticked as covered. Their tests passed before any GitHub callback code existed, because the shared provider-name failure handler (feature 01, item 24) and the OmniAuth state check already cover them. The tests stay as regression tests for GitHub. Item 3 is the sign-in-start refusal, which passed once the GitHub provider was configured (item 2). The same rule applied to feature 01 items 10 to 12, which the owner approved. For feature 02 these five were ticked under the owner's standing approval for workflow gates through feature 06 (2026-11-05), and the owner has not reviewed this specific ticking.
- 2026-11-05: Item 15 (GitHub busy state) was ticked as covered. Its test passed before any new GitHub code, because the busy state is shared by both sign-in forms. The test stays as a regression test for GitHub.
- 2026-11-05: The sign-in callbacks share one controller method (`Auth::SessionsController#sign_in_from_provider`) for Google and GitHub. Reason: the find-or-create rule is the same for both, so the two routes cannot drift apart. The Google behavior is unchanged, and its tests pass.
- 2026-11-05: Item 13's check uses the `github` provider name as the redirect name. The strategy name is `github` at runtime (checked by instantiating `OmniAuth::Strategies::GitHub`), so no map entry was needed.
- 2026-11-05: Added a log-redaction test for GitHub callbacks (`code` and `state` not in the request log). It is not a separate plan item. The global filter from feature 01 covers GitHub too, and the test shows that.
