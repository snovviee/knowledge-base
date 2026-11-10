# Feature: 13_mark_reviewed

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner approved the spec)

## Acceptance criterion

> AC-13: A user can mark a note as reviewed

Sources: requirements.md 1, 3.5 (a user can mark a note as reviewed; `last_reviewed_date` is set to today), 4 (note detail: last reviewed date and a "mark as reviewed" action), 5 (authorization; dates), 7 (a user can mark a note as reviewed), 11 (the handling of "today"); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Busy button); [features/05_logout/spec.md](../05_logout/spec.md) (question 1), [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 2 to 4, 12, 13), [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 12), and [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1 to 3, not approved: "today", date formats), not yet in `docs/`.

Not part of this feature: the new next review date after a review (AC-14, feature 14); due today and overdue (AC-15, AC-16).

## Questions

1. Which notes can be marked as reviewed?
   - Options: any note, archived and unscheduled ones included (recommended); other options: TBD (the research names none).
   - Answer: any note, archived and unscheduled ones included. The last reviewed date becomes the user's today (feature 12 question 1). (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
2. What does marking a note as reviewed again on the same day do?
   - Options: nothing more (recommended); other options: TBD (the research names none).
   - Answer: nothing more changes. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
3. May a note be marked as reviewed before its next review date?
   - Options: yes (recommended); no.
   - Answer: yes. An early review is allowed. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
4. May a client send its own review date?
   - Options: no, the request body is ignored (recommended); yes.
   - Answer: no. The request body is ignored, so a client cannot send its own date. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
5. How does the API mark a note as reviewed?
   - Options: a review request for the note (recommended); other options: TBD (the research names none).
   - Answer: `POST /api/notes/:id/review` answers 200 `{ "note": ... }`. 401 is checked first, then 403 without this session's anti-forgery token, then 404 for another user's note or a missing one. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
6. Where is the action, and what does the user see?
   - Options: "Mark as reviewed" in the note's detail (recommended); other options: TBD (the research names none).
   - Answer: "Mark as reviewed" in the detail. The button is busy while the request waits. Success shows "Marked as reviewed." as a status. A failure shows the alert "Could not mark the note as reviewed. Try again.". A 404 shows the list with "This note no longer exists.", and a 401 shows the sign-in screen. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
7. How does the detail show the last reviewed date?
   - Options: "Last reviewed: <date>", or "Never" (recommended); other options: TBD (the research names none).
   - Answer: "Last reviewed: <date>", or "Last reviewed: Never" for a note that was never reviewed. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
8. Does this feature change the next review date?
   - Options: no, feature 14 moves it (recommended); other options: TBD (the research names none).
   - Answer: no. Feature 13 leaves the next review date as it is. Feature 14 (AC-14) moves it. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
9. A review request comes with a body that cannot be read as JSON. Does it answer 400, as other requests do (feature 06 question 2), or is the body ignored with the rest (question 4)?
   - Answer: 400 `{ "error": "bad_request" }`, as for every other request that changes data (feature 06 question 2). A body that cannot be read changes nothing. (The owner's choice of 2026-11-09: 400 bad_request, recommended.)

## Scenarios

Based on the answers to the questions above.

**Mark a note as reviewed**
- Given today is 2026-11-09 in my time zone, and the detail of "Rails tips" shows "Last reviewed: Never"
- When I choose "Mark as reviewed"
- Then the review request answers 200 with the note, whose `last_reviewed_date` is "2026-11-09"
- Then the status "Marked as reviewed." shows, and the detail shows "Last reviewed: Nov 9, 2026" (questions 5 to 7)

**The button is busy while the request waits**
- Given I chose "Mark as reviewed", and the server has not answered yet
- When I choose it again
- Then no second request is sent ([conventions: Busy button](../../docs/conventions.md#ui); question 6)

**Mark again on the same day**
- Given "Rails tips" was marked as reviewed today
- When I mark it as reviewed again
- Then the request answers 200, and nothing more changes (question 2)

**Review early**
- Given today is 2026-11-09, and the next review date of "Rails tips" is 2026-11-16
- When I mark it as reviewed
- Then its last reviewed date is 2026-11-09 (question 3)

**An archived or unscheduled note can be marked as reviewed**
- Given an archived note, and a note with the interval None
- When I mark each as reviewed
- Then each answers 200, and each has today as its last reviewed date (question 1)

**A client cannot choose the date**
- Given today is 2026-11-09
- When a review request sends `{ "last_reviewed_date": "2020-01-01" }`
- Then the body is ignored, and the last reviewed date is 2026-11-09 (question 4)

**The next review date stays as it is**
- Given the next review date of "Rails tips" is 2026-11-16
- When I mark it as reviewed
- Then its next review date is still 2026-11-16, until feature 14 is built (question 8)

**The mark fails**
- Given the server cannot be reached, or answers the review request with an error other than 401 or 404
- When I choose "Mark as reviewed"
- Then the alert "Could not mark the note as reviewed. Try again." shows, and the detail stays as it was (question 6)

**The note was deleted elsewhere**
- Given "Rails tips" was deleted in another tab, and its detail is still open here
- When I choose "Mark as reviewed"
- Then the request answers 404 `{ "error": "not_found" }`, the list shows again without "Rails tips", and an alert says "This note no longer exists." (question 6)

**The sign-in has ended**
- Given my sign-in ended
- When I choose "Mark as reviewed"
- Then the request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen (question 6)

**Another user's note cannot be marked as reviewed**
- Given another user has a note
- When I send a review request for its id
- Then it answers 404 `{ "error": "not_found" }`, and that note is unchanged (question 5; requirements.md 1)

## Edge cases

Based on the answers to the questions above.

- No one signed in: 401 `{ "error": "unauthenticated" }`, with or without an anti-forgery token, and nothing changes (question 5).
- Signed in, without this session's anti-forgery token: 403 `{ "error": "invalid_csrf_token" }`, and nothing changes (question 5).
- Another user's note, a missing one, or an id that is not a number: 404 `{ "error": "not_found" }`, and nothing changes (question 5; feature 06 question 3).
- The checks come in this order: 401, then 403, then 404 (question 5).
- The request body is ignored: no field a client sends changes the note (question 4). A body that cannot be read as JSON: 400 `{ "error": "bad_request" }`, and nothing changes (question 9).
- Marking as reviewed sets only the last reviewed date. The status, the interval, and the other fields stay (questions 1, 8).
- "Today" is the date in my saved time zone (feature 12 question 1).
- UI states (requirements.md 4 `<ui_quality_checks>`): the busy button, the status "Marked as reviewed.", and the alerts of "The mark fails" and "The note was deleted elsewhere" (question 6).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

No changes since approval on 2026-11-09. On 2026-11-09 the stage moved from Design to Plan under the owner's standing instruction (pipelined run, features taken in folder order while the previous one is still being built), after the Design checks passed again. No behavior changed.

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Depends on (planned): 09, 12.
- requirements.md 7 asks for a test that marks a note as reviewed and checks the recalculated next review date. The recalculation is feature 14's, so that test needs both features; feature 29's proposal (its question 5, not approved) lists a test named with two AC IDs under both.
- Risk: the AC-09 frontend tests use `getByRole('status')` and `findByRole('alert')` without scoping. Check that the new status and alert do not show alongside 09's in those flows.
- AC-27 (proposed): tests that depend on the date fix the time and pass in any time zone.
