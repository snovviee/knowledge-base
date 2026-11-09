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

Relations: a user has many notes (`backend/app/models/user.rb`). A note belongs to one collection (features/09_notes_crud). A note has zero or more of its user's tags, through the link table `note_tags` (AC-10).

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
- **A note has zero or more of its user's tags, each linked once** (AC-10). A second add of a tag the note has changes nothing.
- **Tags are sent as `tag_ids`, the whole set.** A create without `tag_ids` gives a note with no tags. An edit without `tag_ids` keeps its tags. An empty list removes every tag (AC-10, spec question 3).
- **A `tag_ids` that is not a list is invalid.** A number, text, or an object answers 422 `invalid`, and nothing changes (AC-10, spec question 5).
- **A tag id that is not one of the user's tags is not_found.** Another user's tag, a deleted one, and a value that is not a whole number give the same answer, so an answer never shows whether another user's tag exists. The whole request is refused, the note's fields included (AC-10, spec question 5).
- **The same id twice counts once** (AC-10, spec question 5).
- **An edit that changes the tags changes the note's updated date.** An edit that sends the same set changes nothing. A rename or a delete of a tag changes no note's updated date (AC-10, spec question 4).
- **Deleting a tag removes its links and no note.** A note keeps its other tags and its text (AC-10; requirements.md 3.3).
- **Deleting a note removes its links and keeps its tags** for other notes (AC-10).
- **A note's tags are shown in alphabetical order, ignoring case,** as the tags area lists them (AC-10, spec question 2).
- **A `null` item inside `tag_ids` is not decided.** Rails reads `[null]` as an empty list, so it removes every tag. The spec left this case open (AC-10, see Deviations in features/10_note_tags).

## Chosen approaches

- **The answers to spec questions 1 to 15 are the rules above.** Each was taken under the owner's standing instruction of 2026-11-05, as the recommended option (AC-09).
- **The notes' collection is set on create and never changed by an edit.** Moving a note is AC-11, which adds that change (features/11_note_move).
- **The tags of a note are links, not a column.** The link table is `note_tags`, with cascade on both sides, so a tag's delete and a note's delete each remove only their own links (AC-10).
- **The review interval and dates are not here yet.** They come with features 12 to 14 and are added to this file then.
- **The check for a source URL is the same pattern in the server and in the browser.** The server uses `Note::WEB_ADDRESS` (`backend/app/models/note.rb`), and the browser has its own copy as `WEB_ADDRESS` (`frontend/src/NoteForm.tsx`). The two are kept the same by hand, so a change to one must be made to the other.
