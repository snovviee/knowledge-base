# Feature: 12_review_interval_setting

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-12: A user can configure review intervals for notes

Sources: requirements.md 1, 3.4 (review interval, custom review interval days, next review date; custom days greater than 0), 3.5 (the interval calculation; the case of a note with no review schedule; the time zone approach, documented), 4 (notes view: next review date; note create/edit UI; note detail: review interval, next review date; client-side validation), 5 (invalid input; dates stored consistently, time zone documented), 11 (the handling of "today"); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Error body; Dates and times); [features/05_logout/spec.md](../05_logout/spec.md) (question 1), [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 1 to 4), and [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 6 to 9: the note form, its checks, the API's 422 answer, edits that send only some fields), not yet in `docs/`.

Not part of this feature: marking a note as reviewed and the last reviewed date (AC-13, feature 13); the new next review date after a review (AC-14, feature 14); due today and overdue (AC-15, AC-16); review reminders (AC-18 to AC-20).

## Questions

1. Which time zone decides "today"?
   - Options: each user's own time zone, as the browser reports it (recommended); other options: TBD (the research names none; requirements.md 3.5 and 5 leave the approach to us and ask that it be documented).
   - Answer: each user's own time zone, as the browser reports it (an IANA name, such as "Europe/Moscow"). The app sends it with the session check each time it loads, in a request header and not in the address, so another site cannot set it, and the server saves it for the account. "Today" is the date in the saved zone. It is UTC until a zone is known, and when the server does not know the zone's name. With two browsers in different zones, the one that loaded last decides. The periodic checks of AC-20 use the saved zone. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
2. How does the API write review dates?
   - Options: calendar dates `YYYY-MM-DD`, with no time or zone (recommended); other options: TBD (the research names none).
   - Answer: as calendar dates `YYYY-MM-DD`, with no time or zone. `created_at` and `updated_at` stay UTC timestamps. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
3. How does the UI write dates?
   - Options: "Nov 16, 2026" (recommended); other options: TBD (the research names none).
   - Answer: "Nov 16, 2026". (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
4. Which interval does a new note get?
   - Options: None (recommended); other options: TBD (the research names none).
   - Answer: None. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
5. Which custom numbers of days are allowed?
   - Options: a whole number from 1 to 365 (recommended); other options: TBD (the research names none).
   - Answer: a whole number from 1 to 365, sent as a JSON integer. `7.0`, `1.5`, and `"7"` are invalid. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
6. What does "today + 1 calendar month" (requirements.md 3.5) give at the end of a month?
   - Options: the same day number in the next month, or that month's last day (recommended); other options: TBD (the research names none).
   - Answer: the same day number in the next month, or that month's last day when it has no such day: Jan 31 → Feb 28 (Feb 29 in a leap year), Mar 31 → Apr 30. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
7. May the user set the next review date?
   - Options: yes, in an optional field (recommended); no, the date is always computed (simpler, but the Verify walkthroughs would need console steps to backdate notes).
   - Answer: yes. An optional field "Next review date (optional)" in the form, shown only when the interval is not None. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
8. What is the next review date when none is given?
   - Options: today plus the interval (recommended); other options: TBD (the research names none).
   - Answer: when a schedule is set without a date, or the date is emptied, the next review date is today plus the interval, by the calculation of requirements.md 3.5. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
9. The interval changes, and the date is left as it is. What happens to the date?
   - Options: it stays (recommended); other options: TBD (the research names none).
   - Answer: the date stays. Emptying the date restarts the schedule from today. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
10. Is a next review date in the past allowed?
    - Options: yes (recommended); no.
    - Answer: yes, and the note is overdue at once (AC-16). (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
11. What does the interval None do to the dates?
    - Options: it removes the next review date and the days, and keeps the last reviewed date (recommended); other options: TBD (the research names none).
    - Answer: None removes the next review date and the custom days. The last reviewed date stays. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
12. What does the API answer when a review field breaks a rule?
    - Options: 422 with a code for each field, as for the other note fields (recommended); other options: TBD (the research names none).
    - Answer: 422 `{ "error": "validation_failed", "fields": { ... } }` with `review_interval`: `invalid`; `review_interval_days`: `blank` or `invalid`; `next_review_date`: `invalid`. Days or a date sent with the interval None, and days sent with an interval other than custom, are ignored. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
13. What do the form's messages say?
    - Options: the messages below (recommended); other options: TBD (the research names none).
    - Answer: "Enter the number of days." (no days for the custom interval), "Enter a whole number from 1 to 365." (days that are not such a number), "Enter a valid date." (a date that is not valid), and "Choose a review interval." (an interval that is not valid). (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
14. How do the list and the detail show a note's schedule?
    - Options: the lines below (recommended); other options: TBD (the research names none).
    - Answer: the list shows "Next review: <date>", or "No review scheduled". The detail shows "Review interval" (None, Daily, Weekly, Monthly, or "Every N days") and "Next review" (the owner's answer, recommended option, taken under the owner's instruction of 2026-11-09).
15. Which values does the API use for the review interval?
    - Options: TBD. requirements.md 3.4 names none, daily, weekly, monthly, and custom number of days; the research uses "none" and "custom" but lists no values.
    - Answer: the values of requirements.md 3.4, in the API: `none`, `daily`, `weekly`, `monthly`, and `custom` (for a custom number of days), as the owner chose on 2026-11-09. In the form, the interval choices are "None", "Daily", "Weekly", "Monthly", and "Every N days", as the owner chose on 2026-11-09 (the recommended labels).
    - Answer: the field names, added on 2026-11-09 (see Changes). A note's review fields in the API are `review_interval` (one of `"none"`, `"daily"`, `"weekly"`, `"monthly"`, `"custom"`), `review_interval_days` (a whole number when the interval is `"custom"`, else null; the name question 12 gives it), and `next_review_date` and `last_reviewed_date` (each `"YYYY-MM-DD"` or null). Every note in an answer carries all four, in the list and in the detail. A create or an edit sends the first three. `last_reviewed_date` is null until the note is marked as reviewed (AC-13), and a create or an edit that sends it changes nothing. Later features use these names. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
16. What do the form's interval choices and the custom days field say, and what does the detail show under "Next review" for a note with no schedule?
    - Options: TBD. The research gives only the detail's labels (question 14) and the field "Next review date (optional)".
    - Answer: for a note with no schedule, the detail shows "Next review: Not set" (the owner's choice of 2026-11-09). The custom days field is labelled "Number of days" (the recommended label, which the owner chose on 2026-11-09).
17. When does the form send the review fields? (added on 2026-11-09, see Changes)
    - Options: only what the user changed, as the form already does for tags and the collection (features 10 and 11, recommended: a save that does not touch the schedule keeps a date that another tab, or a review (AC-14), changed meanwhile); all the review fields with every save.
    - Answer: only what the user changed. The new-note form sends the interval only when it is not None, the number of days only with "Every N days", and the next review date only when one is entered. The edit form sends the interval when it differs from the note's; the number of days when "Every N days" is chosen and the number differs from the note's, or the note had another interval; and the next review date when the field differs from the note's date. An emptied date field sends no date (null), which restarts the schedule from today (question 9). A save that does not touch the schedule sends no review field. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
18. Which texts and fields does the form show for the schedule, beyond questions 13 to 16? (added on 2026-11-09, see Changes)
    - Options: the field "Review interval" with the choices of question 15, and the other two fields only when the interval needs them (recommended: the same word as the detail, and no field that does not apply); other options: TBD.
    - Answer: the new-note form and the edit form show the field "Review interval", with the choices of question 15. A new note has None chosen. "Number of days" shows only while "Every N days" is chosen, and "Next review date (optional)" only while the interval is not None (question 7). The edit form shows the note's interval, number of days, and next review date. The detail writes a custom interval of one day as "Every 1 day", and any other number as "Every N days". (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
19. What does a session check that sends no time zone do? (added on 2026-11-09, see Changes)
    - Options: nothing changes: the saved zone stays (recommended: only the app reports a zone, and a client that reports none, such as `curl`, should not move "today"); the saved zone is removed, and "today" is UTC.
    - Answer: the saved zone stays. Only a session check that names a zone changes it: a name the server knows is saved, and a name it does not know makes "today" UTC until a later session check names a known zone (question 1). (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**A new note has no review schedule**
- Given the new-note form is open
- Then the interval is None, and "Next review date (optional)" does not show
- When I create the note
- Then it has no next review date, and the list shows "No review scheduled" for it (questions 4, 7, 14; requirements.md 3.5: a note with no review schedule)

**Set a weekly schedule without a date**
- Given today is 2026-11-09 in my time zone
- When I create a note with the interval Weekly and no next review date
- Then the answer has `next_review_date` "2026-11-16", and the list shows "Next review: Nov 16, 2026" (questions 2, 3, 8)

**Set a custom schedule**
- Given today is 2026-11-09 in my time zone
- When I create a note with the custom interval and 10 days, and no date
- Then its next review date is 2026-11-19, and the detail shows "Review interval: Every 10 days" (questions 5, 8, 14)

**Set the next review date myself**
- Given the form shows the interval Weekly
- When I enter Nov 20, 2026 in "Next review date (optional)" and save
- Then the note's next review date is 2026-11-20 (question 7)

**A monthly schedule at the end of a month**
- Given today is 2026-01-31 in my time zone
- When I set the interval Monthly with no date
- Then the next review date is 2026-02-28; from 2028-01-31 it is 2028-02-29, and from 2026-03-31 it is 2026-04-30 (question 6)

**Change the interval and keep the date**
- Given a weekly note whose next review date is 2026-11-16
- When I change the interval to Daily, leave the date as it is, and save
- Then the next review date stays 2026-11-16 (question 9)

**Empty the date to restart the schedule**
- Given today is 2026-11-09, and a weekly note whose next review date is 2026-11-20
- When I empty "Next review date (optional)" and save
- Then the next review date is 2026-11-16 (questions 8, 9)

**A date in the past**
- Given today is 2026-11-09
- When I set the interval Weekly and the date Nov 2, 2026, and save
- Then the date is saved, and the note is overdue at once (question 10; AC-16)

**Remove the schedule**
- Given a weekly note with a next review date and a last reviewed date
- When I set the interval to None and save
- Then the note has no next review date and no custom days, keeps its last reviewed date, and the list shows "No review scheduled" (questions 11, 14)

**The form checks the days**
- Given the form shows the custom interval
- When I choose "Create" or "Save" with the days empty, or with 0, 366, or 1.5
- Then no request is sent, and "Enter the number of days." (empty) or "Enter a whole number from 1 to 365." (the others) shows under the days field (questions 5, 13; feature 09 question 6)

**The server refuses a review field**
- Given I am signed in
- When a create request sends the custom interval with `review_interval_days` `"7"`
- Then it answers 422 `{ "error": "validation_failed", "fields": { "review_interval_days": "invalid" } }`, and no note is created (questions 5, 12)

**"Today" follows my time zone**
- Given my browser reports the time zone "Asia/Tokyo", and it is 2026-11-09 20:00 UTC, which is 2026-11-10 in Tokyo
- When the app loads, and I create a note with the interval Weekly and no date
- Then its next review date is 2026-11-17 (questions 1, 8)

**"Today" is UTC while no zone is known**
- Given the server knows no time zone for me, and it is 2026-11-09 20:00 UTC
- When I create a note with the interval Weekly and no date
- Then its next review date is 2026-11-16 (question 1)

**The detail shows the schedule**
- Given a weekly note whose next review date is 2026-11-16
- When I open its detail
- Then it shows "Review interval: Weekly" and "Next review: Nov 16, 2026" (questions 3, 14)

**The form shows the fields the interval needs**
- Given the new-note form is open, with None chosen in "Review interval"
- When I choose "Every N days"
- Then "Number of days" and "Next review date (optional)" show
- When I choose "Weekly"
- Then only "Next review date (optional)" shows, and with None neither shows (questions 7, 18)

**The edit form shows the note's schedule**
- Given a note with the interval "Every N days", 10 days, and the next review date 2026-11-19
- When I open its edit form
- Then "Review interval" shows "Every N days", "Number of days" shows 10, and "Next review date (optional)" shows Nov 19, 2026 (question 18)

**A save that does not touch the schedule keeps the date**
- Given a weekly note whose next review date is 2026-11-16, with its edit form open
- And another tab has changed its next review date to 2026-11-23 meanwhile
- When I change only the title here and save
- Then the edit request sends no review field, and the next review date stays 2026-11-23 (question 17)

## Edge cases

Based on the answers to the questions above.

- A create without an interval: the note's interval is None (question 4).
- An interval value the API does not know, null included: 422 `{ "error": "validation_failed", "fields": { "review_interval": "invalid" } }`. The values are `none`, `daily`, `weekly`, `monthly`, and `custom` (question 15).
- The custom interval with the days missing or null: 422 with `review_interval_days` `blank` (question 12).
- The custom interval with days of 0, 366, `1.5`, `7.0`, `"7"`, or any other value that is not a JSON integer from 1 to 365: 422 with `review_interval_days` `invalid`. 1 and 365 are accepted (questions 5, 12).
- Days sent with the interval None or with an interval other than custom, and a date sent with the interval None: ignored (question 12).
- In an edit, the interval that counts is the one the note has after the edit: days sent alone count only for a note whose interval is custom, and a date sent alone only for a note with a schedule (question 12; feature 09 question 9).
- A change from the custom interval to another interval removes the custom days: they are a whole number only while the interval is custom (question 15).
- Every note in an answer, in the list and in the detail, carries `review_interval`, `review_interval_days`, `next_review_date`, and `last_reviewed_date` (question 15).
- A `last_reviewed_date` sent in a create or an edit changes nothing. It stays null until the note is marked as reviewed (question 15; AC-13).
- A next review date that is not a real calendar date written `YYYY-MM-DD`, such as `20261109`, `2026-02-30`, or `tomorrow`: 422 with `next_review_date` `invalid` (questions 2, 12).
- A schedule without a date (missing or null): the next review date is today plus the interval (question 8).
- An edit that sends only the interval keeps the date; an edit that empties the date restarts the schedule from today (question 9; feature 09 question 9).
- The interval None removes the next review date and the custom days, and keeps the last reviewed date (question 11).
- A note has a next review date exactly when its interval is not None.
- Every field that breaks a rule is named in the same 422 answer, one code each (feature 09 question 8). 401, 403, 404, and 400 are as in feature 09.
- Dates in the API are `YYYY-MM-DD` with no time or zone; `created_at` and `updated_at` stay UTC timestamps (question 2).
- "Today" is the date in my saved time zone. It is UTC until a zone is known, and when the server does not know the zone's name, such as "Mars/Base" (question 1).
- Two browsers in different time zones: the one that loaded last decides (question 1).
- A session check that sends no time zone, such as a `curl` request, keeps the saved zone (question 19).
- The periodic review checks of AC-20 use the saved time zone (question 1; AC-20).
- A save that does not touch the schedule sends no review field, and a create with the interval None sends none either (question 17).
- The detail of a note with no schedule shows "Review interval: None" and "Next review: Not set" (questions 14, 16).
- The detail writes a custom interval of one day as "Every 1 day" (question 18).
- UI states (requirements.md 4 `<ui_quality_checks>`): the messages under the review fields, shown and checked as the other note fields are (question 13; feature 09 question 6).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

The owner approved the spec on 2026-11-09, and it stayed at Design while features 10 and 11 went first (one feature at a time, folder order).

### 2026-11-09: Names of the review fields, and what the form sends

- Reason: question 15 gave the interval values, but not the names of all the review fields, and features 13 to 20 need them. The Plan step also found three gaps: when the form sends the review fields, which texts the form shows for them, and what a session check without a time zone does.
- Change: question 15: a second answer names every review field of a note in the API, with question 12's `review_interval_days` for the days, and says that every note in an answer carries them.
- Change: new questions 17 (what the form sends), 18 (the texts and fields of the form), and 19 (a session check without a time zone). Each is the agent's recommendation, taken under the owner's standing instruction of 2026-11-09.
- Change: new scenarios "The form shows the fields the interval needs", "The edit form shows the note's schedule", and "A save that does not touch the schedule keeps the date".
- Change: edge cases: the interval values are named (the draft said TBD); a create or an edit names a value the API does not know with `invalid`, null included; in an edit, the interval after the edit decides whether days or a date count; leaving the custom interval removes the days; every note carries the four fields; `last_reviewed_date` cannot be sent; a session check without a time zone keeps the saved zone; the detail of a note with no schedule shows "Not set" (question 16, which no scenario or edge case showed); one day is written "Every 1 day".
- Stage: approved again on 2026-11-09 under the owner's standing instruction (recommended options).

## Notes for Plan (draft)

From the research of 2026-11-09 (read-only probes in the containers), before the spec was approved. Their content is in `plan.md` now, and this list is kept as the record of the research.

- Depends on (planned): 01, 04, 05, 06, 09.
- The backend image has `/usr/share/zoneinfo`, and TZInfo reads it (ZoneinfoDataSource, 485 ids). `ActiveSupport::TimeZone["Europe/Moscow"]` resolves, and an unknown name gives nil. `Time.zone` is UTC because `config.time_zone` is not set. The `tzinfo-data` gem is installed only for windows and jruby.
- `Date#next_month` clamps to the month's end: 2026-01-31 → 2026-02-28, 2028-01-31 → 2028-02-29, 2026-03-31 → 2026-04-30.
- `Date.iso8601("20261109")` is accepted. Active Record's date cast turns `"2026-02-30"` and `"tomorrow"` into nil without an error. A strict check of the raw value against `\A\d{4}-\d{2}-\d{2}\z` is needed.
- In the frontend container, Node's zone is UTC. jsdom sets an impossible date input value to `""` and never reports `badInput`. `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })` gives "Nov 16, 2026".
- CORS is off: `config/initializers/cors.rb` holds only comments. That is why the zone goes in a request header, not a query parameter (question 1).
- The frontend test stubs match the session check by URL. One assertion with exact arguments on `/api/session` exists (`src/App.logout.test.tsx:80`). Check it before adding a header to the session check.
- Feature 09 was mid-build during the research (backend items 1 to 20 and frontend items 21 to 25 ticked). Read its final code before planning.
- Risk: the biggest choice is the settable next review date (question 7). The simpler alternative is a date that is always computed, which would need console steps to backdate notes in the Verify walkthroughs.
- Risk: features 18 to 23 depend on the meaning of "today" (question 1). It stays open until this spec is approved.
- AC-27 (proposed): tests that depend on the date fix the time and pass in any time zone. This binds the tests of features 12 to 20.
