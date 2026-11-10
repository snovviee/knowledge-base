# Feature: 18_archived_no_reminders

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-18: Archived notes do not generate review reminders

Sources: requirements.md 1, 3.4 (the status Active or Archived; archive and restore; archived notes must not generate review reminders), 3.5 (due and overdue need the status Active), 3.7 (archived notes must not generate review notifications), 7 (archived notes do not generate review reminders), 8 (README: review reminder rules), 11 (no review notifications for archived notes); [docs/domain/notes.md](../../docs/domain/notes.md#rules) (Rules: archiving and restoring; only the fields a request sends change); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 9, 12), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1, 14), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 1), [features/14_review_date_recalc/spec.md](../14_review_date_recalc/spec.md), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 1 to 4, 6), [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (questions 1, 2), [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (questions 2, 7, 11), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (questions 1, 4, 5), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (questions 2, 3), not yet in `docs/`.

Not part of this feature: notes without a review schedule (AC-19, feature 19); the batches and the panel themselves (AC-20, feature 20); "Next 7 days", which leaves archived notes out by its own rule (feature 17 question 7).

## Questions

1. What counts as a review reminder for this rule?
   - Options: both kinds: the review states in the notes view and the WebSocket reminders (recommended: requirements.md 3.4 says "review reminders", and 3.5, 3.7, and 11 apply the rule to both the review states and the notifications); only the WebSocket reminders.
   - Answer: both kinds. In the notes view: the labels "Due today" and "Overdue" in the list and the detail, a note's `review_state` in the API, and the "Due today" and "Overdue" choices of the "Review" filter (features 15 to 17). Over the WebSocket: the reminders in each batch, and so in the "Review reminders" panel (feature 20). An archived note is never due today or overdue, so it has none of them, whatever its interval and dates. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. When does a restored note's reminder come back?
   - Options: when the note is due, as for any active note: at once when its next review date is today or earlier, otherwise on that date (recommended: archiving keeps the schedule, feature 09 question 9, so a restore brings it back as it was); only after the note is marked as reviewed.
   - Answer: when the note is due, as for any active note. Archiving keeps the note's interval and next review date (feature 09 question 9). A restored note whose next review date is today or earlier is reminded in the batch sent right after the restore (feature 20 question 5), and one with a later date when that date comes. A reminder dismissed for the same date before the archive stays dismissed after the restore, because the date did not change (feature 23 question 2). (the recommended option, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**An archived note shows no review state**
- Given today is 2026-11-09 in my time zone, and the archived weekly notes "Old plan" (next review date 2026-11-02) and "Today's plan" (2026-11-09)
- When the notes list shows, and I open each detail
- Then each shows "Archived" and neither "Due today" nor "Overdue", and the API gives each `review_state` null (question 1; features 15, 16)

**The review filters leave archived notes out**
- Given the same notes
- When I choose "Due today", and then "Overdue", in "Review"
- Then neither note is listed (question 1; features 15, 16)

**"Archived" with a review filter finds nothing**
- Given the same notes
- When I choose "Archived" in "Status" and "Overdue" in "Review"
- Then no note is listed, and the list shows "No notes match your search and filters." (question 1; feature 17 questions 2, 11)

**An archived note is never in a batch**
- Given the same notes, and my connection is open
- When a batch is sent: the first one, one from a check, or one after a change
- Then neither note is in it, and the panel does not show them (question 1; feature 20 question 1)

**No reminder at midnight**
- Given the archived weekly note "Tomorrow's plan" with the next review date 2026-11-10, and my connection is open
- When 2026-11-10 comes in my time zone
- Then the first check after midnight leaves "Tomorrow's plan" out of the batch (question 1; feature 20 question 4)

**Archiving removes the reminder**
- Given the main layout is open in two tabs, and both panels show the active weekly note "Old idea" as "Overdue" (next review date 2026-11-02)
- When I archive "Old idea" in one tab (feature 09)
- Then the batch sent right after the archive leaves it out, and neither panel shows it (question 1; feature 20 question 5)

**Restoring brings the reminder back when the note is due**
- Given today is 2026-11-09, and the archived weekly note "Old idea" has the next review date 2026-11-02, and its reminder was never dismissed
- When I restore it
- Then the batch sent right after the restore holds it as `review_overdue`, the panel shows it as "Overdue", and its detail shows "Overdue" (question 2; feature 16)

**A restored note with a later date waits for its date**
- Given today is 2026-11-09, and the archived weekly note "Later" has the next review date 2026-11-12
- When I restore it
- Then no batch holds it before 2026-11-12, and on 2026-11-12 it is reminded as `review_due_today` (question 2)

**A dismissed reminder stays dismissed after an archive and a restore**
- Given I dismissed the reminder of "Old idea" for 2026-11-02, and then archived the note
- When I restore it, with the same next review date
- Then batches still leave it out (question 2; feature 23 question 2)

**An archived note marked as reviewed still gets no reminder**
- Given today is 2026-11-09, and the archived weekly note "Old plan" has the next review date 2026-11-02
- When I mark it as reviewed (feature 13 question 1)
- Then its next review date becomes 2026-11-16 (AC-14), and it still shows neither "Due today" nor "Overdue", is under neither filter, and is in no batch (question 1)

## Edge cases

- The rule holds for every schedule and date: an archived note with any interval, and a next review date in the past, today, or the future, is never due today or overdue (question 1; requirements.md 3.5).
- Archiving and restoring change only the status. The interval and the dates stay, so a restore brings back the same schedule (question 2; feature 09 question 9).
- An ack for an archived note answers `{ "type": "error", "error": "not_found" }`, and nothing is recorded (feature 23 question 3).
- An archive or a restore made in another tab or browser shows in every open panel at once (feature 20 question 5).
- The notes list's labels hold as of the list load (feature 15 question 6). A list loaded before an archive keeps its old label until it loads again; the panel follows at once.
- No archived note of another user ever reaches my views or my batches (requirements.md 1; feature 22).
- README (requirements.md 8, review reminder rules; AC-30): it states that an archived note gets no review state, no place under the "Due today" and "Overdue" filters, and no WebSocket reminders, and that a restore brings its reminders back when it is due.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
