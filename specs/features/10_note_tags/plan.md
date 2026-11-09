# Plan: 10_note_tags

**Approved:** yes, 2026-11-09 (owner approved the plan)
**Depends on:** 06, 08, 09

## Approach

- Data: new table `note_tags` with `note_id` and `tag_id` (integer, not null), each a foreign key with cascade on delete, and a unique index on (`note_id`, `tag_id`). A tag's delete removes its rows here, and never a note (spec scenario "Deleting a tag keeps its notes"; requirements.md 3.3). A note's delete removes its rows too. `Note` has many tags through `note_tags`; `Tag` has many notes through `note_tags`. The `updated_at` of a note changes only when its tags change (spec question 4).
  - The columns of the review fields come with features 12 to 14, not now.
- API: JSON under `/api`, as for notes (features/09_notes_crud). The requests that change data send `X-CSRF-Token`.
  - `GET /api/notes` and `GET /api/notes/:id`: every note carries `"tags": [{ "id", "name" }, ...]` in alphabetical order, ignoring case, and `[]` for a note with none (spec question 2). The list entry and the detail both carry it.
  - `POST /api/notes`: the body may include `tag_ids` (a list of ids). Without it, the note has no tags. The response carries the note's `tags` (spec question 3).
  - `PATCH /api/notes/:id`: the body may include `tag_ids`. Without it, the tags stay as they are. An empty list removes every tag (spec question 3). The answer's `tags` is the note's tags after the change.
  - `tag_ids` that is not a list (null included): 422 `{ "error": "validation_failed", "fields": { "tag_ids": "invalid" } }`. An id that is not one of the user's tags (another user's, a deleted one, or not a whole number): 422 with `tag_ids` `not_found`. The same id twice counts once. A refused request changes nothing, the tags included (spec question 5).
  - `DELETE /api/tags/:id`: 204 as before; the tag's links are removed with it, and no note is deleted (spec scenario "Deleting a tag keeps its notes").
  - Errors: 401, 403, 404, and 400 as in features/09_notes_crud.
- WebSocket: none.
- UI:
  - `frontend/src/NoteForm.tsx`: a "Tags" group of checkboxes, one per tag, in the new-note form and the edit form (spec question 1). The group loads the user's tags on its own (`GET /api/tags`), while the rest of the form works (spec question 7). Its states: "Loading…" (`role="status"`), "Could not load tags. Try again." (`role="alert"`) with "Try again", and "No tags yet" when the user has none. A create sends `tag_ids` when at least one tag is checked; an edit sends `tag_ids` only when the checked set differs from the note's tags (spec question 8). A 422 with `tag_ids` `not_found` shows "A chosen tag no longer exists. Check the tags again." under the group, reloads the group, keeps the checks of the tags that still exist, and moves the focus to the group (spec question 9).
  - `frontend/src/Notes.tsx`: the list shows a note's tag names after its collection's name, and nothing for a note with no tags (spec question 6). The names are shown as plain text, one `data-testid="note-tags"` element per note, not as list items, so the AC-09 `listitem` queries are unchanged.
  - `frontend/src/NoteDetail.tsx`: a "Tags" line with the names, or "No tags" (spec question 6).
  - `frontend/src/Tags.tsx` (the tags area, feature 08): its delete confirmation gets the added line "Notes with this tag are kept." under the question (spec question 11). Its NameListTexts gets an optional `deleteNote` line, the same way feature 07 added `deleteRefused`.
  - Renames and deletes of a tag reach the notes at once, as a renamed collection does (feature 09 item 50): `App` keeps the renamed tags by id, and `Notes` shows each new name at render time. A deleted tag leaves the notes' shown tags at once (spec question 10).
