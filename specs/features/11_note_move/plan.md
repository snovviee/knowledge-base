# Plan: 11_note_move

**Approved:** yes, 2026-11-09 (owner's standing instruction)
**Depends on:** 06, 09, 10

## Approach

- Data: no change. A note already belongs to one collection (`notes.collection_id`, feature 09). A move is an update of that column.
- API: `PATCH /api/notes/:id` takes `collection_id` (spec question 2).
  - `collection_id` sent and a whole number of one of the user's collections: the note moves there. The answer is 200 with the note, whose `collection` is the new one.
  - `collection_id` that is null: 422 `{ "error": "validation_failed", "fields": { "collection_id": "blank" } }`. Nothing changes.
  - `collection_id` that is another user's collection, a deleted one, or not a whole number: 422 with `collection_id` `not_found`, the same answer for each. Nothing changes.
  - An edit without `collection_id` keeps the note where it is. An edit with the note's own collection changes nothing (spec question 2).
  - A move together with other fields that break a rule names every field in the same 422, one code each, and changes nothing (feature 09 question 8).
  - A move whose target collection is deleted between the check and the write: the move answers 422 `collection_id` `not_found` (the foreign key of `notes.collection_id` refuses the row). The delete of that collection answers 409 while a note is in it (feature 07). No note is left without a collection.
  - Errors: 401, 403, 404, and 400 as in features/09_notes_crud.
  - There is no bulk move (spec question 5): a request moves one note, and nothing is built for several.
- WebSocket: none.
- UI:
  - `frontend/src/NoteForm.tsx`: the edit form gets a "Collection" field, a select with the note's collection chosen, and the user's collections in the server's order (spec question 1). It loads the collections on its own, as the create form already does (feature 09 question 10), so the title, body, and source URL show at once and the field shows "Loading…" (spec question 3). Its failure is "Could not load collections. Try again." with "Try again". A save made before the collections arrive sends no `collection_id`, so the note stays where it is (spec question 3).
  - The new-note and the edit form share the one Collection field: a group named "Collection" (a fieldset with its legend, as feature 10's Tags group), which holds the select, and in the edit form its "Loading…" and its failure in its place. The select is labelled by the legend, so it is still found by the label "Collection". The new-note form keeps its own loading, failure, and no-collections states above the fields (feature 09 questions 10 and 11).
  - The edit form sends `collection_id` only when the chosen collection differs from the note's (spec question 4). A save that changes only the title sends no `collection_id`.
  - The field's 422 message is "This collection no longer exists. Choose another." under "Collection", as the create form already shows for `collection_id` `not_found` (feature 09 question 7). A null choice is "Choose a collection.".
  - `frontend/src/Notes.tsx` and `frontend/src/NoteDetail.tsx`: after a move, the list and the detail show the new collection's name. A moved note keeps its place in the list (feature 09 question 2).
- Decisions:
  - The edit form already has the save path, the 422 handling, and the busy state of feature 09. The Collection field reuses the create form's collection loading and select, so it adds no second loading path.
  - The collection field is loaded for the edit form the same way as for the create form, so the edit form's collection request is made when the form opens. The notes area's own request is not affected.
  - The move is an update of the existing column, so the foreign key and its no-cascade rule (feature 07) stay as they are.
  - `update` reads `collection_id` as `create` does (`collection_id_param`, feature 09 question 8), and rescues the foreign key's refusal with the same answer as `create`.
  - The two feature 09 tests that encode the interim rule are replaced, not deleted, and recorded under Deviations (see Checklist items 1 and 8).
  - A save of a note whose collection is still loading sends no `collection_id`, so the form never guesses a collection for a note it has not yet confirmed.

## Checklist

- [x] 1. [BE] A PATCH with `collection_id` of another of the user's collections moves the note there: 200 with the note in its new collection, and the notes list keeps the note in its place (spec scenario "Move a note"; edge case "A moved note keeps its place in the list"). The AC-09 PATCH test in `spec/requests/notes_spec.rb` asserts the interim rule that a collection in the body is ignored. That assertion fails once the move is built, so this item's green step removes it and keeps the rest of that test (see Deviations).
  - Test first: AC-11 PATCH /api/notes/:id with collection_id moves the note to that collection (spec/requests/note_move_spec.rb)
- [x] 2. [BE] An edit without `collection_id` keeps the note in its collection, and an edit with the note's own collection changes nothing, its updated date included (spec question 2; scenario "A save without a move keeps the collection"; edge case). Expected to pass once item 1 is built, because an edit changes only the fields it sends (feature 09 question 9) and the same value writes nothing. Kept as the AC-11 test.
  - Test first: AC-11 an edit without collection_id keeps the note in its collection (spec/requests/note_move_spec.rb)
- [x] 3. [BE] A `collection_id` that is null answers 422 `collection_id` `blank`, and the note stays where it is (spec edge case). Expected to pass once item 1 is built: the note's check from feature 09 refuses a missing collection. Kept as the AC-11 test.
  - Test first: AC-11 a null collection_id answers 422 blank and the note stays (spec/requests/note_move_spec.rb)
- [x] 4. [BE] A `collection_id` that is another user's, a deleted one, or not a whole number answers 422 `collection_id` `not_found`, the same answer for each, and the note stays where it is (spec scenarios "A note cannot move into another user's collection" and "Move into a collection deleted elsewhere"; edge case). Expected to pass once item 1 is built, because item 1 reads the value as the create does (feature 09 question 8). Kept as the AC-11 test.
  - Test first: AC-11 a collection_id that is not one of the user's collections answers 422 not_found and the note stays (spec/requests/note_move_spec.rb)
- [x] 5. [BE] A move with other fields that break a rule names every field in the same 422 and changes nothing: the title stays, the note stays in its collection (spec edge case; feature 09 question 8). Expected to pass once item 1 is built: the note's checks name every field in one answer and save nothing. Kept as the AC-11 test.
  - Test first: AC-11 a move refused with another field changes nothing (spec/requests/note_move_spec.rb)
- [x] 6. [BE] A move whose collection is deleted between its check and its write answers 422 `collection_id` `not_found`, and the note stays in its collection (spec edge case; the foreign key of `notes.collection_id` refuses the row). Feature 09 item 11 forces the same race for a create. The test also shows the other order: once the move is done, the delete of that collection answers 409 `collection_not_empty` (feature 07), so no note is left without a collection.
  - Test first: AC-11 a move whose target collection is deleted during the request answers 422 not_found (spec/requests/note_move_spec.rb)
- [x] 7. [BE] A move without a sign-in, without this session's token, or of a note that is not the user's answers 401, 403, or 404 and changes nothing, as for every notes edit (spec edge case; features 05 and 09). Feature 05 and feature 09's checks cover the notes edit, so this test is expected to pass at once. It is kept as the AC-11 test.
  - Test first: AC-11 a move without a sign-in, without the anti-forgery token, or of another user's note answers 401, 403, or 404 and changes nothing (spec/requests/note_move_spec.rb)
- [x] 8. [FE] The edit form shows a "Collection" field with the note's collection chosen, and the user's collections in the server's order, the same field as in the new-note form (spec scenario "The edit form shows the note's collection"; question 1). The AC-09 edit-form test in `src/Notes.test.tsx` asserts the interim rule that the edit form has no "Collection" field. That assertion fails once the field is built, so this item's green step removes it (see Deviations). No other AC-09 or AC-10 assertion changes.
  - Test first: AC-11 the edit form shows the note's collection chosen among my collections (src/NoteMove.test.tsx)
- [x] 9. [FE] The Collection field loads on its own: the title, body, and source URL show at once, and the field shows "Loading…" in its place until the collections arrive (spec scenario "The Collection field loads on its own").
  - Test first: AC-11 the Collection field loads on its own while the rest of the edit form works (src/NoteMove.test.tsx)
- [x] 10. [FE] Collections that cannot load show "Could not load collections. Try again." with "Try again" in the field's place, and the rest of the edit form works. "Try again" shows "Loading…" and then the field with the note's collection chosen (spec scenarios "The collections cannot load", "Try again loads the collections").
  - Test first: AC-11 the Collection field shows its failure and Try again loads it (src/NoteMove.test.tsx)
- [x] 11. [FE] Choosing another collection and choosing "Save" sends the `collection_id` of that collection. The detail and the list then show its name, and the note keeps its place in the list (spec scenario "Move a note"; edge case "A moved note keeps its place in the list").
  - Test first: AC-11 Save moves the note to the chosen collection and the detail and list show it in its place (src/NoteMove.test.tsx)
- [x] 12. [FE] A save that changes only the title sends no `collection_id` (spec scenario "A save without a move keeps the collection"; question 4). Expected to pass once item 11 is built, because item 11 sends the collection only when it changed, and the AC-09 edit test checks the exact request body. Kept as the AC-11 test.
  - Test first: AC-11 a save without a move sends no collection_id (src/NoteMove.test.tsx)
- [x] 13. [FE] A save while the Collection field shows "Loading…" or its failure sends no `collection_id`, and the note stays in its collection (spec scenarios "A save before the collections arrive keeps the collection", "The collections cannot load"). Expected to pass once item 11 is built, because the chosen collection is the note's until the user changes it. Kept as the AC-11 test.
  - Test first: AC-11 a save before the collections load keeps the note's collection (src/NoteMove.test.tsx)
- [x] 14. [FE] A 422 with `collection_id` `not_found` shows "This collection no longer exists. Choose another." under "Collection", keeps the form and what was typed, and moves the focus to the field (spec scenario "Move into a collection deleted elsewhere"; the server's 422 answer shows as the browser's checks do, docs/conventions.md). Expected to pass once item 11 is built, because the field shows the server's codes as in the new-note form. Kept as the AC-11 test.
  - Test first: AC-11 a move into a collection deleted elsewhere shows the message under Collection (src/NoteMove.test.tsx)
- [x] 15. [FE] Choosing "Choose a collection" (no collection) and choosing "Save" shows "Choose a collection." under "Collection" and sends nothing, as the new-note form does (spec question 1: the same field as in the new-note form; spec edge case: a null `collection_id`).
  - Test first: AC-11 choosing no collection shows Choose a collection and sends nothing (src/NoteMove.test.tsx)

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. Two users: sign in with Google in a normal window and with GitHub in a private window. A step that says "in the console" runs in DevTools → Console of that window, where a request carries that window's session cookie. As in features/09_notes_crud, `token()` in those steps stands for `(await (await fetch('/api/csrf')).json()).token`, and `send(method, path, body)` for `await fetch(path, { method, headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })`; read its answer with `.status` and `await <answer>.json()`. Before item 1, the Google user has the collections "Work" and "Books", and the note "Rails tips" in "Work".

1. The edit form shows the note's collection
   - Steps: open "Rails tips" and choose "Edit".
   - Expected: a "Collection" field with "Work" chosen, and "Books" among the choices.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the edit form of "Rails tips" showed the group "Collection" with its select, "Work" chosen, and the choices "Choose a collection", "Books", "Work" in that order.
2. Move a note
   - Steps: in the edit form of "Rails tips", choose "Books" in "Collection", then "Save". Choose "Back to notes".
   - Expected: `PATCH /api/notes/<id>` with status 200 and `"collection"` `"Books"`. The detail shows "Books"; the list shows "Books" for "Rails tips", in the same place in the list.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): "Save" sent `PATCH /api/notes/2` with `"collection_id": 2` (Books) and the answer was 200 with `"collection": {"id": 2, "name": "Books"}`. The detail showed "Books". After "Back to notes", the row of "Rails tips" read "Books", second of "Newer note", "Rails tips", "Older note", as before the move; the same after a reload.
3. A save without a move keeps the collection
   - Steps: move "Rails tips" back to "Work" if needed. Open "Edit", change only the title, choose "Save", with the network log open.
   - Expected: the `PATCH` request has no `collection_id`, and the note stays in "Work".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the move back through the form sent `"collection_id": 1` and got 200 in "Work". The title-only save sent only `title`, `body`, and `source_url`, with no `collection_id`, and got 200. The detail and `GET /api/notes/2` showed "Work".
4. The Collection field loads on its own
   - Steps: in DevTools → Network, block `GET /api/collections`, then open the edit form of "Rails tips".
   - Expected: the title, body, and source URL show at once. The "Collection" field shows "Loading…".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): the form's `GET /api/collections` was held with no answer, because a blocked request fails at once and shows item 6 instead. The title, body, and source URL showed the note's values, and the group "Collection" showed "Loading…" with no select.
