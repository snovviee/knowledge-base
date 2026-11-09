# Plan: 06_collections_crud

**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05)
**Depends on:** 01, 05

## Approach

- Data: new table `collections`: `user_id` (integer, not null, foreign key), `name` (string, not null: the name as shown), `name_key` (string, not null: the name in Unicode NFC, case-folded), timestamps. Unique index on (`user_id`, `name_key`). `Collection` belongs to a user, and `User` has many collections.
  - The name is tidied on assignment (`normalizes :name` with `squish`: the ends trimmed, each inner run of whitespace one space; spec question 5), and assigning it also sets `name_key` (`unicode_normalize(:nfc).downcase(:fold)`).
  - Validations, each with the code the API sends: `name` present (`blank`), at most 100 characters (`too_long`), and no other collection of the same user with the same `name_key` (`taken`). The error is on `name`.
  - Scope `alphabetical`: `order(:name_key, :id)` (spec question 8).
- API: JSON under `/api`. The requests that change data send `X-CSRF-Token` with the token from `GET /api/csrf` (feature 05).
  - `GET /api/collections` → 200 `{ "collections": [ { "id": 1, "name": "Art" }, ... ] }`, only the signed-in user's, in alphabetical order.
  - `POST /api/collections`, body `{ "name": "<string>" }` → 201 `{ "collection": { "id": 1, "name": "Art" } }`.
  - `PATCH /api/collections/:id`, body `{ "name": "<string>" }` → 200 `{ "collection": { "id": 1, "name": "Art" } }`. `PUT` routes to the same action.
  - `DELETE /api/collections/:id` → 204, no body.
  - Errors: 401 `{ "error": "unauthenticated" }` (no sign-in, every request, checked first: spec question 4); 403 `{ "error": "invalid_csrf_token" }` (feature 05); 400 `{ "error": "bad_request" }` (a body that is not JSON: spec question 2); 404 `{ "error": "not_found" }` (another user's or a missing collection: spec question 3); 422 `{ "error": "validation_failed", "fields": { "name": "blank" | "too_long" | "taken" } }` (spec question 1).
- UI:
  - New component `frontend/src/Collections.tsx`: the collections area (the `aside` labelled by its "Collections" heading), in place of the static area in `frontend/src/App.tsx`. App passes `onSignedOut`, which sets the session to signed out, so the sign-in screen shows (spec question 13).
  - New `frontend/src/api.ts`: `sendWithCsrfToken(method, url, body?)` gets a token from `GET /api/csrf` right before the request and sends it in `X-CSRF-Token`, with a JSON body when there is one.
  - List states: loading ("Loading…", `role="status"`), load error ("Could not load collections. Try again.", `role="alert"`, and a "Try again" button), empty ("No collections yet"), and the list. Each row shows the name as text (the name element carries `data-testid="collection-name"` for the tests) and the buttons "Rename" and "Delete", named "Rename <name>" and "Delete <name>".
  - One editor at a time: the create form (at the top, opened by "New collection", which shows once the list has loaded), a rename form (in place of its row), or a delete confirmation (in place of its row). Opening one closes the other.
  - Forms: the label "Collection name", the field with the focus, a submit button ("Create" or "Save"), and "Cancel". Escape cancels. A message under the field (`role="alert"`): the validation message for a 422 (the field gets `aria-invalid="true"` and `aria-describedby`), or the failure message. The submit button is busy (disabled, `aria-busy="true"`) while the request waits.
  - Delete confirmation: "Delete “<name>”? This cannot be undone.", "Delete" (busy while the request waits) and "Cancel" (with the focus). Escape cancels. The failure message shows in the confirmation.
  - "This collection no longer exists." (`role="alert"`) shows at the top of the area after a rename answered 404.
  - The list keeps the server's order. A created or renamed collection is put in place by its name in NFC, lowercased, so the order follows the same rule as the server.
- Decisions:
  - A `name_key` column, not `COLLATE NOCASE` or `LOWER()`: SQLite folds only ASCII letters (checked: `LOWER('Работа') = LOWER('работа')` is false), and spec question 6 asks for any alphabet. Ruby's `downcase(:fold)` folds Unicode.
  - The model check gives the 422 with `taken`. The unique index catches two creates at the same moment, and `ActiveRecord::RecordNotUnique` answers the same 422 (spec edge case).
  - `ApplicationController#require_signed_in_user` answers 401. `Api::CollectionsController` uses it with `prepend_before_action`, so it runs before the forgery check from feature 05 (spec question 4). Tags and notes can reuse it.
  - Lookups go through `current_user.collections`, so another user's id is not found. `rescue_from ActiveRecord::RecordNotFound` in `ApplicationController` answers 404 `not_found` (spec question 3).
  - `rescue_from ActionDispatch::Http::Parameters::ParseError` in `ApplicationController` answers 400 `bad_request` (spec question 2). Rails parses the body when `params` is first read, inside the action's callbacks.
  - `ApplicationController#render_validation_failed(record)` builds the 422 body from `record.errors.details`, the first code of each field, so the note forms can reuse it.
  - The `name` parameter is used only when it is a string. Anything else becomes `nil`, so it is `blank` (spec question 1).
  - Request-spec helpers move from `spec/requests/logout_spec.rb` to `spec/support/request_helpers.rb`: `sign_in_with_google(browser = integration_session, uid: "u-1", name: "Ada Lovelace")` and `csrf_token(browser = integration_session)`. Features 05 and 06 share them, and the cross-user tests sign in a second user with another `uid`.
  - The frontend tests go in a new `src/Collections.test.tsx`. They render `<App />` with a fetch stub that answers by method and path, so they test the area as the user reaches it.
  - The main-layout tests of features 01, 04, and 05 answer every request with the same stub. Once the area loads its list, those stubs must also answer `GET /api/collections`, with an empty list. Only the stubs change, not the assertions.
  - New code goes in new files. Features 04 and 05 are not committed yet, so the shared files get only small edits: `config/routes.rb`, `db/schema.rb`, `app/models/user.rb`, `app/controllers/application_controller.rb`, `src/App.tsx`, and the stubs in `src/App.test.tsx` and `src/App.logout.test.tsx`.

## Checklist

- [x] 1. [SETUP] Move the request-spec helpers to `spec/support/request_helpers.rb`, included in request specs: `sign_in_with_google(browser = integration_session, uid: "u-1", name: "Ada Lovelace")` and `csrf_token(browser = integration_session)`. `spec/requests/logout_spec.rb` uses them and drops its own copies.
  - Check: `docker compose run --rm backend bundle exec rspec`: 41 examples, 0 failures; `grep -rn "def sign_in_with_google\|def csrf_token" backend/spec`: only `spec/support/request_helpers.rb`
- [x] 2. [BE] Create the `collections` table and the `Collection` model: a collection belongs to a user, and its name is tidied (ends trimmed, inner whitespace one space) and required (`blank`).
  - Test first: AC-06 a collection belongs to a user, and its name is tidied and required (spec/models/collection_spec.rb)
- [x] 3. [BE] A name has at most 100 characters after tidying (`too_long`). Exactly 100 is valid.
  - Test first: AC-06 a collection name has at most 100 characters (spec/models/collection_spec.rb)
- [x] 4. [BE] A name is unique per user, ignoring case in any alphabet (`taken`). Another user may use the same name, and a collection may keep its own name or change only its case.
  - Test first: AC-06 a collection name is unique per user, ignoring case in any alphabet (spec/models/collection_spec.rb)
- [x] 5. [BE] `GET /api/collections` lists only the signed-in user's collections, in alphabetical order ignoring case: 200 `{ "collections": [ { "id", "name" } ] }`.
  - Test first: AC-06 GET /api/collections lists only the signed-in user's collections in alphabetical order (spec/requests/collections_spec.rb)
- [x] 6. [BE] `GET /api/collections` with no sign-in, or with a sign-in that has ended, answers 401 `unauthenticated`. Adds `require_signed_in_user` to `ApplicationController`.
  - Test first: AC-06 GET /api/collections answers 401 when no one is signed in (spec/requests/collections_spec.rb)
- [x] 7. [BE] `POST /api/collections` creates a collection for the signed-in user with the tidied name: 201 `{ "collection": { "id", "name" } }`. A name that another user has is allowed.
  - Test first: AC-06 POST /api/collections creates a collection and answers 201 with it (spec/requests/collections_spec.rb)
- [x] 8. [BE] `POST /api/collections` with a blank, too long, or taken name answers 422 `{ "error": "validation_failed", "fields": { "name": "<code>" } }` and creates nothing. Adds `render_validation_failed` to `ApplicationController`.
  - Test first: AC-06 POST /api/collections refuses a blank, too long, or taken name with 422 and the field code (spec/requests/collections_spec.rb)
- [x] 9. [BE] A name that is missing, null, or not text (a number, a list, an object) counts as blank: 422 with `blank`.
  - Test first: AC-06 POST /api/collections treats a missing or non-text name as blank (spec/requests/collections_spec.rb)
- [x] 10. [BE] A create that loses a race for the same name (the model check passed, the database refuses the row) answers 422 with `taken`, and only one collection exists.
  - Test first: AC-06 a create that loses a race for the same name answers 422 taken (spec/requests/collections_spec.rb)
- [x] 11. [BE] `PATCH /api/collections/:id` renames the user's collection: 200 `{ "collection": { "id", "name" } }`. A change of case only, or the same name, is accepted.
  - Test first: AC-06 PATCH /api/collections/:id renames the collection and answers 200 with it (spec/requests/collections_spec.rb)
- [x] 12. [BE] `PATCH /api/collections/:id` with a blank, too long, non-text, or taken name answers 422 with the field code, and the name is unchanged.
  - Test first: AC-06 PATCH /api/collections/:id refuses an invalid name with 422 and keeps the name (spec/requests/collections_spec.rb)
- [x] 13. [BE] A create or rename whose body is not valid JSON answers 400 `{ "error": "bad_request" }` and changes nothing. Adds the handler to `ApplicationController`.
  - Test first: AC-06 a collections request whose body is not valid JSON answers 400 (spec/requests/collections_spec.rb)
- [x] 14. [BE] `DELETE /api/collections/:id` deletes the user's collection: 204 with no body, and the list no longer has it.
  - Test first: AC-06 DELETE /api/collections/:id deletes the collection and answers 204 (spec/requests/collections_spec.rb)
- [x] 15. [BE] A rename or delete of another user's collection, of a deleted one, or of an id that is not a number answers 404 `{ "error": "not_found" }` and changes nothing. Adds the `RecordNotFound` handler to `ApplicationController`.
  - Test first: AC-06 renaming or deleting another user's or a missing collection answers 404 and changes nothing (spec/requests/collections_spec.rb)
- [x] 16. [BE] A create, rename, or delete without this session's token, or with another session's token, answers 403 `{ "error": "invalid_csrf_token" }` and changes nothing. Feature 05's forgery protection covers every API controller, so this test is expected to pass at once. It is kept as the AC-06 regression test.
  - Test first: AC-06 create, rename, and delete without this session's anti-forgery token answer 403 and change nothing (spec/requests/collections_spec.rb)
- [x] 17. [BE] A create, rename, or delete with no sign-in answers 401 `unauthenticated`, with or without a token, and changes nothing. The sign-in check moves before the token check (`prepend_before_action`).
  - Test first: AC-06 create, rename, and delete with no sign-in answer 401 with or without a token (spec/requests/collections_spec.rb)
- [x] 18. [FE] The collections area (`src/Collections.tsx`, in place of the static area in `src/App.tsx`) shows "Loading…" while the list loads, then the names in the server's order, as plain text. The stubs of the main-layout tests that answer every request the same way (`src/App.test.tsx`: AC-01 empty states, AC-04 Try again if it needs it; `src/App.logout.test.tsx`: `stubBackend`) answer `GET /api/collections` with an empty list; their assertions do not change.
  - Test first: AC-06 the collections area shows Loading… and then the user's collections (src/Collections.test.tsx)
- [x] 19. [FE] A list that cannot load (no answer, or an error answer other than 401) shows "Could not load collections. Try again." as an alert with "Try again". "Try again" shows "Loading…" and loads the list again.
  - Test first: AC-06 a list that cannot load shows the error, and Try again loads it (src/Collections.test.tsx)
- [x] 20. [FE] "New collection" shows once the list has loaded. It opens a form with the focused "Collection name" field and "Create". "Create" sends `POST /api/collections` with `X-CSRF-Token` from `GET /api/csrf` and the body `{ "name": ... }`. On 201 the returned collection shows in its alphabetical place, ignoring case, and the form closes. Adds `src/api.ts`.
  - Test first: AC-06 New collection creates a collection and shows it in alphabetical order (src/Collections.test.tsx)
- [x] 21. [FE] An empty list shows "No collections yet" and "New collection". Item 18 keeps the AC-01 empty-state test green and item 20 adds the button, so this test is expected to pass at once. It is kept as the AC-06 empty-state test.
  - Test first: AC-06 the collections area shows No collections yet and New collection when the user has none (src/Collections.test.tsx)
- [x] 22. [FE] A create answered 422 shows the message for its code under the field ("Enter a name.", "Use at most 100 characters.", "A collection with this name already exists."), marks the field invalid, keeps the form and the typed name, and adds nothing.
  - Test first: AC-06 a refused name shows its validation message under the field (src/Collections.test.tsx)
- [x] 23. [FE] A create with no answer, or an error answer (403, 5xx), shows "Could not create the collection. Try again." as an alert and keeps the form and the typed name.
  - Test first: AC-06 a create that fails shows the error and keeps the form (src/Collections.test.tsx)
- [x] 24. [FE] "Rename" on a row turns it into a form with the current name, focused, and "Save". "Save" sends `PATCH /api/collections/:id` with the token and the name. On 200 the row shows the new name in its alphabetical place.
  - Test first: AC-06 Rename renames a collection and keeps the list in alphabetical order (src/Collections.test.tsx)
- [x] 25. [FE] A rename answered 422 shows the validation message; a rename with no answer or an error answer shows "Could not rename the collection. Try again."; the form and the typed name stay.
  - Test first: AC-06 a rename that is refused or fails shows the message and keeps the form (src/Collections.test.tsx)
- [x] 26. [FE] A rename answered 404 takes the collection off the list and shows "This collection no longer exists." as an alert.
  - Test first: AC-06 renaming a collection that no longer exists removes it and says so (src/Collections.test.tsx)
- [x] 27. [FE] While a create or a rename waits for the server, its button ("Create" or "Save") is busy (disabled, `aria-busy="true"`), and a second click sends no second request.
  - Test first: AC-06 Create and Save show a busy state and ignore a second click (src/Collections.test.tsx)
- [x] 28. [FE] "Cancel", Escape, or opening the other form closes the open create or rename form without a request, and the list is unchanged.
  - Test first: AC-06 Cancel, Escape, or another form closes the open form without a request (src/Collections.test.tsx)
- [x] 29. [FE] "Delete" on a row turns it into "Delete “<name>”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and no request. "Cancel" or Escape brings the row back. Opening the confirmation closes an open form.
  - Test first: AC-06 Delete asks for confirmation, and Cancel or Escape keeps the collection (src/Collections.test.tsx)
- [x] 30. [FE] "Delete" in the confirmation sends `DELETE /api/collections/:id` with the token. On 204, or on 404 (already deleted elsewhere), the row leaves the list with no alert.
  - Test first: AC-06 confirming a delete removes the collection, also when it was already deleted (src/Collections.test.tsx)
- [x] 31. [FE] A delete with no answer, or an error answer (403, 5xx), shows "Could not delete the collection. Try again." as an alert and keeps the confirmation.
  - Test first: AC-06 a delete that fails shows the error and keeps the confirmation (src/Collections.test.tsx)
- [x] 32. [FE] While a delete waits for the server, "Delete" is busy, and a second click sends no second request.
  - Test first: AC-06 Delete shows a busy state and ignores a second click (src/Collections.test.tsx)
- [x] 33. [FE] A list request answered 401 shows the sign-in screen with no message.
  - Test first: AC-06 a list request answered 401 shows the sign-in screen (src/Collections.test.tsx)
- [x] 34. [FE] A create, rename, or delete answered 401 shows the sign-in screen with no message.
  - Test first: AC-06 a change answered 401 shows the sign-in screen (src/Collections.test.tsx)
- [x] 35. [BE] Two renames of different collections to the same name at the same moment end in one success and one 422 `{ "error": "validation_failed", "fields": { "name": "taken" } }`, not a 500. The rename that loses the race (its model check passed, the database refuses the row) answers like a taken name, and its collection keeps its name. Added during Build (see Deviations).
  - Test first: AC-06 a rename that loses a race for the same name answers 422 taken (spec/requests/collections_spec.rb)

Coverage:
- "My collections are listed in alphabetical order": items 5 and 18. "I see only my own collections": item 5.
- "No collections yet": item 21, with the AC-01 empty-state test.
- "Create a collection": items 7 and 20. "Spaces in a name are tidied": items 2 and 7.
- "A name I already use is refused", "An empty name is refused", "A name longer than 100 characters is refused": items 2 to 4, 8, 9, and 22.
- "Another user may use the same name": items 4 and 7.
- "Rename a collection" and "Change only the letter case": items 4, 11, and 24. "A rename to a name I already use is refused": items 12 and 25.
- "Cancel a create or a rename": item 28.
- "Delete asks for confirmation" and "Cancel a delete": item 29. "Confirm a delete": items 14 and 30.
- "Another user's collection cannot be renamed or deleted": item 15.
- "The list cannot load" and "Try again loads the list": item 19.
- "A change fails": items 23, 25, and 31.
- "Rename a collection that was deleted elsewhere": items 15 and 26. "Delete a collection that was deleted elsewhere": items 15 and 30.
- "The sign-in has ended": items 6, 17, 33, and 34.
- Edge cases: 401 first, items 6 and 17; 403, item 16; 404 for a missing or non-numeric id, item 15; missing or non-text name, items 9 and 12; exactly 100 characters, item 3; any alphabet, item 4; the own name, item 11; the race, items 10 (create) and 35 (rename); a body that is not JSON, item 13; markup shown as text, item 18; loading, items 18 and 20; busy, items 27 and 32; validation state, item 22; one editor at a time, items 28 and 29; focus, items 20, 24, and 29.

## Test plan

Manual walkthrough for Verify. Run each item against the running app (`docker compose up`, then http://localhost:3000). Signing in is done by the owner by hand. Two users: sign in with Google in a normal window and with GitHub in a private window. A step that says "in the console" runs in DevTools → Console of that window, where a request carries that window's session cookie. `token()` in those steps stands for `(await (await fetch('/api/csrf')).json()).token`.

1. My collections are listed in alphabetical order
   - Steps: as the Google user, create "Work", "books", and "Art". Reload the page.
   - Expected: the collections area lists "Art", "books", "Work".
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
2. I see only my own collections
   - Steps: as the GitHub user, create "Secret". As the Google user, reload.
   - Expected: the Google user's list has no "Secret".
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
3. No collections yet
   - Steps: as a user with no collections (the GitHub user before item 2, or after deleting all of them), look at the collections area.
   - Expected: "No collections yet" and the "New collection" button.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
4. Create a collection
   - Steps: open DevTools → Network. Choose "New collection", type "Reading", choose "Create".
   - Expected: `POST /api/collections` with status 201 and the body `{"collection":{"id":<number>,"name":"Reading"}}`. "Reading" shows between "books" and "Work", and the form closes.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
5. Spaces in a name are tidied
   - Steps: create a collection named `  Book   notes  ` (spaces at both ends, three in the middle).
   - Expected: the list shows "Book notes", and the response body has `"name":"Book notes"`.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
6. A name I already use is refused
   - Steps: with "Work" in the list, create "work".
   - Expected: status 422 with `{"error":"validation_failed","fields":{"name":"taken"}}`. The form stays open with "work" in the field and "A collection with this name already exists." under it. The list is unchanged.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
7. An empty name is refused
   - Steps: choose "New collection", then "Create" with the field empty. Then type three spaces and choose "Create".
   - Expected: status 422 with `"name":"blank"` both times, and "Enter a name." under the field.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
8. A name longer than 100 characters is refused
   - Steps: in the console, run `copy('a'.repeat(101))`. Paste into the "Collection name" field and choose "Create". Then delete one character and choose "Create" again.
   - Expected: first status 422 with `"name":"too_long"` and "Use at most 100 characters."; then status 201, and the 100-character name is in the list.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
9. Another user may use the same name
   - Steps: as the GitHub user, create "Work" (the Google user has "Work").
   - Expected: status 201, and "Work" is in the GitHub user's list.
   - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
10. Rename a collection
    - Steps: as the Google user with "Art" and "Work", choose "Rename" on "Work", change the name to "Agenda", choose "Save".
    - Expected: `PATCH /api/collections/<id>` with status 200 and `{"collection":{"id":<id>,"name":"Agenda"}}`. The list shows "Agenda" before "Art", and no "Work".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
11. A rename to a name I already use is refused
    - Steps: create "Home" and "Work". Rename "Home" to "WORK".
    - Expected: status 422 with `"name":"taken"`, the message "A collection with this name already exists.", and after "Cancel" the row still says "Home".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
12. Change only the letter case
    - Steps: create "work" (if "Work" exists, rename it to "work" first). Rename "work" to "Work".
    - Expected: status 200, and the list shows "Work".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
13. Cancel a create or a rename
    - Steps: in Network, clear the log. Choose "New collection", type "X", choose "Cancel". Choose "New collection" again, type "X", press Escape. Choose "Rename" on a collection, change the text, press Escape.
    - Expected: each form closes, the list is unchanged, and Network shows no request to `/api/collections`.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
14. Delete asks for confirmation
    - Steps: choose "Delete" on "Work".
    - Expected: the row shows "Delete “Work”? This cannot be undone." with "Delete" and "Cancel", the focus is on "Cancel", and no request is sent.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
15. Confirm a delete
    - Steps: from item 14, choose "Delete". Then reload.
    - Expected: `DELETE /api/collections/<id>` with status 204 and no body. "Work" is gone, also after the reload.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
16. Cancel a delete
    - Steps: choose "Delete" on a collection, then "Cancel". Do it again and press Escape.
    - Expected: the row comes back each time, and no `DELETE` request is sent.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
17. Another user's collection cannot be renamed or deleted
    - Steps: as the Google user, note the id of a collection from a create response in Network. As the GitHub user, in the console run `await fetch('/api/collections/<id>', { method: 'PATCH', headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hacked' }) })` and then the same with `method: 'DELETE'` and no body. Look at each response's `status` and `await response.json()`. As the Google user, reload.
    - Expected: both answers have status 404 and the body `{"error":"not_found"}`. The Google user's collection is unchanged.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
18. The list cannot load
    - Steps: DevTools → Network, right-click a request to `/api/collections` → "Block request URL". Reload.
    - Expected: "Could not load collections. Try again." and a "Try again" button in the collections area. The rest of the main layout shows.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
19. Try again loads the list
    - Steps: from item 18, remove the block (Network request blocking panel), then choose "Try again".
    - Expected: "Loading…", then the list.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
20. A change fails
    - Steps: Network → throttling "Offline". Create "Offline test"; rename a collection; delete a collection and confirm. Set throttling back to "No throttling".
    - Expected: "Could not create the collection. Try again.", "Could not rename the collection. Try again.", and "Could not delete the collection. Try again." in turn. Each form or confirmation stays open with the typed name, and the list is unchanged.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
21. Rename a collection that was deleted elsewhere
    - Steps: open the app in two tabs as the same user. In tab B, delete "Art". In tab A (not reloaded), rename "Art".
    - Expected: status 404. "Art" leaves the list in tab A, and the alert "This collection no longer exists." shows.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
22. Delete a collection that was deleted elsewhere
    - Steps: in two tabs, delete a collection in tab B. In tab A, delete the same collection and confirm.
    - Expected: status 404. The collection leaves the list in tab A, with no alert.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
23. The sign-in has ended
    - Steps: in two tabs as the same user, choose "Log out" in tab B. In tab A, choose "New collection", type "After logout", choose "Create".
    - Expected: `POST /api/collections` answers 401 with `{"error":"unauthenticated"}`, and tab A shows the sign-in screen with no message.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
24. Edge case: no sign-in, and no token
    - Steps: run `curl -s -i http://localhost:3000/api/collections` and `curl -s -i -X POST http://localhost:3000/api/collections`. Signed in, in the console, run `await fetch('/api/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No token' }) })`.
    - Expected: both `curl` calls answer 401 with `{"error":"unauthenticated"}`. The console request answers 403 with `{"error":"invalid_csrf_token"}`, and a reload shows no "No token".
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
25. Edge case: a body that is not JSON
    - Steps: in the console, run `await fetch('/api/collections', { method: 'POST', headers: { 'X-CSRF-Token': await token(), 'Content-Type': 'application/json' }, body: '{' })`.
    - Expected: status 400 with `{"error":"bad_request"}`, and nothing is added.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)
26. Edge case: markup in a name, and the busy button
    - Steps: create `<b>Bold</b>`. Then Network → throttling "Slow 4G", create "Slow", and double-click "Create".
    - Expected: the list shows the text `<b>Bold</b>`, not bold text. While "Slow" is created, "Create" is disabled, and Network shows one `POST`.
    - Result: Pass, 2026-11-09 (owner's manual walkthrough, reported as passed)

## Docs

Written in Polish, from the code as built.

- [x] 1. `docs/domain/collections.md` (create): the Collection entity (user, name, the case-folded key, timestamps) with its validations and codes; the rules: unique per user ignoring case in any alphabet, the name tidied before any rule, 1 to 100 characters, alphabetical order ignoring case, a user reaches only their own collections; chosen approaches: the answers to spec questions 5 to 8; deletion removes only the collection until AC-07 decides about notes (AC-06)
  - Check: every column of the collections migration appears with its validation, and the answers to questions 5 to 8 appear
- [x] 2. `docs/api_contract.md` (update): Conventions: the error codes `validation_failed` (422, with `fields`), `not_found` (404), and `bad_request` (400); the status codes 201, 204, 400, 404, and 422; the order of checks (sign-in 401 first, then the token 403 or the body 400, then 404, then 422); a `## Collections` section with the four endpoints, their requests, responses, and errors (AC-06)
  - Check: `docker compose run --rm backend bin/rails routes -g collections` lists every documented route, and each status code in `spec/requests/collections_spec.rb` is documented
- [x] 3. `docs/conventions.md` (update): UI: loading inside an area, the load error with "Try again", the forms in place (the focus, Escape, one open at a time), the validation message under the field with `aria-invalid`, the failure alerts of a change, the delete confirmation with the focus on "Cancel", a missing record leaving the list, and a 401 showing the sign-in screen; Code: `require_signed_in_user` with `prepend_before_action`, `render_validation_failed`, the 404 and 400 handlers in `ApplicationController`, lookups through `current_user`, `spec/support/request_helpers.rb`, `src/api.ts` (`sendWithCsrfToken`), `src/Collections.tsx` as its own component, and frontend tests that render `<App />` with a stub by method and path, with every main-layout stub answering `GET /api/collections` (AC-06)
  - Check: each message and label in `conventions.md` matches `frontend/src/Collections.tsx`, and each file named in `## Code` exists
- [x] 4. `README.md` (update): Short API description: the four collections endpoints (AC-06)
  - Check: the endpoints in the README match `bin/rails routes -g collections`
- [x] 5. `README.md` (update): the known limitation "The app shows no notes or collections yet" becomes "no notes yet", since collections are built (AC-06) (found in Polish)
  - Check: the README no longer says the app has no collections

## Deviations

- 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end). The owner has not reviewed them one by one.
- 2026-11-05: Build started while a dependency is not at Done: 05 (logout) is at Verify. 01 is at Done. Started under the owner's standing instruction of 2026-11-05.
- 2026-11-05: The case-folded column is `folded_name`, not `name_key` (Approach, Data and Decisions). The app's log filter (`config/initializers/filter_parameter_logging.rb`) matches `_key`, so `name_key` showed as `[FILTERED]` in logs and in `inspect`, though it holds no secret. Found in item 3, before anything used the column. The migration was rolled back and renamed. Polish uses `folded_name` in `docs/`.
- 2026-11-05: Item 16 was ticked as covered. Its test passed before any code of its own, because feature 05's forgery protection in `ApplicationController` covers every API controller, as the plan expected. A mutation check showed the test is not empty: with `skip_forgery_protection` in `Api::CollectionsController`, it failed (201 instead of 403). The test stays as the AC-06 regression test.
- 2026-11-05: Item 18 adapted the stubs of the main-layout tests that answer every request the same way, as planned, and two more than the plan named: `AC-01 signed-in user sees the main layout with their display name` (`src/App.test.tsx`) and `AC-05 the profile area shows the display name and a Log out button` (`src/App.logout.test.tsx`). Each stub now answers `GET /api/collections` with an empty list. One assertion changed form: in `AC-04 Try again checks the session again and shows the main layout`, `toHaveBeenCalledTimes(3)` became a count of the `/api/session` requests (3), because the request after the third session check is now the collections list. It still checks three session checks. `AC-04 a page load with a live session never shows the sign-in screen` needed no change.
- 2026-11-05: Item 21 was ticked as covered. Its test passed before any code of its own, because item 18 renders the empty state (the AC-01 empty-state test needs it) and item 20 adds "New collection", as the plan expected. A mutation check showed the test is not empty: with the empty-state text changed, it failed. The test stays as the AC-06 empty-state test.
- 2026-11-05: While item 26 was built, the item 20 test failed once in four runs. Its deferred list answer could be given before the collections area had sent its request from the mount effect, so the answer went nowhere. The item 18 test had the same race. Both now wait with a `later()` helper in `src/Collections.test.tsx` until the request is made, and only then answer. The item 19 test uses the same helper. Six full Vitest runs passed after the fix. No production code changed.
- 2026-11-05: Build stopped before item 34 was verified. Docker Desktop stopped during the run: the daemon socket, the `desktop-linux` context, and then the `docker` command itself were gone, and Docker did not come back within 10 minutes. Item 34's test was red for the right reason (a 401 on create showed the failure alert, not the sign-in screen), and its code is written (`saveName` and `deleteCollection` set the list to signed out on a 401), but it has not been run green, so the item stays unticked. To resume: run item 34's test, then the full RSpec, RuboCop, Vitest, ESLint, and `tsc -b` runs. Then do the refactor step (the nested ternary in the row rendering of `src/Collections.tsx`) and set `**Stage:** Verify`. The stage stays at Build.
- 2026-11-06: Build resumed once Docker was back. Item 34's test passed with the code written before the stop, and the full Vitest suite passed (38 tests). The refactor step then moved the row rendering of `src/Collections.tsx` from a nested ternary into `renderRow`, with the tests green.
- 2026-11-06: Item 35 was added during Build, under the owner's standing approval of 2026-11-05. It is a missing step for a behavior the spec has: a rename to a name already used answers 422 with `taken` (questions 1 and 6). Item 10 covers this for two creates at the same moment, but a rename that lost the same race would have hit the unique index and answered 500. The spec does not change.
