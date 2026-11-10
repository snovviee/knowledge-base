# Feature: 19_unscheduled_no_reminders

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-19: Notes without review schedules do not generate review reminders

Sources: requirements.md 1, 3.4 (the review interval none; the next review date is optional), 3.5 (due and overdue need an interval other than none; the app must clearly handle a note with no review schedule), 3.7 (notes without a review schedule must not generate review notifications), 8 (README: review reminder rules), 11 (no review notifications for notes without a review interval); [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 4, 7, 8, 10, 11, 14, 16), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 1), [features/14_review_date_recalc/spec.md](../14_review_date_recalc/spec.md), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 1, 2, 6), [features/16_review_overdue/spec.md](../16_review_overdue/spec.md), [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (questions 8, 12), [features/18_archived_no_reminders/spec.md](../18_archived_no_reminders/spec.md) (question 1), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (questions 1, 4, 5), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (questions 2, 3), not yet in `docs/`.

Not part of this feature: archived notes (AC-18, feature 18); setting and showing a schedule (AC-12, feature 12); the "No review scheduled" filter itself (feature 17 question 8); the batches and the panel themselves (AC-20, feature 20).

## Questions

1. What counts as a review reminder for this rule?
   - Options: both kinds: the review states in the notes view and the WebSocket reminders (recommended: requirements.md 3.5 keeps such notes out of "due" and "overdue", and 3.7 and 11 keep them out of the notifications); only the WebSocket reminders.
   - Answer: both kinds, as in feature 18 question 1: the labels "Due today" and "Overdue", a note's `review_state`, and the "Due today" and "Overdue" choices of the "Review" filter (features 15 to 17), and the reminders in each batch and in the "Review reminders" panel (feature 20). A note with the interval None has no next review date (feature 12 question 11), is never due today or overdue, and has none of them, whatever its status. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. When does a note that gets a schedule again get its reminder?
   - Options: when it is due on its new next review date (recommended: the same rule as for any scheduled note); at once.
   - Answer: when it is due on its new date, as any scheduled note is. A schedule set without a date starts from today, so the next review date is today plus the interval (feature 12 question 8), and the note is reminded on that date. A date I set to today or earlier (feature 12 questions 7, 10) is reminded in the batch sent right after the save (feature 20 question 5). (the recommended option, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**A note with no schedule shows no review state**
- Given the active note "Someday" with the interval None
- When the notes list shows, and I open its detail
- Then the list shows "No review scheduled", the detail shows "Next review: Not set", neither shows "Due today" or "Overdue", and the API gives `review_interval` `"none"`, `next_review_date` null, and `review_state` null (question 1; feature 12 questions 14, 16; requirements.md 3.5)

**The review filters leave it out**
- Given the same note
- When I choose "Due today", then "Overdue", then "No review scheduled" in "Review"
- Then "Someday" is not listed under the first two, and is listed under "No review scheduled" (question 1; feature 17 question 8)

**It is never in a batch**
- Given the same note, and my connection is open
- When a batch is sent: the first one, one from a check, or one after a change
- Then "Someday" is not in it, and the panel does not show it (question 1; feature 20 question 1)

**A new note has no schedule and no reminder**
- Given my connection is open
- When I create a note and leave its interval at None (feature 12 question 4)
- Then the batch sent right after the create does not hold it (question 1; feature 20 question 5)

**Setting the interval to None removes the reminder**
- Given the main layout is open in two tabs, and both panels show the weekly note "Rails tips" as "Overdue" (next review date 2026-11-02)
- When I set its interval to None and save (feature 12 question 11)
- Then the batch sent right after the save leaves it out, neither panel shows it, and its detail shows "Next review: Not set" (question 1; feature 20 question 5)

**A schedule set again is reminded on its new date**
- Given today is 2026-11-09, and "Someday" has the interval None
- When I set the interval Weekly with no date, and save
- Then its next review date is 2026-11-16 (feature 12 question 8), no batch holds it before then, and on 2026-11-16 it is reminded as `review_due_today` (question 2)

**A schedule set again with a past date is reminded at once**
- Given today is 2026-11-09, and "Someday" has the interval None
- When I set the interval Weekly and the date Nov 2, 2026, and save
- Then the batch sent right after the save holds "Someday" as `review_overdue` (question 2; feature 12 question 10)

**Marking a note with no schedule as reviewed creates no reminder**
- Given "Someday" has the interval None
- When I mark it as reviewed (feature 13 question 1)
- Then its last reviewed date is today, it still has no next review date (feature 14), and no reminder shows for it in the notes view or in a batch (question 1)

## Edge cases

- No review schedule means the interval None. Such a note has no next review date and no custom days (feature 12 question 11), and is never due today or overdue, whatever its status (question 1; requirements.md 3.5).
- The case is shown clearly: "No review scheduled" in the list, "Review interval: None" and "Next review: Not set" in the detail, and the "No review scheduled" choice of the "Review" filter (feature 12 questions 14, 16; feature 17 question 8; requirements.md 3.5).
- A periodic check, or midnight in the user's time zone, never adds a note with no schedule to a batch (question 1; feature 20 question 4).
- An archived note with the interval None gets no reminder under both rules (AC-18, feature 18).
- Setting the interval None ends any dismissal of the note, because the date is removed (feature 23 question 2).
- An ack for a note with the interval None answers `{ "type": "error", "error": "not_found" }`, and nothing is recorded (feature 23 question 3).
- A change made in another tab or browser shows in every open panel at once (feature 20 question 5).
- The notes list's labels hold as of the list load (feature 15 question 6).
- README (requirements.md 8, review reminder rules; AC-30): it states that a note with the interval None gets no review state, no place under the "Due today" and "Overdue" filters, and no WebSocket reminders, and how the app shows a note with no schedule.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
