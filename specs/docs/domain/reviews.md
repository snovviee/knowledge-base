# Reviews

## Review schedule

A note's review schedule says when the note should be reviewed again (requirements.md 3.4, 3.5). It is four attributes of the note: the review interval, the custom number of days, the next review date, and the last reviewed date. Their values, checks, and the rules of each create and edit are in [notes.md](notes.md#note) (AC-12).

- **Intervals.** `none`, `daily`, `weekly`, `monthly`, and `custom`: every N days, with N a whole number from 1 to 365. A note with `none` has no schedule, so it has no next review date (AC-12).
- **Review dates are calendar dates.** The next review date and the last reviewed date are days, with no time and no time zone. The API writes them `"YYYY-MM-DD"`, and the UI writes them like "Nov 16, 2026" (AC-12, spec questions 2 and 3).

## Rules

- **"Today" is the date in the user's time zone.** It is the current date in the time zone saved on the user's account, and in UTC while none is saved. The saved zone is the one named by the latest session check that named a zone, when the server knows that name; a check that names none leaves it as it is. So "today" is UTC before the first check that names a known zone, and after a check that names a zone the server does not know (AC-12, spec questions 1 and 19). How the zone is saved is in [users.md](users.md#rules). "Today" is computed from the current time in that zone (`User#today`), never from the date of the server machine.
- **A schedule without a date counts from today.** When a schedule is set without a next review date, or its date is emptied (null), the next review date is the user's today plus the interval, as requirements.md 3.5 calculates it (AC-12, spec question 8):
  - daily: today + 1 day;
  - weekly: today + 7 days;
  - monthly: today + 1 calendar month;
  - custom: today + the number of days.
- **A month later is the same day number, or the month's last day.** When the next month has no such day, the date is that month's last day: from 2026-11-09 the monthly date is 2026-12-09, from 2026-01-31 it is 2026-02-28, from 2028-01-31 it is 2028-02-29 (a leap year), and from 2026-03-31 it is 2026-04-30 (AC-12, spec question 6).
- **Only a missing date is computed.** A date the user gives is kept, a date in the past included. An edit that changes the interval or the number of days, and sends no date, keeps the date the note has (AC-12, spec questions 7, 9, and 10). A refused date is never replaced by a computed one: the request is refused.
- **A note without a schedule has no next review date.** The interval `none` removes it, and keeps the last reviewed date (AC-12, spec question 11; requirements.md 3.5).

## Marking a note as reviewed

The user marks a note as reviewed from its detail, with "Mark as reviewed" (requirements.md 3.5, 4). The request is [`POST /api/notes/:id/review`](../api_contract.md#post-apinotesidreview) (AC-13).

- **The last reviewed date becomes today.** Marking a note as reviewed sets its last reviewed date to the user's "today", the date in their saved time zone (see [Rules](#rules)). It is the only way the date is set (AC-13, spec question 1; requirements.md 3.5).
- **Any note of the user can be marked.** Active or archived, with any interval, `none` included (AC-13, spec question 1).
- **An early review is allowed.** A note can be marked on any day, before its next review date included (AC-13, spec question 3).
- **A second review on the same day changes nothing more.** It answers the same note, and nothing is written (AC-13, spec question 2).
- **Only the review dates change.** A review sets the last reviewed date, and the next review date as the next section says (AC-14). The status, the interval and its days, the collection, the tags, the title, the body, the source URL, and the updated date stay as they are (AC-13, spec edge cases).
- **The client cannot choose the date.** The request's body is ignored, whatever it holds, so no field it sends changes the note. A body that cannot be read as JSON is still refused, as for every request that changes data, and changes nothing (AC-13, spec questions 4 and 9).

## The next review date after a review

A review also moves the next review date, so the note comes up again one interval after the day it was reviewed (requirements.md 3.5) (AC-14).

- **Today plus the interval.** The new next review date is the user's today plus the interval the note has at the review, by the same calculation as a schedule without a date (see [Rules](#rules)): daily + 1 day, weekly + 7 days, monthly + 1 calendar month, and custom + its number of days. Today is read once, so the last reviewed date is the same day: a weekly note reviewed on 2026-11-09 gets the last reviewed date 2026-11-09 and the next review date 2026-11-16 (AC-14, spec question 1).
- **It counts from the review day, never from the old date.** An overdue note does not catch up, and an early review counts from the day it is made: a weekly note due on 2026-11-02 and one due on 2026-11-12, each reviewed on 2026-11-09, both get 2026-11-16 (AC-14, spec question 1).
- **A monthly note drifts.** The month-end rule applies from each review day, so a monthly note reviewed on its date each month goes Jan 31 → Feb 28 → Mar 28, not back to Mar 31 (AC-14, spec question 2). Reviewed on 2028-01-31 it gets 2028-02-29 (a leap year), and on 2026-03-31 2026-04-30 (AC-14).
- **The new date may be in the next year.** Weekly reviewed on 2026-12-28 gets 2027-01-04, and monthly reviewed on 2026-12-15 gets 2027-01-15 (AC-14).
- **The custom interval counts its own days,** 1 to 365: reviewed on 2026-11-09, 1 day gives 2026-11-10, and 365 days give 2027-11-09 (AC-14).
- **The interval the note has at the review counts.** A weekly note changed to daily keeps its date (see [notes.md](notes.md#rules)), and its next review gives today + 1 day (AC-14).
- **A note with no schedule keeps none.** With the interval `none`, a review sets only the last reviewed date, and the next review date stays empty (AC-14; AC-12, spec question 11).
- **An archived note gets a new date too,** like any other, and stays archived (AC-14; AC-13, spec question 1).
- **A second review on the same day gives the same two dates,** so nothing is written (see above). A next review date changed by hand in between is set again to today plus the interval (AC-14, spec question 1).
- **A refused review changes neither date.** The refusals are those of [`POST /api/notes/:id/review`](../api_contract.md#post-apinotesidreview) (AC-14).

## Due today

A note is due for review today when its next review date is today (requirements.md 3.5). The app marks it, and the notes list can show only those notes (AC-15).

- **The rule.** A note is due today when all three hold: its status is Active, its interval is not `none`, and its next review date equals the user's today, the date in the saved time zone (see [Rules](#rules)). `Note#review_state(today)` and the scope `Note.due_today(today)` hold the rule, and later features call them with the user's today (AC-15, spec question 1).
- **Archived and unscheduled notes are never due today.** An archived note whose date is today is not due today, and neither is a note with the interval `none` (AC-15, spec question 1; AC-18 and AC-19 build on it).
- **`review_state` has three values.** Every note in every answer carries it: `"due_today"`, `"overdue"`, or `null`. It is `"overdue"` for an Active note with a schedule whose next review date is before today (see [Overdue](#overdue)), and `null` for every other note: archived, no schedule, or dated later. A note whose next review date is today is `"due_today"`, never `"overdue"`, so the two never overlap, and together they are the notes due for review in requirements.md 3.5 (AC-15, spec questions 1 and 2).
- **The state is judged once per request.** The notes controller reads the user's today once (`Api::NotesController#today`), so every note of one answer is judged on the same date. The list, the detail, and the answers of a create, an edit, and a review all carry it (AC-15, spec question 2).
- **States hold as of the list load.** The server judges on each request, but the app keeps a loaded list as it is: a note that becomes due at midnight in the user's zone, or by a change in another tab, keeps its label and its place until the list loads again. A note changed in this tab shows the new state the server answered, and stays in a filtered list until the list loads again (AC-15, spec question 6). The request and the filter are in [`GET /api/notes`](../api_contract.md#get-apinotes).

## Overdue

A note is overdue when it should have been reviewed before today (requirements.md 3.5). The app marks it, and the notes list can show only those notes (AC-16).

- **The rule.** A note is overdue when all three hold: its status is Active, its interval is not `none`, and its next review date is before the user's today (see [Rules](#rules)), however long ago. A note a day late and a note 39 days late are both overdue. `Note#review_state(today)` answers `"overdue"` for it, and the scope `Note.overdue(today)` holds the same rule beside `Note.due_today(today)` (AC-16, spec question 1).
- **Archived and unscheduled notes are never overdue,** as they are never due today. An archived note stays out of the overdue list whatever its date, and so does a note with the interval `none` (AC-16; AC-18 and AC-19 build on it).
- **Never at the same time as due today.** A date before today is overdue and a date equal to today is due today, so each note has at most one state, and a note due tomorrow or later has none. The two together are the notes due for review in requirements.md 3.5 (AC-16, spec question 1).
- **A review or a new date ends it.** Marking a note as reviewed moves its next review date to today plus the interval, so it stops being overdue ([above](#the-next-review-date-after-a-review)). A note created or edited with a next review date in the past is overdue at once, because a date the user gives is kept (AC-16; AC-12).
- **States hold as of the list load,** as for due today (see [Due today](#due-today)). A note reviewed in this tab shows its new date with no "Overdue", and stays in the overdue list until the list loads again (AC-16, spec question 6). The request and the filter are in [`GET /api/notes`](../api_contract.md#get-apinotes).

## Next 7 days and no review scheduled

The notes list can also show the notes that come up soon, and the notes that have no schedule (AC-17).

- **Next 7 days.** A note is in the next 7 days when its status is Active, its interval is not `none`, and its next review date is from tomorrow through today plus 7 days, in the saved zone (see [Rules](#rules)). `Note.due_next_7_days(today)` holds the rule. With today 2026-11-09, dates 2026-11-10 to 2026-11-16 count, and 2026-11-09, 2026-11-17, and any earlier date do not. An archived note is never in it (AC-17, spec question 7).
- **No review scheduled.** A note is unscheduled when its interval is `none`, in any status, archived included. `Note.unscheduled` holds the rule. An archived note with an interval is not in it (AC-17, spec question 8).
- **No overlap.** Due today (the date is today), overdue (before today), and the next 7 days (tomorrow or later) each take a different date, so no note is in two of them. The unscheduled notes have no date, so they are in none of the three. A note dated more than 7 days ahead is in none of the four (AC-17).
- **The request.** `GET /api/notes?review=next_7_days` and `review=unscheduled`, see [`GET /api/notes`](../api_contract.md#get-apinotes). The server judges, as for due today, once per request on the user's today.

## No reminders for archived notes and notes with no schedule

"Review reminders" means two things, and both follow one rule: the notes view's states and filters ("Due today" and "Overdue" labels, the "Review" filter), and the WebSocket reminders of the "Review reminders" panel ([notifications.md](notifications.md)). The rule lives once, in `Note#review_state(today)`, `Note.due_today(today)`, and `Note.overdue(today)`, which build on `Note.active` and `Note.scheduled`, and every kind of reminder calls them (AC-18, AC-19, spec question 1 of each; requirements.md 3.4, 3.5, 7).

- **An archived note has no reminder, whatever its schedule and dates.** It is never due today or overdue, so its `review_state` is `null`, it is not in the "Due today" and "Overdue" filters (and "Archived" with either finds nothing), and no batch holds it. This holds for every interval and every date, today and the past included. An archived note keeps its interval and its dates, and "Mark as reviewed" still moves its next review date and leaves it archived (AC-18).
- **A restored note is reminded when it is due,** as any Active note: one that is overdue or dated today is in the next batch, and one with a later date waits for its date. An archive and a restore change only the status, so the schedule is as it was, and a dismissed reminder stays dismissed through both ([notes.md](notes.md#rules); AC-18, spec question 2).
- **A note with the interval `none` has no review schedule, so no reminder, whatever its status** and whatever date its row may hold. Its `review_state` is `null`, it is not in the "Due today" and "Overdue" filters, and no batch holds it. It is only under "No review scheduled" (AC-19, spec question 1).
- **A schedule set again is reminded on its new date.** A note moved from `none` to an interval with a date today or earlier is reminded at once, in the batch sent right after the save; with a later date, or with no date (today plus the interval), it is reminded when that date comes, at the first check of that day. Setting `none` ends its reminder at once ([notes.md](notes.md#rules); AC-19, spec question 2).
- **Marking a note with no schedule as reviewed creates no reminder.** It sets only the last reviewed date, and the next review date stays empty (AC-19; see [above](#the-next-review-date-after-a-review)).

## Chosen approaches


- **"Today" is the user's own date (spec question 1).** requirements.md 3.5 and 5 leave the time zone approach to us. The app sends the browser's IANA time zone, such as `Europe/Berlin`, with every session check, and the server saves it on the account. The server can then work out the user's "today" with no browser open, and the periodic review checks of AC-20 are to use the same saved zone. When two browsers are in different zones, the one that loaded last decides. UTC is the fallback (AC-12).
- **A session check without a zone keeps the saved zone (spec question 19).** Only a check that names a zone changes it, so a client that names none, such as `curl`, does not move "today" (AC-12).
- **Review dates have no time (spec question 2).** A review is due on a day, not at an instant. `created_at` and `updated_at` stay UTC timestamps (AC-12).
- **Dates in the UI (spec question 3).** "Nov 16, 2026", built from the date's own year, month, and day, so the browser's zone never moves a calendar date (AC-12).
- **Month end (spec question 6), a missing date (question 8), an interval change (question 9), and a past date (question 10)** are the rules above. Each answer was the recommended option, taken under the owner's instruction of 2026-11-09; question 19 was the agent's recommendation (AC-12).
- **The zone names the server knows.** A name is known when the time zone data of the `tzinfo-data` gem has it. The gem is installed on every platform, so every machine knows the same names, whatever its operating system has: 598 names in version 1.2026.6. They include the old names that the tz database keeps as links to the current ones: `US/Eastern`, and the names Chrome reports for some zones, such as `Asia/Calcutta` (India), `Europe/Kiev` (Ukraine), `Asia/Saigon`, `America/Buenos_Aires`, and `Asia/Katmandu`. A known name is saved as sent, and "today" follows its zone. Names are case-sensitive, so `asia/tokyo` is unknown, and so is a made-up name such as `Mars/Base` (AC-12).
- **The server tells the state (AC-15, spec question 2).** The app never computes "due today": it shows the `review_state` the server sent, so the browser's clock and zone cannot disagree with the saved zone. The filter is answered by the server too, with the same rule (`Note.due_today`). "Due today" and overdue do not overlap, so each note has at most one state. The answers were the recommended option, taken under the owner's instruction of 2026-11-09; question 7 (the list's loading and failure) was the agent's recommendation (AC-15).
- **Marking as reviewed (spec questions 1 to 4, 8, and 9)** follows the rules above. Questions 1 to 8 were each answered with the recommended option, under the owner's instruction of 2026-11-09, and question 9 (a body that is not JSON answers 400) was the owner's choice of 2026-11-09 (AC-13).
- **A review keeps the updated date.** The spec's edge case says that a review sets only the last reviewed date and that the other fields stay. requirements.md 3.4 lists the updated date among a note's fields, so it stays too, and a second review on the same day writes nothing at all (AC-13). The next review date that AC-14 adds to a review does not change the updated date either (AC-14).
- **A review counts from its own day (AC-14, spec questions 1 and 2).** requirements.md 3.5 writes the calculation from today ("today + 1 day", and so on), so the next review is always one interval after the last review: an overdue note does not catch up with the reviews it missed, and a monthly note's day number drifts after a short month. Scheduling and reviewing use one calculation, so the month-end rule is the same for both. Both answers were the recommended option, taken under the owner's instruction of 2026-11-09 (AC-14).
- **"Review reminders" is one rule for the notes view and the WebSocket (AC-18, AC-19, spec question 1 of each).** requirements.md 3.4, 3.5, and 7 say that archived notes and notes with no schedule get no review reminders, and "review reminders" covers the labels, the filters, and the batches. Features 15, 16, and 20 already build all three on `Note.due_today` and `Note.overdue`, so these two features added no production code: they hold the rule with tests, and each kind of reminder has its own test (`spec/models`, `spec/requests`, and `spec/channels` `archived_reminders_spec.rb` and `unscheduled_reminders_spec.rb`, and `src/ArchivedReminders.test.tsx`).
- **An archive and a restore keep the schedule (AC-18, spec question 2).** Restoring does not reset the date, so a note that was overdue when archived is overdue when restored; the answers were the recommended option, taken under the owner's instruction of 2026-11-09 (AC-18, AC-19).
