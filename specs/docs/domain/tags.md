# Tags

## Tag

A label a user puts on notes (AC-08). Each `Tag` belongs to one user. Putting a tag on a note and taking it off is AC-10, which is not built yet.

Attributes (table `tags`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `user_id` | integer | yes | The owner. Foreign key to `users`. Unique together with `folded_name`. |
| `name` | string | yes | The name as shown, tidied and checked by the rules below. |
| `folded_name` | string | yes | The name in Unicode NFC, case-folded. Set whenever `name` is set. Uniqueness and the alphabetical order use it. |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. |

Validations (`backend/app/models/tag.rb`, `backend/app/models/concerns/uniquely_named.rb`):
- `name` must be present after tidying. The code is `blank`.
- `name` has at most 100 characters. The code is `too_long`.
- No other tag of the same user has the same `folded_name`. The code is `taken`. The record itself does not count.
- A database unique index on (`user_id`, `folded_name`) backs the uniqueness rule. A create or a rename that loses a race for the same name is answered as `taken` too.

Relations: a user has many tags (`backend/app/models/user.rb`).

## Rules

- **The name rules are the collections' rules.** Names are tidied, must be 1 to 100 characters after tidying, and are unique per user ignoring case in any alphabet. The rules are the same as for collections, in [domain/collections.md](collections.md) (AC-08).
- **A tag name may hold any characters.** Spaces inside it, `#`, `,`, and `/` included, are kept as typed once the spaces are tidied. "#work" and "work" are two names (AC-08, question 3).
- **A tag may have the name of one of the user's collections.** The uniqueness check looks only among the user's tags, so a collection and a tag can share a name (AC-08, requirements.md 3.3).
- **Another user may use the same name.** Uniqueness is per user (requirements.md 3.3, AC-08).
- **A user reaches only their own tags.** Another user's tag, a missing one, and an id that is not a number all answer 404 `not_found` (AC-08).
- **The list is alphabetical, ignoring case** (AC-08).
- **Deleting a tag removes only the tag.** What happens to the notes that carry it is AC-10, which is not built yet (AC-08).

## Chosen approaches

- **The answers to spec questions 1 to 3 are the rules above.** The tags area sits below the collections area in the left area, with the same forms and states. Tags have no rules of their own beyond the collections' name rules, and a name may hold any characters. Each answer was taken under the owner's standing instruction of 2026-11-05, as the recommended option (AC-08).
- **Tags and collections share one place for the name rules.** The `UniquelyNamed` concern holds them, and each model includes it. Its checks look only among records of the same model and the same user (AC-08).
