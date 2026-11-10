# Notes

## Note

A note is a user's own text: a title, a body, and an optional web address to the page it came from. Each `Note` belongs to one user and to one of that user's collections (AC-09), and can be moved to another of that user's collections (AC-11). A note may have a review schedule: an interval and the date of its next review (AC-12; see [reviews.md](reviews.md)). Any note can be marked as reviewed, which sets the date of its last review (AC-13; see [reviews.md](reviews.md#marking-a-note-as-reviewed)).

Attributes (table `notes`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `user_id` | integer | yes | The owner. Foreign key to `users`. |
| `collection_id` | integer | yes | The collection the note is in. Foreign key to `collections`, with no cascade: a collection that has notes cannot be deleted (AC-07). An edit that sends another of the user's collections moves the note there (AC-11). |
| `title` | string | yes | The title as shown, tidied and checked by the rules below. |
| `body` | text | yes | The body as typed. |
| `source_url` | string | no | A web address, or none. Trimmed; an empty one is none. |
| `status` | string | yes | `active` or `archived`. A new note is `active` (the column's default). |
| `review_interval` | string | yes | `none`, `daily`, `weekly`, `monthly`, or `custom` (a custom number of days). A new note has `none` (the column's default), and so do the notes made before feature 12 (AC-12). |
| `review_interval_days` | integer | no | The number of days of the `custom` interval, 1 to 365. Null with any other interval (AC-12). |
| `next_review_date` | date | no | A calendar date, with no time or zone. Set exactly when the interval is not `none` (AC-12). Marking the note as reviewed sets it to the user's today plus the interval (AC-14; see [reviews.md](reviews.md#the-next-review-date-after-a-review)). |
| `last_reviewed_date` | date | no | A calendar date. Null until the note is marked as reviewed, which sets it to the user's today (AC-13; see [reviews.md](reviews.md#marking-a-note-as-reviewed)). No create or edit sets it, and changing or removing the schedule keeps it (AC-12). |
| `search_title`, `search_body` | string, text | no | The search copies of `title` and `body` (AC-17): each field in Unicode NFC, case-folded, with each run of whitespace made one space and the ends trimmed. The search compares them, because SQLite's `LIKE` and `LOWER` fold only ASCII letters. Never sent in an answer. |
| `search_source_url` | string | no | The same copy of `source_url`, null for a note with no source URL (AC-17). |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. The list is ordered by `created_at`. |

The review columns come from `backend/db/migrate/20261109171243_add_review_schedule_to_notes.rb`. There is no index on them (AC-12).

The search copies come from `backend/db/migrate/20261109221600_add_search_copies_to_notes.rb`, which fills them for the notes that exist, with its own copy of the rule so that it does not depend on the model as it is later. `Note.fold_for_search` is the one rule, and a `before_save` callback (`set_search_copies`) sets the copies on every save, whatever saves the note: the API, a review (`save!(touch: false)`), and the console. A value equal to the stored one is not written, so a review still keeps `updated_at`. There is no index: the match uses `instr`, which no index serves, and it runs over one user's notes. A row written around the model (`insert!`) has null copies and is found by no search until its next save (AC-17).

Validations (`backend/app/models/note.rb`):
- `title` must be present after tidying. The code is `blank`.
- `title` has at most 200 characters, counted after tidying. The code is `too_long`.
- `body` must be present: a body of only spaces and line breaks is blank. The code is `blank`.
- `body` has at most 100,000 characters. The code is `too_long`.
- `source_url`, when given, has at most 2,000 characters (`too_long`), and must be a web address (`invalid`).
- `collection_id` must be given (`blank`), and must be one of the user's collections (`not_found`). A move is checked the same way (AC-11).
- `status` must be `active` or `archived` (`invalid`). Anything else, nil included, is invalid.
- `review_interval` must be `none`, `daily`, `weekly`, `monthly`, or `custom` (`invalid`). Anything else is invalid: `"yearly"`, `"Weekly"`, null, and values that are not text (AC-12).
- With `custom`, `review_interval_days` must be given (`blank` when it is missing or null) and must be a JSON integer from 1 to 365 (`invalid`): `0`, `366`, `-7`, `1.5`, `7.0`, `"7"`, `true`, a list, and an object are invalid. The value is checked as sent, because Active Record would turn `"7"`, `7.0`, and `1.5` into whole numbers (AC-12).
- With a schedule, `next_review_date`, when given, must be text written `YYYY-MM-DD` that names a real calendar date (`invalid`): `"20261109"`, `"2026-11-9"`, `"2026-02-30"`, `"tomorrow"`, `""`, a time such as `"2026-11-20T10:00:00Z"`, a number, and a list are invalid. The value is checked as sent, because Active Record would turn `"2026-02-30"` or `"tomorrow"` into no date with no error (AC-12).

Relations: a user has many notes (`backend/app/models/user.rb`). A note belongs to one collection at a time (features/09_notes_crud), and moves between its user's collections (AC-11). A note has zero or more of its user's tags, through the link table `note_tags` (AC-10). A note has many review dismissals (table `review_dismissals`), deleted with it (AC-23; see [notifications.md](notifications.md#review-dismissal)).

## Note tags

A note's tags are links to the user's tags (AC-10). Each link is a row of the table `note_tags`.

Attributes (table `note_tags`, no id of its own; `tag_ids` is a request field, not a column, see the rules):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `note_id` | integer | yes | Foreign key to `notes`, with cascade on delete: a note's links go with the note. |
| (pair) | unique index on `note_id`, `tag_id` | yes | A tag is linked to a note once. |
| `tag_id` | integer | yes | Foreign key to `tags`, with cascade on delete: a tag's links go with the tag, and no note. |

The migration is `backend/db/migrate/20261109120000_create_note_tags.rb`. The model is `backend/app/models/note_tag.rb`.

## Rules

- **A change of the next review date ends the note's review dismissals.** A review, a new date in the edit form, or the interval None deletes them (`ReviewDismissible`, `backend/app/models/concerns/review_dismissible.rb`), so the reminder shows again when the note is due. An archive, a restore, and an interval change that keeps the date keep them ([notifications.md](notifications.md#review-dismissal); AC-23).
- **Archiving a note ends its review reminders at once, and restoring brings them back when it is due.** An archived note has no review state, is in neither the "Due today" nor the "Overdue" filter, and is in no batch; the batch sent right after the archive no longer holds it. The archive and the restore change only the status, so the interval and the dates stay: a restored note that is overdue or dated today is in the batch sent right after the restore, and one with a later date waits for its date. A dismissed reminder stays dismissed through both, because no date changes. The rule is in [reviews.md](reviews.md#no-reminders-for-archived-notes-and-notes-with-no-schedule), and the batches are in [notifications.md](notifications.md#rules) (AC-18).
- **Setting the interval to None ends a note's review reminders at once.** The save removes the next review date, so the note has no review state, leaves the "Due today" and "Overdue" filters, is left out of the batch sent right after the save, and loses its dismissals (see the first rule). A note created with no schedule, which is the default, is never reminded. Setting a schedule again reminds it on its new date ([reviews.md](reviews.md#no-reminders-for-archived-notes-and-notes-with-no-schedule); AC-19).
- **A note belongs to one user and to one of that user's collections.** A collection that is another user's, deleted, or not a whole number is `not_found`, so an answer never tells whether another user's collection exists (AC-09, spec question 8).
- **Titles are tidied; bodies are kept as typed.** The ends of a title are trimmed, and each run of whitespace inside becomes one space. The body keeps its line breaks, and only its emptiness check ignores spaces and line breaks (AC-09, spec question 3).
- **Lengths are counted after tidying.** A title has 1 to 200 characters, a body 1 to 100,000, and a source URL at most 2,000 (AC-09, spec question 4).
- **A source URL is a web address.** It starts with `http://` or `https://` in any letter case, has a host, and has no spaces. The browser shows it as a link that opens in a new tab (AC-09, spec question 5).
- **A note is active when it is created.** Archiving sets `archived`, and restoring sets `active`. Each undoes the other, so neither asks first (AC-09, spec question 12).
- **Only the fields a request sends change.** An archive or a restore sends only the status. An edit without `collection_id` keeps the note in its collection (AC-09, spec question 9; AC-11, spec question 2).
- **The later save wins.** Two tabs that save the same note do not warn each other, and each save changes only the fields it sends (AC-09, spec question 14).
- **The list is newest first, by the date the note was created.** Editing, moving, archiving, restoring, or marking a note as reviewed does not change its place in the list (AC-09, spec question 2; AC-11; AC-14).
- **A user reaches only their own notes.** Another user's note, a deleted one, and an id that is not a number are all `not_found` (AC-09, spec question 8).
- **The search finds a note whose title, body, or source URL contains the text.** Each of the three is searched on its own, so "tips short" does not find a note whose title ends with "tips" and whose body starts with "Short". It ignores letter case in any alphabet ("ПРИВЕТ" finds "Привет мир") but keeps accents ("cafe" does not find "Café"). The ends of the text are trimmed and each run of whitespace in it, and in the note's fields, counts as one space, so "use rails" finds a body with "use" at the end of one line and "rails" at the start of the next. A text empty after that is no search. Each character matches as itself, `%` and `_` included (`Note.matching` uses `instr`, never `LIKE`). The text has at most 2,000 characters after tidying: a longer one is `too_long`, and one that is not text, such as `search[]=rails`, is `invalid` (AC-17, spec questions 4, 6, 13, 18; requirements.md 11: full-text search is not required).
- **The filters are one collection, one tag, a status, and a review state, and every one of them, with the search, must match.** The list stays newest first. A collection or a tag that is not the user's, that was deleted, or whose id is not a whole number keeps no note, and the answer is 200 with an empty list, so it never tells whether another user's collection or tag exists. An unknown `status` or `review` is `invalid`. The values, the refusals, and their order are in [`GET /api/notes`](../api_contract.md#get-apinotes), checked by `NoteListFilter` and applied by it in `Api::NotesController#index`. "Next 7 days" and "No review scheduled" are in [reviews.md](reviews.md#next-7-days-and-no-review-scheduled) (AC-17, spec questions 2, 8, 9, 12).
- **The list can show only the notes due today, or only the overdue ones.** `GET /api/notes?review=due_today` keeps the notes that are due today, and `review=overdue` the overdue ones (AC-16), still newest first. The values and the refusal are in [`GET /api/notes`](../api_contract.md#get-apinotes), checked by `NoteListFilter` and applied in `Api::NotesController#index`. Every note in an answer carries `review_state`, and the rules are in [reviews.md](reviews.md#due-today) and [reviews.md](reviews.md#overdue) (AC-15, AC-16).
- **A note can be deleted, and its delete is final.** A deleted note is gone from the list and from the database (AC-09, spec question 12).
- **A collection with notes cannot be deleted.** The notes' foreign key refuses the delete, so the collection and its notes stay (AC-07, spec question 15).
- **A note moves with `collection_id` on its edit.** An edit that sends the id of another of the user's collections moves the note there. The endpoint is in [api_contract.md](../api_contract.md#notes). Notes move one at a time: there is no separate move action and no move of several notes at once (AC-11, spec questions 1, 2, and 5).
- **A move goes only into one of the user's collections,** with a create's codes: a `collection_id` that is null is `blank`, and one that is not one of the user's collections is `not_found` (see the first rule). A refused move changes nothing. A move sent with other fields that break a rule names every field in one answer (AC-11, spec question 2; AC-09, spec question 8).
- **A move changes the note's updated date.** Sending the note's own collection changes nothing, its updated date included (AC-11, spec question 2).
- **A move never leaves a note without a collection.** If the target collection is deleted after the move's check and before its write, the database refuses the row, and the move answers `not_found`, as a create does. If the move comes first, the collection now has a note, so its delete is refused (AC-07, AC-11).
- **A note has zero or more of its user's tags, each linked once** (AC-10). A second add of a tag the note has changes nothing.
- **Tags are sent as `tag_ids`, the whole set.** A create without `tag_ids` gives a note with no tags. An edit without `tag_ids` keeps its tags. An empty list removes every tag (AC-10, spec question 3).
- **A `tag_ids` that is not a list is invalid.** A number, text, or an object answers 422 `invalid`, and nothing changes (AC-10, spec question 5).
- **A tag id that is not one of the user's tags is not_found.** Another user's tag, a deleted one, and a value that is not a whole number give the same answer, so an answer never shows whether another user's tag exists. The whole request is refused, the note's fields included. This holds for a tag deleted while the request runs, after its check: the note and its tags are written in one transaction, so a create leaves no note and an edit changes no field (AC-10, spec question 5).
- **The same id twice counts once** (AC-10, spec question 5).
- **An edit that changes the tags changes the note's updated date.** An edit that sends the same set changes nothing. A rename or a delete of a tag changes no note's updated date (AC-10, spec question 4).
- **Deleting a tag removes its links and no note.** A note keeps its other tags and its text (AC-10; requirements.md 3.3).
- **Deleting a note removes its links and keeps its tags** for other notes (AC-10).
- **A note's tags are shown in alphabetical order, ignoring case,** as the tags area lists them (AC-10, spec question 2).
- **A `null` item inside `tag_ids` is not decided.** Rails reads `[null]` as an empty list, so it removes every tag. The spec left this case open (AC-10, see Deviations in features/10_note_tags).
- **A new note has no review schedule.** A create without `review_interval` gives the interval `none` and no next review date (AC-12, spec question 4).
- **A schedule without a date counts from today.** A schedule set without a next review date, missing or null, gets the user's today plus the interval. "Today" and the calculation, with its month-end rule, are in [reviews.md](reviews.md#rules) (AC-12, spec question 8).
- **A given date is kept, a past one included** (AC-12, spec questions 7 and 10).
- **A change of interval keeps the date.** An edit that sends only `review_interval` keeps the next review date, and gives a note that had `none` a date from today. An edit that sends `next_review_date` null restarts the schedule from today. An edit that changes only the days of a custom note keeps its date too (AC-12, spec question 9).
- **The interval `none` removes the schedule.** It removes the next review date and the custom days, and keeps the last reviewed date (AC-12, spec question 11).
- **The days belong to the custom interval only.** Days sent with another interval are ignored, and a change from `custom` to another interval removes them (AC-12, spec questions 12 and 15).
- **The interval after the edit decides.** In an edit, days sent alone count only for a note whose interval is `custom`, and a date sent alone only for a note with a schedule. A note changed to `custom` needs its days (`blank` without them) (AC-12, spec edge cases).
- **Values that do not apply are ignored, with no code.** Days with an interval other than `custom`, and a date with `none`, are ignored whatever they hold, `"tomorrow"` included. So is `last_reviewed_date` in any create or edit (AC-12, spec questions 12 and 15).
- **A note has a next review date exactly when its interval is not `none`.** The model keeps this on every save: it drops the values the interval does not use before its checks, and fills a missing date after them. So the API, the console, and later features all keep it (AC-12).
- **The form sends only the review fields that changed.** A create sends `review_interval` only when it is not None, the days only with "Every N days", and the date only when one is entered. An edit sends each review field only when it differs from the note's, and an emptied date as null. So a save that does not touch the schedule keeps a date that another tab changed meanwhile (AC-12, spec question 17). The form is described in [conventions](../conventions.md#ui).
- **A change sends the user's review reminders.** A successful create, edit, move, archive, restore, review, or delete of a note sends the user's new batch to each of their open connections, right after the change. A refused request changes nothing and sends nothing. See [notifications.md](notifications.md#batch) (AC-20).

## Chosen approaches

- **The answers to spec questions 1 to 15 are the rules above.** Each was taken under the owner's standing instruction of 2026-11-05, as the recommended option (AC-09).
- **A move is an edit, not an action of its own.** The edit form has the new-note form's "Collection" field, with the note's collection chosen. It sends `collection_id` only when another collection is chosen, so a save made before the collections load keeps the note where it is. The field is described in [conventions](../conventions.md#ui). Feature 11's spec questions 1 to 5 were each answered with the recommended option, under the owner's instruction of 2026-11-09 (AC-11).
- **The tags of a note are links, not a column.** The link table is `note_tags`, with cascade on both sides, so a tag's delete and a note's delete each remove only their own links (AC-10).
- **The review schedule is four columns of the note** (AC-12). The rules above are the answers to feature 12's spec questions 4, 7 to 12, 15, and 17, each taken under the owner's instruction of 2026-11-09. "Today", the review dates, and the calculation are in [reviews.md](reviews.md).
- **The schedule's values are checked as sent.** The checks read the values before Active Record casts them (`review_interval_days_before_type_cast`, `next_review_date_before_type_cast`), and a value read back from the database passes them. The date of a schedule is filled after the checks, so a date that failed its check is never replaced by a computed one (AC-12).
- **The check for a source URL is the same pattern in the server and in the browser.** The server uses `Note::WEB_ADDRESS` (`backend/app/models/note.rb`), and the browser has its own copy as `WEB_ADDRESS` (`frontend/src/NoteForm.tsx`). The two are kept the same by hand, so a change to one must be made to the other.