5. A save before the collections arrive keeps the collection
   - Steps: from item 4, change the title and choose "Save" while the field still shows "Loading…".
   - Expected: the note is saved, and it stays in "Work".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): with "Loading…" still showing, the changed title was saved. The `PATCH` had no `collection_id` and got 200, and the detail and `GET /api/notes/2` showed the new title in "Work".
6. The collections cannot load
   - Steps: with `GET /api/collections` blocked, open the edit form.
   - Expected: the "Collection" field shows "Could not load collections. Try again." with "Try again". The title field can still be typed in.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): with `GET /api/collections` blocked (`net::ERR_BLOCKED_BY_CLIENT`), and also when it was answered 500, the group "Collection" showed "Could not load collections. Try again." with "Try again". Typing " (typed)" at the end of the title gave "Rails tips (typed)".
7. Try again loads the collections
   - Steps: from item 6, remove the block, then choose "Try again".
   - Expected: "Loading…", then the field with "Work" chosen.
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): with the block removed, "Try again" showed "Loading…" (its answer was held once so the state could be seen). Then the select showed with "Work" chosen among "Books" and "Work", and the typed title was kept.
8. Move into a collection deleted elsewhere
   - Steps: open "Rails tips" for edit in one tab. In another tab, delete "Books" (it has no notes). In the first tab, choose "Books" and choose "Save".
   - Expected: status 422 with `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`. The form stays with what was typed, and "This collection no longer exists. Choose another." shows under "Collection".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright): a second tab of the same browser deleted "Books" (204). In the first tab, a changed body and the choice "Books" were saved: 422 `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`. The form stayed with the typed body, "This collection no longer exists. Choose another." showed under "Collection", and the select had `aria-invalid="true"` and the focus. `GET /api/notes/2` showed the note unchanged in "Work".
