# Feature: 01_google_sign_in

**Stage:** Done
**Approved:** yes, 2026-11-05

## Acceptance criterion

> AC-01: A user can sign in with Google

Sources: requirements.md 3.1, 4 (authentication screen, main layout, ui_quality_checks), 5, 11; docs/: none yet.

Not part of this feature: GitHub sign-in (AC-02), the record rules beyond what sign-in needs (AC-03), keeping the session across a page refresh (AC-04), and logout (AC-05).

## Questions

1. Who creates the local user record at the first Google sign-in? The record rules belong to AC-03, but a sign-in cannot finish without a record.
   - Answer: Create it here. This feature creates the record on the first Google sign-in. AC-03 adds the rules for the record.

2. Where does the user land after a successful sign-in?
   - Answer: The main layout (requirements.md section 4): collections on the left, notes in the main area.

3. What does the user see when the Google sign-in fails or is cancelled at Google?
   - Answer: One message for both cases: "Sign-in with Google did not complete. Try again." The provider's error text is not shown.

## Scenarios

**The sign-in screen offers Google**
- Given I am not signed in
- When I open the app
- Then I see the sign-in screen with a "Continue with Google" button

**First sign-in with Google**
- Given I have never signed in with this Google account
- When I choose "Continue with Google" and approve the sign-in at Google
- Then the app creates my local user record
- Then I am signed in and land on the main layout
- Then my profile area shows the display name Google gives for my account

**Sign in again with the same Google account**
- Given I have signed in with this Google account before
- When I choose "Continue with Google" and approve the sign-in at Google
- Then I am signed in as the same user
- Then no second user record is created

**Google sign-in is cancelled**
- Given I am on the sign-in screen
- When I choose "Continue with Google" and cancel at Google
- Then I am not signed in
- Then I stay on the sign-in screen and see "Sign-in with Google did not complete. Try again."

**Google sign-in fails**
- Given I am on the sign-in screen
- When I choose "Continue with Google" and Google reports an error
- Then I am not signed in
- Then I stay on the sign-in screen and see "Sign-in with Google did not complete. Try again."

## Edge cases

- The sign-in response does not match the sign-in started in this browser (a replayed or forged response): the sign-in is rejected, no session is created, and the message "Sign-in with Google did not complete. Try again." is shown.
- Google cannot be reached when the sign-in completes: the same message is shown, and I stay signed out.
- Google returns no email for the account: the sign-in succeeds and the record has no email. Email is optional (requirements.md 3.1).
- The email of the Google account changes between sign-ins: the same user is signed in, because identity is the Google account, not its email (requirements.md 3.1, section 11).
- "Continue with Google" is chosen again while a sign-in is in progress: the button shows a busy state, and no second sign-in starts (requirements.md section 4, loading state).
- The main layout is shown before AC-06 (collections) and AC-09 (notes) exist: the collections and notes areas show their empty states, "no collections" and "no notes" (requirements.md section 4, ui_quality_checks).
- The sign-in completes through a browser redirect, not an API call, so no HTTP status code applies. The results are the screens and messages above.

## Changes

### 2026-11-05: The failure redirect names the provider

- Reason: feature 02 adds GitHub sign-in. Its failures must show a GitHub message, so the one shared failure redirect can no longer say only `google`. The owner chose to name the provider (feature 02, question on the failure message).
- Change: the sign-in failure redirect `/?sign_in_error=google` → the same path with the provider name: `/?sign_in_error=google` stays for Google. A GitHub failure uses `/?sign_in_error=github`. The message for Google does not change: "Sign-in with Google did not complete. Try again."
- Change: edge case, a failed or cancelled sign-in: the address names the provider that failed, not a fixed `google`.
- Stage: approved by the owner on 2026-11-05. The header stays at Design and not approved until feature 01's plan gets the new item below and the owner approves that plan. Its code changes only through that item.
