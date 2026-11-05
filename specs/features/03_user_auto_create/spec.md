# Feature: 03_user_auto_create

**Stage:** Verify
**Approved:** yes, 2026-11-05 (the owner's standing approval for spec, plan, and workflow gates through feature 06, given 2026-11-05; the three answers above are the owner's own)

## Acceptance criterion

> AC-03: A local user record is created automatically on first successful SSO sign-in

Sources: requirements.md 3.1 (accounts and authentication, profile data), 5 (backend), 6 (data), 11 (additional notes); docs/: `domain/users.md`, `api_contract.md`, `conventions.md` (features 01 and 02).

Built by features 01 and 02, and this spec does not repeat them: the record is created on the first successful sign-in with Google (AC-01) or GitHub (AC-02); a repeat sign-in with the same provider account finds it; the profile fields are provider, provider user id, email when sent, display name, and avatar URL.

This feature covers the rules that features 01 and 02 left to AC-03: what a repeat sign-in does to the stored profile, and what happens when two sign-ins for the same new account happen at the same time.

## Questions

1. A user changes their Google or GitHub name, avatar, or email. Should a later sign-in update the stored display name, email, and avatar, or keep the values from the first sign-in? (Features 01 and 02 keep the first values. The docs record that choice as "set once, at creation".)
   - Answer: Keep the first values. A later sign-in does not update the profile.

2. Two sign-ins for the same new account happen at the same moment, for example a double click with two tabs. Should both succeed and sign the user in, with one record created?
   - Answer: Both succeed. One record is created. The second sign-in finds the record the first one made and signs the user in, with no error page.

3. A sign-in from a provider that sends no display name and no login (GitHub users can leave both empty) cannot create a record, because the display name is required. What should the user see?
   - Answer: The sign-in failure message for that provider, the same message as a cancelled sign-in ("Sign-in with GitHub did not complete. Try again."). No record is created.

## Scenarios

**One record for one provider account**
- Given I have signed in with a provider account before
- When I sign in with the same provider account again
- Then the app finds the same user record, and no record is created

**Two sign-ins race for a new account**
- Given I have never signed in with this provider account
- When two sign-ins for it finish at the same moment
- Then one user record exists for the account
- Then both sign-ins sign me in as that user, with no error page

**A provider account with no usable name cannot be stored**
- Given I have never signed in with this provider account, and the provider sends no name and no login
- When I finish the sign-in at the provider
- Then no user record is created
- Then I am not signed in, and I see the sign-in message for that provider (question 3)

## Edge cases

- The same provider id under two providers is two users (AC-02 scenario, feature 02 question 3). This feature does not change that rule.
- The profile fields are read only on the first sign-in, unless question 1 changes that.
- A sign-in that loses a race for a new account is not an error for the user (question 2). The record the other sign-in created is used.
- The sign-in completes through a browser redirect, not an API call, so no HTTP status code applies. The results are the screens and messages above.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
