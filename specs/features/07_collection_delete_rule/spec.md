# Feature: 07_collection_delete_rule

**Stage:** Done
**Approved:** yes, 2026-11-09

## Acceptance criterion

> AC-07: Collection deletion behavior is documented

Sources: requirements.md 1, 3.2, 5, 8 (README: collection deletion behavior); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 3, 4, 10, 12: not found, the order of 401 and 403, the delete confirmation, failures) and [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (question 15: the interim refusal that this feature would make final), not yet in `docs/`.

Not part of this feature: moving a note to another collection (AC-11, feature 11); deleting a note (AC-09).

## Questions

1. Which approach of requirements.md 3.2 handles the delete of a collection that has notes?
   - Options: block the delete (recommended: it makes feature 09's interim answer, its question 15, final, and no note is lost); allow the delete and move the notes to a default collection, such as "Uncategorized"; allow the delete and delete the notes with it.
   - Answer: block the delete, as in the first option. A delete of a collection that has notes answers 409 `{ "error": "collection_not_empty" }`, and the collection and its notes stay. A collection with no notes is deleted, with 204.
2. Do archived notes block the delete too?
   - Options: yes (recommended); no.
   - Answer: yes, as in the first option. A collection whose notes are all archived is not deleted either.
3. What does the collections area show when the delete is refused?
   - Options: a message that says why (recommended); feature 09's interim alert "Could not delete the collection. Try again.".
   - Answer: a message that says why, as in the first option. The confirmation stays open, and "This collection still has notes. Move or delete them first." shows in place of "Could not delete the collection. Try again.". "Delete" can be chosen again once the notes are gone.
4. Does the error body give the number of notes?
   - Options: no (recommended); yes.
   - Answer: no, as in the first option. The body is only `{ "error": "collection_not_empty" }`.

## Scenarios

Based on the answers to questions 1 to 4.

**A collection with notes is not deleted**
- Given my collection "Work" has the active note "Rails tips"
- When I delete "Work" in the collections area and confirm
- Then the delete request answers 409 `{ "error": "collection_not_empty" }`
- Then "Work" stays in the list, "Rails tips" is unchanged, and the confirmation stays open with "This collection still has notes. Move or delete them first." (questions 1, 3, 4)

**Archived notes block the delete too**
- Given every note in my collection "Old" is archived
- When I delete "Old" and confirm
- Then the delete request answers 409 `{ "error": "collection_not_empty" }`, and "Old" and its notes stay (question 2)

**An empty collection is deleted**
- Given my collection "Spare" has no notes
- When I delete "Spare" and confirm
- Then the delete request answers 204 with no body, and "Spare" leaves the list (question 1; feature 06)

**Delete again once the notes are gone**
- Given the confirmation for "Work" shows "This collection still has notes. Move or delete them first."
- When I move or delete every note of "Work", and then choose "Delete" in that confirmation again
- Then the delete request answers 204, and "Work" leaves the list (question 3)

**The deletion behavior is documented**
- Given the README and this spec
- When a developer reads the README section "Collection deletion behavior"
- Then it says that a collection with notes, archived notes included, cannot be deleted, that the API answers 409 `{ "error": "collection_not_empty" }`, and that the notes must be moved or deleted first (requirements.md 3.2, 8)

## Edge cases

Based on the answers to questions 1 to 4.

- No one signed in: the delete answers 401 `{ "error": "unauthenticated" }`, with or without an anti-forgery token, and nothing changes (feature 06 question 4).
- Signed in, without this session's anti-forgery token: 403 `{ "error": "invalid_csrf_token" }`, and nothing changes ([features/05_logout](../05_logout/spec.md), question 1).
- Another user's collection, or one that does not exist, with or without notes: 404 `{ "error": "not_found" }`, and nothing changes (feature 06 question 3).
- The checks come in this order: 401, then 403, then 404, then 409. A refusal for notes is never given for a collection that is not mine.
- The refusal changes nothing: the collection keeps its name and its notes (question 1).
- A note created in, or moved into, the collection at the same moment as the delete: either the note is saved and the delete answers 409 `{ "error": "collection_not_empty" }`, or the delete answers 204 and the create or the move answers 422 with `collection_id` `not_found`. No note is left without a collection (feature 09 question 15; AC-11, feature 11).
- A delete that fails for another reason (the server cannot be reached, or another error) shows feature 06's alert "Could not delete the collection. Try again." (feature 06 question 12).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Depends on: 06 and 09. Neither is at Done (06 is at Verify, 09 at Build), so under the strict gate Build waits for them. The owner's standing instruction allows starting anyway, with a Deviation.
- Data: no change. Feature 09's foreign key already guards the delete.
- Backend: about 4 items, mostly expected to pass at once, because feature 09 (its checklist item 20) built the 409. They would be kept as the AC-07 tests in a new `spec/requests/collection_delete_spec.rb`: active notes, all-archived notes, deleted once empty, and 401, 403, and 404 before 409. The plan must say why they pass at once (Build gate in `specs/README.md`).
- Frontend: about 2 items. An optional `deleteRefused` text in `NameListTexts`, tested in a new `src/CollectionDelete.test.tsx`.
- Risk: the new message changes what feature 09's Test plan expects. Its item 41 expects "Could not delete the collection. Try again." for a 409. Feature 06's delete-failure test answers 403 and 500, so it stays green.
- Docs, which are AC-07's acceptance: the README section "Collection deletion behavior", `docs/domain/collections.md`, `docs/api_contract.md`, and `docs/conventions.md`.
