# Feature: 10_note_tags

**Stage:** Ship
**Approved:** yes, 2026-11-09 (owner approved the spec)

## Acceptance criterion

> AC-10: A user can assign and remove tags from notes

Sources: requirements.md 1, 3.3, 3.4 (a note has zero or more tags; assign and remove tags), 4 (notes view: tags; note create/edit UI; note detail: tags; tag management UI; `<ui_quality_checks>`), 5, 6 (NoteTag), 7 (a user can assign tags to a note); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Loading, Empty states); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 3, 8, 12, 13), [features/08_tags_crud/spec.md](../08_tags_crud/spec.md), and [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 6 to 9: the note form's checks and the API's 422 answer), not yet in `docs/`.

Not part of this feature: creating, renaming, and deleting tags (AC-08, feature 08); moving a note (AC-11, feature 11); filtering notes by tag (AC-17, feature 17).

## Questions

1. Where does the user put tags on a note and take them off?
   - Options: a "Tags" group of checkboxes in the create and the edit form (recommended); other options: TBD (the research names none).
   - Answer: a "Tags" group of checkboxes, one per tag, in both the new-note form and the edit form. New tags are made only in the tags area (feature 08). (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
2. How do note answers show a note's tags?
   - Options: every note carries its tags with their ids and names, in alphabetical order (recommended); other options: TBD (the research names none).
   - Answer: every note in an answer has `tags: [{ "id": <integer>, "name": "<string>" }, ...]`, in alphabetical order as the tags area lists them (feature 06 question 8), and `[]` for a note with no tags. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
3. How does a create or an edit set the tags?
   - Options: the request sends the whole set as `tag_ids` (recommended); other options: TBD (the research names none).
   - Answer: `tag_ids` is the whole set of the note's tags. An empty list removes all of them. A request without `tag_ids` leaves the tags as they are, so a create without it makes a note with no tags. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
4. Does a change of tags change a note's updated date?
   - Options: only an edit of the note's own tags does (recommended); other options: TBD (the research names none).
   - Answer: an edit that changes the note's tags changes its updated date. Renaming or deleting a tag changes no note's updated date. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
5. What does the API answer for tag ids that break a rule?
   - Options: 422 with the field `tag_ids` (recommended); other options: TBD (the research names none).
   - Answer: 422 `{ "error": "validation_failed", "fields": { "tag_ids": "<code>" } }`, with `invalid` when `tag_ids` is not a list (null included), and `not_found` when an id is not one of the user's tags (another user's, a deleted one, or an id that is not a whole number), the same answer for each. The same id twice counts once. A refused request changes nothing. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
6. How do the list and the detail show a note's tags?
   - Options: the names after the collection in the list, and a "Tags" line in the detail (recommended); other options: TBD (the research names none).
   - Answer: the list shows a note's tag names after its collection, and nothing for a note with no tags. The detail shows "Tags" with the names, or "No tags". (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
7. How does the form's Tags group load?
   - Options: on its own, while the rest of the form works (recommended); other options: TBD (the research names none).
   - Answer: on its own. It shows "Loading…" while the tags load, "Could not load tags. Try again." with "Try again" when they cannot load, and "No tags yet" when the user has none. The rest of the form keeps working meanwhile. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
8. When does the form send the tags?
   - Options: only when they changed (recommended: a save does not undo a tag change made in another tab); with every create and save.
   - Answer: only when they changed. A create sends them when at least one tag is checked, and an edit when the checked set differs from the note's tags. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
9. What does the form show when a chosen tag no longer exists (422 with `tag_ids` `not_found`)?
   - Options: a message under the Tags group, and the group loads again (recommended); other options: TBD (the research names none).
   - Answer: "A chosen tag no longer exists. Check the tags again." shows under the Tags group. The group loads the tags again, keeps the checks of the tags that still exist, and takes the focus. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