9. A note cannot move into another user's collection
   - Steps: as the GitHub user, create a collection and note its id from Network. As the Google user, in the console, run `send('PATCH', '/api/notes/<id of Rails tips>', { collection_id: <their collection id> })`.
   - Expected: status 422 with `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`, and "Rails tips" stays in "Work".
   - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright and curl): the GitHub user created "Secret" in the UI, and its id, 3, was read from the `POST` answer. The Google user's `PATCH` with `"collection_id": 3` answered 422 `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`, the same bytes as for id 999999. The note stayed in "Work", with its `updated_at` unchanged.
10. Edge case: a null or non-number collection, and a move with a bad title
    - Steps: in the console, `send('PATCH', '/api/notes/<id>', { collection_id: null })`, then `send('PATCH', '/api/notes/<id>', { collection_id: 'abc' })`, then `send('PATCH', '/api/notes/<id>', { collection_id: <Books id>, title: ' ' })`.
    - Expected: the first answers 422 `{"error":"validation_failed","fields":{"collection_id":"blank"}}`. The second answers 422 `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`. The third answers 422 with `title` `blank` and `collection_id` not moved: the note stays in "Work" with its title.
    - Result: Pass, 2026-11-09, automated walkthrough by Claude (Playwright and curl): `null` answered 422 `{"error":"validation_failed","fields":{"collection_id":"blank"}}`, and `'abc'` answered 422 `{"error":"validation_failed","fields":{"collection_id":"not_found"}}`. Item 8 had deleted "Books", so a new "Books" was made for the third request, which answered 422 `{"error":"validation_failed","fields":{"title":"blank"}}`. Also, `'abc'` with title `' '` named both fields in one 422. The note stayed "Rails tips" in "Work", with its `updated_at` unchanged.
