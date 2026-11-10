# Feature: 11_note_move

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner approved the spec)

## Acceptance criterion

> AC-11: A user can move notes between collections

Sources: requirements.md 1, 3.4 (a note belongs to one collection; move a note to another collection), 4 (note create/edit UI), 5; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Loading); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 3, 8, 12), [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 2, 7 to 10: the forms, the order of the list, the messages, the API's 422 answer, the Collection field), and [features/10_note_tags/spec.md](../10_note_tags/spec.md) (question 7, not approved: a form part that loads on its own), not yet in `docs/`.

Not part of this feature: what deleting a collection does to its notes (AC-07, feature 07); tags on notes (AC-10, feature 10).

## Questions

1. Where does the user move a note?
   - Options: a "Collection" field in the edit form (recommended); a separate "Move" action; drag and drop.
   - Answer: a "Collection" field in the edit form, the same as in the new-note form, with the note's collection chosen. There is no separate Move action and no drag and drop. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
2. How does the API move a note?
   - Options: the edit request with `collection_id` (recommended); other options: TBD (the research names none).
   - Answer: `PATCH /api/notes/:id` with `collection_id` moves the note. The answers are feature 09's (its question 8): null gives `blank`, and anything that is not one of the user's collections gives `not_found`. An edit without `collection_id` keeps the note where it is, and sending its own collection changes nothing. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
3. How does the edit form's Collection field load?
   - Options: on its own, while the rest of the form works (recommended); the whole edit form waits for the collections.
   - Answer: on its own, the same way as feature 10's Tags group: "Loading…" while the collections load, and feature 09's "Could not load collections. Try again." with "Try again" when they cannot load. A save made meanwhile keeps the note's collection. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
4. When does the form send the collection?
   - Options: only when it changed (recommended); with every save.
   - Answer: only when the chosen collection differs from the note's. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
5. Can several notes be moved at once?
   - Options: no, one note at a time (recommended); yes.
   - Answer: no. A note is moved one at a time, from its edit form. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**The edit form shows the note's collection**
- Given "Rails tips" is in "Work", and I have the collections "Books" and "Work"
- When I open the edit form of "Rails tips"
- Then the form shows the field "Collection", which lists "Books" and "Work" with "Work" chosen (question 1; feature 09 question 10)

**Move a note**
- Given the edit form of "Rails tips", in "Work", is open
- When I choose "Books" in "Collection" and choose "Save"
- Then the edit request sends the `collection_id` of "Books" and answers 200 with the note in "Books"
- Then the detail shows "Books", and the list shows "Books" for "Rails tips", in the same place in the list (questions 1, 2; feature 09 question 2)

**A save without a move keeps the collection**
- Given the edit form of "Rails tips", in "Work", is open
- When I change only the title and choose "Save"
- Then the edit request sends no `collection_id`, and "Rails tips" stays in "Work" (questions 2, 4)

**The Collection field loads on its own**
- Given the collections request has not answered yet
- When I open the edit form of "Rails tips"
- Then the title, body, and source URL show at once, and the Collection field shows "Loading…" (question 3)

**A save before the collections arrive keeps the collection**
- Given the Collection field of the edit form still shows "Loading…"
- When I change the title and choose "Save"
- Then the note is saved and stays in its collection (question 3)

**The collections cannot load**
- Given the server cannot be reached, or answers the collections request with an error
- When I open the edit form of "Rails tips"
- Then the Collection field shows "Could not load collections. Try again." with "Try again", and the rest of the form works (question 3)

**Try again loads the collections**
- Given the Collection field shows "Could not load collections. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows, and then the field with the note's collection chosen (question 3)

**Move into a collection deleted elsewhere**
- Given "Books" was deleted in another tab, and the edit form here still lists it
- When I choose "Books" and choose "Save"
- Then the request answers 422 `{ "error": "validation_failed", "fields": { "collection_id": "not_found" } }`, the form stays open with what I typed, and "This collection no longer exists. Choose another." shows under "Collection" (feature 09 questions 7, 8)

**A note cannot move into another user's collection**
- Given another user has the collection "Secret"
- When I send an edit request for my note with that collection's id
- Then it answers 422 `{ "error": "validation_failed", "fields": { "collection_id": "not_found" } }`, the same answer as for a collection that does not exist, and the note stays where it is (question 2; requirements.md 1)

## Edge cases

Based on the answers to the questions above.

- `collection_id` null in an edit: 422 `{ "error": "validation_failed", "fields": { "collection_id": "blank" } }`, and the note stays where it is (question 2).
- Another user's collection, a deleted one, or a value that is not a whole number: 422 with `collection_id` `not_found`, the same answer for each, and nothing changes (question 2; feature 09 question 8).
- An edit without `collection_id` keeps the note where it is. An edit with the note's own collection changes nothing (question 2).
- A move together with other fields that break a rule: every field is named in the same 422 answer, one code each, and nothing changes (feature 09 question 8).
- A move at the same moment as the delete of the target collection: either the move answers 422 with `collection_id` `not_found`, or the delete answers 409 `{ "error": "collection_not_empty" }` (AC-07, feature 07). No note is left without a collection.
- No one signed in, no anti-forgery token, or a note that is not mine: the edit answers 401, 403, or 404 as in feature 09, and nothing changes.
- A moved note keeps its place in the list, which is ordered by creation date (feature 09 question 2).
- There is no way to move several notes at once (question 5).
- UI states (requirements.md 4 `<ui_quality_checks>`): the Collection field's loading "Loading…", its failure "Could not load collections. Try again.", and the message under "Collection" for a collection that no longer exists (question 3; feature 09 question 7).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

No changes since approval on 2026-11-09. Taken in folder order after feature 10, which is Done.

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Depends on: 06 and 09. Folder order puts 10 before this feature. Neither 06 nor 09 is at Done (06 is at Verify, 09 at Build); the owner's standing instruction allows starting anyway, with a Deviation.
- About 5 backend items, mostly expected to pass at once. The race with a collection's delete needs the foreign-key rescue in `update`. About 7 frontend items.
- Risk: this feature contradicts two AC-09 assertions that check the interim behavior. The AC-09 PATCH request spec checks that "a collection is ignored (moving a note is AC-11)", and the AC-09 edit-form test checks that there is no "Collection" field (`queryByLabelText('Collection')`). 09's spec marks both as interim until AC-11. The plan must replace them and record the change under Deviations.
- Risk: a waiting edit form would break every AC-09 edit test, because those tests read the fields right after "Edit". A Collection field that loads on its own avoids this, and that is why it was chosen (question 3).
- Risk: the AC-09 frontend tests use `getAllByRole('listitem')`, `getByRole('status')`, and `findByRole('alert')` without scoping. The new "Loading…" and alert elements must not show alongside 09's in those flows.