- Decisions:
  - Links are written by id, and each id is looked up among `current_user.tags` first, with the whole request refused when one is missing. The spec needs 422 `not_found`, and a lookup that raises `ActiveRecord::RecordNotFound` would answer 404 instead. The spec's Notes for Plan says that assigning `tag_ids=` raises for a missing tag; that is not checked here, because `Note` has no tags association yet, so the probe could not run. Item 13's test is what settles it.
  - The create's rescue for `InvalidForeignKey` (feature 09) is shared with the link write. Feature 09 rescues it as `collection_id` `not_found`. With tags, the controller first checks that the collection still exists and that the tags still exist, and answers the field whose row was refused. This keeps feature 09's race test (the stub of `valid?`) green: that test checks the collection, not the tags.
  - Tags are sent only when the form changed them (spec question 8). That keeps feature 09's exact-body tests green: an edit that does not touch tags sends the same body as before.
  - The list's tag names are a separate element from the list items, so the AC-09 `getAllByRole('listitem')` queries are unchanged.
  - The collection and the tags in one note: a tag and a collection may share a name (feature 08). The form's Tags group and its Collection field are separate elements with separate labels.
  - The tests that the notes and the tags features already have keep their assertions. Their fixtures and their exact-shape helpers gain `tags` (see Checklist items 19 and 26).
  - The notes list fixture in the main-layout stubs answers `GET /api/tags` with the tags the test names, so the new Tags group loads in those tests.

## Checklist

- [x] 1. [SETUP] Create the `note_tags` table with a migration: `note_id` and `tag_id` not null, foreign keys to `notes` and `tags` with cascade on delete, a unique index on (`note_id`, `tag_id`). Run the migration and keep `db/schema.rb` current.
  - Check: `docker compose run --rm backend bin/rails db:migrate` runs, and `db/schema.rb` has the `note_tags` table with both foreign keys set to cascade
- [x] 2. [BE] A note has zero or more tags, and a tag is linked to a note once: `Note` has many tags through `note_tags`; `Tag` has many notes through `note_tags`. Adding the same tag twice to a note keeps one link.
  - Test first: AC-10 a note has zero or more tags, each linked once (spec/models/note_tag_spec.rb)
- [x] 3. [BE] Deleting a tag removes its links and no note: "Rails tips" keeps existing, and loses the tag. Expected to fail at first: `Tag`'s delete currently does not know the links.
  - Test first: AC-10 deleting a tag removes it from its notes and deletes no note (spec/models/note_tag_spec.rb)
- [x] 4. [BE] Deleting a note removes its links and no tag: the tags stay, for other notes.
  - Test first: AC-10 deleting a note removes its links and keeps its tags (spec/models/note_tag_spec.rb)
- [x] 5. [BE] `GET /api/notes` and `GET /api/notes/:id` carry each note's `tags`: `[{ "id", "name" }]` in alphabetical order, ignoring case, and `[]` for a note with none. The list entry and the detail both carry them (spec question 2).
  - Test first: AC-10 GET /api/notes and GET /api/notes/:id carry each note's tags in alphabetical order (spec/requests/note_tags_spec.rb)
- [x] 6. [BE] `POST /api/notes` with `tag_ids` creates the note with those tags, and answers 201 with them: `tags` lists them in alphabetical order (spec question 3).
  - Test first: AC-10 POST /api/notes with tag_ids creates the note with those tags (spec/requests/note_tags_spec.rb)
- [x] 7. [BE] `POST /api/notes` without `tag_ids` creates a note with no tags (spec question 3).
  - Test first: AC-10 POST /api/notes without tag_ids creates a note with no tags (spec/requests/note_tags_spec.rb)
- [x] 8. [BE] `PATCH /api/notes/:id` with `tag_ids` sets the note's tags to exactly that set: a tag not in the set is removed, one in it is added. Its answer's `tags` is the new set (spec question 3; scenario "Take a tag off a note").
  - Test first: AC-10 PATCH /api/notes/:id with tag_ids sets the note's tags to that set (spec/requests/note_tags_spec.rb)
- [x] 9. [BE] `PATCH /api/notes/:id` with `tag_ids` `[]` removes every tag from the note, and its answer's `tags` is `[]` (spec scenario "Take every tag off a note").
  - Test first: AC-10 PATCH /api/notes/:id with an empty tag_ids removes every tag (spec/requests/note_tags_spec.rb)
- [x] 10. [BE] `PATCH /api/notes/:id` without `tag_ids` leaves the tags as they are, even when another tab has since added a tag (spec scenario "A save that leaves the tags alone keeps them").
  - Test first: AC-10 PATCH /api/notes/:id without tag_ids keeps the note's tags (spec/requests/note_tags_spec.rb)
