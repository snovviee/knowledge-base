# Feature: 15_review_due_today

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-15: The app shows notes due for review today

Sources: requirements.md 1, 3.5 (due for review), 3.6 (the review state filter: due today, all; available from the main notes view), 4 (notes view: review state, next review date; `<ui_quality_checks>`: empty states, loading state, visible error handling), 5, 11 (the handling of "today"); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body; Notes: `GET /api/notes`); [docs/conventions.md](../../docs/conventions.md) (UI: Loading inside an area, Load error with Try again, Sign-in ended, The notes area); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (question 1: the 422 body), [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 2: the notes area, the order of the list), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1, 3, 14: "today", the date format, the list's review line), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) and [features/14_review_date_recalc/spec.md](../14_review_date_recalc/spec.md) (marking a note as reviewed), not yet in `docs/`.

Not part of this feature: the "Overdue" label and filter (AC-16, feature 16); the other filters and search (AC-17, feature 17); review reminders (AC-18 to AC-20). Features 16 and 17 add choices to the "Review" filter defined here.

## Questions

1. What does "due today" mean?
   - Options: the next review date is today, and not earlier (recommended: it does not overlap with overdue, and the two together make the "due for review" of requirements.md 3.5); today or earlier, the whole "due for review" of requirements.md 3.5, which overlaps with overdue.
   - Answer: an Active note whose interval is not None and whose next review date equals the user's today. It does not overlap with overdue (AC-16), and together they make the "due for review" of requirements.md 3.5. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. How does the API tell a note's review state?
   - Options: the server sends it with every note (recommended); other options: TBD (the research names none).
   - Answer: every note in an answer has `review_state`: `"due_today"`, `"overdue"`, or null. That is the list, the detail, and the answers of a create, an edit, and a review. `"overdue"` is an Active note with a schedule whose next review date is before the user's today (requirements.md 3.5); feature 16 shows it. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How do the list and the detail show it?
   - Options: the label "Due today" (recommended); other options: TBD (the research names none).
   - Answer: "Due today", in the note's list entry and in its detail, next to "Next review: <date>". (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. How does the user see only the notes due today?
   - Options: a "Review" filter above the list, answered by the server (recommended); other options: TBD (the research names none).
   - Answer: a "Review" filter above the list, with "All" and "Due today". "Due today" asks the server for `review=due_today` (`GET /api/notes?review=due_today`). An unknown value answers 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }`. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. What does the list show when no note is due today under that filter?
   - Options: the message below (recommended); other options: TBD (the research names none).
   - Answer: "No notes are due for review today." (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. Does a note leave the filtered list at once when its state changes?
   - Options: no, states hold as of the list load (recommended); other options: TBD (the research names none).
   - Answer: no. States hold as of the list load. A note that changes stays in the filtered list until the list loads again. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. What does the list show while a filtered answer loads, and when it cannot load?
   - Options: TBD (the research does not cover it).
   - Answer: the notes list's own states (feature 09; [conventions: Loading inside an area, Load error with Try again](../../docs/conventions.md#ui)), kept for a filtered list. While the answer loads, "Loading…" shows as a status in place of the entries, and "Review" keeps its choice and can be changed again; only the answer to the latest choice is shown. When the list cannot load (no answer, or an error answer other than 401), "Could not load notes. Try again." shows as an alert with a "Try again" button, which asks again with the chosen filter. A 401 shows the sign-in screen ([conventions: Sign-in ended](../../docs/conventions.md#ui)). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
8. How does the "Review" filter look, and when does it keep its choice?
   - Answer: a drop-down list labelled "Review", above the notes list, with the choices "All" (chosen at first) and "Due today". It shows with the list, in every state of the list, and not with a note's detail or a form (feature 09 question 1: one view at a time). It keeps its choice while I open a note or a form and go back to the list. The address does not change (feature 09 question 1), so a reload shows "All". (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. A note is created while "Review" shows "Due today". Does it show in the list?
   - Answer: yes. As in feature 09, the new note goes to the top of the list, whether or not it is due today, and stays there until the list loads again (question 6). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. What does the list request do when `review` is left out or empty, and how are its values written?
    - Answer: left out or empty, `review` does not filter: the answer has all my notes, as before this feature ("All"). The values are written exactly as given, in lower case: `due_today` here, and the values that features 16 and 17 add. Any other value, such as `soon` or `Due_Today`, answers 422 as in question 4. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**A note due today is marked in the list**
- Given today is 2026-11-09 in my time zone, and the active weekly note "Rails tips" has the next review date 2026-11-09
- When the list shows
- Then the entry of "Rails tips" shows "Next review: Nov 9, 2026" and "Due today", and its `review_state` in the list answer is `"due_today"` (questions 1 to 3; feature 12 question 14)

**A note due today is marked in the detail**
- Given the same note "Rails tips"
- When I open it
- Then the detail shows "Due today" next to "Next review: Nov 9, 2026", and its `review_state` is `"due_today"` (questions 2, 3)

**Notes that are not due today**
- Given today is 2026-11-09, and four notes: the archived weekly note "Archived tip" with the date 2026-11-09, the note "Someday" with the interval None, the active weekly note "Tomorrow tip" with the date 2026-11-10, and the active weekly note "Late tip" with the date 2026-11-08
- When the list shows
- Then none of them shows "Due today". "Late tip" has `review_state` `"overdue"` (shown by feature 16), and the other three have null (questions 1, 2)

**The Review filter**
- Given I am signed in
- When the list shows
- Then the drop-down list "Review" shows above the list, with the choices "All" and "Due today", and "All" chosen (questions 4, 8)

**Show only the notes due today**
- Given today is 2026-11-09, "Rails tips" and "Ruby tips" are due today, "Ruby tips" was created after "Rails tips", and "Tomorrow tip" is not due today
- When I choose "Due today" in "Review"
- Then the list request is `GET /api/notes?review=due_today`, and the list shows "Ruby tips" and then "Rails tips", and not "Tomorrow tip" (question 4; feature 09 question 2)

**Back to all notes**
- Given "Review" shows "Due today"
- When I choose "All" in "Review"
- Then the list request is `GET /api/notes`, with no `review`, and the list shows all my notes (questions 4, 10)

**No note is due today**
- Given no note of mine is due today
- When I choose "Due today" in "Review"
- Then the list shows "No notes are due for review today." in place of the entries (question 5)

**The filter keeps its choice while I open a note**
- Given "Review" shows "Due today", and the list shows "Rails tips"
- When I open "Rails tips" and choose "Back to notes"
- Then "Review" still shows "Due today", and the list shows the same notes, with no list request (questions 6, 8)

**A reload shows all notes**
- Given "Review" shows "Due today"
- When I reload the page
- Then "Review" shows "All", and the list shows all my notes (question 8)

**A reviewed note stays until the list loads again**
- Given today is 2026-11-09, "Review" shows "Due today", and the list shows the weekly note "Rails tips" with "Due today"
- When I open "Rails tips", choose "Mark as reviewed" (AC-13, AC-14), and choose "Back to notes"
- Then the list still shows "Rails tips", now with "Next review: Nov 16, 2026" and without "Due today" (question 6)

**The list drops the reviewed note when it loads again**
- Given the list of the scenario above, still showing "Rails tips" under "Due today"
- When I choose "All" and then "Due today" in "Review"
- Then the list loads again, and "Rails tips" is not in it (questions 4, 6)

**A note created under the filter**
- Given "Review" shows "Due today"
- When I create the note "New idea" with the interval None, and choose "Back to notes" in its detail
- Then "New idea" shows at the top of the list, without "Due today", and "Review" still shows "Due today" (questions 8, 9)

**The filtered list loads**
- Given the server has not answered the list request yet
- When I choose "Due today" in "Review"
- Then "Loading…" shows in place of the entries, and "Review" shows "Due today" (question 7)

**The filtered list cannot load**
- Given the server cannot be reached, or answers the list request with an error other than 401
- When I choose "Due today" in "Review"
- Then "Could not load notes. Try again." shows as an alert, with the button "Try again", and "Review" still shows "Due today" (question 7)

**Try again keeps the filter**
- Given the list shows "Could not load notes. Try again.", and "Review" shows "Due today"
- When I choose "Try again", and the server answers
- Then the list request `GET /api/notes?review=due_today` is sent, "Loading…" shows while it waits, and then the notes due today show (question 7)

**Only the latest choice is shown**
- Given I chose "Due today" in "Review", and its answer has not arrived
- When I choose "All", and the answer for "All" arrives before the one for "Due today"
- Then the list shows all my notes, and the late answer for "Due today" changes nothing (question 7)

**The sign-in has ended**
- Given my sign-in ended
- When I choose "Due today" in "Review"
- Then the list request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen (question 7; [conventions: Sign-in ended](../../docs/conventions.md#ui))

**"Today" follows my time zone**
- Given my browser reports the time zone "Asia/Tokyo", it is 2026-11-09 20:00 UTC (2026-11-10 in Tokyo), and the active weekly note "Rails tips" has the next review date 2026-11-10
- When the list shows
- Then "Rails tips" shows "Due today" (question 1; feature 12 question 1)

**An unknown review value is refused**
- Given I am signed in
- When a list request asks for `review=soon`
- Then it answers 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }` (questions 4, 10)