10. What do the notes show when a tag is renamed or deleted in the tags area?
    - Options: the change at once, as for a renamed collection (recommended); other options: TBD (the research names none).
    - Answer: the notes list and an open detail show the change at once, as feature 09 does for a renamed collection. An open form keeps the list of tags it loaded. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)
11. Does the tag delete confirmation say what happens to the notes?
    - Options: yes, with an added line (recommended); no, the question stays as in feature 08.
    - Answer: the question stays "Delete “<name>”? This cannot be undone.", with the added line "Notes with this tag are kept." under it. (the owner's answer: the recommended option, taken under the owner's instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**The form lists my tags**
- Given I have the tags "ruby" and "web"
- When I open the new-note form, or the edit form of a note
- Then a "Tags" group shows a checkbox for "ruby" and one for "web"; in the edit form, the note's own tags are checked (question 1)

**Put tags on a new note**
- Given the new-note form is open
- When I fill in the fields, check "ruby" and "web", and choose "Create"
- Then the create request sends `tag_ids` with both ids and answers 201 with the note, whose `tags` lists "ruby" and "web"
- Then the detail shows "Tags" with "ruby" and "web" (questions 1 to 3, 6)

**Take a tag off a note**
- Given the note "Rails tips" has the tags "ruby" and "web", and its edit form is open
- When I uncheck "web" and choose "Save"
- Then the edit request answers 200 with `tags` listing only "ruby", and the detail and the list show only "ruby" (questions 3, 6)

**Take every tag off a note**
- Given the edit form of "Rails tips" is open with "ruby" checked
- When I uncheck it and choose "Save"
- Then the edit request sends `tag_ids` `[]`, the answer's `tags` is `[]`, the detail shows "No tags", and the list shows no tag names for "Rails tips" (questions 3, 6)

**The list shows tags after the collection**
- Given "Rails tips" is in "Work" and has the tags "web" and "ruby"
- When the list shows
- Then the entry for "Rails tips" shows "Work", and then "ruby" and "web", in alphabetical order (questions 2, 6)

**A save that leaves the tags alone keeps them**
- Given the edit form of "Rails tips" is open, and another tab has since added the tag "web" to it
- When I change only the title here and choose "Save"
- Then the edit request sends no `tag_ids`, and the note keeps "web" (questions 3, 8)

**The Tags group loads on its own**
- Given the tags request has not answered yet
- When I open the new-note form
- Then the Tags group shows "Loading…", and I can fill in the other fields (question 7)

**The tags cannot load**
- Given the server cannot be reached, or answers the tags request with an error
- When I open the new-note form
- Then the Tags group shows "Could not load tags. Try again." with "Try again", and I can still create the note without tags (question 7)

**Try again loads the tags**
- Given the Tags group shows "Could not load tags. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows, and then the checkboxes (question 7)

**No tags yet**
- Given I have no tags
- When I open the new-note form
- Then the Tags group shows "No tags yet" (question 7)

**A chosen tag was deleted elsewhere**
- Given the form has "ruby" and "web" checked, and "ruby" was deleted in another tab
- When I choose "Create" or "Save"
- Then the request answers 422 `{ "error": "validation_failed", "fields": { "tag_ids": "not_found" } }`, and the form stays open with what I typed
- Then "A chosen tag no longer exists. Check the tags again." shows under the Tags group, the group loads again without "ruby" and with "web" still checked, and the focus moves to the group (questions 5, 9)

**Another user's tag cannot be put on my note**
- Given another user has the tag "secret"
- When I send a create or an edit with its id in `tag_ids`
- Then the request answers 422 `{ "error": "validation_failed", "fields": { "tag_ids": "not_found" } }`, the same answer as for a tag that does not exist, and nothing changes (question 5; requirements.md 1)

**A renamed tag shows its new name on its notes**
- Given "Rails tips" has the tag "web", and the list or its detail shows
- When I rename "web" to "frontend" in the tags area
- Then the list, or the detail, shows "frontend" for "Rails tips", without a reload (question 10)

**Deleting a tag keeps its notes**
- Given "Rails tips" has the tag "web", and the list or its detail shows
- When I delete "web" in the tags area and confirm
- Then "Rails tips" still exists, and the list, or the detail, no longer shows "web" for it, without a reload (requirements.md 3.3; question 10)

**The tag delete confirmation says the notes are kept**
- Given the tags area lists "web"
- When I choose "Delete" on "web"
- Then the row asks "Delete “web”? This cannot be undone." with the line "Notes with this tag are kept." under it (question 11)

## Edge cases

Based on the answers to the questions above.

- `tag_ids` that is not a list (a number, text, an object, or null): 422 `{ "error": "validation_failed", "fields": { "tag_ids": "invalid" } }`, and nothing changes (question 5).
- An id that is not one of my tags (another user's, a deleted one, or an id that is not a whole number): 422 `{ "error": "validation_failed", "fields": { "tag_ids": "not_found" } }`, the same answer for each, so it never tells whether another user's tag exists, and nothing changes (question 5).
- The same id twice in `tag_ids`: it counts once (question 5).
- An empty list removes every tag. A request without `tag_ids` leaves the tags as they are; a create without it makes a note with no tags (question 3).
- `tag_ids` that breaks a rule together with other fields: every field is named in the same 422 answer, one code each (feature 09 question 8). A refused request changes no field, the tags included (question 5).
- An edit that changes the tags changes the note's updated date. Renaming or deleting a tag changes no note's updated date (question 4).
- No one signed in, no anti-forgery token, or a note that is not mine: the create or edit answers 401, 403, or 404 as in feature 09, and nothing changes.
- Deleting a tag removes it from every note that has it, and deletes no note (requirements.md 3.3).
- A note may have no tags, or any number of my tags (requirements.md 3.4).
- An open form keeps the list of tags it loaded. A tag created in the tags area while the form is open shows there the next time the form opens (question 10).
- UI states (requirements.md 4 `<ui_quality_checks>`): the Tags group's loading "Loading…", its failure "Could not load tags. Try again.", its empty state "No tags yet", and the message under the group for a tag that no longer exists (questions 7, 9).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Depends on: 06, 08, and 09. None is at Done (06 and 08 are at Verify, 09 at Build), so under the strict gate Build waits for them. The owner's standing instruction allows starting anyway, with a Deviation.
- Data: a `note_tags` table, with foreign keys to notes and tags that delete on cascade, and a unique (note, tag) pair.
- About 12 backend items and 12 frontend items.
- Risk: this feature breaks AC-09 tests that check exact shapes. In `backend/spec/requests/notes_spec.rb`, the `full_json` helper and the list test's `eq` on the first entry have no `tags`. In `frontend/src/Notes.test.tsx`, the `summary` and `fullNote` fixtures have no `tags`. The plan must update these shapes and fixtures; the assertions themselves stay.
- Risk: the AC-09 frontend tests use `getAllByRole('listitem')` on note entries, and `getByRole('status')` or `findByRole('alert')` without scoping. Tags must not render as nested list items, and new "Loading…" or alert elements must not show alongside 09's in those flows.
- Sending the tags only when they changed (question 8) also keeps 09's exact-body tests green.
- Backend trap: `tag_ids=` on a `has_many :through` raises `RecordNotFound`, which would answer 404 for a missing tag. The links must be written by id, so that a deleted tag gives a foreign-key error and a 422.
- Backend trap: `NotesController#create` rescues `InvalidForeignKey` as `collection_id` `not_found`. With tags it must tell the collection from a tag. 09's race test stubs `valid?`, so the check must look up whether the collection still exists instead of running the validations again.
- Rails may drop null items from JSON arrays (deep munge turns `[null]` into `[]`). This is not checked on this repo's Rails 8.1, so the spec says nothing about null items of `tag_ids`.
