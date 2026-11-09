# Plan: 09_notes_crud

**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05)
**Depends on:** 01, 05, 06, 08

## Approach

- Data: new table `notes`: `user_id` (integer, not null, foreign key), `collection_id` (integer, not null, foreign key, indexed, no cascade), `title` (string, not null), `body` (text, not null), `source_url` (string, null), `status` (string, not null, default `active`), timestamps. Index on (`user_id`, `created_at`). `Note` belongs to a user and a collection. `User` has many notes.
  - The columns of later ACs come with their own features, not now: the tags on a note with feature 10 (a `note_tags` table), and the review interval, its custom days, and the next and last review dates with features 12 to 14. Each feature then holds its migration and its rules together, and no column waits unused with a default that no spec has decided yet.
  - Tidying on assignment (spec question 3): `normalizes :title` with `squish`; `normalizes :source_url` trims Unicode whitespace at both ends, and an empty result is nil. The body is kept as typed.
  - Validations, each with the code the API sends (spec questions 4, 5, 8): `title` present (`blank`) and at most 200 characters (`too_long`); `body` present (`blank`; only spaces and line breaks is blank) and at most 100,000 characters (`too_long`); `source_url`, when there is one, at most 2,000 characters (`too_long`) and a web address (`invalid`); `status` is `active` or `archived` (`invalid`); `collection_id` given (`blank`) and the id of a collection of the note's user (`not_found`).
  - Scope `newest_first`: `order(created_at: :desc, id: :desc)` (spec question 2).