- [x] 11. [BE] An edit that changes the tags changes the note's `updated_at`. An edit that does not change them, and a rename or delete of a tag, change no note's `updated_at` (spec question 4).
  - Test first: AC-10 only an edit that changes a note's tags changes its updated date (spec/requests/note_tags_spec.rb)
- [x] 12. [BE] `tag_ids` that is not a list (a number, text, an object, or null) answers 422 `{ "error": "validation_failed", "fields": { "tag_ids": "invalid" } }` and changes nothing, on a create and an edit (spec edge case).
  - Test first: AC-10 tag_ids that is not a list answers 422 invalid and changes nothing (spec/requests/note_tags_spec.rb)
- [x] 13. [BE] An id that is not one of the user's tags (another user's, a deleted one, or not a whole number) answers 422 with `tag_ids` `not_found`, the same answer for each, and changes nothing (spec question 5; scenario "Another user's tag cannot be put on my note").
  - Test first: AC-10 a tag id that is not one of the user's tags answers 422 not_found and changes nothing (spec/requests/note_tags_spec.rb)
- [x] 14. [BE] The same id twice in `tag_ids` counts once, and the note has one link for it (spec edge case).
  - Test first: AC-10 the same tag id twice in tag_ids links the note to it once (spec/requests/note_tags_spec.rb)
- [x] 15. [BE] `tag_ids` that breaks a rule together with other fields names every field in the same 422 answer, one code each, and changes no field, the tags included (spec edge case; feature 09 question 8).
  - Test first: AC-10 a refused create or edit with tag_ids changes no field (spec/requests/note_tags_spec.rb)
- [x] 16. [BE] (narrowed, see Deviations) A tag deleted between a create's check and its link write (the database refuses the link) answers 422 with `tag_ids` `not_found`, and no note is created (spec question 5; Decisions: the create's rescue tells the collection from a tag). The test forces the race the way feature 09 item 11 does: the tag's check is skipped (the check of the tag ids, not the collection's), so the database refuses the link.
  - Test first: AC-10 a create whose tag is deleted during the request answers 422 tag_ids not_found and creates no note (spec/requests/note_tags_spec.rb)
- [x] 17. [BE] The collection race of feature 09 still answers `collection_id` `not_found` when the tags are fine: the rescue checks the collection before it names the tag (Decisions; feature 09 item 11 test stays green).
  - Test first: AC-10 a note create that loses a race with its collection still answers collection_id not_found with tags (spec/requests/note_tags_spec.rb)
- [x] 18. [BE] A create, edit, or delete of a note's tags without this session's token, or with another's, answers 403 and changes nothing; with no sign-in, 401 (features 05, 06; spec edge case). Feature 05 and features/09's checks cover every notes endpoint, so this test is expected to pass at once. It is kept as the AC-10 test.
  - Test first: AC-10 note tag changes without the anti-forgery token answer 403 and change nothing (spec/requests/note_tags_spec.rb)
- [x] 19. [BE] Feature 09's notes request specs keep their assertions, and their exact-shape helpers (`full_json` and the list's first entry) gain `tags` (spec risk note). Test: the existing AC-09 request specs pass unchanged in their assertions.
  - Check: `docker compose run --rm backend bundle exec rspec spec/requests/notes_spec.rb`: all examples pass, and `git diff -- backend/spec/requests/notes_spec.rb` shows changes only to the helpers and fixtures, not to any `expect`
- [x] 20. [FE] The form's "Tags" group lists the user's tags, one checkbox each, in the create and the edit form. In the edit form, the note's own tags are checked (spec scenario "The form lists my tags").
  - Test first: AC-10 the form lists my tags as checkboxes, with the note's own tags checked in the edit form (src/NoteTags.test.tsx)
- [x] 21. [FE] The Tags group loads on its own: "Loading…" while the tags load, while the rest of the form works, and "Could not load tags. Try again." with "Try again" when they cannot load; "Try again" shows "Loading…" and then the checkboxes. The create still works without tags (spec scenarios "The Tags group loads on its own", "The tags cannot load", "Try again loads the tags").
  - Test first: AC-10 the Tags group loads on its own and shows its failure and Try again (src/NoteTags.test.tsx)
- [x] 22. [FE] "No tags yet" shows when the user has no tags (spec scenario "No tags yet").
  - Test first: AC-10 the Tags group shows No tags yet when the user has none (src/NoteTags.test.tsx)
