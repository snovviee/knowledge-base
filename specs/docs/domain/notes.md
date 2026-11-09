# Notes

## Note

A note is a user's own text: a title, a body, and an optional web address to the page it came from. Each `Note` belongs to one user and to one of that user's collections (AC-09).

Attributes (table `notes`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `user_id` | integer | yes | The owner. Foreign key to `users`. |
| `collection_id` | integer | yes | The collection the note is in. Foreign key to `collections`, with no cascade: a collection that has notes cannot be deleted (AC-07). |
| `title` | string | yes | The title as shown, tidied and checked by the rules below. |
| `body` | text | yes | The body as typed. |
| `source_url` | string | no | A web address, or none. Trimmed; an empty one is none. |
| `status` | string | yes | `active` or `archived`. A new note is `active` (the column's default). |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. The list is ordered by `created_at`. |

Validations (`backend/app/models/note.rb`):
- `title` must be present after tidying. The code is `blank`.
- `title` has at most 200 characters, counted after tidying. The code is `too_long`.
- `body` must be present: a body of only spaces and line breaks is blank. The code is `blank`.
- `body` has at most 100,000 characters. The code is `too_long`.
- `source_url`, when given, has at most 2,000 characters (`too_long`), and must be a web address (`invalid`).
- `collection_id` must be given (`blank`), and must be one of the user's collections (`not_found`).
- `status` must be `active` or `archived` (`invalid`). Anything else, nil included, is invalid.

Relations: a user has many notes (`backend/app/models/user.rb`). A note belongs to one collection (features/09_notes_crud).

## Rules

- **A note belongs to one user and to one of that user's collections.** A collection that is another user's, deleted, or not a whole number is `not_found`, so an answer never tells whether another user's collection exists (AC-09, spec question 8).
- **Titles are tidied; bodies are kept as typed.** The ends of a title are trimmed, and each run of whitespace inside becomes one space. The body keeps its line breaks, and only its emptiness check ignores spaces and line breaks (AC-09, spec question 3).
- **Lengths are counted after tidying.** A title has 1 to 200 characters, a body 1 to 100,000, and a source URL at most 2,000 (AC-09, spec question 4).
- **A source URL is a web address.** It starts with `http://` or `https://` in any letter case, has a host, and has no spaces. The browser shows it as a link that opens in a new tab (AC-09, spec question 5).
- **A note is active when it is created.** Archiving sets `archived`, and restoring sets `active`. Each undoes the other, so neither asks first (AC-09, spec question 12).
- **Only the fields a request sends change.** An archive or a restore sends only the status. The collection is not one of the edited fields: moving a note is AC-11 (AC-09, spec question 9).
- **The later save wins.** Two tabs that save the same note do not warn each other, and each save changes only the fields it sends (AC-09, spec question 14).
- **The list is newest first, by the date the note was created.** Editing, archiving, or restoring a note does not move it (AC-09, spec question 2).
- **A user reaches only their own notes.** Another user's note, a deleted one, and an id that is not a number are all `not_found` (AC-09, spec question 8).
- **A note can be deleted, and its delete is final.** A deleted note is gone from the list and from the database (AC-09, spec question 12).
- **A collection with notes cannot be deleted.** The notes' foreign key refuses the delete, so the collection and its notes stay (AC-07, spec question 15).

## Chosen approaches

- **The answers to spec questions 1 to 15 are the rules above.** Each was taken under the owner's standing instruction of 2026-11-05, as the recommended option (AC-09).
- **The notes' collection is set on create and never changed by an edit.** Moving a note is AC-11, which adds that change (features/11_note_move).
- **Columns of later ACs are not here yet.** Tags on notes (AC-10), and the review interval and dates (AC-12 to AC-14), come with their own features and are added to this file then.
- **The check for a source URL is the same pattern in the server and in the browser.** The server uses `Note::WEB_ADDRESS` (`backend/app/models/note.rb`), and the browser has its own copy as `WEB_ADDRESS` (`frontend/src/NoteForm.tsx`). The two are kept the same by hand, so a change to one must be made to the other.
