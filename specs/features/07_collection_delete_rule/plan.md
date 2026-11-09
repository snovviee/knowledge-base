# Plan: 07_collection_delete_rule

**Approved:** yes, 2026-11-09 (owner's instruction of 2026-11-09: approve the plan and build it)
**Depends on:** 06, 09

## Approach

- Data: no change. The notes' foreign key (`notes.collection_id`, feature 09's migration) has no cascade, so the database refuses to delete a collection that still has a note, whatever the note's status. This is the block approach of spec question 1, already in place.
- API: `DELETE /api/collections/:id` (feature 06): 204 with no body when the collection has no notes; 409 `{ "error": "collection_not_empty" }` when it has notes, archived ones included, and the collection and its notes stay. The 401, 403, and 404 answers come first (`prepend_before_action`, the forgery check, `current_user.collections.find`). No backend code changes: feature 09 (its item 20) built the 409.
- WebSocket: none.
- UI: the collections area (`src/NameListArea.tsx`) shows the refusal in the open confirmation. `NameListTexts` gets an optional `deleteRefused`, which `src/Collections.tsx` sets to "This collection still has notes. Move or delete them first.". A 409 from a delete shows it; every other failure keeps "Could not delete the collection. Try again.".
- Decisions:
  - The backend tests are the AC-07 contract. They go in a new `spec/requests/collection_delete_spec.rb`, not in feature 06's or 09's files, because the rule is this feature's. Items 1 to 8 pass at once, for the reason given in each item. They add no behavior.
  - A 409 from `DELETE /api/collections/:id` is the refusal. That route answers no other 409, so the UI does not read the body.
  - `deleteRefused` is optional. Tags cannot be refused (features/08_tags_crud), so the tags area leaves it out and keeps its failure text.
  - The race in the spec's edge cases has three halves. The delete side is item 8. The note-create side is feature 09's race test (its item 11), already in place. The note-move side needs feature 11 (AC-11), which is not built, so its test comes with feature 11.

## Checklist

- [x] 1. [BE] A collection with an active note is not deleted: `DELETE` answers 409 `{ "error": "collection_not_empty" }`, and the collection and its note are unchanged. Expected to pass at once: feature 09 (its item 20) built the 409 and the foreign key that refuses the row.
  - Test first: AC-07 deleting a collection with an active note answers 409 and keeps the collection and its note (`spec/requests/collection_delete_spec.rb`)
- [x] 2. [BE] A collection whose notes are all archived is not deleted either: 409 `collection_not_empty`, and the collection and its notes stay. Expected to pass at once: the foreign key does not look at a note's status.
  - Test first: AC-07 deleting a collection whose notes are all archived answers 409 and keeps the collection and its notes (`spec/requests/collection_delete_spec.rb`)
- [x] 3. [BE] A collection with no notes is deleted: 204 with no body, and the list no longer has it. Expected to pass at once: feature 06 (item 14) and feature 09 (item 20) built it.
  - Test first: AC-07 deleting a collection with no notes answers 204 and removes it (`spec/requests/collection_delete_spec.rb`)
- [x] 4. [BE] A collection refused for its notes is deleted with 204 once its last note is deleted. Expected to pass at once: the refusal changes nothing, and the foreign key lets the delete through when no row points at the collection. The note is deleted, not moved, since moving is feature 11.
  - Test first: AC-07 a refused collection is deleted with 204 once its last note is deleted (`spec/requests/collection_delete_spec.rb`)
- [x] 5. [BE] A delete of a collection with notes, with no sign-in, answers 401 `unauthenticated` with or without a token, and changes nothing. Expected to pass at once: feature 06 (item 17) puts the sign-in check first.
  - Test first: AC-07 deleting a collection with notes with no sign-in answers 401 with or without a token and changes nothing (`spec/requests/collection_delete_spec.rb`)
- [x] 6. [BE] A delete of a collection with notes, without this session's token or with another session's, answers 403 `invalid_csrf_token` and changes nothing. Expected to pass at once: feature 05's forgery protection covers every API controller.
  - Test first: AC-07 deleting a collection with notes without this session's anti-forgery token answers 403 and changes nothing (`spec/requests/collection_delete_spec.rb`)
- [x] 7. [BE] A delete of another user's collection with notes, or of a missing one, answers 404 `not_found`, never 409, and changes nothing. Expected to pass at once: the lookup through `current_user` runs before the delete (feature 06, item 15).
  - Test first: AC-07 deleting another user's or a missing collection that has notes answers 404, never 409, and changes nothing (`spec/requests/collection_delete_spec.rb`)
- [x] 8. [BE] A note saved in the collection after the delete has looked it up, and before the delete runs, makes the delete answer 409, and the note is kept. The test wraps `Collection#destroy!` to save the note first. Expected to pass at once: the foreign key refuses the delete inside the database.
  - Test first: AC-07 a note saved in the collection just before its delete makes the delete answer 409 and keeps the note (`spec/requests/collection_delete_spec.rb`)
- [x] 9. [FE] A delete answered 409 shows "This collection still has notes. Move or delete them first." in the open confirmation, in place of "Could not delete the collection. Try again.". The collection stays in the list, and the confirmation stays open. Adds the optional `deleteRefused` to `NameListTexts`, sets it in `src/Collections.tsx`, and reads a 409 in `deleteRecord`.
  - Test first: AC-07 a delete refused with 409 shows the refusal in the open confirmation and keeps the collection (`src/CollectionDelete.test.tsx`)
