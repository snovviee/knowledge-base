# Feature: 14_review_date_recalc

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-14: The app recalculates the next review date after review

Sources: requirements.md 3.5 (when a note is marked as reviewed, `next_review_date` is recalculated; the interval calculation), 4 (note detail: next review date; "mark as reviewed"), 5 (dates), 7 (a user can mark a note as reviewed, and the next review date is recalculated), 11 (the handling of "today"); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 2: a note changed in its detail keeps its place in the list, with its new values), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1 to 3: "today" and the date formats; 5: the custom days; 6: the month-end rule; 9: an interval changed with the date kept; 11, 14, 16: a note with no schedule and how the schedule shows) and [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (questions 1, 2: which notes, a second review on the same day; 5 to 7: the review request, the action, its messages, and "Last reviewed"), not yet in `docs/`.

Not part of this feature: the review request itself and the last reviewed date (AC-13, feature 13); due today and overdue (AC-15, AC-16).

## Questions

1. What does the new next review date count from?
   - Options: the review day, the user's today (recommended: requirements.md 3.5 says "today + 1 day", "today + 7 days", and so on); the old next review date.
   - Answer: the review day. After a review, the next review date is today plus the note's interval: Daily +1 day, Weekly +7 days, Monthly +1 calendar month by feature 12's month-end rule (its question 6), and the custom interval + its number of days. An overdue note does not catch up, and an early review counts from the day it is made. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. A monthly note is reviewed on its next review date each month. Does it keep its day number after a short month?
   - Options: no, it drifts: Jan 31 → Feb 28 → Mar 28 (recommended: it follows from question 1 and feature 12's month-end rule); other options: TBD (the research names none).
   - Answer: no. A monthly note drifts: Jan 31 → Feb 28 → Mar 28. (the recommended option, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above. "Mark it as reviewed" means choosing "Mark as reviewed" in the note's detail, or sending its review request (feature 13 questions 5, 6).

**Daily**
- Given today is 2026-11-09 in my time zone, and the note "Rails tips" has the interval Daily
- When I mark it as reviewed
- Then the review request answers 200 with the note, whose `last_reviewed_date` is "2026-11-09" and `next_review_date` is "2026-11-10" (question 1; requirements.md 3.5)

**Weekly**
- Given today is 2026-11-09, and "Rails tips" has the interval Weekly
- When I mark it as reviewed
- Then its `next_review_date` is "2026-11-16" (question 1; requirements.md 3.5)

**Monthly**
- Given today is 2026-11-09, and "Rails tips" has the interval Monthly
- When I mark it as reviewed
- Then its `next_review_date` is "2026-12-09" (question 1; requirements.md 3.5)

**Custom number of days**
- Given today is 2026-11-09, and "Rails tips" has the custom interval with 10 days
- When I mark it as reviewed
- Then its `next_review_date` is "2026-11-19" (question 1; requirements.md 3.5)

**Monthly at the end of a month**
- Given today is 2026-01-31, and "Rails tips" has the interval Monthly
- When I mark it as reviewed
- Then its `next_review_date` is "2026-02-28" (feature 12 question 6)

**A monthly note drifts**
- Given today is 2026-02-28, and "Rails tips" has the interval Monthly and the next review date 2026-02-28
- When I mark it as reviewed
- Then its `next_review_date` is "2026-03-28", not "2026-03-31" (question 2)

**An overdue note does not catch up**
- Given today is 2026-11-09, and the weekly note "Old idea" has the next review date 2026-11-02
- When I mark it as reviewed
- Then its `next_review_date` is "2026-11-16" (question 1)

**An early review counts from the day it is made**
- Given today is 2026-11-09, and the weekly note "Rails tips" has the next review date 2026-11-12
- When I mark it as reviewed
- Then its `next_review_date` is "2026-11-16" (question 1)

**A note with no schedule keeps none**
- Given today is 2026-11-09, and the note "Someday" has the interval None
- When I mark it as reviewed
- Then its `last_reviewed_date` is "2026-11-09", its `next_review_date` is still null, and its detail still shows "Next review: Not set" (feature 12 questions 11, 16; feature 13 question 1)

**An archived note gets a new date too**
- Given today is 2026-11-09, and the archived weekly note "Old idea" has the next review date 2026-11-02
- When I mark it as reviewed
- Then its `next_review_date` is "2026-11-16", and it is still archived (question 1; feature 13 question 1)

**The detail shows the new date**
- Given today is 2026-11-09, and the detail of the weekly note "Rails tips" shows "Next review: Nov 12, 2026" and "Last reviewed: Never"
- When I choose "Mark as reviewed"
- Then "Marked as reviewed." shows, and the detail shows "Next review: Nov 16, 2026" and "Last reviewed: Nov 9, 2026" (question 1; feature 12 questions 3, 14; feature 13 questions 6, 7)

**The list shows the new date**
- Given today is 2026-11-09, and I marked the weekly note "Rails tips", whose next review date was 2026-11-12, as reviewed in its detail
- When I choose "Back to notes"
- Then the list shows "Next review: Nov 16, 2026" for "Rails tips", in the same place in the list (feature 09 questions 1, 2; feature 12 question 14)

**"Today" follows my time zone**
- Given my browser reports the time zone "Asia/Tokyo", it is 2026-11-09 20:00 UTC (2026-11-10 in Tokyo), and "Rails tips" has the interval Weekly
- When I mark it as reviewed
- Then its `last_reviewed_date` is "2026-11-10" and its `next_review_date` is "2026-11-17" (question 1; feature 12 question 1)

## Edge cases

Based on the answers to the questions above.

- "Today" is the date in my saved time zone, UTC until one is known or when its name is unknown (feature 12 question 1).
- Monthly at the end of a month: the same day number in the next month, or that month's last day when it has no such day: 2026-01-31 → 2026-02-28, 2028-01-31 → 2028-02-29 (a leap year), 2026-03-31 → 2026-04-30 (feature 12 question 6).
- The new date may be in the next year: Weekly reviewed on 2026-12-28 gives 2027-01-04, and Monthly reviewed on 2026-12-15 gives 2027-01-15 (question 1).
- The custom interval counts its own days, from 1 to 365 (feature 12 question 5): 1 day reviewed on 2026-11-09 gives 2026-11-10, and 365 days give 2027-11-09 (question 1).
- The interval the note has at the review counts. A note changed from Weekly to Daily with its date kept (feature 12 question 9) gets today + 1 day when it is reviewed (question 1).
- A second review on the same day gives the same date again, so nothing more changes (feature 13 question 2). If the date was changed by hand in between, the second review sets it again to today plus the interval (question 1).
- A note with the interval None has no next review date before or after a review (feature 12 question 11).
- An archived note with a schedule gets a new date like any other and stays archived. It still generates no review reminders (feature 13 question 1; AC-18).
- The review request's answer carries the new `next_review_date` together with the new `last_reviewed_date` (feature 13 question 5).
- A refused review request changes no date: 401 `{ "error": "unauthenticated" }`, 403 `{ "error": "invalid_csrf_token" }`, 404 `{ "error": "not_found" }`, or 400 `{ "error": "bad_request" }`, as in feature 13 (its questions 5, 9).
- UI states (requirements.md 4 `<ui_quality_checks>`): the detail and the list show the new date after a review; when the review fails, feature 13's alert "Could not mark the note as reviewed. Try again." shows and both dates stay as they were (feature 13 question 6).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09 (read-only probes in the containers). These move to `plan.md` in the Plan step.

- Depends on (planned): 12, 13.
- `Date#next_month` clamps to the month's end: 2026-01-31 → 2026-02-28, 2028-01-31 → 2028-02-29, 2026-03-31 → 2026-04-30.
- requirements.md 7 asks for a test that marks a note as reviewed and checks the recalculated next review date. Feature 29's proposal (its question 5) lists a test named with two AC IDs ("AC-13 AC-14 ...") under both.
- Risk: feature 13's scenario "The next review date stays as it is" holds only until this feature is built. The test written for it must be replaced here, and the change recorded under Deviations.
- The list entry shows the new date because a note changed in its detail replaces its list entry (`frontend/src/Notes.tsx`, `onChanged`), as archive and restore do. Check that the review action uses the same path.
- AC-27 (proposed): tests that depend on the date fix the time and pass in any time zone.