- [x] 23. [FE] "Create" with checked tags sends `tag_ids` with their ids; with none checked it sends no `tag_ids` (spec scenario "Put tags on a new note"; question 8).
  - Test first: AC-10 Create sends the checked tags as tag_ids (src/NoteTags.test.tsx)
- [x] 24. [FE] "Save" sends `tag_ids` only when the checked set differs from the note's tags. A save that changes only the title sends no `tag_ids`, even when another tab added a tag (spec scenario "A save that leaves the tags alone keeps them"; question 8).
  - Test first: AC-10 Save sends tag_ids only when the checked tags changed (src/NoteTags.test.tsx)
- [x] 25. [FE] A 422 with `tag_ids` `not_found` shows "A chosen tag no longer exists. Check the tags again." under the group, reloads the group, keeps the checks of the tags that still exist, and moves the focus to the group. The form stays with what was typed (spec scenario "A chosen tag was deleted elsewhere"; question 9).
  - Test first: AC-10 a chosen tag deleted elsewhere shows the message and reloads the group (src/NoteTags.test.tsx)
- [x] 26. [FE] The list shows a note's tag names after its collection, and nothing for a note with none; the detail shows "Tags" with the names, or "No tags" (spec scenarios "The list shows tags after the collection", "Take every tag off a note"; question 6). The names are not list items, so the AC-09 `listitem` queries keep their meaning. The AC-09 fixtures gain `tags: []`; their assertions do not change.
  - Test first: AC-10 the list and the detail show a note's tags (src/NoteTags.test.tsx)
- [x] 27. [FE] A tag renamed in the tags area shows its new name on the notes in the list and in an open detail, with no notes request (spec scenario "A renamed tag shows its new name on its notes"; question 10). A tag deleted in the tags area leaves the notes' shown tags at once, with no notes request (spec scenario "Deleting a tag keeps its notes").
  - Test first: AC-10 a renamed or deleted tag changes the notes' shown tags at once (src/NoteTags.test.tsx)
- [x] 28. [FE] The tags area's delete confirmation shows the added line "Notes with this tag are kept." under "Delete “<name>”? This cannot be undone." (spec scenario "The tag delete confirmation says the notes are kept"; question 11).
  - Test first: AC-10 the tag delete confirmation says the notes are kept (src/Tags.test.tsx)
- [x] 29. [FE] A form that is open keeps the list of tags it loaded; a tag created in the tags area while it is open shows the next time the form opens (spec edge case; question 10).
  - Test first: AC-10 an open note form keeps its loaded tags until it is opened again (src/NoteTags.test.tsx)
- [x] 30. [FE] (one assertion changed, see Deviations) The AC-09 frontend tests keep their assertions: the main-layout stubs answer `GET /api/tags` as well, and the fixtures gain `tags: []`. A stub's answer for the form's Tags group does not change the form's other fields.
  - Check: `docker compose run --rm frontend npx vitest run src/Notes.test.tsx src/App.test.tsx src/App.logout.test.tsx`: all tests pass, and `git diff` changes only fixtures and stubs, not the `expect` lines

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. Before item 1, the user creates the tags "ruby" and "web" in the tags area, and the collection "Work".

1. The form lists my tags
   - Steps: open "New note". Then open "Rails tips" and choose "Edit".
   - Expected: a "Tags" group with a checkbox for "ruby" and one for "web". In the edit form, the note's own tags are checked.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
2. Put tags on a new note
   - Steps: open "New note", fill in the fields, check "ruby" and "web", choose "Create".
   - Expected: the detail shows "Tags" with "ruby" and "web". In the list, the note shows "Work", then "ruby" and "web".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
3. Take a tag off a note
   - Steps: open a note with "ruby" and "web", choose "Edit", uncheck "web", choose "Save".
   - Expected: the detail and the list show only "ruby".
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
4. Take every tag off a note
   - Steps: from item 3, edit, uncheck "ruby", choose "Save".
   - Expected: the detail shows "No tags". The list shows no tag names for the note.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
5. The list shows tags after the collection
   - Steps: look at a note in "Work" with "web" and "ruby".
   - Expected: the entry shows "Work", then "ruby" and "web", in alphabetical order.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
