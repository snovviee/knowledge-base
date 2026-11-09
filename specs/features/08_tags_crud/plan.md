# Plan: 08_tags_crud

**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05)
**Depends on:** 01, 05, 06

## Approach

- Data: new table `tags`: `user_id` (integer, not null, foreign key), `name` (string, not null: the name as shown), `folded_name` (string, not null: the name in Unicode NFC, case-folded), timestamps. Unique index on (`user_id`, `folded_name`). `Tag` belongs to a user, and `User` has many tags. This is the shape of `collections` (feature 06 plan: Approach, Data, and the Deviation that names the column `folded_name`).
  - The name rules are the ones `Collection` has (spec: feature 06 questions 5 to 8): the name is tidied on assignment (`normalizes :name` with `squish`), and assigning it also sets `folded_name` (`unicode_normalize(:nfc).downcase(:fold)`). Validations, each with the code the API sends: `name` present (`blank`), at most 100 characters (`too_long`), and no other tag of the same user with the same `folded_name` (`taken`). Scope `alphabetical`: `order(:folded_name, :id)`.
  - Item 4 moves these rules, which `Tag` and `Collection` then both have, into the model concern `UniquelyNamed` (`backend/app/models/concerns/uniquely_named.rb`), and both models include it. The uniqueness check looks only among records of the same model and the same user, so a tag may have the name of one of the user's collections (spec edge case).
