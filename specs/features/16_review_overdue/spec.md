# Feature: 16_review_overdue

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-16: The app shows overdue review notes

Sources: requirements.md 1, 3.5 (overdue for review: `next_review_date` before today, status Active, interval not `none`), 3.6 (the review state filter: overdue), 4 (notes view: review state; `<ui_quality_checks>`: empty states), 5, 11 (the handling of "today"); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (question 2: the order of the list), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1, 3, 7, 10, 14: "today", the date format, the next review date field, a date in the past, the list's review line), [features/14_review_date_recalc/spec.md](../14_review_date_recalc/spec.md) (question 1: a review counts from today), and [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 1 to 10: the review state, the label, the "Review" filter, its states), not yet in `docs/`.

Not part of this feature: notes due today (AC-15, feature 15); the other filters and search (AC-17, feature 17); review reminders (AC-18 to AC-20). This feature adds the "Overdue" label and the choice "Overdue" to feature 15's "Review" filter; everything else about the filter is feature 15's.

## Questions

1. How do the list and the detail mark an overdue note?
   - Options: the label "Overdue" (recommended); other options: TBD (the research names none).
   - Answer: "Overdue", in the list and in the detail, where feature 15 shows "Due today". The note's `review_state` is `"overdue"` (feature 15 question 2). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. How does the user see only the overdue notes?
   - Options: an "Overdue" choice in feature 15's "Review" filter (recommended); other options: TBD (the research names none).
   - Answer: the "Review" filter gains "Overdue", which asks the server for `review=overdue` (`GET /api/notes?review=overdue`). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. What does the list show when no note is overdue under that filter?
   - Options: the message below (recommended); other options: TBD (the research names none).
   - Answer: "No notes are overdue for review." (the recommended option, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**An overdue note is marked in the list**
- Given today is 2026-11-09 in my time zone, and the active weekly note "Old idea" has the next review date 2026-11-02
- When the list shows
- Then the entry of "Old idea" shows "Next review: Nov 2, 2026" and "Overdue", and its `review_state` in the list answer is `"overdue"` (question 1; requirements.md 3.5; feature 12 question 14)

**An overdue note is marked in the detail**
- Given the same note "Old idea"
- When I open it
- Then the detail shows "Overdue" next to "Next review: Nov 2, 2026" (question 1)

**Notes that are not overdue**
- Given today is 2026-11-09, and three notes: the archived weekly note "Archived idea" with the date 2026-11-02, the note "Someday" with the interval None, and the active weekly note "Rails tips" with the date 2026-11-09
- When the list shows
- Then none of them shows "Overdue". "Rails tips" shows "Due today" (AC-15), and "Archived idea" and "Someday" show neither label (requirements.md 3.5; feature 15 question 1)

**The Review filter offers Overdue**
- Given I am signed in
- When the list shows
- Then "Review" offers "All", "Due today", and "Overdue", in that order, with "All" chosen (question 2; feature 15 question 8; requirements.md 3.6 lists due today before overdue)

**Show only the overdue notes**
- Given today is 2026-11-09, "Old idea" and "Older idea" are overdue, "Older idea" was created after "Old idea", and "Rails tips" is due today
- When I choose "Overdue" in "Review"
- Then the list request is `GET /api/notes?review=overdue`, and the list shows "Older idea" and then "Old idea", and not "Rails tips" (question 2; feature 09 question 2)

**No note is overdue**
- Given no note of mine is overdue
- When I choose "Overdue" in "Review"
- Then the list shows "No notes are overdue for review." in place of the entries (question 3)

**A date set in the past makes a note overdue at once**
- Given today is 2026-11-09
- When I create the note "Late start" with the interval Weekly and "Next review date (optional)" Nov 2, 2026
- Then its detail shows "Overdue" next to "Next review: Nov 2, 2026", and after "Back to notes" its list entry shows "Overdue" (question 1; feature 12 question 10)

**A reviewed overdue note stays until the list loads again**
- Given today is 2026-11-09, "Review" shows "Overdue", and the list shows the weekly note "Old idea" with "Overdue"
- When I open "Old idea", choose "Mark as reviewed", and choose "Back to notes"
- Then the list still shows "Old idea", now with "Next review: Nov 16, 2026" and without "Overdue" (feature 15 question 6; feature 14 question 1)

**"Today" follows my time zone**
- Given my browser reports the time zone "Asia/Tokyo", it is 2026-11-09 20:00 UTC (2026-11-10 in Tokyo), and the active weekly note "Rails tips" has the next review date 2026-11-09
- When the list shows
- Then "Rails tips" shows "Overdue" (question 1; feature 12 question 1)

**An unknown review value is still refused**
- Given I am signed in
- When a list request asks for `review=late`
- Then it answers 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }`, while `review=overdue` answers 200 (question 2; feature 15 questions 4, 10)

## Edge cases

Based on the answers to the questions above.

- Overdue needs all three: status Active, an interval other than None, and a next review date before my today (requirements.md 3.5).
- An archived note with a past date is not overdue (AC-18). A note with the interval None is never overdue (AC-19).
- Overdue and due today never overlap (feature 15 question 1).
- A note is "Overdue" whether its date is one day or a year before today (question 1).
- `review=overdue`: 200 with only the overdue notes, newest first (question 2; feature 09 question 2). Any value other than those features 15 to 17 define, another letter case included (`Overdue`): 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }` (feature 15 questions 4, 10).
- No one signed in: 401 `{ "error": "unauthenticated" }`, whatever the `review` value (feature 09).
- Another user's overdue notes never show (requirements.md 1).
- "Today" is the date in my saved time zone, UTC until one is known or when its name is unknown. At 2026-11-09 20:00 UTC, a note dated 2026-11-09 is overdue for a user in Tokyo and due today for a user whose zone is not known (feature 12 question 1).
- States hold as of the list load: a note due today becomes overdue at midnight in my time zone, and the list shows "Overdue" for it once the list loads again (feature 15 question 6).
- An overdue note that is marked as reviewed gets a date counted from today (feature 14 question 1). Its entry shows the new date without "Overdue", and it stays in the filtered list until the list loads again (feature 15 question 6).
- With "Overdue" chosen, the filter behaves as with "Due today": it keeps its choice while a note or a form is open, a reload shows "All", a note created meanwhile shows at the top until the list loads again, and the list shows "Loading…" while it loads and "Could not load notes. Try again." with "Try again" when it cannot (feature 15 questions 7 to 9).
- UI states (requirements.md 4 `<ui_quality_checks>`): the empty state "No notes are overdue for review." (question 3).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` in the Plan step.

- Depends on (planned): 15.
- Feature 15 already sends `review_state` `"overdue"` (its question 2). This feature adds the label, the filter's choice, the `overdue` value of `review`, and the empty state.
- Features 18 to 23 use the meaning of "overdue" defined here and in feature 15.
- The choice "Overdue" in "Review" has the same text as the label: tests should find the label within a list entry.
- AC-27 (proposed): tests that depend on the date fix the time and pass in any time zone.