6. A save that leaves the tags alone keeps them
   - Steps: open the edit form of a note. In another tab, add "web" to the note. Here, change only the title and choose "Save".
   - Expected: the note keeps "web" (the network request has no `tag_ids`).
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
7. The Tags group loads on its own
   - Steps: block `GET /api/tags` in DevTools → Network, then choose "New note".
   - Expected: the Tags group shows "Loading…" and the other fields can be filled in. Once the request answers, the checkboxes show.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
8. The tags cannot load
   - Steps: with `/api/tags` blocked, choose "New note" and wait.
   - Expected: the Tags group shows "Could not load tags. Try again." with "Try again", and "Create" still creates the note without tags.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
9. Try again loads the tags
   - Steps: from item 8, unblock the request, choose "Try again".
   - Expected: "Loading…", then the checkboxes.
   - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
10. No tags yet
    - Steps: as a user with no tags, choose "New note".
    - Expected: the Tags group shows "No tags yet".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
11. A chosen tag was deleted elsewhere
    - Steps: open "New note" with "ruby" checked. In another tab, delete "ruby" in the tags area. Here, fill in the title and the collection and choose "Create".
    - Expected: status 422 with `tag_ids` `not_found`. "A chosen tag no longer exists. Check the tags again." shows under the Tags group; "ruby" is gone from the group, "web" stays checked if it was.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
12. Another user's tag cannot be put on my note
    - Steps: as the other user, note the id of their tag. As this user, in the console, run `send('POST', '/api/notes', { title: 'T', body: 'B', collection_id: <Work id>, tag_ids: [<their tag id>] })`.
    - Expected: status 422 with `{"error":"validation_failed","fields":{"tag_ids":"not_found"}}`, and no note is created.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
13. A renamed tag shows its new name on its notes
    - Steps: with a note with "web" in the list, rename "web" to "frontend" in the tags area.
    - Expected: the list shows "frontend" for the note at once, with no reload.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
14. Deleting a tag keeps its notes
    - Steps: with "Rails tips" having "web" in the list, delete "web" in the tags area and confirm.
    - Expected: "Rails tips" is still in the list, without "web". Reload: it is still there.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
15. The tag delete confirmation says the notes are kept
    - Steps: in the tags area, choose "Delete" on "web".
    - Expected: "Delete “web”? This cannot be undone." and, under it, "Notes with this tag are kept." Then "Cancel".
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
16. Edge case: tag_ids that is not a list
    - Steps: in the console, `send('POST', '/api/notes', { title: 'T', body: 'B', collection_id: <Work id>, tag_ids: 'ruby' })`, then with `tag_ids: null`.
    - Expected: both answer 422 with `{"error":"validation_failed","fields":{"tag_ids":"invalid"}}`, and no note is created.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.
