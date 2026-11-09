# Feature: 02_github_sign_in

**Stage:** Done
**Approved:** yes, 2026-11-05

## Acceptance criterion

> AC-02: A user can sign in with GitHub

Sources: requirements.md 3.1, 4 (authentication screen, main layout, ui_quality_checks), 5, 11; docs/: `domain/users.md`, `api_contract.md`, `conventions.md` (feature 01).

Not part of this feature: Google sign-in (AC-01, feature 01), the record rules beyond what sign-in needs (AC-03), keeping the session across a page refresh (AC-04), logout (AC-05), and linking a Google account and a GitHub account (requirements.md 3.1 leaves this out of the MVP).

## Questions

1. Does GitHub sign-in use the same sign-in screen, the same session, and the same failure message as Google (feature 01)?
   - Answer: Same flow. The sign-in screen gets a second button, "Continue with GitHub", and the session is the same. The failure message names the provider: "Sign-in with GitHub did not complete. Try again."

2. GitHub may send no email. Should the sign-in still succeed when GitHub sends no email, and the record have no email?
   - Answer: Yes. The sign-in succeeds and the record has no email. Email is optional (requirements.md 3.1), and identity is provider + provider_user_id.

3. A person who has both a Google account and a GitHub account signs in with each. Should these be two separate users?
   - Answer: Two users. Each provider account is its own user. Account linking is not required (requirements.md 3.1).

4. GitHub users may leave their public name empty, and then GitHub sends no name. The record needs a display name (feature 01). What name should the record and the profile area show?
   - Answer: The GitHub login (username). When GitHub sends no name, the display name is the login. The login is always present for a GitHub account.

## Scenarios

**The sign-in screen offers GitHub**
- Given I am not signed in
- When I open the app
- Then I see the sign-in screen with a "Continue with GitHub" button

**First sign-in with GitHub**
- Given I have never signed in with this GitHub account
- When I choose "Continue with GitHub" and approve the sign-in at GitHub
- Then the app creates my local user record
- Then I am signed in and land on the main layout
- Then my profile area shows the display name GitHub gives for my account

**Sign in again with the same GitHub account**
- Given I have signed in with this GitHub account before
- When I choose "Continue with GitHub" and approve the sign-in at GitHub
- Then I am signed in as the same user
- Then no second user record is created

**First sign-in with a GitHub account that has no public name**
- Given I have never signed in with this GitHub account, and GitHub sends no name for it
- When I choose "Continue with GitHub" and approve the sign-in at GitHub
- Then the app creates my local user record, with my GitHub login as the display name
- Then I am signed in and land on the main layout, and my profile area shows my GitHub login

**A Google account and a GitHub account are two users**
- Given I have signed in with a Google account
- When I sign in with a GitHub account that is not the same account
- Then a second user record is created, separate from the Google user
- Then I am signed in as the GitHub user

**GitHub sign-in is cancelled**
- Given I am on the sign-in screen
- When I choose "Continue with GitHub" and cancel at GitHub
- Then I am not signed in
- Then I stay on the sign-in screen and see "Sign-in with GitHub did not complete. Try again."

**GitHub sign-in fails**
- Given I am on the sign-in screen
- When I choose "Continue with GitHub" and GitHub reports an error
- Then I am not signed in
- Then I stay on the sign-in screen and see "Sign-in with GitHub did not complete. Try again."

## Edge cases

- The sign-in response does not match the sign-in started in this browser (a replayed or forged response): the sign-in is rejected, no session is created, and the failure message is shown.
- GitHub cannot be reached when the sign-in completes: the failure message is shown, and I stay signed out.
- A failed or cancelled GitHub sign-in shows the GitHub message, and a failed or cancelled Google sign-in shows the Google message. Each provider's failure returns with its own name in the address (`?sign_in_error=github` or `?sign_in_error=google`). The shared failure path of feature 01 carries the name; its behavior for Google is unchanged. Feature 01's behavior change is recorded in `specs/features/01_google_sign_in/spec.md` under Changes.
- GitHub returns no email for the account: the sign-in succeeds and the record has no email (requirements.md 3.1, section 11; question 2).
- GitHub returns no name for the account: the display name is the GitHub login (question 4). A later sign-in does not change it (feature 01 rule).
- The GitHub user id is the identity, so the same person who changes their GitHub email still signs in as the same user (requirements.md 3.1, section 11).
- "Continue with GitHub" is chosen again while a sign-in is in progress: the button shows a busy state, and no second sign-in starts (requirements.md section 4, loading state).
- The sign-in completes through a browser redirect, not an API call, so no HTTP status code applies. The results are the screens and messages above.

## Changes

### 2026-11-05: GitHub accounts with no public name

- Reason: the approved spec did not say what display name a GitHub account gets when GitHub sends no name. Feature 01's record requires a display name, so the first sign-in would fail. The owner chose the GitHub login as the fallback.
- Change: question 4 and its answer added. Scenario "First sign-in with a GitHub account that has no public name" added. Edge case "GitHub returns no name" added.
- Stage: back to Design and not approved, as the workflow requires for a behavior change. Approved by the owner on 2026-11-05, and the stage is Plan.
