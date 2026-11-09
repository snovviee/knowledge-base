# Plan: 03_user_auto_create

**Approved:** yes, 2026-11-05 (the owner's standing approval for spec, plan, and workflow gates through feature 06)
**Depends on:** 01, 02

## Approach

- Data: no change. The `users` table and its unique index on (`provider`, `provider_user_id`) come from feature 01.
- API: no change. The sign-in callbacks (`GET /auth/google_oauth2/callback`, `GET /auth/github/callback`) are the only paths that create a record.
- WebSocket: none.
- UI: no change. A sign-in that cannot create a record shows that provider's failure message (spec question 3).
- Decisions:
  - Profile fields are set once, at the first sign-in (spec question 1). This matches features 01 and 02, so no update code is added.
  - Two sign-ins for the same new account: the create that loses the race fails on the unique index, or on the model's uniqueness check, and the sign-in then uses the record the other request made (spec question 2). The fix is in `Auth::SessionsController#find_or_create_user`.
  - Only a duplicate is a race. Any other invalid record (no usable name) returns no user, and the controller redirects with that provider's `sign_in_error` (spec question 3). The rescue must not swallow other errors.

## Checklist

- [x] 1. [BE] A repeat sign-in with a provider account finds the same record and creates no second one.
  - Test first: AC-03 one record for one provider account (`spec/requests/auth/user_auto_create_spec.rb`)
  - Note: covered by feature 01 item 8 and feature 02 item 5. This item's test is a direct AC-03 check of the rule. It passed before any new code, because the find-or-create was already in place. Ticked as covered.
- [x] 2. [BE] Two sign-ins that race for a new account both sign the user in, with one record.
  - Test first: AC-03 a sign-in that loses a race to a second request for the same account still signs the user in (`spec/requests/auth/user_auto_create_spec.rb`)
  - Red: 422 (RecordInvalid, provider user already taken), confirmed by a probe that caught the exception class.
- [x] 3. [BE] A sign-in with no usable name creates no record, and redirects with that provider's sign-in error.
  - Test first: AC-03 a provider account with no usable name cannot be stored and redirects with the sign-in error (`spec/requests/auth/user_auto_create_spec.rb`)
- [x] 4. [BE] The first sign-in with a provider account stores exactly the profile fields requirements.md 3.1 lists, and a later sign-in does not change them (spec question 1).
  - Test first: AC-03 a later sign-in with a changed name and avatar keeps the first values (`spec/requests/auth/user_auto_create_spec.rb`)
  - Note: passed before any new code, because the first-values behavior already existed in features 01 and 02 (which keep the first values). Ticked as covered. This test adds the name and avatar, which the earlier tests did not check.

## Test plan

Manual walkthrough for Verify. Owner signs in by hand: Google and GitHub block automated browsers.

1. Repeat sign-in keeps one record
   - Steps: note the count. Sign in with Google, then sign out or use a new private window and sign in again with the same account. Check the count.
   - Expected: the count is the same after the second sign-in as after the first.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
2. Changed profile keeps the first values
   - Steps: change the display name on the Google account, then sign in again. Check the stored display name with `bin/rails runner`.
   - Expected: the stored name is the one from before the change.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
3. No usable name fails cleanly
   - Steps: needs a GitHub account with no public name and no login. Skipped if no such account is available.
   - Expected: the sign-in screen with "Sign-in with GitHub did not complete. Try again.", and no record.
   - Result: Skipped, 2026-11-09, not Pass. GitHub always sends a login, so the account this item needs cannot exist. The owner approved the skip; the request spec covers the behavior (see Deviations).

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/users.md` (update): `## Rules` gets the race rule (two sign-ins for one new account create one record, and both sign in) and the no-usable-name rule (no record, the provider's failure message); `## Chosen approaches` confirms the profile is set once (AC-03)
  - Check: each rule from the approved spec appears in `users.md`
- [x] 2. `docs/conventions.md` (update): the race handling is a shared pattern, so later features that create records can reuse it (AC-03)
  - Check: the convention names `find_or_create_user` in `backend/app/controllers/auth/sessions_controller.rb`
- [x] 3. `docs/api_contract.md` (update): both callbacks document the race response (302 to `/`, one record) and the no-usable-name response (302 to `/?sign_in_error=<provider>`), which this feature changed (AC-03) (found in Polish)
  - Check: each callback's documented responses match the examples in `backend/spec/requests/auth/user_auto_create_spec.rb`

## Deviations

- 2026-11-05: The race fix (item 2) and the no-usable-name handling (item 3) were written before this plan, during Design. The rules came from the owner's answers to spec questions 2 and 3. Item 2's test was red first: 422 from the duplicate create, confirmed by catching `ActiveRecord::RecordInvalid`. Item 3's first version was wrong: its mock still had an email, so the sign-in succeeded and the test failed for the wrong reason. The mock was corrected to OmniAuth's real fallback (no name, no login, no email), and then the test was red for the right reason and green after the fix.
- 2026-11-05: The rescue in `find_or_create_user` first caught every `RecordInvalid`, which turned a no-name sign-in into a 404. It now returns nil for anything that is not a duplicate, so the failure redirect applies. This was found by a probe while building item 3, before the item was ticked.
- 2026-11-05: Item 1 was ticked as covered. Its behavior is already in features 01 and 02, and the test adds the explicit AC-03 check.
- 2026-11-09: Test plan item 3 (no usable name) is recorded as Skipped, not Pass. GitHub always sends a login, so the account the item needs cannot exist, and the item could not be run by hand. The owner approved the skip on 2026-11-09. The behavior is covered by the request spec `AC-03 a provider account with no usable name cannot be stored and redirects with the sign-in error` (`spec/requests/auth/user_auto_create_spec.rb`). Polish ran with this one item not Pass, on that approval.
- 2026-11-09: Polish added Docs item 3 (`docs/api_contract.md`). The race and no-usable-name responses changed the two callbacks, and the contract did not describe them. The race used to end in a 422 (see item 2's Red note). The contract now documents the responses that the request spec checks.