- API: JSON under `/api`. The requests that change data send `X-CSRF-Token` with the token from `GET /api/csrf` (feature 05).
  - `GET /api/notes` → 200 `{ "notes": [ { "id", "title", "status", "collection": { "id", "name" }, "created_at", "updated_at" } ] }`, only the signed-in user's, newest first.
  - `GET /api/notes/:id` → 200 `{ "note": { "id", "title", "body", "source_url", "status", "collection": { "id", "name" }, "created_at", "updated_at" } }`.
  - `POST /api/notes`, body `{ "title", "body", "source_url", "collection_id" }` → 201 `{ "note": { ... } }`, the full note. A new note is `active`.
  - `PATCH /api/notes/:id`, body any of `{ "title", "body", "source_url", "status" }` → 200 `{ "note": { ... } }`. Only the sent fields change (spec question 9). Archive sends `{ "status": "archived" }`, restore `{ "status": "active" }`. `PUT` routes to the same action.
  - `DELETE /api/notes/:id` → 204, no body.
  - Errors: 401 `{ "error": "unauthenticated" }` (every request, checked first: feature 06 question 4); 403 `{ "error": "invalid_csrf_token" }` (feature 05); 400 `{ "error": "bad_request" }` (feature 06 question 2); 404 `{ "error": "not_found" }` (another user's or a missing note: feature 06 question 3); 422 `{ "error": "validation_failed", "fields": { "<field>": "<code>", ... } }` with every invalid field (spec question 8).
  - `DELETE /api/collections/:id` of a collection that has notes → 409 `{ "error": "collection_not_empty" }`, and nothing changes (spec question 15). A collection with no notes still answers 204.
  - `created_at` and `updated_at` are ISO 8601 in UTC, as Rails renders times (checked: `"2026-11-09T10:15:00.000Z"`).
- UI:
  - New `frontend/src/Notes.tsx`: the notes area, a `main` labelled by its "Notes" heading, in place of the static area in `frontend/src/App.tsx`. It holds the list (`GET /api/notes`) and the view (spec question 1): `list`, `create`, `detail` (the note's id, plus the note when a create or a save just returned it), or `edit` (the loaded note). List states: "Loading…" (`role="status"`); "Could not load notes. Try again." (`role="alert"`) with "Try again"; "No notes yet"; the entries, each with the title as a button that opens the detail (`data-testid="note-title"`), the collection's name (`data-testid="note-collection"`), and "Archived" for an archived note. "New note" shows next to the heading once the list has loaded, in the list view. "This note no longer exists." (`role="alert"`) shows above the list after a 404. A 401 calls `onSignedOut`, as the other areas do.
  - New `frontend/src/NoteDetail.tsx`: loads `GET /api/notes/:id` unless it was given the note: "Loading…"; "Could not load the note. Try again." with "Try again" and "Back to notes"; then "Back to notes", the title as a heading that takes the focus (`tabIndex={-1}`), "Archived" for an archived note, "Collection" with the collection's name, "Source URL" with a link (`target="_blank"`, `rel="noopener noreferrer"`) only when there is one, the body in a block with `white-space: pre-wrap`, and the actions "Edit", "Archive" or "Restore", and "Delete". The delete confirmation takes the place of the actions: "Delete “<title>”? This cannot be undone.", "Delete", and "Cancel" with the focus; Escape cancels. Failure messages (`role="alert"`) show above the actions. It reports a changed note, a deleted note, a missing note (404), and a 401 to `Notes`.
  - New `frontend/src/NoteForm.tsx`: the create and the edit form, headed "New note" or "Edit note", with `noValidate`. Fields: "Title" (focused), "Body" (a textarea), "Source URL (optional)" (`type="text"`, `inputMode="url"`, so the browser's own URL check does not compete with the form's), and, in the create form only, "Collection" (a select whose first option, "Choose a collection", has an empty value; then the user's collections in the order of `GET /api/collections`). The create form loads the collections first: "Loading…"; "Could not load collections. Try again." with "Try again" and "Cancel"; or "Create a collection first. Every note belongs to a collection." with only "Cancel" (spec question 11). `checkNote` holds the browser's checks (spec questions 3 to 7): it tidies the title as the server does, counts characters by code point (`[...text].length`, as Ruby counts them), and tests the source URL with the server's pattern. A failed check or a 422 shows each message under its field (`role="alert"`; the field gets `aria-invalid="true"` and `aria-describedby`) and puts the focus on the first such field. The submit button ("Create" or "Save") is busy while the request waits. A failure message (`role="alert"`) shows above the buttons. Escape does nothing (spec question 13). A 404 on a save and a 401 are reported to `Notes`.
  - `frontend/src/NameListArea.tsx` gets an optional `onRenamed(record)` prop, called after a rename answered 200. `frontend/src/Collections.tsx` passes it on. `App.tsx` keeps the last renamed collection in state and gives it to `Notes`, which puts the new name on the notes in its list and in the open detail (spec: "A renamed collection shows its new name on its notes").
  - The collections area needs no change for a 409: its delete already shows "Could not delete the collection. Try again." for any error answer other than 401 and 404, with the confirmation open (feature 06 item 31).
- Decisions:
  - A list of summaries and a separate read: the list stays light while bodies grow to 100,000 characters, and a detail always shows the note as the server has it (spec edge case).
  - `notes.user_id` next to `collection_id`: every lookup goes through `current_user.notes`, as for collections and tags, so another user's note is not found (404). The model checks that the collection belongs to the same user.
  - The interim collection delete rule (spec question 15) rests on the foreign key alone. SQLite enforces it (checked: `PRAGMA foreign_keys` is 1 in the app), so the delete fails as one statement, with no gap between a check and the delete in which a note could be created. `Api::CollectionsController#destroy` rescues `ActiveRecord::InvalidForeignKey` and answers 409. `Collection` gets no `has_many :notes` with a `dependent` option: that is feature 07's decision.
  - A create whose collection is deleted between its check and its insert (the same race from the other side) hits the same foreign key: `Api::NotesController#create` rescues `ActiveRecord::InvalidForeignKey` and answers 422 with `collection_id` `not_found` (spec edge case).
  - Params: the title and the body are used only when they are text, so anything else is `blank` (feature 06 question 1). The source URL and the status are assigned as sent: Active Record turns a value that is not text into text, which is never a web address or a known status, so it is `invalid`. `collection_id` is used when it is a whole number or null; anything else becomes 0, which no collection has, so it is `not_found` (checked: Active Model casts `"abc"` to 0 but `[1]` to nil, which would read as `blank`). An edit assigns only the keys the request sends (spec question 9), and never `collection_id` (AC-11).
  - One web-address pattern in the model and in `checkNote`, so the browser and the server agree (spec question 5): `\Ahttps?://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?\z`, ignoring case. In JavaScript: `/^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i`. Ruby's `[[:space:]]` and JavaScript's `\s` both match Unicode spaces.
  - The model adds the codes the API sends as they are: `errors.add(:collection_id, :not_found, message: ...)` and `errors.add(:status, :invalid)`, so `render_validation_failed` (feature 06) builds the 422 body without a mapping. It sends the first code of each field, so a source URL that is too long and not a web address answers `too_long`.
  - `Api::NotesController` reuses `require_signed_in_user` with `prepend_before_action` (feature 06 question 4), `render_validation_failed`, and the 400, 403, and 404 handlers in `ApplicationController`. Its list uses `includes(:collection)`.
  - Tests: model specs in a new `spec/models/note_spec.rb`; request specs in a new `spec/requests/notes_spec.rb`, with `sign_in_with_google` and `csrf_token` from `spec/support/request_helpers.rb`; frontend tests in a new `src/Notes.test.tsx`, which renders `<App />` with a fetch stub that answers by method and path, as `src/Collections.test.tsx` does. The AC-09 test of the collection delete (item 20) goes in `spec/requests/notes_spec.rb`, so feature 06's spec file stays as it is.
  - Once the notes area loads its list (item 21), every main-layout stub answers `GET /api/notes` with an empty list: in `src/App.test.tsx`, `AC-01 signed-in user sees the main layout with their display name`, `AC-01 main layout shows the no collections and no notes empty states`, and `AC-04 Try again checks the session again and shows the main layout`; in `src/App.logout.test.tsx`, `stubBackend` and `AC-05 the profile area shows the display name and a Log out button`; in `src/Collections.test.tsx` and `src/Tags.test.tsx`, `stubBackend`. Only the stubs change, not the assertions.
  - New code goes in new files. Shared files get small edits: `config/routes.rb`, `db/schema.rb`, `app/models/user.rb`, `app/controllers/api/collections_controller.rb` (item 20), `src/App.tsx` (items 21 and 50), `src/NameListArea.tsx` and `src/Collections.tsx` (item 50), and the test stubs named above.

## Checklist

- [x] 1. [BE] Create the `notes` table and the `Note` model: a note belongs to a user and a collection; its title is tidied (ends trimmed, inner whitespace one space) and required (`blank`); its body is required, a body of only spaces and line breaks is blank, and a body is kept as typed; a new note is `active`. `User` has many notes.
  - Test first: AC-09 a note has a tidied title and a body as typed, both required, and starts active (spec/models/note_spec.rb)
- [x] 2. [BE] A note's collection is one of its user's: none gives `blank` on `collection_id`; another user's collection or one that does not exist gives `not_found`.
  - Test first: AC-09 a note's collection must be one of its user's collections (spec/models/note_spec.rb)
- [x] 3. [BE] A title has at most 200 characters after tidying, a body at most 100,000, and a source URL at most 2,000 (`too_long`). Exactly the limit is valid.
  - Test first: AC-09 a note's title, body, and source URL have length limits (spec/models/note_spec.rb)
- [x] 4. [BE] A source URL's ends are trimmed, and an empty one is none (nil). One that is given must be a web address (`invalid`): `http://` or `https://` in any letter case, a host, and no spaces. `javascript:`, `ftp:`, `example.com`, and an address with a space inside are invalid.
  - Test first: AC-09 a note's source URL is a web address or none (spec/models/note_spec.rb)
- [x] 5. [BE] A status is `active` or `archived`. Anything else, nil included, is `invalid`.
  - Test first: AC-09 a note's status is active or archived (spec/models/note_spec.rb)
- [x] 6. [BE] `GET /api/notes` lists only the signed-in user's notes, newest first: 200 `{ "notes": [ { "id", "title", "status", "collection": { "id", "name" }, "created_at", "updated_at" } ] }`.
  - Test first: AC-09 GET /api/notes lists only the signed-in user's notes, newest first (spec/requests/notes_spec.rb)
- [x] 7. [BE] `GET /api/notes/:id` answers 200 with the user's note: `{ "note": { "id", "title", "body", "source_url", "status", "collection": { "id", "name" }, "created_at", "updated_at" } }`.
  - Test first: AC-09 GET /api/notes/:id answers 200 with the note (spec/requests/notes_spec.rb)
- [x] 8. [BE] `POST /api/notes` creates a note in one of the user's collections: 201 with the full note, the title tidied, the source URL trimmed, the status `active`. A status or a user id in the body is ignored. Two notes may have the same title.
  - Test first: AC-09 POST /api/notes creates a note in one of the user's collections and answers 201 with it (spec/requests/notes_spec.rb)
- [x] 9. [BE] `POST /api/notes` with fields that break rules answers 422 `{ "error": "validation_failed", "fields": { ... } }` naming every such field with its code, and creates nothing.
  - Test first: AC-09 POST /api/notes refuses invalid fields with 422 and a code for each (spec/requests/notes_spec.rb)
- [x] 10. [BE] In a create, a title or a body that is missing, null, or not text is `blank`; a source URL that is missing or null is none, and one that is not text is `invalid`; a `collection_id` that is missing or null is `blank`, and one that is not a whole number, another user's, or missing is `not_found`.
  - Test first: AC-09 POST /api/notes treats missing and non-text values by each field's rule (spec/requests/notes_spec.rb)
- [x] 11. [BE] A create whose collection is deleted after its check passed (the database refuses the row) answers 422 with `collection_id` `not_found`, and no note exists.
  - Test first: AC-09 a note create that loses a race with its collection's delete answers 422 not_found (spec/requests/notes_spec.rb)
- [x] 12. [BE] `PATCH /api/notes/:id` changes only the fields it sends (title, body, source URL): 200 with the full note. An empty or null source URL removes it. A `collection_id` in the body is ignored.
  - Test first: AC-09 PATCH /api/notes/:id edits the sent fields and answers 200 with the note (spec/requests/notes_spec.rb)
- [x] 13. [BE] `PATCH /api/notes/:id` with `{ "status": "archived" }` archives the note, and with `{ "status": "active" }` restores it: 200 with the note. Archiving an archived note, or restoring an active one, answers 200 and changes nothing. An edit of an archived note keeps it archived.
  - Test first: AC-09 PATCH /api/notes/:id archives and restores a note (spec/requests/notes_spec.rb)
- [x] 14. [BE] `PATCH /api/notes/:id` with fields that break rules (a blank, too long, or non-text title or body; an invalid or too long source URL; an unknown or non-text status) answers 422 with every such field's code, and the note is unchanged.
  - Test first: AC-09 PATCH /api/notes/:id refuses invalid fields with 422 and keeps the note (spec/requests/notes_spec.rb)
- [x] 15. [BE] `DELETE /api/notes/:id` deletes the user's note: 204 with no body, and the list no longer has it.
  - Test first: AC-09 DELETE /api/notes/:id deletes the note and answers 204 (spec/requests/notes_spec.rb)
- [x] 16. [BE] A read, edit, or delete of another user's note, of a deleted one, or of an id that is not a number answers 404 `{ "error": "not_found" }` and changes nothing. Items 7, 12, and 15 look notes up through `current_user.notes`, and the 404 handler is in `ApplicationController` (feature 06), so this test is expected to pass at once. It is kept as the AC-09 test (requirements.md 7: a user cannot access another user's notes).
  - Test first: AC-09 reading, editing, or deleting another user's or a missing note answers 404 and changes nothing (spec/requests/notes_spec.rb)
- [x] 17. [BE] A create or edit whose body is not valid JSON answers 400 `{ "error": "bad_request" }` and changes nothing. The handler is in `ApplicationController` (feature 06), so this test is expected to pass at once. It is kept as the AC-09 test.
  - Test first: AC-09 a notes request whose body is not valid JSON answers 400 (spec/requests/notes_spec.rb)
- [x] 18. [BE] A create, edit, or delete without this session's token, or with another session's token, answers 403 `{ "error": "invalid_csrf_token" }` and changes nothing. Feature 05's forgery protection covers every API controller, so this test is expected to pass at once. It is kept as the AC-09 test.
  - Test first: AC-09 note create, edit, and delete without this session's anti-forgery token answer 403 and change nothing (spec/requests/notes_spec.rb)
- [x] 19. [BE] Every notes request with no sign-in, or with a sign-in that has ended, answers 401 `unauthenticated`: the list, a read, and a create, edit, or delete with or without a token. Nothing changes. `Api::NotesController` adds `prepend_before_action :require_signed_in_user`, so the sign-in check runs before the token check.
  - Test first: AC-09 the notes requests answer 401 with no sign-in, with or without a token (spec/requests/notes_spec.rb)
- [x] 20. [BE] `DELETE /api/collections/:id` of a collection that has notes answers 409 `{ "error": "collection_not_empty" }`; the collection and its notes stay. A collection with no notes is still deleted (204).
  - Test first: AC-09 deleting a collection that has notes answers 409 and keeps the collection and its notes (spec/requests/notes_spec.rb)
- [x] 21. [FE] The notes area (`src/Notes.tsx`, in place of the static area in `src/App.tsx`) shows "Loading…" while its list loads, then the notes in the server's order, each with its title as plain text, its collection's name, and "Archived" for an archived note. The main-layout stubs named in Decisions answer `GET /api/notes` with an empty list; their assertions do not change.
  - Test first: AC-09 the notes area shows Loading… and then the user's notes with their collections and archived status (src/Notes.test.tsx)
- [x] 22. [FE] An empty list shows "No notes yet" and "New note". "New note" shows once the list has loaded.
  - Test first: AC-09 the notes area shows No notes yet and New note when the user has none (src/Notes.test.tsx)
- [x] 23. [FE] A notes list that cannot load (no answer, or an error answer other than 401) shows "Could not load notes. Try again." as an alert with "Try again", while the collections area shows its list. "Try again" shows "Loading…" and loads the list again.
  - Test first: AC-09 a notes list that cannot load shows the error, and Try again loads it (src/Notes.test.tsx)
- [x] 24. [FE] A notes list request answered 401 shows the sign-in screen with no message.
  - Test first: AC-09 a notes list request answered 401 shows the sign-in screen (src/Notes.test.tsx)
- [x] 25. [FE] Choosing a note's title opens its detail in place of the list (`src/NoteDetail.tsx`): "Loading…" while `GET /api/notes/:id` loads, then the title with the focus, "Archived" for an archived note, the collection's name, the source URL as a link that opens in a new tab with `rel="noopener noreferrer"` (no source URL line when there is none), the body as plain text with its line breaks, and "Back to notes", "Edit", "Archive" (or "Restore"), and "Delete". Markup in the fields shows as text.
  - Test first: AC-09 choosing a note opens its detail with its fields and actions (src/Notes.test.tsx)
- [x] 26. [FE] "Back to notes" shows the list again as it was, with no new list request.
  - Test first: AC-09 Back to notes shows the list again (src/Notes.test.tsx)
- [x] 27. [FE] A note that cannot load (no answer, or an error answer other than 401 and 404) shows "Could not load the note. Try again." as an alert with "Try again" and "Back to notes". "Try again" shows "Loading…" and then the detail.
  - Test first: AC-09 a note that cannot load shows the error, and Try again loads it (src/Notes.test.tsx)
- [x] 28. [FE] A note request answered 404 shows the list without that note and the alert "This note no longer exists.".
  - Test first: AC-09 opening a note that no longer exists removes it from the list and says so (src/Notes.test.tsx)
- [x] 29. [FE] "New note" opens the form "New note" in place of the list (`src/NoteForm.tsx`): "Loading…" until `GET /api/collections` answers, then "Title" with the focus, "Body", "Source URL (optional)", "Collection" with "Choose a collection" chosen and then the collections in the server's order, "Create", and "Cancel".
  - Test first: AC-09 New note opens the form with the user's collections and none chosen (src/Notes.test.tsx)
- [x] 30. [FE] With no collections, the form says "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields. "Cancel" shows the list.
  - Test first: AC-09 New note with no collections says to create a collection first (src/Notes.test.tsx)
- [x] 31. [FE] When the form's collections cannot load (no answer, or an error answer other than 401), it shows "Could not load collections. Try again." as an alert with "Try again" and "Cancel". "Try again" shows "Loading…" and then the fields.
  - Test first: AC-09 the form's collections that cannot load show the error, and Try again loads them (src/Notes.test.tsx)
- [x] 32. [FE] "Create" sends `POST /api/notes` with the token (`sendWithCsrfToken`) and `{ "title", "body", "source_url", "collection_id" }`, the collection's id as a number. On 201 the new note's detail shows from the answer, with no read request, and "Back to notes" shows it at the top of the list.
  - Test first: AC-09 Create sends the note and shows its detail, and the list has it at the top (src/Notes.test.tsx)
- [x] 33. [FE] "Cancel" in the new-note form shows the list, unchanged, with no request. Escape in the form changes nothing: the form stays with what was typed.
  - Test first: AC-09 Cancel closes the new-note form without a request, and Escape does not close it (src/Notes.test.tsx)
- [x] 34. [FE] "Create" checks the fields first: an empty title, a body of spaces only, the source URL "example.com", and no collection show "Enter a title.", "Enter a body.", "Enter a URL that starts with http:// or https://.", and "Choose a collection." under their fields, mark them invalid, move the focus to "Title", and send nothing. Once the fields are fixed, "Create" sends.
  - Test first: AC-09 Create checks the fields in the browser and sends nothing while one breaks a rule (src/Notes.test.tsx)
- [x] 35. [FE] A title of 201 characters, a body of 100,001, and a source URL of 2,001 show "Use at most 200 characters.", "Use at most 100,000 characters.", and "Use at most 2,000 characters." and send nothing. Exactly 200, 100,000, and 2,000 characters are sent; spaces the server removes do not count.
  - Test first: AC-09 the form refuses values that are too long and sends values at the limit (src/Notes.test.tsx)
- [x] 36. [FE] A create answered 422 shows the message for each field the answer names under that field (`collection_id` `not_found`: "This collection no longer exists. Choose another."), marks them invalid, and keeps the form and what was typed.
  - Test first: AC-09 a create the server refuses shows each field's message and keeps the form (src/Notes.test.tsx)
- [x] 37. [FE] A create with no answer, or an error answer (403, 5xx), shows "Could not create the note. Try again." as an alert and keeps the form and what was typed.
  - Test first: AC-09 a note create that fails shows the error and keeps the form (src/Notes.test.tsx)
- [x] 38. [FE] While a create waits for the server, "Create" is busy (disabled, `aria-busy="true"`), and a second click sends no second request.
  - Test first: AC-09 Create shows a busy state and ignores a second click (src/Notes.test.tsx)
- [x] 39. [FE] "Edit" in the detail opens the form "Edit note" in place of the detail with the note's title (focused), body, and source URL, no "Collection", "Save", and "Cancel". "Save" sends `PATCH /api/notes/:id` with the token and `{ "title", "body", "source_url" }`. On 200 the detail shows the new values (an emptied source URL shows none), and the list shows the new title in the note's place.
  - Test first: AC-09 Edit saves the note and shows its new values in the detail and the list (src/Notes.test.tsx)
- [x] 40. [FE] "Save" checks the fields as "Create" does and sends nothing while one breaks a rule; a save answered 422 shows the messages; Escape keeps the edit form with what was typed; "Cancel" shows the detail unchanged with no request.
  - Test first: AC-09 Save checks the fields, and Cancel closes the edit form without a request (src/Notes.test.tsx)
- [x] 41. [FE] A save with no answer, or an error answer, shows "Could not save the note. Try again." and keeps the form and what was typed. While a save waits, "Save" is busy and a second click sends no second request.
  - Test first: AC-09 a save that fails shows the error and keeps the form, and Save ignores a second click (src/Notes.test.tsx)
- [x] 42. [FE] A save answered 404 shows the list without the note and the alert "This note no longer exists.".
  - Test first: AC-09 saving a note that no longer exists removes it from the list and says so (src/Notes.test.tsx)
- [x] 43. [FE] "Archive" sends `PATCH /api/notes/:id` with the token and `{ "status": "archived" }`, with no question first. While it waits, "Archive" is busy. On 200 the detail shows "Archived" and "Restore", and the list shows "Archived" on the note.
  - Test first: AC-09 Archive archives the note in the detail and the list (src/Notes.test.tsx)
- [x] 44. [FE] "Restore" sends `{ "status": "active" }`. On 200 the detail no longer shows "Archived" and shows "Archive", and the list no longer shows "Archived" on the note.
  - Test first: AC-09 Restore restores the note in the detail and the list (src/Notes.test.tsx)
- [x] 45. [FE] An archive or a restore with no answer, or an error answer, shows "Could not archive the note. Try again." or "Could not restore the note. Try again." and keeps the detail. One answered 404 shows the list without the note and "This note no longer exists.".
  - Test first: AC-09 an archive or restore that fails shows the error, and one of a deleted note removes it (src/Notes.test.tsx)
- [x] 46. [FE] "Delete" in the detail turns the actions into "Delete “<title>”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and no request. "Cancel" or Escape brings the actions back.
  - Test first: AC-09 Delete asks for confirmation, and Cancel or Escape keeps the note (src/Notes.test.tsx)
- [x] 47. [FE] "Delete" in the confirmation sends `DELETE /api/notes/:id` with the token; while it waits, "Delete" is busy and a second click sends no second request. On 204, or on 404 (already deleted elsewhere), the list shows without the note and with no alert.
  - Test first: AC-09 confirming a delete removes the note, also when it was already deleted (src/Notes.test.tsx)
- [x] 48. [FE] A delete with no answer, or an error answer (403, 5xx), shows "Could not delete the note. Try again." and keeps the confirmation.
  - Test first: AC-09 a note delete that fails shows the error and keeps the confirmation (src/Notes.test.tsx)
- [x] 49. [FE] A read, the form's collections request, a create, a save, an archive, a restore, or a delete answered 401 shows the sign-in screen with no message.
  - Test first: AC-09 a note request answered 401 shows the sign-in screen (src/Notes.test.tsx)
- [x] 50. [FE] A collection renamed in the collections area shows its new name on its notes in the list and in the open detail, with no notes request. `NameListArea` gets `onRenamed`, `Collections` passes it on, and `App` gives the renamed collection to `Notes`.
  - Test first: AC-09 a renamed collection shows its new name on its notes (src/Notes.test.tsx)

Coverage:
- "My notes are listed, newest first" and "An archived note is marked in the list": items 6 and 21. "I see only my own notes": item 6.
- "No notes yet": item 22, with the AC-01 empty-state test.
- "The list cannot load" and "Try again loads the list": item 23.
- "The new-note form": item 29. "Create a note": items 8 and 32. "Spaces in a title are tidied, and the body keeps its line breaks": items 1, 8, and 25.
- "The form checks the fields before sending": item 34. "Values that are too long are refused": items 3 and 35. "The server refuses a field": items 9 and 36.
- "A source URL must be a web address": items 4 and 9. "A new note goes only into one of my collections": items 2 and 10.
- "I have no collections yet": item 30. "The form's collections cannot load" and "Try again loads the form's collections": item 31.
- "Cancel a create" and "Escape does not close the note form": items 33 and 40.
- "Open a note": items 7 and 25. "Back to notes": item 26. "The note cannot load" and "Try again loads the note": item 27. "Open a note that was deleted elsewhere": items 16 and 28.
- "The edit form" and "Save an edit": items 12 and 39. "Remove a source URL": items 4, 12, and 39. "An edit is checked like a create": items 14 and 40. "Cancel an edit": item 40.
- "Archive a note": items 13 and 43. "Restore a note": items 13 and 44.
- "Delete asks for confirmation" and "Cancel a delete": item 46. "Confirm a delete": items 15 and 47.
- "A change fails": items 37, 41, 45, and 48.
- "Change a note that was deleted elsewhere": items 16, 42, and 45. "Delete a note that was deleted elsewhere": items 16 and 47.
- "Another user's note cannot be read, changed, or deleted": item 16.
- "The sign-in has ended": items 19, 24, and 49.
- "A renamed collection shows its new name on its notes": item 50.
- "A collection that has notes is not deleted yet": item 20; the collections area's alert is feature 06 item 31's code and test.
- Edge cases: 401 first, item 19; 403, item 18; 404 for another user's, a missing, or a non-numeric id, item 16; a body that is not JSON, item 17; every field in one 422, items 9 and 14; missing or non-text values, items 10 and 14; a source URL that is none or not text, items 4, 10, and 12; the collection `blank` or `not_found`, items 2 and 10; an unknown status, items 5 and 14; a status or user id ignored in a create and a collection ignored in an edit, items 8 and 12; the exact limits, items 3 and 35; a source URL in any letter case, item 4; archiving twice and editing an archived note, item 13; the same title twice, item 8; the later save wins, item 12 (only the sent fields change, with no version check); the race of a create and a collection delete, items 11 and 20; a collection with no notes, item 20; markup shown as text, items 21 and 25; loading, items 21, 25, and 29; the notes area loads on its own, item 23; busy, items 38, 41, 43, and 47; validation state, items 34 and 36; focus, items 25, 29, 34, 39, and 46; the detail loaded each time it opens, item 25.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. Two users: sign in with Google in a normal window and with GitHub in a private window. A step that says "in the console" runs in DevTools → Console of that window, where a request carries that window's session cookie. `token()` in those steps stands for `(await (await fetch('/api/csrf')).json()).token`, and `send(method, path, body)` for `await fetch(path, { method, headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })`. Before item 1, the Google user creates the collections "Work" and "Books".

1. My notes are listed, newest first
   - Steps: as the Google user, create the note "First" in "Work", then "Second" and "Third" in "Books". Reload the page.
   - Expected: the notes area lists "Third", "Second", "First", with "Books", "Books", and "Work" next to them.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
2. I see only my own notes
   - Steps: as the GitHub user, create a collection and the note "Secret plan" in it. As the Google user, reload.
   - Expected: the Google user's list has no "Secret plan".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
3. No notes yet
   - Steps: as a user with no notes (the GitHub user before item 2, or after deleting their notes), look at the notes area.
   - Expected: "No notes yet" and the "New note" button.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
4. An archived note is marked in the list
   - Steps: open "First", choose "Archive", then "Back to notes".
   - Expected: "First" shows "Archived"; "Second" and "Third" show no status.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
5. The list cannot load
   - Steps: DevTools → Network, right-click the request to `/api/notes` → "Block request URL". Reload.
   - Expected: "Could not load notes. Try again." and "Try again" in the notes area. The collections and tags areas show their lists.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
6. Try again loads the list
   - Steps: from item 5, remove the block, then choose "Try again".
   - Expected: "Loading…", then the list.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
7. The new-note form
   - Steps: choose "New note".
   - Expected: the form "New note" in place of the list: briefly "Loading…", then "Title" with the cursor in it, "Body", "Source URL (optional)", "Collection" showing "Choose a collection" (its list: "Books", "Work"), "Create", and "Cancel".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
8. Create a note
   - Steps: open DevTools → Network. In the form, enter "Rails tips", the body "Use bin/rails.", the source URL "https://guides.rubyonrails.org", choose "Work", and choose "Create". Then choose "Back to notes".
   - Expected: `POST /api/notes` with status 201 and a body `{"note":{"id":…,"title":"Rails tips","body":"Use bin/rails.","source_url":"https://guides.rubyonrails.org","status":"active","collection":{"id":…,"name":"Work"},"created_at":"…Z","updated_at":"…Z"}}`. The detail of "Rails tips" shows; back in the list, "Rails tips" is at the top.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
9. Spaces in a title are tidied, and the body keeps its line breaks
   - Steps: create a note with the title `  Spaced   title  ` and a body of two lines (press Enter between them), in "Books".
   - Expected: the response has `"title":"Spaced title"`. The detail shows "Spaced title" and the body on two lines.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
10. The form checks the fields before sending
    - Steps: clear the Network log. Choose "New note", type three spaces in "Body" and "example.com" in "Source URL (optional)", leave "Title" empty and "Collection" at "Choose a collection", and choose "Create".
    - Expected: no request to `/api/notes`. "Enter a title.", "Enter a body.", "Enter a URL that starts with http:// or https://.", and "Choose a collection." under their fields, each field outlined as invalid, and the cursor in "Title".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
11. Values that are too long are refused
    - Steps: in the console, run `copy('t'.repeat(201))`, paste it into "Title", fill the other fields validly, and choose "Create". Delete one character and choose "Create" again.
    - Expected: first "Use at most 200 characters." and no request; then status 201.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
12. The server refuses a field
    - Steps: create the collection "Temp". Choose "New note", fill the fields, and choose "Temp". In another tab, delete "Temp" (it has no notes). Back here, choose "Create".
    - Expected: status 422 with `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`. The form stays with what was typed, and "This collection no longer exists. Choose another." shows under "Collection".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
13. A source URL must be a web address
    - Steps: in the console, for each of `'javascript:alert(1)'`, `'ftp://example.com/file'`, `'example.com'`, and `'https://exa mple.com'`, run `send('POST', '/api/notes', { title: 'T', body: 'B', source_url: <value>, collection_id: <id of Work> })` and read `await response.json()`.
    - Expected: each answers 422 with `{"error":"validation_failed","fields":{"source_url":"invalid"}}`, and a reload shows no new note.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
14. A new note goes only into one of my collections
    - Steps: as the GitHub user, note the id of their collection from Network. As the Google user, in the console run `send('POST', '/api/notes', { title: 'T', body: 'B', collection_id: <GitHub collection id> })`, then the same with `collection_id: 999999`.
    - Expected: both answer 422 with `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
15. I have no collections yet
    - Steps: as a user with no collections (a new GitHub user, or after deleting their empty collections), choose "New note".
    - Expected: "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
16. The form's collections cannot load
    - Steps: block the request URL `/api/collections` (Network → right-click → "Block request URL"), then choose "New note".
    - Expected: in the form, "Could not load collections. Try again." with "Try again" and "Cancel".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
17. Try again loads the form's collections
    - Steps: from item 16, remove the block and choose "Try again" in the form.
    - Expected: "Loading…", then the form's fields with the collections.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
18. Cancel a create
    - Steps: clear the Network log. Choose "New note", type a title, choose "Cancel".
    - Expected: the list shows, unchanged, and no `POST /api/notes` was sent.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
19. Escape does not close the note form
    - Steps: choose "New note", type a title, press Escape. Then open a note, choose "Edit", type in the body, press Escape.
    - Expected: both forms stay open with what was typed.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
20. Open a note
    - Steps: in the list, choose "Rails tips".
    - Expected: briefly "Loading…", then the detail: "Rails tips" with the focus on it, "Work", the link "https://guides.rubyonrails.org" (it opens in a new tab), the body, and "Back to notes", "Edit", "Archive", "Delete".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
21. Back to notes
    - Steps: from the detail, choose "Back to notes".
    - Expected: the list, as before.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
22. The note cannot load
    - Steps: block the request URL of one note (open it once, then right-click its `/api/notes/<id>` request → "Block request URL"), go back, and open it again.
    - Expected: "Could not load the note. Try again." with "Try again" and "Back to notes".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
23. Try again loads the note
    - Steps: from item 22, remove the block and choose "Try again".
    - Expected: "Loading…", then the detail.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
24. Open a note that was deleted elsewhere
    - Steps: open the app in two tabs as the same user. In tab B, delete "Second". In tab A (not reloaded), choose "Second".
    - Expected: status 404. Tab A shows the list without "Second" and the alert "This note no longer exists.".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
25. The edit form
    - Steps: open "Rails tips", choose "Edit".
    - Expected: the form "Edit note" in place of the detail, with "Rails tips" (cursor in it), the body, the source URL, no "Collection", "Save", and "Cancel".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
26. Save an edit
    - Steps: change the title to "Rails guides" and the body to "Read the guides.", choose "Save". Choose "Back to notes".
    - Expected: `PATCH /api/notes/<id>` with status 200 and the new values. The detail shows them; the list shows "Rails guides" where "Rails tips" was.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
27. Remove a source URL
    - Steps: open "Rails guides", choose "Edit", empty "Source URL (optional)", choose "Save".
    - Expected: status 200 with `"source_url":null`, and the detail shows no source URL.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
28. An edit is checked like a create
    - Steps: choose "Edit", empty "Title", choose "Save".
    - Expected: no request, "Enter a title." under "Title". After "Cancel", the note is unchanged.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
29. Cancel an edit
    - Steps: choose "Edit", change the title, choose "Cancel".
    - Expected: the detail with the old title, and no `PATCH` request.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
30. Archive a note
    - Steps: open the active note "Third", choose "Archive". Then "Back to notes".
    - Expected: no question first; `PATCH /api/notes/<id>` with status 200 and `"status":"archived"`. The detail shows "Archived" and "Restore"; the list shows "Archived" on "Third".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
31. Restore a note
    - Steps: open "Third", choose "Restore". Then "Back to notes".
    - Expected: status 200 with `"status":"active"`. The detail shows "Archive" and no "Archived"; the list shows no "Archived" on "Third".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
32. Delete asks for confirmation
    - Steps: open "Third", choose "Delete".
    - Expected: "Delete “Third”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and no request.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
33. Confirm a delete
    - Steps: from item 32, choose "Delete". Then reload.
    - Expected: `DELETE /api/notes/<id>` with status 204 and no body. The list has no "Third", also after the reload.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
34. Cancel a delete
    - Steps: open a note, choose "Delete", then "Cancel". Do it again and press Escape.
    - Expected: the actions come back each time, and no `DELETE` request is sent.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
35. A change fails
    - Steps: for each change, open what it needs with "No throttling", then set Network → throttling to "Offline", make the change, and set "No throttling" again: create a note (open "New note" and fill it first); save an edit (open a note and choose "Edit" first); archive an active note; restore an archived note; delete a note and confirm.
    - Expected: "Could not create the note. Try again.", "Could not save the note. Try again.", "Could not archive the note. Try again.", "Could not restore the note. Try again.", and "Could not delete the note. Try again." in turn. Each form, detail, or confirmation stays, with what was typed.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
36. Change a note that was deleted elsewhere
    - Steps: in two tabs, open the same note in tab A and choose "Edit"; delete it in tab B. In tab A, choose "Save". Repeat with "Archive" in place of "Edit" and "Save".
    - Expected: status 404 each time. Tab A shows the list without the note and "This note no longer exists.".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
37. Delete a note that was deleted elsewhere
    - Steps: in two tabs, open the same note in tab A; delete it in tab B. In tab A, choose "Delete" and confirm.
    - Expected: status 404. Tab A shows the list without the note, with no alert.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
38. Another user's note cannot be read, changed, or deleted
    - Steps: as the Google user, note the id of a note from Network. As the GitHub user, in the console run `await fetch('/api/notes/<id>')`, `send('PATCH', '/api/notes/<id>', { title: 'Hacked' })`, `send('PATCH', '/api/notes/<id>', { status: 'archived' })`, and `send('DELETE', '/api/notes/<id>')`. As the Google user, reload and open the note.
    - Expected: every answer has status 404 and the body `{"error":"not_found"}`. The Google user's note is unchanged.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
39. The sign-in has ended
    - Steps: in two tabs as the same user, choose "Log out" in tab B. In tab A, open a note (or choose "New note", or "Archive" in an open detail).
    - Expected: the request answers 401 with `{"error":"unauthenticated"}`, and tab A shows the sign-in screen with no message.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
40. A renamed collection shows its new name on its notes
    - Steps: with the list showing notes in "Work", rename "Work" to "Job" in the collections area. Open one of those notes, and rename "Job" back to "Work".
    - Expected: the list shows "Job" on those notes at once, with no reload; the open detail shows "Work" again after the second rename.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
41. A collection that has notes is not deleted yet
    - Steps: choose "Delete" on "Work" (it has notes) and confirm. Then reload.
    - Expected: `DELETE /api/collections/<id>` with status 409 and `{"error":"collection_not_empty"}`. The confirmation stays with "Could not delete the collection. Try again."; after the reload, "Work" and its notes are there.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
42. Edge case: no sign-in, no token, and a body that is not JSON
    - Steps: run `curl -s -i http://localhost:3000/api/notes` and `curl -s -i -X POST http://localhost:3000/api/notes`. Signed in, in the console, run `await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'No token', body: 'B', collection_id: <id> }) })` and `await fetch('/api/notes', { method: 'POST', headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: '{' })`.
    - Expected: both `curl` calls answer 401 with `{"error":"unauthenticated"}`; the request without a token answers 403 with `{"error":"invalid_csrf_token"}`; the broken body answers 400 with `{"error":"bad_request"}`. A reload shows no new note.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
43. Edge case: markup, and the busy buttons
    - Steps: create a note with the title `<b>Bold</b>` and the body `<script>alert(1)</script>`. Then Network → throttling "Slow 4G", create another note and double-click "Create"; open a note and double-click "Archive".
    - Expected: the list and the detail show the markup as text, and no alert runs. While each request waits, its button is disabled, and Network shows one request per action.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/notes.md` (create): the Note entity (user, collection, title, body, source URL, status, timestamps) with its validations and codes; the rules: a note belongs to one user and one of that user's collections, the title tidied and the body kept as typed, the length limits, the web-address rule for the source URL, the two statuses and a new note active, newest first, an edit changes only the fields it sends, the later save wins, a user reaches only their own notes; chosen approaches: the answers to spec questions 1 to 15, and that the columns of later ACs (tags, review fields) come with features 10 and 12 to 14 (AC-09)
  - Check: every column of the notes migration appears with its validation, and the answers to questions 1 to 15 appear
- [x] 2. `docs/domain/collections.md` (update): deleting a collection that has notes is refused with 409 until AC-07 decides its rule; a collection with no notes is deleted (AC-09, spec question 15)
  - Check: the rule matches `Api::CollectionsController#destroy` and the AC-09 409 test in `spec/requests/notes_spec.rb`
- [x] 3. `docs/api_contract.md` (update): Conventions: the error code `collection_not_empty` (409) and the status code 409; dates in response bodies (`created_at`, `updated_at`, ISO 8601 in UTC); a `## Notes` section with the five endpoints, their requests (the fields, partial edits), responses (the summary and the full note), and errors with every 422 code; `DELETE /api/collections/:id` gets its 409 (AC-09)
  - Check: `docker compose run --rm backend bin/rails routes -g notes` lists every documented route, and each status code and error code in `spec/requests/notes_spec.rb` is documented
- [x] 4. `docs/conventions.md` (update): UI: the notes area shows one view at a time (list, detail, form) with "Back to notes" and the address unchanged; browser checks on submit with the message under each field, the first invalid field focused, and the server's 422 shown the same way; Escape does not close a long form; the detail's focus on its title; Code: `src/Notes.tsx`, `src/NoteDetail.tsx`, and `src/NoteForm.tsx` with `checkNote`; `onRenamed` on `NameListArea` for areas that show a collection's name; every main-layout test stub answers `GET /api/notes` as well as `GET /api/collections` and `GET /api/tags` (AC-09)
  - Check: each message and label in `conventions.md` matches `frontend/src/NoteForm.tsx`, `frontend/src/NoteDetail.tsx`, or `frontend/src/Notes.tsx`, and each file named in `## Code` exists
- [x] 5. `README.md` (update): Short API description: the five notes endpoints (AC-09). The collection deletion behavior is left to feature 07 (AC-07), which decides it.
  - Check: the endpoints in the README match `bin/rails routes -g notes`

## Deviations

- 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end). The owner has not reviewed them one by one.
- 2026-11-09: Build started while dependencies are not at Done: 05 (logout), 06 (collections), and 08 (tags) are at Verify. 01 is at Done. Started under the owner's standing instruction of 2026-11-05.
- 2026-11-09: Feature 07 (AC-07, collection deletion behavior) is still at Design, so 09 is built out of folder order, as this run's brief asked. 09 does not decide 07's rule: it only keeps a collection that has notes from being deleted until 07 does (spec question 15).
- 2026-11-09: Items 16, 17, and 18 were ticked as covered. Their tests passed before any code of their own, as the plan expected: the lookups of items 7, 12, and 15 go through `current_user.notes`, and the 400, 403, and 404 answers come from `ApplicationController` (features 05 and 06). A mutation check showed that each test is not empty: with the lookups changed to `Note.find`, item 16's test failed (200 instead of 404); with the `ParseError` handler removed from `ApplicationController`, item 17's test failed (the parse error was not handled); with `skip_forgery_protection` in `Api::NotesController`, item 18's test failed (201 instead of 403). Each file was restored and compared with its copy. The tests stay as the AC-09 tests.
- 2026-11-09: Item 26 was ticked as covered. Its test passed before any code of its own: item 25's code already wired "Back to notes" to show the list, which was more than item 25's least code. A mutation check showed that the test is not empty: with "Back to notes" doing nothing, it failed (the list did not show). The file was restored and compared with its copy. The test stays as the AC-09 test for "Back to notes".
- 2026-11-09: Item 40 was ticked as covered. Its test passed before any code of its own: the edit form of item 39 is the create form in edit mode, so it already had the browser's check, the 422 handling (items 34 to 36), Escape doing nothing, and a "Cancel" that item 39 pointed at the detail. A mutation check showed that the test is not empty: with the browser's check skipped in the edit form, it failed (an empty title was sent); with "Cancel" showing the list instead of the detail, it failed (no detail). Each file was restored and compared with its copy. The test stays as the AC-09 test for the edit form's checks and "Cancel".
- 2026-11-09: Build stopped after item 43, because the owner asked (through the coordinator) to finish now. Items 44 to 50 are not started: "Restore" (44), the failures and 404 of an archive or a restore (45), the delete confirmation, the delete, and its failure (46 to 48), the 401 of the other note requests (49), and a renamed collection's new name on its notes (50). Until then, "Restore" and "Delete" in the detail do nothing, and a 401 on a read, the form's collections, a create, a save, or an archive shows a failure message instead of the sign-in screen. The stage stays at Build. To resume: `/sdd-build 09` from item 44.
- 2026-11-09: Items 44 to 50 were built after the entry above, which is superseded: they are built and ticked. Restore, the archive and restore failures, the delete confirmation, the delete and its failure, the 401 of the note requests, and the collection rename are all in place, each test first. Two decisions in that build are recorded here. (a) A note deleted by this tab (204) and a note already gone elsewhere (404) both leave the list with no alert, as the spec's "Delete a note that was deleted elsewhere" says ("with no error"). Only opening a note that is gone shows "This note no longer exists.". A first draft of the 404 test asserted the alert, which contradicted the spec; the test was corrected to the spec before the fix. (b) A rename is shown at render time from a map of renamed collections kept by `App`, not copied into state, so a rename causes no notes request and every rename in a visit stays.