- API: JSON under `/api`, the same shape as collections. The requests that change data send `X-CSRF-Token` with the token from `GET /api/csrf` (feature 05).
  - `GET /api/tags` → 200 `{ "tags": [ { "id": 1, "name": "art" }, ... ] }`, only the signed-in user's, in alphabetical order.
  - `POST /api/tags`, body `{ "name": "<string>" }` → 201 `{ "tag": { "id": 1, "name": "art" } }`.
  - `PATCH /api/tags/:id`, body `{ "name": "<string>" }` → 200 `{ "tag": { "id": 1, "name": "art" } }`. `PUT` routes to the same action.
  - `DELETE /api/tags/:id` → 204, no body.
  - Errors: 401 `{ "error": "unauthenticated" }` (no sign-in, every request, checked first: feature 06 question 4); 403 `{ "error": "invalid_csrf_token" }` (feature 05); 400 `{ "error": "bad_request" }` (a body that is not JSON: feature 06 question 2); 404 `{ "error": "not_found" }` (another user's or a missing tag: feature 06 question 3); 422 `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }` (feature 06 question 1).
- UI:
  - New component `frontend/src/Tags.tsx`: the tags area, an `aside` labelled by its "Tags" heading. `frontend/src/App.tsx` puts it in the left area, below the collections area (spec question 1): a wrapper takes the left column's width and border from the collections `aside`, which changes only class names there. App passes `onSignedOut`, as it does for collections (feature 06 question 13).
  - The tags area has the states and pieces of the collections area (feature 06 plan, Approach, UI), with tag words: "Loading…" (`role="status"`); "Could not load tags. Try again." (`role="alert"`) with "Try again"; "No tags yet"; the rows (the name as text, with `data-testid="tag-name"` for the tests, and the buttons "Rename" and "Delete", named "Rename <name>" and "Delete <name>"); "New tag", which shows once the list has loaded; the forms with the label "Tag name", "Create" or "Save", and "Cancel"; the messages "Enter a name.", "Use at most 100 characters.", "A tag with this name already exists.", "Could not create the tag. Try again.", "Could not rename the tag. Try again.", "Could not delete the tag. Try again.", and "This tag no longer exists."; and the confirmation "Delete “<name>”? This cannot be undone.".
  - Each area holds its own open form or confirmation (spec question 2), so nothing in one area closes the other's.
  - Item 36 moves the code that `Collections.tsx` and `Tags.tsx` then share into `frontend/src/NameListArea.tsx`: the list, the forms, the confirmation, and their states, with the texts, the API path, the JSON keys, and the name's test id as props. `Collections.tsx` and `Tags.tsx` keep only their own texts and settings.
- Decisions:
  - One place for the name rules: the `UniquelyNamed` concern, because tags reuse feature 06's name rules as they are. `Collection` keeps its behavior, and its model and request specs stay as they are and must stay green.
  - `Api::TagsController` mirrors `Api::CollectionsController` and shares no code with it beyond `ApplicationController`: AC-07 will decide what deleting a collection does to its notes, and AC-10 what deleting a tag does, so the two are expected to differ. It reuses `require_signed_in_user` with `prepend_before_action` (feature 06 question 4), `render_validation_failed`, and the 400, 403, and 404 handlers in `ApplicationController`.
  - Lookups go through `current_user.tags`, so another user's id is not found (404, feature 06 question 3).
  - The `name` parameter is used only when it is a string; anything else becomes `nil`, so it is `blank` (feature 06 question 1).
  - A create or a rename that loses a race for the same name (the model check passed, the unique index refuses the row) rescues `ActiveRecord::RecordNotUnique` and answers 422 `taken`, as collections do (feature 06 items 10 and 35).
  - Tests: model specs in a new `spec/models/tag_spec.rb`; request specs in a new `spec/requests/tags_spec.rb`, with `sign_in_with_google` and `csrf_token` from `spec/support/request_helpers.rb`; frontend tests in a new `src/Tags.test.tsx`, which render `<App />` with a fetch stub that answers by method and path, as `src/Collections.test.tsx` does.
  - Once the tags area loads its list (item 18), every main-layout stub that answers by address must answer `GET /api/tags` too, with an empty list: in `src/App.test.tsx`, `AC-01 signed-in user sees the main layout with their display name`, `AC-01 main layout shows the no collections and no notes empty states`, and `AC-04 Try again checks the session again and shows the main layout`; in `src/App.logout.test.tsx`, `stubBackend` and `AC-05 the profile area shows the display name and a Log out button`; in `src/Collections.test.tsx`, `stubBackend`. Only the stubs change, not the assertions.
  - The frontend is built test-first in `Tags.tsx`, with the least code for each item, which repeats parts of `Collections.tsx`. The shared component comes only once both areas are built and tested (item 36), so that every tags test is red first, and the 19 AC-06 tests and the AC-08 tests guard the move.
  - New code goes in new files. Shared files get small edits: `config/routes.rb`, `db/schema.rb`, `app/models/user.rb`, `app/models/collection.rb` (item 4), `src/App.tsx`, `src/Collections.tsx` (items 18 and 36), and the test stubs named above.

## Checklist

- [x] 1. [BE] Create the `tags` table and the `Tag` model: a tag belongs to a user, and its name is tidied (ends trimmed, inner whitespace one space) and required (`blank`). `User` has many tags.
  - Test first: AC-08 a tag belongs to a user, and its name is tidied and required (spec/models/tag_spec.rb)
- [x] 2. [BE] A name has at most 100 characters after tidying (`too_long`). Exactly 100 is valid.
  - Test first: AC-08 a tag name has at most 100 characters (spec/models/tag_spec.rb)
- [x] 3. [BE] A name is unique among the user's tags, ignoring case in any alphabet (`taken`). Another user's tag, or one of the user's collections, may have the same name. A tag may keep its own name or change only its case. "#work" and "work" are two names (spec question 3).
  - Test first: AC-08 a tag name is unique among the user's tags, ignoring case in any alphabet (spec/models/tag_spec.rb)
- [x] 4. [SETUP] Refactor, no behavior: move the name rules that `Tag` and `Collection` now both have (the tidying, `folded_name`, the three validations, and `alphabetical`) into the concern `UniquelyNamed` in `app/models/concerns/uniquely_named.rb`. Both models include it, and no spec changes.
  - Check: `docker compose run --rm backend bundle exec rspec`: as many examples as before the item, 0 failures; `grep -n "squish\|downcase(:fold)" backend/app/models/*.rb`: no match; `bundle exec rubocop` on the changed files: no offenses
- [x] 5. [BE] `GET /api/tags` lists only the signed-in user's tags, in alphabetical order ignoring case: 200 `{ "tags": [ { "id", "name" } ] }`.
  - Test first: AC-08 GET /api/tags lists only the signed-in user's tags in alphabetical order (spec/requests/tags_spec.rb)
- [x] 6. [BE] `POST /api/tags` creates a tag for the signed-in user with the tidied name: 201 `{ "tag": { "id", "name" } }`. A name that another user's tag or one of the user's collections has is allowed, and so is a name with any characters.
  - Test first: AC-08 POST /api/tags creates a tag and answers 201 with it (spec/requests/tags_spec.rb)
- [x] 7. [BE] `POST /api/tags` with a blank, too long, or taken name answers 422 `{ "error": "validation_failed", "fields": { "name": "<code>" } }` and creates nothing.
  - Test first: AC-08 POST /api/tags refuses a blank, too long, or taken name with 422 and the field code (spec/requests/tags_spec.rb)
- [x] 8. [BE] A name that is missing, null, or not text (a number, a list, an object) counts as blank: 422 with `blank`.
  - Test first: AC-08 POST /api/tags treats a missing or non-text name as blank (spec/requests/tags_spec.rb)
- [x] 9. [BE] A create that loses a race for the same name (the model check passed, the database refuses the row) answers 422 with `taken`, and only one tag exists.
  - Test first: AC-08 a tag create that loses a race for the same name answers 422 taken (spec/requests/tags_spec.rb)
- [x] 10. [BE] `PATCH /api/tags/:id` renames the user's tag: 200 `{ "tag": { "id", "name" } }`. A change of case only, or the same name, is accepted.
  - Test first: AC-08 PATCH /api/tags/:id renames the tag and answers 200 with it (spec/requests/tags_spec.rb)
- [x] 11. [BE] `PATCH /api/tags/:id` with a blank, too long, non-text, or taken name answers 422 with the field code, and the name is unchanged.
  - Test first: AC-08 PATCH /api/tags/:id refuses an invalid name with 422 and keeps the name (spec/requests/tags_spec.rb)
- [x] 12. [BE] A rename that loses a race for the same name answers 422 with `taken`, and its tag keeps its name.
  - Test first: AC-08 a tag rename that loses a race for the same name answers 422 taken (spec/requests/tags_spec.rb)
- [x] 13. [BE] `DELETE /api/tags/:id` deletes the user's tag: 204 with no body, and the list no longer has it.
  - Test first: AC-08 DELETE /api/tags/:id deletes the tag and answers 204 (spec/requests/tags_spec.rb)
- [x] 14. [BE] A rename or delete of another user's tag, of a deleted one, or of an id that is not a number answers 404 `{ "error": "not_found" }` and changes nothing. Items 10 and 13 look tags up through `current_user.tags`, and the 404 handler is in `ApplicationController` (feature 06), so this test is expected to pass at once. It is kept as the AC-08 test.
  - Test first: AC-08 renaming or deleting another user's or a missing tag answers 404 and changes nothing (spec/requests/tags_spec.rb)
- [x] 15. [BE] A create or rename whose body is not valid JSON answers 400 `{ "error": "bad_request" }` and changes nothing. The handler is in `ApplicationController` (feature 06), so this test is expected to pass at once. It is kept as the AC-08 test.
  - Test first: AC-08 a tags request whose body is not valid JSON answers 400 (spec/requests/tags_spec.rb)
- [x] 16. [BE] A create, rename, or delete without this session's token, or with another session's token, answers 403 `{ "error": "invalid_csrf_token" }` and changes nothing. Feature 05's forgery protection covers every API controller, so this test is expected to pass at once. It is kept as the AC-08 test.
  - Test first: AC-08 tag create, rename, and delete without this session's anti-forgery token answer 403 and change nothing (spec/requests/tags_spec.rb)
- [x] 17. [BE] Every tags request with no sign-in, or with a sign-in that has ended, answers 401 `unauthenticated`: the list, and a create, rename, or delete with or without a token. Nothing changes. `Api::TagsController` adds `prepend_before_action :require_signed_in_user`, so the sign-in check runs before the token check.
  - Test first: AC-08 the tags requests answer 401 with no sign-in, with or without a token (spec/requests/tags_spec.rb)
- [x] 18. [FE] The tags area (`src/Tags.tsx`) shows in the left area, below the collections area, with the heading "Tags": "Loading…" while its list loads, then the names in the server's order, as plain text. It does not wait for the collections area: its list shows while the collections list cannot load. The main-layout stubs named in Decisions answer `GET /api/tags` with an empty list; their assertions do not change.
  - Test first: AC-08 the tags area shows Loading… and then the user's tags, below the collections area (src/Tags.test.tsx)
- [x] 19. [FE] A tags list that cannot load (no answer, or an error answer other than 401) shows "Could not load tags. Try again." as an alert with "Try again", while the collections area shows its list. "Try again" shows "Loading…" and loads the list again.
  - Test first: AC-08 a tags list that cannot load shows the error, and Try again loads it (src/Tags.test.tsx)
- [x] 20. [FE] "New tag" shows once the list has loaded. It opens a form with the focused "Tag name" field and "Create". "Create" sends `POST /api/tags` with `X-CSRF-Token` from `GET /api/csrf` (`sendWithCsrfToken` in `src/api.ts`) and the body `{ "name": ... }`. On 201 the returned tag shows in its alphabetical place, ignoring case, and the form closes.
  - Test first: AC-08 New tag creates a tag and shows it in alphabetical order (src/Tags.test.tsx)
- [x] 21. [FE] An empty list shows "No tags yet" and "New tag".
  - Test first: AC-08 the tags area shows No tags yet and New tag when the user has none (src/Tags.test.tsx)
- [x] 22. [FE] A create answered 422 shows the message for its code under the field ("Enter a name.", "Use at most 100 characters.", "A tag with this name already exists."), marks the field invalid, keeps the form and the typed name, and adds nothing.
  - Test first: AC-08 a refused tag name shows its validation message under the field (src/Tags.test.tsx)
- [x] 23. [FE] A create with no answer, or an error answer (403, 5xx), shows "Could not create the tag. Try again." as an alert and keeps the form and the typed name.
  - Test first: AC-08 a tag create that fails shows the error and keeps the form (src/Tags.test.tsx)
- [x] 24. [FE] "Rename" on a row turns it into a form with the current name, focused, and "Save". "Save" sends `PATCH /api/tags/:id` with the token and the name. On 200 the row shows the new name in its alphabetical place.
  - Test first: AC-08 Rename renames a tag and keeps the list in alphabetical order (src/Tags.test.tsx)
- [x] 25. [FE] A rename answered 422 shows the validation message; a rename with no answer or an error answer shows "Could not rename the tag. Try again."; the form and the typed name stay.
  - Test first: AC-08 a tag rename that is refused or fails shows the message and keeps the form (src/Tags.test.tsx)
- [x] 26. [FE] A rename answered 404 takes the tag off the list and shows "This tag no longer exists." as an alert.
  - Test first: AC-08 renaming a tag that no longer exists removes it and says so (src/Tags.test.tsx)
- [x] 27. [FE] While a create or a rename waits for the server, its button ("Create" or "Save") is busy (disabled, `aria-busy="true"`), and a second click sends no second request.
  - Test first: AC-08 Create and Save in the tags area show a busy state and ignore a second click (src/Tags.test.tsx)
- [x] 28. [FE] "Cancel", Escape, or opening the other tag form closes the open create or rename form without a request, and the list is unchanged.
  - Test first: AC-08 Cancel, Escape, or another tag form closes the open tag form without a request (src/Tags.test.tsx)
- [x] 29. [FE] "Delete" on a row turns it into "Delete “<name>”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and no request. "Cancel" or Escape brings the row back. Opening the confirmation closes an open tag form.
  - Test first: AC-08 Delete asks for confirmation, and Cancel or Escape keeps the tag (src/Tags.test.tsx)
- [x] 30. [FE] "Delete" in the confirmation sends `DELETE /api/tags/:id` with the token. On 204, or on 404 (already deleted elsewhere), the row leaves the list with no alert.
  - Test first: AC-08 confirming a delete removes the tag, also when it was already deleted (src/Tags.test.tsx)
- [x] 31. [FE] A delete with no answer, or an error answer (403, 5xx), shows "Could not delete the tag. Try again." as an alert and keeps the confirmation.
  - Test first: AC-08 a tag delete that fails shows the error and keeps the confirmation (src/Tags.test.tsx)
- [x] 32. [FE] While a delete waits for the server, "Delete" is busy, and a second click sends no second request.
  - Test first: AC-08 Delete in the tags area shows a busy state and ignores a second click (src/Tags.test.tsx)
- [x] 33. [FE] A tags list request answered 401 shows the sign-in screen with no message.
  - Test first: AC-08 a tags list request answered 401 shows the sign-in screen (src/Tags.test.tsx)
- [x] 34. [FE] A tag create, rename, or delete answered 401 shows the sign-in screen with no message.
  - Test first: AC-08 a tag change answered 401 shows the sign-in screen (src/Tags.test.tsx)
- [x] 35. [FE] A collection form and a tag form can be open at once: opening a tag form or confirmation leaves an open collection form as it is, with its typed name, and the other way round. Each area holds its own form state (items 20 and 28 build the tags area's), so this test is expected to pass at once. It is kept as the AC-08 test for spec question 2.
  - Test first: AC-08 a collection form and a tag form can be open at the same time (src/Tags.test.tsx)
- [x] 36. [SETUP] Refactor, no behavior: move the code that `src/Collections.tsx` and `src/Tags.tsx` now share into `src/NameListArea.tsx` (the list, the forms, the confirmation, and their states), with the texts, the API path, the JSON keys, and the name's test id as props. `Collections.tsx` and `Tags.tsx` pass only their own. No test changes.
  - Check: `docker compose run --rm frontend npx vitest run`: as many tests as before the item, all passing; `npx eslint .` and `npx tsc -b`: no errors; `grep -ln "function NameForm\|function DeleteConfirmation" frontend/src/*.tsx`: only `src/NameListArea.tsx`

Coverage:
- "The tags area is in the left area": item 18.
- "My tags are listed in alphabetical order": items 5 and 18. "I see only my own tags": item 5.
- "No tags yet": item 21.
- "Create a tag": items 6 and 20. "Spaces in a name are tidied": items 1 and 6. "A name may hold any characters": items 3 and 6.
- "A name I already use is refused", "An empty name is refused", "A name longer than 100 characters is refused": items 1 to 3, 7, 8, and 22.
- "Another user may use the same name": items 3 and 6.
- "Rename a tag" and "Change only the letter case": items 3, 10, and 24. "A rename to a name I already use is refused": items 11 and 25.
- "Cancel a create or a rename": item 28. "A collection form and a tag form can be open at once": item 35.
- "Delete asks for confirmation" and "Cancel a delete": item 29. "Confirm a delete": items 13 and 30.
- "Another user's tag cannot be renamed or deleted": item 14.
- "The list cannot load" and "Try again loads the list": item 19.
- "A change fails": items 23, 25, and 31.
- "Rename a tag that was deleted elsewhere": items 14 and 26. "Delete a tag that was deleted elsewhere": items 14 and 30.
- "The sign-in has ended": items 17, 33, and 34.
- Edge cases: 401 first, item 17; 403, item 16; 404 for a missing or non-numeric id, item 14; missing or non-text name, items 8 and 11; exactly 100 characters, item 2; any alphabet, item 3; any characters, items 3 and 6; the name of one of my collections, items 3 and 6; the own name, item 10; the race, items 9 (create) and 12 (rename); a body that is not JSON, item 15; markup shown as text, item 18; loading, items 18 and 20; the two areas load on their own, items 18 and 19; busy, items 27 and 32; validation state, item 22; one form or confirmation at a time in the tags area, items 28 and 29; the collections area's open form stays, item 35; focus, items 20, 24, and 29; UI states, items 18, 19, 21 to 23, 25, and 31; a delete removes only the tag, item 13.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. Two users: sign in with Google in a normal window and with GitHub in a private window. A step that says "in the console" runs in DevTools → Console of that window, where a request carries that window's session cookie. `token()` in those steps stands for `(await (await fetch('/api/csrf')).json()).token`.

1. The tags area is in the left area
   - Steps: as the Google user, look at the main layout.
   - Expected: the left area shows "Collections" and, below it, "Tags". The notes area is to the right.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
2. My tags are listed in alphabetical order
   - Steps: as the Google user, create the tags "rails", "Books", and "art". Reload the page.
   - Expected: the tags area lists "art", "Books", "rails".
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
3. I see only my own tags
   - Steps: as the GitHub user, create the tag "secret". As the Google user, reload.
   - Expected: the Google user's tags have no "secret".
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
4. No tags yet
   - Steps: as a user with no tags (the GitHub user before item 3, or after deleting all of them), look at the tags area.
   - Expected: "No tags yet" and the "New tag" button.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
5. Create a tag
   - Steps: open DevTools → Network. Choose "New tag", type "reading", choose "Create".
   - Expected: `POST /api/tags` with status 201 and the body `{"tag":{"id":<number>,"name":"reading"}}`. "reading" shows after "rails", at the end of the list, and the form closes.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
6. Spaces in a name are tidied
   - Steps: create a tag named `  machine   learning  ` (spaces at both ends, three in the middle).
   - Expected: the list shows "machine learning", and the response body has `"name":"machine learning"`.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
7. A name may hold any characters
   - Steps: create the tags "C#", "#work", and "work".
   - Expected: status 201 for each, and the list shows all three as typed.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
8. A name I already use is refused
   - Steps: with "work" in the list, create "Work".
   - Expected: status 422 with `{"error":"validation_failed","fields":{"name":"taken"}}`. The form stays open with "Work" in the field and "A tag with this name already exists." under it. The list is unchanged.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
9. An empty name is refused
   - Steps: choose "New tag", then "Create" with the field empty. Then type three spaces and choose "Create".
   - Expected: status 422 with `"name":"blank"` both times, and "Enter a name." under the field.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
10. A name longer than 100 characters is refused
    - Steps: in the console, run `copy('t'.repeat(101))`. Paste into the "Tag name" field and choose "Create". Then delete one character and choose "Create" again.
    - Expected: first status 422 with `"name":"too_long"` and "Use at most 100 characters."; then status 201, and the 100-character name is in the list.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
11. Another user may use the same name
    - Steps: as the GitHub user, create "work" (the Google user has "work").
    - Expected: status 201, and "work" is in the GitHub user's tags.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
12. Rename a tag
    - Steps: as the Google user with "art" and "work", choose "Rename" on "work", change the name to "agenda", choose "Save".
    - Expected: `PATCH /api/tags/<id>` with status 200 and `{"tag":{"id":<id>,"name":"agenda"}}`. The list shows "agenda" before "art", and no "work".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
13. A rename to a name I already use is refused
    - Steps: create "home" and "work". Rename "home" to "WORK".
    - Expected: status 422 with `"name":"taken"`, the message "A tag with this name already exists.", and after "Cancel" the row still says "home".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
14. Change only the letter case
    - Steps: rename "work" to "Work".
    - Expected: status 200, and the list shows "Work".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
15. Cancel a create or a rename
    - Steps: in Network, clear the log. Choose "New tag", type "x", choose "Cancel". Choose "New tag" again, type "x", press Escape. Choose "Rename" on a tag, change the text, press Escape.
    - Expected: each form closes, the list is unchanged, and Network shows no request to `/api/tags`.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
16. A collection form and a tag form can be open at once
    - Steps: choose "New collection" and type "Reading". Then choose "New tag".
    - Expected: the tag form opens with the focus in "Tag name", and the collection form is still open with "Reading" in its field. Escape in the tag form closes only the tag form.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
17. Delete asks for confirmation
    - Steps: choose "Delete" on "Work" (renamed in item 14).
    - Expected: the row shows "Delete “Work”? This cannot be undone." with "Delete" and "Cancel", the focus is on "Cancel", and no request is sent.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
18. Confirm a delete
    - Steps: from item 17, choose "Delete". Then reload.
    - Expected: `DELETE /api/tags/<id>` with status 204 and no body. "Work" is gone, also after the reload.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
19. Cancel a delete
    - Steps: choose "Delete" on a tag, then "Cancel". Do it again and press Escape.
    - Expected: the row comes back each time, and no `DELETE` request is sent.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
20. Another user's tag cannot be renamed or deleted
    - Steps: as the Google user, note the id of a tag from a create response in Network. As the GitHub user, in the console run `await fetch('/api/tags/<id>', { method: 'PATCH', headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'hacked' }) })` and then the same with `method: 'DELETE'` and no body. Look at each response's `status` and `await response.json()`. As the Google user, reload.
    - Expected: both answers have status 404 and the body `{"error":"not_found"}`. The Google user's tag is unchanged.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
21. The list cannot load
    - Steps: DevTools → Network, right-click the request to `/api/tags` → "Block request URL". Reload.
    - Expected: "Could not load tags. Try again." and a "Try again" button in the tags area. The collections area shows its list, and the rest of the main layout shows.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
22. Try again loads the list
    - Steps: from item 21, remove the block (Network request blocking panel), then choose "Try again".
    - Expected: "Loading…", then the list.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
23. A change fails
    - Steps: Network → throttling "Offline". Create "offline test"; rename a tag; delete a tag and confirm. Set throttling back to "No throttling".
    - Expected: "Could not create the tag. Try again.", "Could not rename the tag. Try again.", and "Could not delete the tag. Try again." in turn. Each form or confirmation stays open with the typed name, and the list is unchanged.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
24. Rename a tag that was deleted elsewhere
    - Steps: open the app in two tabs as the same user. In tab B, delete "art". In tab A (not reloaded), rename "art".
    - Expected: status 404. "art" leaves the list in tab A, and the alert "This tag no longer exists." shows.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
25. Delete a tag that was deleted elsewhere
    - Steps: in two tabs, delete a tag in tab B. In tab A, delete the same tag and confirm.
    - Expected: status 404. The tag leaves the list in tab A, with no alert.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
26. The sign-in has ended
    - Steps: in two tabs as the same user, choose "Log out" in tab B. In tab A, choose "New tag", type "after logout", choose "Create".
    - Expected: `POST /api/tags` answers 401 with `{"error":"unauthenticated"}`, and tab A shows the sign-in screen with no message.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
27. Edge case: no sign-in, and no token
    - Steps: run `curl -s -i http://localhost:3000/api/tags` and `curl -s -i -X POST http://localhost:3000/api/tags`. Signed in, in the console, run `await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'no token' }) })`.
    - Expected: both `curl` calls answer 401 with `{"error":"unauthenticated"}`. The console request answers 403 with `{"error":"invalid_csrf_token"}`, and a reload shows no "no token".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
28. Edge case: a body that is not JSON
    - Steps: in the console, run `await fetch('/api/tags', { method: 'POST', headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: '{' })`.
    - Expected: status 400 with `{"error":"bad_request"}`, and nothing is added.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
29. Edge case: markup in a name, and the busy button
    - Steps: create `<b>bold</b>`. Then Network → throttling "Slow 4G", create "slow", and double-click "Create".
    - Expected: the list shows the text `<b>bold</b>`, not bold text. While "slow" is created, "Create" is disabled, and Network shows one `POST`.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
30. Edge case: a tag with the name of a collection
    - Steps: with a collection "Reading" in the collections area, create the tag "Reading".
    - Expected: status 201, and "Reading" shows in both areas.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/tags.md` (create): the Tag entity (user, name, the case-folded name, timestamps) with its validations and codes; the rules: unique among the user's tags ignoring case in any alphabet (a collection may have the same name), the name tidied before any rule, any characters, 1 to 100 characters, alphabetical order ignoring case, a user reaches only their own tags; chosen approaches: the answers to spec questions 1 to 3, and the name rules shared with collections (AC-06), linking to `docs/domain/collections.md` for them once that file exists; deleting a tag removes only the tag until AC-10 builds tags on notes (AC-08)
  - Check: every column of the tags migration appears with its validation, and the answers to questions 1 to 3 appear
- [x] 2. `docs/api_contract.md` (update): a `## Tags` section with the four endpoints, their requests, responses, and errors (AC-08). The error and status codes are the ones feature 06's Docs item adds to Conventions; tags add none.
  - Check: `docker compose run --rm backend bin/rails routes -g tags` lists every documented route, and each status code in `spec/requests/tags_spec.rb` is documented
- [x] 3. `docs/conventions.md` (update): UI: the left area holds the collections area and, below it, the tags area; each area loads and fails on its own and keeps its own open form or confirmation (spec question 2); Code: `src/NameListArea.tsx` for an area that lists, creates, renames, and deletes named records, with its props; the `UniquelyNamed` concern for a model whose name is unique per user; every main-layout test stub answers `GET /api/tags` as well as `GET /api/collections` (AC-08)
  - Check: each label and message in `conventions.md` matches `frontend/src/Tags.tsx` or `frontend/src/NameListArea.tsx`, and each file named in `## Code` exists
- [x] 4. `README.md` (update): Short API description: the four tags endpoints (AC-08)
  - Check: the endpoints in the README match `bin/rails routes -g tags`

## Deviations

- 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end). The owner has not reviewed them one by one.
- 2026-11-06: Build started while dependencies are not at Done: 05 (logout) and 06 (collections) are at Verify. 01 is at Done. Started under the owner's standing instruction of 2026-11-05.
- 2026-11-06: Feature 07 (AC-07, collection deletion behavior) is still at Design, so 08 is built out of folder order, as this run's brief asked. 08 uses nothing from 07.
- 2026-11-09: Item 1 already sets `folded_name` when the name is assigned, as `Collection` does. The `tags` table has `folded_name` as not null from the start (Approach, Data), so a tag could not be saved without it. Item 3 then added only the uniqueness check.
- 2026-11-09: Items 14, 15, and 16 were ticked as covered. Their tests passed before any code of their own, as the plan expected: the lookups of items 10 and 13 go through `current_user.tags`, and the 400, 403, and 404 answers come from `ApplicationController` (features 05 and 06). A mutation check showed that each test is not empty: with the lookups changed to `Tag.find`, item 14's test failed (200 instead of 404); with the `ParseError` handler removed from `ApplicationController`, item 15's test failed (the parse error was not handled); with `skip_forgery_protection` in `Api::TagsController`, item 16's test failed (201 instead of 403). Each file was restored and compared with its copy. The tests stay as the AC-08 tests.
- 2026-11-09: Item 35 was ticked as covered. Its test passed before any code of its own, as the plan expected: each area holds its own open form or confirmation (items 20, 28, and 29). A mutation check showed that the test is not empty: with the collections area's name field closing its form when it loses the focus (one form for the whole left area, the option spec question 2 did not take), the test failed (the collection form was gone). The file was restored and compared with its copy. The test stays as the AC-08 test for spec question 2.
- 2026-11-09: Docker Desktop stopped once during item 27 (the daemon socket was gone). Build waited until it came back, then ran item 27's checks. No code changed while it was down.
- 2026-11-09: Item 36 dropped the `Collection` type that `src/Collections.tsx` exported, and the `Tag` type of `src/Tags.tsx`. Nothing imported them. `NamedRecord` in `src/NameListArea.tsx` now describes both, and the texts of each area are a `NameListTexts` object in its own file. The collections area's heading id comes from `useId` now instead of the fixed `collections-heading`; no test or label depends on it.
