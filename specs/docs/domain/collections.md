# Collections

## Collection

A named group of a user's notes (AC-06). Each `Collection` belongs to one user.

Attributes (table `collections`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `user_id` | integer | yes | The owner. Foreign key to `users`. Unique together with `folded_name`. |
| `name` | string | yes | The name as shown, tidied and checked by the rules below. |
| `folded_name` | string | yes | The name in Unicode NFC, case-folded. Set whenever `name` is set. Uniqueness and the alphabetical order use it. |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. |

Validations (`backend/app/models/collection.rb`, `backend/app/models/concerns/uniquely_named.rb`):
- `name` must be present after tidying. The code is `blank`.
- `name` has at most 100 characters. The code is `too_long`.
- No other collection of the same user has the same `folded_name`. The code is `taken`. The record itself does not count.
- A database unique index on (`user_id`, `folded_name`) backs the uniqueness rule. A create or a rename that loses a race for the same name is answered as `taken` too.

Relations: a user has many collections (`backend/app/models/user.rb`). A note belongs to one collection (feature 09).

## Rules

- **Names are tidied before any rule.** The ends are trimmed, and each run of whitespace inside becomes one space. A name that is empty after that is `blank` (AC-06, question 5).
- **A name has 1 to 100 characters,** counted after tidying (AC-06, question 7).
- **Names are unique per user, ignoring case in any alphabet.** "Work" and "work" are the same name, and so are "Работа" and "работа". Another user may use the same name (AC-06, question 6; requirements.md 3.2).
- **A collection may keep its own name, or change only its case** (AC-06, question 6).
- **A user reaches only their own collections.** Another user's collection, a missing one, and an id that is not a number all answer 404 `not_found`, so an answer never shows whether another user's collection exists (AC-06, question 3).
- **The list is alphabetical, ignoring case** (AC-06, question 8).
- **Deleting a collection removes only the collection, for now.** What happens to its notes is AC-07 (feature 07), which is not built. Until feature 07 decides, the database refuses to delete a collection that still has notes (feature 09, question 15).

## Chosen approaches

- **The answers to spec questions 5 to 8 are the rules above:** tidying, length, case, and order. Each was taken under the owner's standing instruction of 2026-11-05, as the recommended option (AC-06).
- **`folded_name` is a stored column.** SQLite's `LOWER()` and `NOCASE` fold only ASCII letters, so they cannot meet the case rule in every alphabet. Ruby folds Unicode (feature 06, Decisions).
- **The same codes are used in every named area.** `blank`, `too_long`, and `taken` mean the same for collections and tags (feature 08).
