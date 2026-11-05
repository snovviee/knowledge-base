# Conventions

## UI

- **Loading.** While the app checks the session, the page shows a status line "Loading…" with `role="status"`. The app does not flash the sign-in screen first (AC-01, AC-04).
- **Sign-in error.** A failed or cancelled sign-in comes back as `?sign_in_error=google`. The sign-in screen shows "Sign-in with Google did not complete. Try again." with `role="alert"`, and the parameter is removed from the address (AC-01).
- **Busy button.** The sign-in button is disabled and has `aria-busy="true"` after it is chosen, so a second click starts no second sign-in (AC-01).
- **Empty states.** The main layout shows "No collections yet" in the collections area and "No notes yet" in the notes area (AC-01). Later features replace these with their own lists, and keep the same wording rule.

## Code

- **Sign-in configuration.** `backend/config/initializers/omniauth.rb`. Credentials come from `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Test-only placeholders apply in the test environment only.
- **Test helper.** `backend/spec/support/omniauth.rb` turns OmniAuth test mode on for every example. An example sets `OmniAuth.config.mock_auth[:google_oauth2]` to simulate a provider response. Tests never reach Google (requirements.md section 7).
- **Test mode and CSRF.** OmniAuth test mode skips its request and callback phases, including the CSRF and state checks. An example that tests those checks must set test mode off in a `before` block, because the global `before` in the helper runs after an `around` block.
- **Forgery protection in tests.** Rails' forgery protection is off in the test environment. An example that needs it sets `ActionController::Base.allow_forgery_protection = true`.
- **Session and cookies.** API mode leaves out the cookie and session middleware. `backend/config/application.rb` adds them back for sign-in. Any new endpoint that reads the session needs no extra setup.
- **Forgery helpers in API controllers.** A controller that calls `form_authenticity_token` includes `ActionController::RequestForgeryProtection` itself (`Api::CsrfController`).
- **Frontend tests.** `frontend/src/App.test.tsx` replaces `fetch` with `vi.stubGlobal` and answers `/api/session` and `/api/csrf` per test. Wait for asynchronous UI with `findBy` or `waitFor`.