- [x] 10. [FE] After a refusal, "Delete" can be chosen again: once it is answered 204 (the notes are gone), the row leaves the list with no alert. Expected to pass at once: feature 06 (item 30) removes the row on 204, and the refusal message leaves with it.
  - Test first: AC-07 after a refusal, Delete again removes the collection once its notes are gone, with no alert (`src/CollectionDelete.test.tsx`)
- [x] 11. [FE] A delete answered 500, or with no answer, still shows "Could not delete the collection. Try again.", not the refusal, and keeps the confirmation. Expected to pass at once: feature 06 (item 31) shows that message for every error answer, so this test guards the new 409 branch from catching other answers.
  - Test first: AC-07 a delete answered 500 or with no answer shows the general failure, not the refusal (`src/CollectionDelete.test.tsx`)

## Test plan

Manual walkthrough for Verify. Run each item against the running app. Open the browser's network tab for the `DELETE` requests.

1. A collection with notes is not deleted
   - Steps: Sign in. In Collections, "New collection", name "Work", "Create". In Notes, "New note": title "Rails tips", body "Read later", collection "Work", "Create". In Collections, "Delete Work", then "Delete".
   - Expected: "Work" stays in the list. The confirmation stays open, with "This collection still has notes. Move or delete them first." as the alert, not "Could not delete the collection. Try again.". The `DELETE /api/collections/<id>` request answers 409 with `{"error":"collection_not_empty"}`. "Rails tips" is unchanged, in "Work".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all cases passed.
2. Archived notes block the delete too
   - Steps: From item 1, "Cancel" in the confirmation. Open "Rails tips" and choose "Archive". Back to notes. In Collections, "Delete Work", then "Delete".
   - Expected: As in item 1: 409, "Work" stays, the refusal alert shows. "Rails tips" shows "Archived".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all cases passed.
3. An empty collection is deleted
   - Steps: In Collections, "New collection", name "Spare", "Create". "Delete Spare", then "Delete".
   - Expected: "Spare" leaves the list with no alert. The request answers 204 with no body.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all cases passed.
4. Delete again once the notes are gone
   - Steps: From item 2, "Delete Work" and "Delete" in Collections once more, so the refusal shows with the confirmation open. Leave that confirmation open. In Notes, open "Rails tips", choose "Delete", then "Delete" in its confirmation. Back in Collections, choose "Delete" in the "Work" confirmation.
   - Expected: After the note is deleted, the "Work" confirmation is still open with the refusal alert. Its "Delete" sends the request, which answers 204. "Work" leaves the list with no alert.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all cases passed. Run after feature 09's note delete and restore were built.
5. The deletion behavior is documented
   - Steps: None. This scenario is a document, so its check is in `## Docs` (`specs/README.md`, step 6).
   - Expected: See `## Docs`.
   - Result: Not a walkthrough item. The owner left its documentation to Claude: the README and `docs/` items in `## Docs`, written in Polish, are its acceptance.

## Docs

Written in Polish, from the code as built.

- [x] 1. `README.md` (update): the section "Collection deletion behavior" (requirements.md 8): a collection with notes, archived notes included, cannot be deleted; the API answers 409 `{ "error": "collection_not_empty" }`; the notes must be moved or deleted first; a collection with no notes is deleted (AC-07)
  - Check: the README has the section "Collection deletion behavior" with those four facts, and nothing in it says the notes are deleted or moved for the user
- [x] 2. `specs/docs/domain/collections.md` (update): replace the rule that deleting a collection removes only the collection "until feature 07 decides" with the block rule: a collection with notes, archived notes included, is not deleted (409); an empty one is deleted; the chosen approach is block, from spec questions 1 and 2 (AC-07)
  - Check: the rule no longer says "until feature 07 decides", and it names the block approach and the 409 code
- [x] 3. `specs/docs/api_contract.md` (update): Conventions: the status code 409 and the error code `collection_not_empty`; `DELETE /api/collections/:id` gets its 409 response with the body, and the sentence that defers the answer to features 07 and 09 is removed (AC-07)
  - Check: the `DELETE` section lists 204 and 409 with the body, and Conventions list 409 with `collection_not_empty`
- [x] 4. `specs/docs/conventions.md` (update): the change failures: a refused delete shows its reason in the open confirmation, with the text "This collection still has notes. Move or delete them first.", and the other failures keep their text (AC-07)
  - Check: the change-failures paragraph names the refusal and its text, and keeps the general delete failure text

## Deviations

- 2026-11-09: Polish of this feature ran before its stage gate was set. Polish needs `**Stage:** Polish` and every Test plan item at Pass. This feature went from Verify to Ship without the Polish stage. Its Docs items were written from the code, and they match the code (checked against the controllers, the models, the routes, and the frontend strings). Recorded here as a process deviation; no document changed because of the order.
- 2026-11-09: Build started while feature 09 is at Build, not Done. Its items 44 to 50 are open. Feature 07 uses only the 409 and the foreign key that feature 09 built (its item 20, ticked). Reason: the owner asked for the build on 2026-11-09, and the spec's draft notes planned for this. Feature 09 must reach Done before Polish of this feature.
- 2026-11-09, a conflict with an approved document, not changed here: feature 09's approved spec (scenario at its line 275) and its plan's Test plan (the entry for the 409, around line 331) still expect "Could not delete the collection. Try again." for a refused delete. Feature 07 changes that message to the refusal text. Approved documents are not edited in place, so the owner decides how feature 09 records this.
