# Feature: 23_websocket_client_message

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-23: The WebSocket flow includes at least one client → server message that changes server behavior

Sources: requirements.md 1, 3.7 (the client sends at least one meaningful message, such as `ack`; its type and payload are documented in the README and the specification; it changes the server's behavior; duplicate prevention), 5 (authorization for notification acknowledgements; validate input and return clear errors), 6 (a notification acknowledgement, if the implementation needs one), 7 (a WebSocket client → server message affects server behavior), 8 (README: WebSocket message format), 11 (the same notification not shown again without a user action); [docs/conventions.md](../../docs/conventions.md#ui) (UI: Focus, Empty states); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (question 3: another user's record answers like a missing one), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1, 2, 7, 9, 11: "today", the date format, a date the user sets, an interval changed with the date kept, None removes the date), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 2) and [features/14_review_date_recalc/spec.md](../14_review_date_recalc/spec.md) (a review moves the next review date), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) and [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (the labels and the "Review" filter), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (the batches and the panel), and [features/22_websocket_auth/spec.md](../22_websocket_auth/spec.md) (the connection's user; only the app's pages connect), not yet in `docs/`.

Not part of this feature: the batches and the panel (AC-20, feature 20); who may connect (AC-22, feature 22).

## Questions

1. Which message does the client send, and what is its payload?
   - Options: `ack`, sent by "Dismiss" on a reminder, with the note's id and the reminder's next review date (recommended: requirements.md 3.7 names it, it gives the user a way to quiet a reminder, and it changes what the server sends next); `update_preferences`, such as the check interval; `subscribe` with filters.
   - Answer: `ack`. When I choose "Dismiss" on a reminder (feature 20 question 6), the app sends this message on its reminders subscription: `{ "action": "ack", "note_id": 7, "next_review_date": "2026-11-09" }`. `note_id` is the reminder's note id, a JSON whole number. `next_review_date` is the reminder's next review date as the batch gave it, `"YYYY-MM-DD"` (feature 12 question 2). No other field is needed, and an extra field is ignored. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What does an ack change on the server?
   - Options: the server records the dismissal for the user, the note, and the date, and leaves that reminder out of later batches until the note's next review date changes (recommended: the reminder stops in every tab and after a reload, and comes back by itself once the note is due on a new date); the server leaves the reminder out only on this connection; the dismissal lasts until the end of the day.
   - Answer: the server records the dismissal for the connection's user (feature 22), the note, and the date. Every later batch leaves that reminder out, on every connection of the user: every tab and browser, after a reload, and after a new connection. It stays left out while the note keeps that next review date, also after midnight, when the note turns overdue with the same date. The dismissal ends when the note's next review date changes: after "Mark as reviewed" (features 13 and 14), after a new date in the edit form (feature 12 question 7), or with the interval None, which removes the date (feature 12 question 11). From then on, the note is reminded like any other when it is due. Right after an accepted ack, each open connection of the user receives a new batch without the reminder (feature 20 question 5). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. What does the server answer to an ack it cannot accept, and to any other message?
   - Options: an error message to the sender, with nothing changed: `{ "type": "error", "error": "not_found" }` for an ack that names no current reminder of the user, and `{ "type": "error", "error": "invalid" }` for a message that is not a well-formed ack (recommended: requirements.md 5 asks for clear errors for invalid requests, and another user's note gets the same answer as a missing one, so the answer never tells whether it exists, feature 06 question 3); no answer: the message is ignored, and nothing changes.
   - Answer: an error message to the sender. Nothing is recorded, and the connection stays open.
     - An ack that names no current reminder of the user answers `{ "type": "error", "error": "not_found" }`. A current reminder is one the server would send now: the note is the user's, Active, with an interval other than None, due today or overdue, and `next_review_date` is its next review date. So another user's note, a deleted or unknown note, an archived note, a note with the interval None, a note that is not yet due, and a date that is not the note's next review date all get this same answer.
     - A message that is not a well-formed ack answers `{ "type": "error", "error": "invalid" }`: an ack whose `note_id` is missing or not a JSON whole number (`"7"`, `7.0`, and `7.5` included), an ack whose `next_review_date` is missing or not a real date written `YYYY-MM-DD` (`20261109`, `2026-02-30`, and `tomorrow` included), and a message with any action other than `ack`. `invalid` is checked before `not_found`.
     - An ack for a current reminder that is already dismissed is accepted: nothing more changes, and no error is sent.

     (no recommended option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
4. What do I see when I choose "Dismiss"?
   - Options: the reminder leaves the panel at once, with no question first, and the focus moves to the panel's heading (recommended: nothing is lost, because the note keeps its "Due today" or "Overdue" in the notes view, features 15 and 16); a confirmation first; an "Undo" for a few seconds.
   - Answer: the reminder leaves the panel at once, without waiting for the server, and the focus moves to the heading "Review reminders". There is no confirmation and no undo. The note keeps its "Due today" or "Overdue" label in the notes list and the detail, and its place under the "Review" filter's "Due today" or "Overdue" (features 15 and 16), so I can still find it. When no reminder is left, the panel shows "No review reminders" (feature 20 question 6). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
5. What does the app do when an ack is not accepted, or cannot be sent?
   - Options: it shows nothing for an error answer, and the next batch decides what the panel shows, while "Dismiss" is disabled when the connection is offline (recommended: from the app, an ack is refused only when the note changed meanwhile, and then its reminder is gone or replaced anyway); an alert for each error answer.
   - Answer: the panel shows no message for an error answer. The batches decide what it shows: a reminder whose ack was not recorded, and that is still current, shows again with the next batch. While the connection is offline, "Dismiss" is disabled (feature 20 question 8), so no ack is lost unseen. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**Dismiss a reminder**
- Given today is 2026-11-09 in my time zone, and the panel shows "Rails tips" (note id 7) as "Due today", with the next review date 2026-11-09
- When I choose "Dismiss" on "Rails tips"
- Then the app sends `{ "action": "ack", "note_id": 7, "next_review_date": "2026-11-09" }`, "Rails tips" leaves the panel at once, and the focus moves to the heading "Review reminders" (questions 1, 4)

**An ack changes what the server sends**
- Given the batches of my connection hold "Rails tips", which is due today
- When my connection sends the ack for "Rails tips" and 2026-11-09
- Then the batch sent right after the ack and the batch of the next check both leave "Rails tips" out, while it is still due today (question 2; requirements.md 3.7, 7)

**The dismissal reaches my other tabs and browsers**
- Given the panel shows "Rails tips" in two tabs, and in another browser where I am signed in with the same account
- When I dismiss it in one tab
- Then each of my open connections receives a new batch without "Rails tips" right away, and no panel shows it (question 2; feature 20 question 5)

**The dismissal outlasts a reload**
- Given I dismissed "Rails tips" for 2026-11-09
- When I reload the page on the same day
- Then the first batch leaves "Rails tips" out, and the panel does not show it (question 2)

**A dismissed reminder does not come back as overdue**
- Given I dismissed "Rails tips" for 2026-11-09, and I do not review it
- When 2026-11-10 comes, and it is overdue with the same date
- Then batches still leave it out, and the notes list shows it as "Overdue" (question 2; feature 16)

**A review ends the dismissal**
- Given I dismissed the daily note "Rails tips" for 2026-11-09
- When I mark it as reviewed on 2026-11-09, so its next review date becomes 2026-11-10 (AC-14), and 2026-11-10 comes
- Then the first batch after midnight holds "Rails tips" as `review_due_today`, and the panel shows it (question 2)

**A new date ends the dismissal**
- Given I dismissed "Rails tips" for 2026-11-09
- When I set its next review date to Nov 5, 2026 in the edit form, and save (feature 12 question 7)
- Then the batch sent right after the save holds "Rails tips" as `review_overdue`, with `"2026-11-05"` (question 2)

**The same ack twice**
- Given "Rails tips" is dismissed for 2026-11-09
- When the same ack arrives again, for example from a second tab at the same moment
- Then nothing more changes, and no error is sent (question 3)

**An ack for another user's note**
- Given another user's note 42 is due today
- When my connection sends `{ "action": "ack", "note_id": 42, "next_review_date": "2026-11-09" }`
- Then my connection receives `{ "type": "error", "error": "not_found" }`, nothing is recorded, and the other user's batches still hold their note (question 3; requirements.md 5)

**An ack for a reminder that is no longer current**
- Given "Rails tips" was marked as reviewed in another tab, so its next review date is now 2026-11-10
- When an ack names "Rails tips" with `"2026-11-09"`
- Then the answer is `{ "type": "error", "error": "not_found" }`, nothing is recorded, and the panel shows no message (questions 3, 5)

**A malformed ack**
- Given my connection is open
- When it sends `{ "action": "ack", "note_id": "7", "next_review_date": "2026-11-09" }`, or `{ "action": "ack", "note_id": 7, "next_review_date": "2026-02-30" }`
- Then each answers `{ "type": "error", "error": "invalid" }`, and nothing is recorded (question 3)

**An unknown action**
- Given my connection is open
- When it sends `{ "action": "snooze", "note_id": 7 }`
- Then the answer is `{ "type": "error", "error": "invalid" }`, nothing changes, and the connection stays open (question 3)

**Dismiss while offline**
- Given the panel shows "Review reminders are offline. Reconnecting…" and "Rails tips"
- When I try to choose "Dismiss" on "Rails tips"
- Then "Dismiss" is disabled, and no ack is sent (question 5; feature 20 question 8)

**The last reminder dismissed**
- Given the panel shows only "Rails tips"
- When I dismiss it
- Then the panel shows "No review reminders" (question 4)

## Edge cases

- The ack's user is the connection's user (feature 22 question 1). An ack never changes another user's data, and its answer never tells whether another user's note exists (question 3; requirements.md 1, 5).
- An ack carries no anti-forgery token, because only the app's own pages can open the connection (feature 22 question 6).
- Before it handles an ack, the server checks that the connection's sign-in still exists, and closes the connection when it does not (feature 22 question 5).
- `invalid` comes before `not_found`: an ack with the `note_id` `"42"` for another user's note answers `invalid` (question 3).
- An ack sent just before midnight and handled just after it: the note is now overdue with the same date, so it is still a current reminder, and the ack is accepted (questions 2, 3).
- A dismissal stays through an archive and a restore, because neither changes the date: a restored note keeps its reminder dismissed while its date is the same (question 2; AC-18).
- A change of interval that keeps the date (feature 12 question 9) keeps the dismissal (question 2).
- The interval None removes the date, so it ends the dismissal. A schedule set again is reminded when it is due on its new date (question 2; AC-19).
- Once the date has changed, the dismissal is over, even if the date later returns to the dismissed one: the reminder for that date then shows again (question 2).
- Marking a note as reviewed a second time on the same day keeps its date (feature 13 question 2), so it changes no dismissal.
- Deleting a note deletes its dismissals with it.
- "Dismiss" has no busy state, because nothing waits for an answer (question 4).
- UI states (requirements.md 4 `<ui_quality_checks>`): "Dismiss" is disabled while the panel is offline. The empty state after the last dismissal is feature 20's "No review reminders" (questions 4, 5).
- README (requirements.md 3.7, 8; AC-30): it documents the `ack` message and its payload, the error answers and their codes, what an ack changes, and how long a dismissal lasts (questions 1 to 3).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