17. Edge case: the same tag twice, and the auth checks
    - Steps: `send('POST', '/api/notes', { title: 'T', body: 'B', collection_id: <Work id>, tag_ids: [<ruby id>, <ruby id>] })`. Then, without the token, `curl -s -i -X POST http://localhost:3000/api/notes`.
    - Expected: the note is created with one "ruby" tag. The `curl` answers 401 `{"error":"unauthenticated"}`.
    - Result: Pass, 2026-11-09, the owner's walkthrough: all items passed.

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/notes.md` (update): the note's tags (`tags`, the links), the rules for `tag_ids` (422 codes, the same id twice counts once, an empty list removes all, a request without it keeps the tags), the rule that an edit changing tags changes `updated_at`; the chosen approaches of spec questions 1 to 11 (AC-10)
  - Check: every field and code of `tag_ids` in `api_contract.md` and in the spec appears in the file, and the columns of `note_tags` in the migration are listed
- [x] 2. `docs/domain/tags.md` (update): deleting a tag removes its links and no note (AC-10), replacing "What happens to the notes that carry it is AC-10, which is not built yet" with the rule; "Putting a tag on a note … is AC-10, which is not built yet" becomes the rule of the link (AC-10)
  - Check: the tags doc no longer says AC-10 is not built, and its delete rule matches `Tag` and `note_tags`
- [x] 3. `docs/api_contract.md` (update): the `tags` field of the note summary and detail; `tag_ids` on `POST` and `PATCH /api/notes`, with its 422 codes `invalid` and `not_found`; the `DELETE /api/tags/:id` note that links are removed and no note is deleted (AC-10)
  - Check: `docker compose run --rm backend bin/rails routes -g notes` lists the same endpoints, and every `tag_ids` code in `spec/requests/note_tags_spec.rb` is documented
- [x] 4. `docs/conventions.md` (update): the Tags group in the note form (its states, loading on its own), the tag names in the list as plain text outside the list items, "Notes with this tag are kept." in the tag delete confirmation, and the message "A chosen tag no longer exists. Check the tags again." (AC-10)
  - Check: each quoted message appears in `frontend/src/NoteForm.tsx`, `frontend/src/NoteTags.tsx`, or `frontend/src/Tags.tsx`, and each file named exists
- [x] 5. `README.md` (update): Notes API: the `tags` field and `tag_ids` (AC-10)
  - Check: the README's notes table lists `tag_ids` on create and edit, and says tag deletion keeps notes

## Deviations

- 2026-11-09: Items 3 and 4 were ticked without a red step that failed for the planned reason. The plan expected item 3 to fail before the tag's links were known, and item 4 to fail on the note's delete. Both behaviors are delivered by the database: the `note_tags` foreign keys cascade on delete (item 1). With the tag's links removed from the model, the tag-delete test still passed (the cascade removed the rows). With the note's links removed, the test failed earlier, at building its links, not at the delete, so it did not show the delete's behavior. The tests stay as the AC-10 guards of that behavior. The model's `dependent: :delete_all` is a second layer, kept for clarity.
- 2026-11-09: `add_tag` on `Note` (not in the plan) adds a tag once. Adding a tag the note already has changes nothing. Reason: the plan's item 2 says a tag is linked once, and the unique index otherwise raises `RecordNotUnique`. The model method keeps the spec's rule (a link once) without an exception.
- 2026-11-09: A `null` item inside `tag_ids` (`[null]`) is read by Rails as an empty list (deep munge, checked in the request params), so it removes every tag rather than answering 422 `not_found`. The spec does not decide this case; its Notes for Plan flag it as unknown. Open for the owner: whether a null item is `not_found` (refused) or dropped. Not changed here.
- 2026-11-09: Item 16 is ticked for a narrower case than the plan wrote. The plan asks for a tag deleted between the request's check and its link write. Not reproduced: a test that deletes the tag inside the transaction did not reach the write. What is covered: a tag deleted before the request answers 422 `tag_ids` `not_found`, creates no note, and writes no link (verified with a probe, then kept as the test). The narrow race is OPEN and needs the owner's decision on how to stage it, or a note that it is covered by the database's own refusal alone.
- 2026-11-09: A link to a tag that is gone is refused by the `NoteTag` model's "tag must exist" validation before the database sees it (probe: `ActiveRecord::RecordInvalid`). The plan assumed the foreign key would refuse it. The create maps the validation failure to `tag_ids` `not_found` as well.
- 2026-11-09: The create's note and its tags are written in one transaction (features/10_note_tags Decisions). Before this, a tag refused after the note was saved left the note behind.
- 2026-11-09: One feature 09 frontend assertion was changed, not only fixtures and stubs, as item 30 requires. In `src/Notes.test.tsx`, "AC-09 New note opens the form with the user's collections and none chosen" checked `within(area).queryByRole('status')` not to be in the document once the collections loaded. The Tags group (feature 10) now has its own "Loading…" status while its tags load, so that check failed. Before: `expect(within(area).queryByRole('status')).not.toBeInTheDocument()`. After: the check is scoped to the collections field, and it also checks that no collections error shows. The intent of the test (the collections have loaded) is kept. The file's other assertions are unchanged, as far as this session's edits show. Feature 09 is Done; this change is recorded here, not in its spec.
- 2026-11-09: Build complete. The items that passed without a red step that failed for the planned reason, listed so none is hidden: 7 (a create without tag_ids gives no tags, already true), 9 (an empty tag_ids removes every tag, the same branch as item 8), 10 (a missing tag_ids keeps the tags; its guard was checked by a mutation that broke it), 14 (the same id twice counts once, the `uniq` already in place), 18 (the token and sign-in on a tag change, feature 05 and 09 cover them), 29 (an open form keeps its loaded tags; the group loads once per open). The plan called these guards; each test checks the behavior and would fail if the code were broken, except where a mutation check is named above.
