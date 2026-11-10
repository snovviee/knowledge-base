# Plan: 16_review_overdue

**Approved:** yes, 2026-11-09 (owner's standing instruction)
**Depends on:** 01, 05, 06, 09, 12, 13, 14, 15

## Approach

- Data: no change.
- Review state: feature 15 already sends `review_state` `"overdue"` (its question 2), from `Note#review_state(today)`. This feature adds the other half of the shared logic in `Note` (spec question 1):
  - `Note.overdue(today)` → a relation of exactly the notes whose `review_state(today)` is `"overdue"`: `Note.active.scheduled` (feature 15) with a next review date before `today`, whatever its age (requirements.md 3.5). It never shares a note with `Note.due_today(today)`, and it chains on a user's notes: `user.notes.overdue(user.today)`.
  - The interface for features 18 to 20 is then complete: `Note#review_state(today)`, `Note.due_today(today)`, and `Note.overdue(today)`, with `today = user.today` read once. A batch of feature 20 can be `user.notes.due_today(today).or(user.notes.overdue(today))`.
- API (JSON under `/api`, as in [docs/api_contract.md](../../docs/api_contract.md)):
  - `GET /api/notes?review=overdue`: 200 `{ "notes": [ <summary>, ... ] }` with only the overdue notes, newest first (spec question 2; feature 09 question 2).
  - Every other `review` value works as in feature 15: left out or `""` is no filter, `due_today` is feature 15's, and any other value, another letter case included (`late`, `Overdue`), answers 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }`. No sign-in answers 401 first.
- WebSocket: none.
- UI:
  - `frontend/src/Notes.tsx`: a list entry whose `review_state` is `"overdue"` shows "Overdue" in feature 15's `note-review-state` element, after "Next review: Nov 2, 2026" (spec question 1). It has its own look (a warning colour), distinct from "Due today".
  - `frontend/src/NoteDetail.tsx`: the "Next review" row shows "Overdue" after the date, in the same element, for an overdue note (spec question 1).
  - `frontend/src/NoteFilters.tsx`: "Review" gains the choice "Overdue" (`overdue`) after "Due today": "All", "Due today", "Overdue" (spec question 2; requirements.md 3.6 lists due today before overdue). `notesAddress` sends it as `review=overdue`.
  - With "Overdue" chosen and an empty answer, the list shows "No notes are overdue for review." in place of the entries (spec question 3).
  - Everything else about the filter is feature 15's, and works the same with "Overdue": it keeps its choice while a note or a form is open, a reload shows "All", a created note shows at the top, "Loading…" while the list loads, and "Could not load notes. Try again." with "Try again", which asks again for `review=overdue` (spec edge case).
- Decisions:
  - `NoteListFilter` (feature 15) knows one more value, `overdue`, and applies `Note.overdue(today)` for it. Nothing else changes in the controller.
  - The label element and its place are feature 15's. This feature adds a text and a look for the second state, so the entry and the detail never show both labels: a note has one state.
  - Feature 17 adds two more choices after "Overdue". So no AC-16 test pins the whole list of choices: a test checks that the choices start with "All", "Due today", and "Overdue". Unknown values in AC-16 tests are values no feature adds (`late`, `Overdue`).
  - Feature 15's tests stay as they are: its choices test checks only the first two choices; its unknown values `soon` and `Due_Today` stay unknown; and its test of the notes that are not due today checks that the overdue entry shows no "Due today", which still holds when it shows "Overdue".
  - Time in tests, as in feature 15: backend tests fix the time with `travel_to Time.utc(2026, 11, 9, 20, 0)`; the frontend computes no date.
  - New test files, so the earlier ones keep their assertions: `spec/models/note_overdue_spec.rb`, `spec/requests/review_overdue_spec.rb`, and `src/ReviewOverdue.test.tsx`, which copies the stub and the fixtures of `src/ReviewDueToday.test.tsx` (feature 15).
  - Pipelined run: feature 15 comes right before this one. If it is not Done when this Build starts, Build records that under Deviations (owner's standing instruction).

## Checklist

When several agents test at once, each `rspec` command below also carries `-e DATABASE_URL=sqlite3:storage/test_<lane>.sqlite3`.

- [x] 1. [SETUP] Feature 15's code is in the tree, and the earlier test files are recorded for item 12. They are untracked files, so `git diff` cannot show a change to them.
  - Check: `grep -n "def review_state" backend/app/models/note.rb`, `grep -n "due_today" backend/app/models/note_list_filter.rb`, `grep -n "No notes are due for review today." frontend/src/Notes.tsx frontend/src/NoteFilters.tsx`, and `grep -n "export function notesAddress" frontend/src/notesAddress.ts` each print a line. Then `find backend/spec frontend/src \( -name '*_spec.rb' -o -name '*.test.ts' -o -name '*.test.tsx' \) | sort | xargs shasum > backend/tmp/ac16-earlier-tests.sha` writes one line per earlier test file
- [x] 2. [BE] `Note.overdue(today)`: at today 2026-11-09, it holds the active weekly "Old idea" dated 2026-11-02, "Yesterday" dated 2026-11-08, and "A year late" dated 2025-11-09, which are the notes whose `review_state` is `"overdue"`. It does not hold the active weekly "Rails tips" dated 2026-11-09 (due today), "Tomorrow" dated 2026-11-10, the archived weekly "Archived idea" dated 2026-11-02, or "Someday" with the interval `none`. No note is in both `Note.overdue(today)` and `Note.due_today(today)`. `ada.notes.overdue(today)` leaves out Grace's overdue note (spec question 1; scenario "Notes that are not overdue"; edge cases "Overdue needs all three", "An archived note with a past date is not overdue", "Overdue and due today never overlap", "A note is 'Overdue' whether its date is one day or a year before today").
  - Test first: AC-16 overdue(today) finds the active scheduled notes dated before today, whatever their age, and never a note due today (spec/models/note_overdue_spec.rb)
- [x] 3. [BE] At 2026-11-09 20:00 UTC, for a user with no saved zone, `GET /api/notes?review=overdue` answers 200 with "Older idea" (weekly, 2026-10-01, created after) and then "Old idea" (weekly, 2026-11-02), each with `"review_state": "overdue"`. "Rails tips" (due today), "Archived idea", "Someday", and Grace's overdue note are not in it (spec question 2; scenario "Show only the overdue notes"; edge cases "`review=overdue`: 200 with only the overdue notes, newest first", "Another user's overdue notes never show"). Fails at first: `overdue` is a value feature 15 does not know, so the answer is 422.
  - Test first: AC-16 GET /api/notes?review=overdue lists only the overdue notes, newest first (spec/requests/review_overdue_spec.rb)
- [x] 4. [BE] `review=late` and `review=Overdue` answer 422 `{ "error": "validation_failed", "fields": { "review": "invalid" } }`, while `review=overdue` answers 200. With no sign-in, `review=overdue` answers 401 `{ "error": "unauthenticated" }` (spec scenario "An unknown review value is still refused"; edge cases "Any value other than those features 15 to 17 define, another letter case included", "No one signed in: 401"). Expected to pass once item 3 is built. Kept as the guard and recorded under Deviations, with the mutation that compares the value ignoring case.
  - Test first: AC-16 an unknown review value is still refused, and review=overdue needs a sign-in (spec/requests/review_overdue_spec.rb)
- [x] 5. [BE] "Today" is the date in the user's saved zone, and a date set in the past makes a note overdue at once. At 2026-11-09 20:00 UTC, after a session check with `X-Time-Zone: Asia/Tokyo`, the weekly "Rails tips" dated 2026-11-09 answers `"review_state": "overdue"` and is in `review=overdue`. For a second user with no saved zone, a note with the same date answers `"due_today"` and is not in `review=overdue`. `POST /api/notes` with `review_interval` `"weekly"` and `next_review_date` `"2026-11-02"` answers 201 with `"overdue"` (spec scenarios "'Today' follows my time zone", "A date set in the past makes a note overdue at once"; edge case "At 2026-11-09 20:00 UTC, a note dated 2026-11-09 is overdue for a user in Tokyo and due today for a user whose zone is not known"). Expected to pass once item 3 is built, because feature 15 reads `current_user.today`. Kept as the guard and recorded under Deviations, with the mutation `Date.current` in `Api::NotesController#today`.
  - Test first: AC-16 overdue follows today in the user's saved time zone, and a past date is overdue at once (spec/requests/review_overdue_spec.rb)
- [x] 6. [FE] A list entry whose `review_state` is `"overdue"` shows "Overdue" after "Next review: Nov 2, 2026", and no "Due today". An entry with `"due_today"` shows "Due today" and no "Overdue", and one with null shows neither (spec question 1; scenarios "An overdue note is marked in the list", "Notes that are not overdue").
  - Test first: AC-16 the list marks an overdue note with Overdue (src/ReviewOverdue.test.tsx)
- [x] 7. [FE] The detail of a note whose `review_state` is `"overdue"` shows, in its "Next review" row, "Nov 2, 2026" and then "Overdue" (spec question 1; scenario "An overdue note is marked in the detail").
  - Test first: AC-16 the detail marks an overdue note next to its next review date (src/ReviewOverdue.test.tsx)
- [x] 8. [FE] The first three choices of "Review" are "All", "Due today", and "Overdue", in that order, with "All" chosen (feature 17 adds choices after these, so the test does not assert the whole list). Choosing "Overdue" sends the list request `/api/notes?review=overdue`, shows "Loading…" while it waits, and then its answer in its order: "Older idea", then "Old idea" (spec question 2; scenarios "The Review filter offers Overdue", "Show only the overdue notes").
  - Test first: AC-16 the Review filter offers Overdue and asks for review=overdue (src/ReviewOverdue.test.tsx)
- [x] 9. [FE] With "Overdue" chosen and an empty answer, the list shows "No notes are overdue for review." and no list (spec question 3; scenario "No note is overdue").
  - Test first: AC-16 an empty list under Overdue says no notes are overdue for review (src/ReviewOverdue.test.tsx)
- [x] 10. [FE] A note created with "Weekly" and "Next review date (optional)" 2026-11-02, whose create answers `review_state` `"overdue"`, shows "Overdue" in its detail's "Next review" row, and after "Back to notes" its entry, at the top, shows "Overdue" (spec scenario "A date set in the past makes a note overdue at once"). Expected to pass once items 6 and 7 are built: the detail shows the create's answer, and the created note goes to the top of the list as it is. Kept as the guard and recorded under Deviations, with the mutation that shows the detail's label only for a note read with `GET /api/notes/:id`.
  - Test first: AC-16 a note created with a past date shows Overdue at once (src/ReviewOverdue.test.tsx)
- [x] 11. [FE] With "Overdue" chosen, the filter behaves as with "Due today". The list shows "Old idea" with "Overdue"; opening it, choosing "Mark as reviewed" (answered with `next_review_date` `"2026-11-16"` and `review_state` null), and "Back to notes" shows "Old idea" in its place with "Next review: Nov 16, 2026" and no "Overdue", "Review" still shows "Overdue", and no list request is made. Then a list request answered 500 (after choosing "All" and "Overdue" again) shows "Could not load notes. Try again.", and "Try again" sends `/api/notes?review=overdue` (spec scenario "A reviewed overdue note stays until the list loads again"; edge cases "An overdue note that is marked as reviewed gets a date counted from today", "With 'Overdue' chosen, the filter behaves as with 'Due today'", "States hold as of the list load"). Expected to pass once items 6 and 8 are built, because the rest is feature 15's. Kept as the guard and recorded under Deviations, with the mutation that makes "Try again" ask for `/api/notes`.
  - Test first: AC-16 with Overdue chosen the list keeps its notes and its choice as with Due today (src/ReviewOverdue.test.tsx)
- [x] 12. [SETUP] The earlier tests keep their assertions and pass, feature 15's included, and the AC-16 tests pass in any time zone.
  - Check: `shasum -c backend/tmp/ac16-earlier-tests.sha` prints `OK` for every file (a file another feature's fix changed meanwhile is named in the report). `docker compose run --rm frontend npx vitest run` passes. `docker compose run --rm -e TZ=Pacific/Kiritimati frontend npx vitest run src/ReviewOverdue.test.tsx src/ReviewDueToday.test.tsx` and the same with `TZ=Pacific/Pago_Pago` pass. `docker compose run --rm -e TZ=Pacific/Kiritimati backend bundle exec rspec spec/models/note_overdue_spec.rb spec/requests/review_overdue_spec.rb spec/models/note_review_state_spec.rb spec/requests/review_due_today_spec.rb` and the same with `TZ=Pacific/Pago_Pago` pass.

## Test plan

Walkthrough for Verify, against the running app. With the Verify harness (`verify/README.md` in the run's scratchpad): `up.sh <slot>`, `mint.sh` for each user, Playwright through `pw.sh` (`kb.openApp`, `kb.api`, `kb.block`), `curl.sh`, and `rails.sh`. By hand: `docker compose up`, then http://localhost:3000.

- **Users.** A is "Ada Lovelace" (`mint.sh <slot> google a-1 "Ada Lovelace"`), B is "Grace Hopper" (`mint.sh <slot> github b-1 "Grace Hopper"`), and C is "Charles Babbage" (`mint.sh <slot> google c-1 "Charles Babbage"`).
- **Zone and dates.** Every page opens with `timezoneId: 'Europe/Berlin'` unless the item names another zone, so A's saved zone is Europe/Berlin. T is A's today on the server, printed after A's first page load by `rails.sh <slot> 'puts User.find_by!(display_name: "Ada Lovelace").today'`. T+n and T−n are n days later or earlier. The UI writes a date like "Nov 2, 2026", the API like "2026-11-02". Values in square brackets are for T = 2026-11-09. Run the walkthrough within one day in Berlin.
- **Data.** Before item 1, A's page makes, in this order (`kb.api(page, 'POST', ...)`, so each later note is newer), the collection "Work" and these notes in it, each with the body "B": "Old idea" (`"review_interval": "weekly"`, `"next_review_date"` T−7), "Archived idea" (weekly, T−7; then `PATCH` `{"status": "archived"}`), "Someday" (no `review_interval`), "Rails tips" (weekly, T), and "Older idea" (weekly, T−39). B makes the collection "Secret" and the note "Grace late" (weekly, T−3). C makes the collection "Home" and the note "Plain" (no `review_interval`). A's page is then reloaded.
- **Requests and words** are as in features/15_review_due_today: "the list request" is a `GET` whose path is `/api/notes`, read with `page.on('request')` as its path and query; "the entry of X" is the list item whose `note-title` is X, and its label is its `note-review-state` element; "the 'Next review' row" is the `dd` after the term "Next review" in the detail.

1. An overdue note is marked in the list
   - Steps: open the app as A.
   - Expected: the entry of "Old idea" shows "Next review: " with T−7 [Next review: Nov 2, 2026] and the label "Overdue". In the answer to the list request, "Old idea" has `"review_state": "overdue"`.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright, Europe/Berlin, T = 2026-11-09): the entry of "Old idea" showed "Next review: Nov 2, 2026" and "Overdue"; the list answer had `"review_state": "overdue"` for it.
2. An overdue note is marked in the detail
   - Steps: choose "Old idea" in the list.
   - Expected: the "Next review" row shows T−7 [Nov 2, 2026] and then "Overdue".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the "Next review" row read "Nov 2, 2026 Overdue".
3. Notes that are not overdue
   - Steps: choose "Back to notes". Read the entries of "Archived idea", "Someday", and "Rails tips".
   - Expected: none of them shows "Overdue". "Rails tips" shows "Due today". "Archived idea" (which shows "Archived") and "Someday" show neither label.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): "Archived idea" showed "Archived" only, "Someday" no label, "Rails tips" "Due today"; none showed "Overdue".
4. The Review filter offers Overdue
   - Steps: look at "Review".
   - Expected: its first three choices are "All", "Due today", and "Overdue", in that order (feature 17 adds choices after these), and "All" is chosen.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the options were "All", "Due today", "Overdue", with "All" chosen.
5. Show only the overdue notes
   - Steps: choose "Overdue" in "Review".
   - Expected: the list request is `/api/notes?review=overdue`. The list shows "Older idea" and then "Old idea", and nothing else: not "Rails tips", not "Archived idea", not "Someday", and not B's "Grace late".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): one request, `/api/notes?review=overdue`; the list was "Older idea", "Old idea" only. Screenshot /private/tmp/claude-502/-Users-snovviee-workspace-knowledge-base/85ed2414-ec8c-48bf-a403-0b35941b8398/scratchpad/verify/slot1/shots/16-item-5.png
6. No note is overdue
   - Steps: open the app as C, and choose "Overdue" in "Review".
   - Expected: the notes area shows "No notes are overdue for review." in place of the entries, and no list.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright, as C): "Overdue" showed "No notes are overdue for review." with no entries. Screenshot /private/tmp/claude-502/-Users-snovviee-workspace-knowledge-base/85ed2414-ec8c-48bf-a403-0b35941b8398/scratchpad/verify/slot1/shots/16-item-6.png
7. A date set in the past makes a note overdue at once
   - Steps: as A, with "All" chosen, choose "New note". Fill "Title" "Late start", "Body" "B", choose "Work" in "Collection" and "Weekly" in "Review interval", fill "Next review date (optional)" with T−7 [Playwright: `fill('2026-11-02')`], and choose "Create". Then choose "Back to notes".
   - Expected: the create answers 201 with `"next_review_date"` T−7 and `"review_state": "overdue"`. The detail's "Next review" row shows T−7 [Nov 2, 2026] and then "Overdue". After "Back to notes", the entry of "Late start", at the top, shows "Overdue".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the create answered 201 with `"next_review_date": "2026-11-02"` and `"review_state": "overdue"`; the detail row read "Nov 2, 2026 Overdue"; after "Back to notes" "Late start" was on top with "Overdue".
8. A reviewed overdue note stays until the list loads again
   - Steps: choose "Overdue". Choose "Old idea", choose "Mark as reviewed", then "Back to notes".
   - Expected: the review answers 200 with `"next_review_date"` T+7 [`"2026-11-16"`] and `"review_state": null`. The list still shows "Old idea", in its place, with "Next review: " and T+7 [Next review: Nov 16, 2026] and no "Overdue". "Review" shows "Overdue". No list request since the one for "Overdue".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the review answered 200 with `"next_review_date": "2026-11-16"` and `"review_state": null`; the list stayed "Late start", "Older idea", "Old idea" (Old idea in its place, "Next review: Nov 16, 2026", no label); "Review" "Overdue"; no list request.
9. "Today" follows my time zone
   - Steps: P is the date in Pacific/Pago_Pago at the time of the step (`rails.sh <slot> 'puts Time.current.in_time_zone("Pacific/Pago_Pago").to_date'`). As A, make the weekly note "Zone P" (`"next_review_date"` P). Open the app as A with `timezoneId: 'Pacific/Pago_Pago'`, then with `timezoneId: 'Pacific/Kiritimati'`. Last, open it again with `timezoneId: 'Europe/Berlin'`.
   - Expected: each session check sends `X-Time-Zone` with its zone. In Pago Pago, "Zone P" shows "Due today". In Kiritimati, whose date is always one or two days after Pago Pago's, it shows "Overdue".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): every session check sent `X-Time-Zone` with its zone; "Zone P" (P = 2026-11-09) showed "Due today" in Pago Pago and "Overdue" in Kiritimati (Berlin: "Due today").
10. An unknown review value is still refused
    - Steps: `curl.sh <slot> "$A" GET '/api/notes?review=late'`, the same with `review=Overdue`, and then with `review=overdue`.
    - Expected: the first two answer `HTTP 422` with `{"error":"validation_failed","fields":{"review":"invalid"}}`. `review=overdue` answers 200 with only notes whose `"review_state"` is `"overdue"`, newest first: "Older idea" is among them, and "Rails tips", "Archived idea", "Someday", and "Old idea" (reviewed in item 8) are not.
    - Result: Pass, 2026-11-09, automated walkthrough by Claude (curl): `review=late` and `review=Overdue` each `HTTP 422 {"error":"validation_failed","fields":{"review":"invalid"}}`; `review=overdue` `HTTP 200` with "Late start" and "Older idea", both `"overdue"`, and not "Rails tips", "Archived idea", "Someday", or "Old idea".
11. Edge case: the filter with "Overdue" loads, fails, and tries again as with "Due today"
    - Steps: as A in Europe/Berlin, choose "All" and wait for its list. Hold the next list request (`kb.block(page, 'GET', '/api/notes', 'hang', { times: 1 })`), choose "Overdue", then release it. Choose "All", make list requests fail (`kb.block(page, 'GET', '/api/notes')`), and choose "Overdue". Then `unblock()` and choose "Try again". Last, choose "Older idea" and "Back to notes".
    - Expected: "Loading…" shows while the request is held, with "Overdue" chosen. The failure shows "Could not load notes. Try again." with "Try again", and "Review" shows "Overdue". "Try again" sends `/api/notes?review=overdue` and shows the overdue notes. After the detail, "Review" still shows "Overdue", with no list request.
    - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright, `kb.block` hang once, then abort): "Loading…" showed while held with "Overdue" chosen; the failure showed the alert "Could not load notes. Try again." with "Try again" and "Review" "Overdue"; "Try again" sent `/api/notes?review=overdue` and showed "Late start", "Older idea"; after the detail and "Back to notes", "Review" showed "Overdue" with no list request. Screenshot /private/tmp/claude-502/-Users-snovviee-workspace-knowledge-base/85ed2414-ec8c-48bf-a403-0b35941b8398/scratchpad/verify/slot1/shots/16-item-11.png
