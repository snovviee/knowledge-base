# Conventions

## UI

- **Loading.** While the app checks the session, the page shows a status line "Loading…" with `role="status"`. The app does not flash the sign-in screen first (AC-01, AC-04).
- **Sign-in error.** A failed or cancelled sign-in comes back as `?sign_in_error=google` or `?sign_in_error=github`. The sign-in screen names that provider: "Sign-in with Google did not complete. Try again." or "Sign-in with GitHub did not complete. Try again." It is shown with `role="alert"`, and the parameter is removed from the address (AC-01, AC-02).
- **Busy button.** After either sign-in button is chosen, both sign-in buttons are disabled and have `aria-busy="true"`, so a second click starts no second sign-in (AC-01, AC-02).
- **Empty states.** The main layout shows "No collections yet" in the collections area and "No notes yet" in the notes area (AC-01). Later features replace these with their own lists, and keep the same wording rule.

## Code

- **Sign-in configuration.** `backend/config/initializers/omniauth.rb`. Credentials come from `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google, and from `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` for GitHub, which requests the `user:email` scope (AC-02). Test-only placeholders apply in the test environment only.
- **Test helper.** `backend/spec/support/omniauth.rb` turns OmniAuth test mode on for every example. An example sets `OmniAuth.config.mock_auth[:google_oauth2]` (or `[:github]` for GitHub) to simulate a provider response. Tests never reach Google or GitHub (requirements.md section 7).
- **Test mode and CSRF.** OmniAuth test mode skips its request and callback phases, including the CSRF and state checks. An example that tests those checks must set test mode off in a `before` block, because the global `before` in the helper runs after an `around` block.
- **Forgery protection in tests.** Rails' forgery protection is off in the test environment. An example that needs it sets `ActionController::Base.allow_forgery_protection = true`.
- **Session and cookies.** API mode leaves out the cookie and session middleware. `backend/config/application.rb` adds them back for sign-in. Any new endpoint that reads the session needs no extra setup.
- **Forgery helpers in API controllers.** A controller that calls `form_authenticity_token` includes `ActionController::RequestForgeryProtection` itself (`Api::CsrfController`).
- **Frontend tests.** `frontend/src/App.test.tsx` replaces `fetch` with `vi.stubGlobal` and answers `/api/session` and `/api/csrf` per test. Wait for asynchronous UI with `findBy` or `waitFor`.
- **Creating a record from a sign-in.** `find_or_create_user` in `backend/app/controllers/auth/sessions_controller.rb` looks up the account, creates it on the first sign-in, and on a duplicate uses the record the other request created. It rescues the duplicate and any other invalid record, then looks the account up again. A duplicate finds the other request's record. Any other invalid record finds nothing and returns no user, so the sign-in takes the failure redirect (AC-03).
- **Race tests.** A lost race is tested by stubbing `User.find_by` to miss once for the account, so the create reaches the duplicate (`backend/spec/requests/auth/user_auto_create_spec.rb`) (AC-03).