11. Edge case: no sign-in and no token
    - Steps: `curl -s -i -X PATCH http://localhost:3000/api/notes/<id> -H 'Content-Type: application/json' -d '{"collection_id":1}'`. Then, signed in, in the console run `send` without the token: `await fetch('/api/notes/<id>', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection_id: <Books id> }) })`.
    - Expected: the `curl` answers 401 `{"error":"unauthenticated"}`; the request without the token answers 403 `{"error":"invalid_csrf_token"}`, and the note stays in "Work".
    - Result: Pass, 2026-11-09, automated walkthrough by Claude (curl and Playwright): the plan's `curl`, with no cookie and no token, answered 401 `{"error":"unauthenticated"}`. Signed in without `X-CSRF-Token`, from the page and from curl with the session cookie, the answer was 403 `{"error":"invalid_csrf_token"}`. The note stayed in "Work".

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/notes.md` (update): a note moves to another of its user's collections with `collection_id` on its edit; a move is refused for a collection that is not the user's, with the codes of spec questions 2 and 8; an edit without `collection_id` keeps the note's collection; a move that loses a race with the delete of its target collection answers `not_found`; the moved note keeps its place in the list (AC-11)
  - Check: the rules in `notes.md` match `Api::NotesController#update` and the AC-11 request specs, and no line in the file says a move is not built