12. Edge case: no sign-in
    - Steps: `curl.sh <slot> - GET '/api/notes?review=overdue'`.
    - Expected: `HTTP 401` with `{"error":"unauthenticated"}`.
    - Result: Pass, 2026-11-09, automated walkthrough by Claude (curl): `HTTP 401 {"error":"unauthenticated"}`.

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/reviews.md` (update): a section "Overdue": the rule (an active note, an interval other than None, and a next review date before the user's today, whatever its age), never an archived note or one with None, never at the same time as due today, and the two together are the "due for review" of requirements.md 3.5; the shared method `Note.overdue(today)` beside feature 15's (spec question 1) (AC-16)
  - Check: each rule matches `Note.overdue`, `Note#review_state`, and `spec/models/note_overdue_spec.rb`
- [x] 2. `docs/domain/notes.md` (update): the notes list can show only the overdue notes, with the link to `reviews.md` that feature 15 added (AC-16)
  - Check: the rule matches `NoteListFilter`
- [x] 3. `docs/api_contract.md` (update): `GET /api/notes` takes `review=overdue`; the values of `review` are listed together (AC-16)
  - Check: every value and code asserted in `spec/requests/review_overdue_spec.rb` is documented
- [x] 4. `docs/conventions.md` (update): the label "Overdue" in the entry and in the "Next review" row, beside "Due today"; the choice "Overdue" in "Review"; the empty state "No notes are overdue for review." (AC-16)
  - Check: each quoted text appears in `frontend/src/Notes.tsx`, `frontend/src/NoteDetail.tsx`, or `frontend/src/NoteFilters.tsx`