## Edge cases

Based on the answers to the questions above.

- Due today needs all three: status Active, an interval other than None, and a next review date equal to my today (question 1).
- An archived note whose date is today is not due today (question 1; AC-18). A note with the interval None is never due today (question 1; AC-19).
- Due today and overdue never overlap: a date before today is overdue, never due today (question 1; AC-16).
- `review_state` is in every note of every answer: the list, the detail, and the answers of a create, an edit, and a review. It is null for a note that is neither due today nor overdue (question 2).
- `review` left out or empty: 200 with all my notes. `review=due_today`: 200 with only the notes due today, newest first (questions 4, 10; feature 09 question 2).
- `review` with any other value, another letter case included (`soon`, `Due_Today`): 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }` (questions 4, 10).
- No one signed in: 401 `{ "error": "unauthenticated" }`, whatever the `review` value (feature 09).
- Another user's notes never show, filtered or not (requirements.md 1).
- "Today" is the date in my saved time zone, UTC until one is known or when its name is unknown (feature 12 question 1).
- The list loads when the main layout shows, when a "Review" choice is made, and on "Try again". Opening a note and going back does not load it (questions 4, 6, 7, 8).
- States hold as of the list load. A note that becomes due or stops being due, at midnight in my time zone or by a change in another tab, keeps its label and its place in the list until the list loads again. A note changed in this tab (edited, reviewed, archived, or restored) shows its new values and its new label in its entry, and stays in the filtered list until the list loads again (question 6; feature 09 questions 1, 2).
- A detail shows the state as of its opening, and then as of the answer to a change made in it (questions 2, 6).
- With "All", an empty list shows "No notes yet" (feature 09). With "Due today", an empty list shows "No notes are due for review today." (question 5).
- UI states (requirements.md 4 `<ui_quality_checks>`): the empty state "No notes are due for review today.", the loading state "Loading…", and the alert "Could not load notes. Try again." with "Try again" (questions 5, 7).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` in the Plan step.

- Depends on (planned): 09, 12, 14.
- Features 16 and 17 extend the "Review" filter, the `review` values, and the labels defined here. Features 18 to 23 use the meanings of "today", "due today", and "overdue" defined by features 12, 15, and 16.
- `frontend/src/Notes.tsx` loads the list on mount and on "Try again" only. "Back to notes" shows the list as it is, and a note changed in its detail replaces its list entry (`withNote`); a created note goes to the top. Questions 6 and 9 keep that behavior for a filtered list.
- The tests for an unknown `review` value must use a value that no later feature adds, such as `soon`: features 16 and 17 add `overdue`, `next_7_days`, and `unscheduled`.
- Adding `review_state` to every note answer may break tests that compare a whole note body exactly (features 09, 10, 12, 13). Check them when the field is added.
- In the frontend container, Node's zone is UTC.
- Risk: the AC-09 frontend tests use `getAllByRole('listitem')`, `getByRole('status')`, and `findByRole('alert')` without scoping. New labels, empty states, and alerts must not collide with them. The choice "Due today" in "Review" has the same text as the label: tests should find the label within a list entry.
- AC-27 (proposed): tests that depend on the date fix the time and pass in any time zone.
