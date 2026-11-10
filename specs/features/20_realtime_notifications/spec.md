# Feature: 20_realtime_notifications

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-20: While connected, the app receives real-time review notifications

Sources: requirements.md 1, 3.5 (due for review; overdue for review), 3.7 (server → client: the notification types; a first batch when the connection opens; a periodic check whose interval is documented; no notifications for archived notes or notes without a schedule; the data each notification carries; duplicate prevention, documented; UI: notifications visible as toasts, an alert banner, or a panel), 4 (visible real-time review notifications while connected; `<ui_quality_checks>`: the empty state "no review reminders", a loading state, visible error handling), 5 (authorization on notification delivery; never another user's notifications), 7 (WebSocket notifications are sent for notes due today or overdue), 8 (README: WebSocket message format, review reminder rules), 11 (the handling of "today"; no notifications for archived or unscheduled notes; the same notification not shown again and again); [docs/api_contract.md](../../docs/api_contract.md#conventions) (Conventions: Dates and times); [docs/conventions.md](../../docs/conventions.md#ui) (UI: Loading inside an area, Empty states, Sign-in ended, The notes area, Focus); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 13: the notes area, only "Cancel" closes a note form), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 1 to 3, 14: "today", the date formats, "Next review: <date>"), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 1, 2, 6: due today, `review_state`, states as of the list load), [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (question 1), [features/22_websocket_auth/spec.md](../22_websocket_auth/spec.md) (the connection and its user), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) ("Dismiss"), not yet in `docs/`.

Not part of this feature: who may connect, and what logout does to a connection (AC-22, feature 22); what "Dismiss" sends and changes (AC-23, feature 23); the archived and unscheduled rules in full (AC-18, AC-19, features 18 and 19); the panel on narrow screens (AC-25).

## Questions

1. Which reminders does a batch hold?
   - Options: the full current list of the user's notes that are due today or overdue, less the ones the user dismissed (recommended: the app can replace its list with each batch, so a reminder never shows twice and a stale one never stays); only the reminders that are new since the last batch.
   - Answer: the full current list: one reminder for each of the user's notes that is due today or overdue, as features 15 and 16 define them (an Active note with an interval other than None, whose next review date is the user's today, or before it), in the user's saved time zone (feature 12 question 1), less the ones the user dismissed (feature 23). Archived notes and notes with the interval None are never in a batch (requirements.md 3.7; AC-18, AC-19). A batch with no reminders is sent too. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What does each reminder carry?
   - Options: its type, the note's id, title, and collection name, the next review date, and the due or overdue status (recommended: the list of requirements.md 3.7, enough to show the reminder and to open the note); the note's id only, with the rest fetched over HTTP.
   - Answer: `type` (`"review_due_today"` or `"review_overdue"`), `note_id` (a whole number), `title`, `collection_name`, `next_review_date` (`"YYYY-MM-DD"`, feature 12 question 2), and the due or overdue status as `review_state` (`"due_today"` or `"overdue"`, the values of a note's `review_state`, feature 15 question 2). The title and the collection name are the ones the note has when the batch is made. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How is a batch written, and in what order are its reminders?
   - Options: one message of the type `review_reminders` that holds the list, the oldest next review date first (recommended: the most overdue note comes first); other orders, such as by title, or newest note first as in the notes list.
   - Answer: a batch is one message on the user's reminders subscription:

     ```json
     { "type": "review_reminders",
       "reminders": [
         { "type": "review_overdue", "note_id": 12, "title": "Old idea", "collection_name": "Work", "next_review_date": "2026-11-02", "review_state": "overdue" },
         { "type": "review_due_today", "note_id": 7, "title": "Rails tips", "collection_name": "Books", "next_review_date": "2026-11-09", "review_state": "due_today" }
       ] }
     ```

     The reminders come in order of next review date, the oldest first, so the overdue ones come before the ones due today. Notes with the same date come in the order they were created, the oldest first. A batch with no reminders is `{ "type": "review_reminders", "reminders": [] }`. How messages are framed on the connection is the plan's choice, and the README documents it with them. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
4. When does the server send a batch, and how often does it check?
   - Options: a first batch as soon as the connection opens, then a new batch every 60 seconds while it stays open (recommended: a note that becomes due, at midnight in the user's time zone for example, shows within a minute, and one check a minute costs little); every 5 minutes; every 15 seconds.
   - Answer: when the app's connection opens and subscribes to the user's reminders, the server sends the first batch at once. While the connection stays open, the server checks again every 60 seconds and sends a new batch each time, even when nothing has changed. The 60 seconds are documented in the README. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. Does the panel follow the user's own changes at once?
   - Options: yes: right after a change to one of the user's notes or collections, or a dismissal, the server sends a new batch on each of the user's open connections (recommended: "Mark as reviewed", "Archive", or a new schedule shows in the panel at once, in every tab, as other changes already show at once across the layout, such as a renamed collection, [conventions](../../docs/conventions.md#ui)); no: the panel catches up at the next check, within 60 seconds.
   - Answer: yes. Right after the user creates, edits, moves, archives, restores, marks as reviewed, or deletes a note, renames a collection, or dismisses a reminder (feature 23), each of the user's open connections receives a new batch, made as in questions 1 to 3. The 60-second checks go on as before. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
6. How does the app show the reminders?
   - Options: a "Review reminders" panel in the main layout (recommended: every current reminder in one place, with nothing popping up again and again; requirements.md 3.7 allows a notification panel); toasts; an alert banner.
   - Answer: a panel with the heading "Review reminders", at the top of the main area, above the notes area. It stays there whatever the notes area shows: the list, a detail, or a form. Each reminder shows the note's title, its collection name, "Due today" or "Overdue", and "Next review: <date>" with the date written like "Nov 9, 2026" (feature 12 questions 3, 14), and the buttons "Open" and "Dismiss". "Open" shows the note's detail in the notes area, as choosing its title in the list does (feature 09 question 1), with the focus on the title. "Dismiss" is feature 23's. With no reminders, the panel shows "No review reminders" (requirements.md 4). A long list scrolls inside the panel, so the notes area stays in view. There are no toasts and no sounds. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. How is the same reminder kept from showing twice?
   - Options: each batch replaces the panel's whole list, and the app keys each reminder by note, type, and date (recommended: duplicates cannot pile up, and a repeated batch changes nothing on the screen); the app remembers which reminders it has shown, and shows only new ones.
   - Answer: each batch replaces the panel's whole list, so the panel never adds a reminder it already shows, and a reminder missing from a batch leaves the panel. The app keys each reminder by its note, its type, and its next review date: a reminder that a new batch repeats stays where it is, unchanged, and keeps the focus if it has it. A dismissed reminder is left out by the server (feature 23). The README documents this approach. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
8. What does the panel show while it connects, and after the connection is lost?
   - Options: "Loading…" until the first batch, and after a loss an alert, with the last list kept and a new connection tried on its own (recommended: the conventions' loading state, the reminders still readable, and no button to press); an empty panel; the list removed after a loss.
   - Answer: until the first batch arrives, the panel shows "Loading…" with `role="status"` ([conventions: Loading inside an area](../../docs/conventions.md#ui)), and the rest of the layout works. When the connection is lost, or cannot be opened, the panel shows "Review reminders are offline. Reconnecting…" with `role="alert"`. It keeps the last list it had, with "Open" working and "Dismiss" disabled, because an `ack` cannot be sent (feature 23). The app tries to connect again on its own, at most 30 seconds apart, with no button to press. When a batch arrives, the alert goes, and the batch replaces the list. A connection that the server refuses, or closes because the sign-in ended, shows the sign-in screen instead (feature 22 question 3). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. What does "Open" do while the notes area shows a note form?
   - Options: "Open" is disabled while the new-note or the edit form is open (recommended: only "Cancel" closes a note form, feature 09 question 13, so a reminder never throws away what was typed); "Open" closes the form and shows the detail; "Open" asks first.
   - Answer: while the notes area shows the new-note form or the edit form, every "Open" in the panel is disabled. It works again once the form closes, by "Cancel", "Create", or "Save". On the list and on a detail, "Open" shows the note's detail in place of what the notes area shows. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. When does the app open and close its connection?
    - Options: it opens one when the main layout shows, and closes it when the sign-in screen shows, with one connection per tab (recommended: reminders only while signed in, and each tab live on its own); one connection shared by every tab.
    - Answer: the app opens its connection when the main layout shows, and closes it when the sign-in screen shows: after a logout, a 401 answer, or a refused connection (feature 22). Each tab opens its own connection and receives its own batches. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**The first batch arrives when the connection opens**
- Given today is 2026-11-09 in my time zone, and my active weekly notes "Old idea" (in "Work", next review date 2026-11-02), "Rails tips" (in "Books", 2026-11-09), and "Later" (in "Books", 2026-11-12)
- When I sign in, and the main layout shows
- Then my connection receives at once a `review_reminders` batch with two reminders: first "Old idea" (`review_overdue`, `"2026-11-02"`, `"overdue"`), then "Rails tips" (`review_due_today`, `"2026-11-09"`, `"due_today"`), each with its `note_id` and `collection_name`; "Later" is not in it (questions 1 to 4)

**The panel shows the reminders**
- Given the batch above
- When it arrives
- Then the panel "Review reminders" lists "Old idea" with "Work", "Overdue", and "Next review: Nov 2, 2026", and then "Rails tips" with "Books", "Due today", and "Next review: Nov 9, 2026", each with "Open" and "Dismiss" (question 6)

**No reminders**
- Given no note of mine is due today or overdue
- When my connection opens
- Then the batch is `{ "type": "review_reminders", "reminders": [] }`, and the panel shows "No review reminders" (questions 3, 6; requirements.md 4)

**The server checks again every 60 seconds**
- Given my connection is open, and nothing changes
- When 60 seconds pass, and 60 more
- Then a new batch arrives each time, the same as the first, and the panel stays as it was (questions 4, 7)

**Midnight in my time zone**
- Given it is 23:59:30 on 2026-11-09 in my time zone, the panel shows "Rails tips" as "Due today" (next review date 2026-11-09), and "Later" has the next review date 2026-11-10
- When the first check after midnight runs
- Then within 60 seconds of midnight the batch lists "Rails tips" as `review_overdue` and "Later" as `review_due_today`, and the panel shows each once: "Rails tips" as "Overdue", and "Later" as "Due today" (questions 1, 4, 7)

**"Today" follows my time zone**
- Given my time zone is "Asia/Tokyo", it is 2026-11-09 20:00 UTC (2026-11-10 in Tokyo), and my active weekly note has the next review date 2026-11-10
- When a batch is made
- Then the note is in it as `review_due_today` (question 1; feature 12 question 1)

**A change shows at once in every tab**
- Given the main layout is open in two tabs, and both panels show "Rails tips" as "Due today"
- When I open "Rails tips" in one tab and choose "Mark as reviewed" (AC-13, AC-14)
- Then both connections receive a new batch without "Rails tips" right away, and neither panel shows it (question 5)

**A renamed collection shows in the panel**
- Given the panel shows "Old idea" in "Work"
- When I rename "Work" to "Job" in the collections area
- Then the panel shows "Old idea" in "Job" right away (question 5)

**A repeated reminder is shown once**
- Given the panel shows "Rails tips", and the focus is on its "Open"
- When the next batch lists "Rails tips" again, with the same type and date
- Then the panel shows "Rails tips" once, in the same place, and the focus stays on its "Open" (question 7; requirements.md 11)

**A reminder missing from a batch leaves the panel**
- Given the panel shows "Rails tips"
- When a batch arrives without it, for example because I marked it as reviewed in another browser
- Then the panel no longer shows "Rails tips" (question 7)

**Open a reminder's note**
- Given the panel shows "Rails tips", and the notes area shows the list
- When I choose "Open" on "Rails tips"
- Then the notes area shows the detail of "Rails tips", with the focus on its title, and the panel stays as it was (question 6; feature 09 question 1)

**"Open" waits while a note form is open**
- Given the notes area shows the new-note form with a title typed, and the panel shows "Rails tips"
- When I try to choose "Open" on "Rails tips"
- Then "Open" is disabled, and the form keeps what I typed; after "Cancel", "Open" works again (question 9; feature 09 question 13)

**Connecting**
- Given I have signed in, and my connection has not delivered its first batch yet
- When the main layout shows
- Then the panel shows "Loading…" with `role="status"`, and the collections, tags, and notes areas work (question 8)

**The connection is lost**
- Given the panel shows "Rails tips"
- When the connection drops, because the server stops or the network fails
- Then the panel shows "Review reminders are offline. Reconnecting…" as an alert, and keeps "Rails tips", with "Open" working and "Dismiss" disabled (question 8)

**Back online**
- Given the panel shows "Review reminders are offline. Reconnecting…"
- When the server can be reached again
- Then within 30 seconds the app connects again on its own, the server sends a first batch, the alert goes, and the batch replaces the list (questions 4, 8)

**The connection follows the sign-in**
- Given the main layout shows, and its connection is open
- When I log out, or a request answers 401
- Then the app closes its connection, and the sign-in screen shows, with no panel (question 10)

**Each tab has its own connection**
- Given the main layout is open in two tabs
- When the server sends batches
- Then each tab's connection receives its own, and each panel shows them (question 10)

**Archived and unscheduled notes are left out**
- Given today is 2026-11-09, the archived weekly note "Old plan" (next review date 2026-11-02), and the note "Someday" with the interval None
- When a batch is made
- Then neither is in it (question 1; AC-18, AC-19)

**Only my reminders**
- Given another user has notes due today
- When my connection receives a batch
- Then it holds none of their notes (question 1; feature 22; requirements.md 5)

## Edge cases

- A batch holds every current reminder, with no limit and no paging (question 1).
- A note is in a batch at most once: due today and overdue never overlap (feature 15 question 1).
- A reminder's `review_state` is the note's `review_state` in the notes API at the same moment (features 15, 16; question 2).
- A batch is sent at every check, even when it is the same as the one before. The panel then changes nothing (questions 4, 7).
- At midnight in the user's time zone, a note due yesterday turns from `review_due_today` to `review_overdue`, and a note dated the new today becomes `review_due_today`, at the first check after midnight, within 60 seconds. A reminder whose type changes has a new key, and the panel shows it once, with its new label (questions 4, 7).
- "Today" is the date in the user's saved time zone, UTC until a zone is known (feature 12 question 1). A zone saved by a load in another browser applies from the next batch.
- A note's title, or its collection's name, that changes shows in the panel with the batch sent right after the change (question 5).
- A title or a collection name is shown as plain text, never run as markup (feature 09).
- The notes list's "Due today" and "Overdue" labels hold as of the list load (feature 15 question 6). Only the panel follows each batch.
- "Open" on a note that was deleted before the panel heard of it: the notes area answers as for any missing note, with the list and "This note no longer exists." (feature 09).
- A batch that arrives while the notes area shows a form changes only the panel. The form keeps what was typed (question 6).
- An archived note, or a note with the interval None, is never in a batch, whatever its dates (question 1; features 18 and 19).
- Another user's reminders never reach my connection (question 1; feature 22).
- The app does not reconnect after the server refuses its connection, or closes it because the sign-in ended (feature 22 question 3).
- UI states (requirements.md 4 `<ui_quality_checks>`): the loading state is "Loading…", the empty state is "No review reminders", and the error state is "Review reminders are offline. Reconnecting…" (questions 6, 8).
- README (requirements.md 3.7, 8; AC-30): it documents the batch message and the fields of a reminder (questions 2, 3), the 60-second check and the other moments a batch is sent (questions 4, 5), and the duplicate-prevention approach (question 7).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