- [x] 5. `README.md` (update): "API": `GET /api/notes?review=overdue`; "Review reminder rules": a note is overdue when it is active, has an interval other than None, and its next review date is before today in the user's time zone; due today and overdue together are the notes due for review (AC-16)
  - Check: the README's sections agree with `docs/domain/reviews.md` and `docs/api_contract.md`, under their fixed headings, with no second section on the same topic

## Deviations

- 2026-11-09: Build started while feature 15 was at Verify and feature 12 at Verify (reopened for its time-zone fix), under the owner's standing instruction (pipelined run).
- 2026-11-09: how the guards below were proved. Each temporary mutation was run on a changed copy of the file, mounted over the original in the test container only (`docker compose run -v <copy>:/app/<file>:ro ...`), so the working tree never held the mutation while other lanes ran their suites. Each guard passes with the code as built.
- 2026-11-09: item 4 passed once item 3 was built, as the item foresaw: `NoteListFilter` compares `review` exactly with its list of values, and `require_signed_in_user` runs first. The test is kept as the guard of the spec scenario "An unknown review value is still refused" and the edge case "No one signed in: 401". It fails under the named mutation, the value compared ignoring case (`review` turned to lower case in `NoteListFilter`): `review=Overdue` answered 200, not 422.
- 2026-11-09: item 5 passed once item 3 was built, as the item foresaw: feature 15 reads `current_user.today` once per request, and a create's answer carries `review_state`. The test is kept as the guard of the spec scenarios "'Today' follows my time zone" and "A date set in the past makes a note overdue at once". It fails under the named mutation, `Date.current` in `Api::NotesController#today`: after the Tokyo session check, "Rails tips" answered "due_today", not "overdue". The second user of the item signs in from a second browser (`open_session`), with no saved zone.
- 2026-11-09: item 7 passed before its code, which the plan did not foresee. The cause is feature 15's Build (its Deviations): the list entry and the detail's "Next review" row render one shared label, `frontend/src/ReviewStateLabel.tsx`, so item 6's green, which gave that label the words and the look of `"overdue"`, showed "Overdue" in the detail too. The behavior exists; the test is kept as the guard of spec question 1 for the detail. It fails when the detail labels only a note due today (`<ReviewStateLabel state={review_state === 'due_today' ? 'due_today' : null} />` in `NoteDetail.tsx`): "expected 'Nov 2, 2026' to be 'Nov 2, 2026 Overdue'".
- 2026-11-09: item 10 passed once items 6 and 7 were built, as the item foresaw: the detail shows the note the create answered, and the created note goes to the top of the list as it is (feature 15's `changeList`). The test is kept as the guard of the spec scenario "A date set in the past makes a note overdue at once". It fails under the named mutation, the detail's label shown only for a note read with `GET /api/notes/:id` (`state={given ? null : ...}` in `NoteDetail.tsx`): "expected 'Nov 2, 2026' to be 'Nov 2, 2026 Overdue'".
- 2026-11-09: item 11 passed once items 6 and 8 were built, as the item foresaw: the loading, the failure, "Try again", and the kept list are feature 15's, keyed on the address, so they hold for `review=overdue`. The test is kept as the guard of the spec edge case "With 'Overdue' chosen, the filter behaves as with 'Due today'". It fails under the named mutation, "Try again" asking for `/api/notes` (`retryList` setting the choice back to "All" in `Notes.tsx`): the last list request was `/api/notes`, not `/api/notes?review=overdue`.
