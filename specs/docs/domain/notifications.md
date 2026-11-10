# Notifications

## Review reminder

A review reminder tells the user that one of their notes is due for review (requirements.md 3.5, 3.7). It is not stored: the server makes it from a note each time a batch is made, and the app shows it in the "Review reminders" panel ([conventions](../conventions.md#ui)). A note is due when it is due today or overdue, as [reviews.md](reviews.md#due-today) and [reviews.md](reviews.md#overdue) define them (AC-15, AC-16, AC-20).

| Field | Value |
|---|---|
| `type` | `"review_due_today"` or `"review_overdue"`: `"review_"` and the note's `review_state` |
| `note_id` | The note's id, a whole number |
| `title` | The note's title, as it is when the batch is made |
| `collection_name` | The name of the note's collection, as it is when the batch is made |
| `next_review_date` | The note's next review date, `"YYYY-MM-DD"` |
| `review_state` | `"due_today"` or `"overdue"`: the value of the note's `review_state` in the notes API |

## Batch

A batch is the user's whole current list of reminders, as one message `{ "type": "review_reminders", "reminders": [ ... ] }` (the message is in [api_contract.md](../api_contract.md#websocket)). It has no reminders as `{ "type": "review_reminders", "reminders": [] }`, and an empty batch is sent too (AC-20).

- **Order.** The oldest next review date first, so the overdue reminders come before the ones due today. Notes with the same date come in the order they were created, the oldest first (AC-20).
- **When a batch is sent.**
  - To a connection, at once, when it subscribes to the reminders channel. The batch may reach the client before the subscription's confirmation.
  - To each connection, every 60 seconds while it stays open (`ReviewRemindersChannel::CHECK_INTERVAL`), whether or not anything changed. Each subscription has its own timer, started when it subscribes.
  - To every open connection of the user, right after a successful create, edit, move, archive, restore, mark as reviewed, or delete of one of their notes ([notes.md](notes.md#rules)), and after a rename of one of their collections ([collections.md](collections.md#rules)). The note actions are `create`, `update`, `destroy`, and `review` of `Api::NotesController`, and the collection action is `update` of `Api::CollectionsController`; each declares `SendsReviewReminders` with one `after_action` (AC-20).
- **A change made outside the app's requests** (the Rails console, a rake task) sends no batch. It reaches an open panel at the next 60-second check (AC-20).

## Review dismissal

A review dismissal records that the user dismissed the reminder of one of their notes for the note's next review date. It is requirements.md 6's "notification acknowledgement" (AC-23). The client makes one with the `ack` message ([api_contract.md](../api_contract.md#websocket)).

Attributes (table `review_dismissals`, `ReviewDismissal`):

| Attribute | Type | Notes |
|---|---|---|
| `user_id` | integer, required | The user who dismissed it. Foreign key to `users`. |
| `note_id` | integer, required | The note. Foreign key to `notes` with `on_delete: :cascade`: deleting a note deletes its dismissals. |
| `next_review_date` | date, required | The note's next review date when it was dismissed. |
| `created_at`, `updated_at` | datetime | |

A unique index on `note_id` and `next_review_date` allows one dismissal for a note and a date.

## Rules

- **Only the user's own notes.** A batch is made from `user.notes`, and the user comes from the connection's sign-in, never from a parameter. A user never receives another user's reminders ([users.md](users.md#rules); AC-20, AC-22).
- **Never an archived note, and never a note with the interval None.** They are neither due today nor overdue ([reviews.md](reviews.md#no-reminders-for-archived-notes-and-notes-with-no-schedule)), whatever their dates, so no batch holds one: not the first batch, not a check's batch, not the first check after midnight, and not the batch sent after an archive, a restore, or a save to None. A restore or a new schedule brings the reminder back at the batch after it when the note is due, and at the check of its day when it is not yet due ([notes.md](notes.md#rules); AC-18, AC-19, AC-20). An `ack` for such a note answers `not_found` (see below).
- **"Today" is the user's today in the saved time zone,** read again for each batch, so a note that becomes due at midnight in the user's zone shows at the next batch, and a zone saved by another browser applies from the next batch ([reviews.md](reviews.md#rules); AC-12, AC-20).
- **No limit.** Every due note is in the batch, once. A note is never both due today and overdue (AC-20).
- **A reminder's state equals the notes API's.** `review_state` is the value that `GET /api/notes` gives for the same note at that moment (AC-15, AC-16, AC-20).
- **Duplicate prevention.** Each batch replaces the panel's whole list, so the panel never adds a reminder it already shows, and a reminder missing from a batch leaves it. The app keys each reminder by note, type, and next review date: a reminder that a new batch repeats stays in its place, unchanged, and keeps the focus. A reminder whose type changes, at midnight for example, is a new one. Nothing is stored on the server for this, and nothing in the browser's storage (AC-20).
- **Dismissals** are described under [Review dismissal](#review-dismissal): a dismissed reminder is left out of later batches (AC-20, AC-23).

- **An ack records a dismissal.** For a well-formed ack of a current reminder of the connection's user, `ReviewAck` creates the dismissal for the user, the note, and the note's next review date. The same ack again, from another tab at the same moment too, is accepted and records nothing new (`create_or_find_by!` on the unique index). The accepted ack sends no message to the sender, and a new batch goes to every open connection of the user (AC-23).
- **A dismissed reminder stays out of every later batch** while the note keeps that next review date: on every connection of the user, after a reload, and after midnight, even when the note is then overdue. The batch leaves out a note that has a dismissal with the note's id and its current next review date; a dismissal for another date hides nothing (`ReviewReminderBatch`). The notes list still shows the note, with "Due today" or "Overdue" (AC-23).
- **A dismissal ends when the note's next review date changes,** by a review (AC-13, AC-14), a new date in the edit form (AC-12), or the interval None, which removes the date. The `ReviewDismissible` concern of `Note` deletes the note's dismissals after any save that changes the date, so a date that later returns to the dismissed one reminds again. An archive, a restore, an interval change that keeps the date, and a second review on the same day change no date, so the dismissal stays (AC-23).
- **Which notes an ack may name.** A current reminder of the connection's user: the notes a batch would hold now (`ReviewReminderBatch.reminded_notes(user, user.today)`, the user read again, so a zone saved since the connection opened counts), with the ack's date equal to the note's. A reminder that is already dismissed still counts. Another user's note, a missing note, an archived or unscheduled note, a note not due, a note whose date has changed, and a date that is not the note's all answer `not_found`, so an answer never tells whether another user's note exists (AC-23).
- **Errors.** `invalid` for an ack that is not well-formed, and for any message that is not an ack (another action, no action, data that is not a JSON object or not JSON); `not_found` for an ack that names no current reminder. `invalid` is checked first. The error goes only to the sender, and the connection stays open (AC-23).

## Chosen approaches

- **The full list, not the changes** (AC-20, spec questions 1 and 7). The app replaces its list with each batch, so a stale reminder never stays and a repeated one never shows twice.
- **Reminder fields** (AC-20, spec question 2): the note's id, title, collection name, next review date, the type, and the review state, enough to show the reminder and to open the note.
- **One message, the oldest first** (AC-20, spec question 3): the most overdue note comes first.
- **A check every 60 seconds, and a batch after each change** (AC-20, spec questions 4 and 5): a note that becomes due shows within a minute, and the user's own changes show at once in every tab. The 60 seconds are documented in the README.
- **A panel, no toasts** (AC-20, spec question 6): every current reminder in one place, above the notes area, with nothing popping up again. A long list scrolls inside the panel.
- **After a loss** (AC-20, spec question 8): "Loading…" until the first batch. After a loss the last list stays, with "Open" working and "Dismiss" disabled, an alert says "Review reminders are offline. Reconnecting…", and the client connects again on its own, at most 30 seconds apart.
- **"Open" waits for a note form** (AC-20, spec question 9): every "Open" is disabled while the notes area shows the new-note or the edit form, so a reminder never throws away what was typed.
- **One connection per tab** (AC-20, spec question 10): opened when the main layout shows, closed when the sign-in screen shows.
- **A stored dismissal for a note and a date** (AC-23, spec question 2): one row per note and date, ended by a change of the date, so a reviewed note reminds again when it is next due, and nothing is kept in the browser.
- **The ack names the note and the date** (AC-23, spec question 1): `{"action":"ack","note_id":<whole number>,"next_review_date":"YYYY-MM-DD"}`, so an ack for a reminder that has moved on is `not_found`, not a silent dismissal of the new one.
- **Every error is one of two codes, sent to the sender only** (AC-23, spec question 3), and an accepted ack sends nothing back but the new batch every connection receives (spec question 2).