- [x] 2. `docs/api_contract.md` (update): `collection_id` on `PATCH /api/notes/:id`, with its 422 codes `blank` and `not_found`; the removal of "a `collection_id` in the body is ignored" from the notes section (AC-11)
  - Check: `docker compose run --rm backend bin/rails routes -g notes` lists the same endpoints, and the `collection_id` codes asserted in `spec/requests/note_move_spec.rb` are documented
- [x] 3. `docs/conventions.md` (update): the Collection field of the edit form, shared with the new-note form as a group named "Collection", its loading on its own, and its messages "Could not load collections. Try again.", "This collection no longer exists. Choose another.", and "Choose a collection." (AC-11)
  - Check: each quoted message appears in `frontend/src/NoteForm.tsx`, and every file named in the entry exists
- [x] 4. `README.md` (update): the Notes API: `collection_id` on `PATCH` moves a note (AC-11); the "Notes cannot be moved yet." limitation is removed
  - Check: the README's notes table says `PATCH` moves a note with `collection_id`, and the limitations list no longer says notes cannot be moved
- [x] 5. `docs/conventions.md` (update): the Notes backend entry says that `update` reads `collection_id` with `collection_id_param`, and that `create` and `update` share `render_refused_row` (the last Build entry under Deviations). A Code entry says how a frontend test tells the collections area's `GET /api/collections` from the note form's (AC-11) (found in Polish)
  - Check: `collection_id_param` and `render_refused_row` are in `backend/app/controllers/api/notes_controller.rb`, and `collectionsForForm` and `later` are in `frontend/src/NoteMove.test.tsx`: yes, in the tested snapshot
- [x] 6. `README.md` (update): the summary of what is built names feature 11, the collection deletion section says how to move a note, and the limitations list says notes move one at a time (AC-11) (found in Polish)
  - Check: each sentence matches what Verify saw (Test plan items 1 and 2) and spec question 5: yes

## Deviations

- 2026-11-09: Two AC-09 assertions that encode the interim rule are replaced, as the spec's Notes for Plan name. (a) `spec/requests/notes_spec.rb`, the PATCH test: the assertion "a collection is ignored (moving a note is AC-11)" sends `collection_id` and expects the collection to stay. Feature 11 makes that request a move, so the assertion is replaced by item 1's test; the rest of that test is unchanged. (b) `src/Notes.test.tsx`, the edit-form test: "no Collection field" (`queryByLabelText('Collection')` not in the document). Feature 11 adds the field, so the assertion is replaced by item 8's test. The replacing tests are in feature 11's test files (`spec/requests/note_move_spec.rb`, `src/NoteMove.test.tsx`); feature 09 stays Done.
- 2026-11-09 (Build): As built, (a) removed only the `collection_id` part of that step (and its unused "Books" collection); (b) removed only the one `queryByLabelText('Collection')` line and reworded its comment. No other AC-09 or AC-10 assertion changed.
- 2026-11-09 (Build): Eight tests passed at once, as their items predicted, and are kept as guards. Each was shown to fail under a temporary mutation, which was then undone. Item 2: `collection_id` assigned even when the request does not send it. Item 3: a null `collection_id` ignored. Item 4: the raw value cast by Active Model instead of `collection_id_param`. Item 5: the collection written before the checks. Item 7: `update` finding any user's note (404), and no forgery check (403). Item 12: `collection_id` sent with every save. Item 13: the collection sent while the field is not loaded. Item 14: no message under the field in the edit form.
- 2026-11-09 (Build): The race rescue that `create` had is now one private method, `render_refused_row`, shared by `create` and `update` (`backend/app/controllers/api/notes_controller.rb`). The new-note form's Collection field is now the shared `CollectionField` (a fieldset with its legend), so its select is labelled by the legend instead of a `<label>`; the AC-09 tests find it by the label "Collection" as before.
