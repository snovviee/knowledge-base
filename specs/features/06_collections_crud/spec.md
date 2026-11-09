# Feature: 06_collections_crud

**Stage:** Done
**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question)

## Acceptance criterion

> AC-06: A user can create, rename, and delete collections

Sources: requirements.md 1, 3.2, 4 (main layout: collections area; collection management UI; `<ui_quality_checks>`), 5, 6, 7; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Loading, Busy button, Empty states); [features/05_logout/spec.md](../05_logout/spec.md) (question 1: the anti-forgery token for requests that change data), not yet in `docs/`.

Not part of this feature: what deleting a collection does to its notes (AC-07, feature 07); notes themselves (AC-09); choosing a collection to see or filter its notes (AC-09, AC-17); the collections dropdown on narrow screens (AC-25).

## Questions

1. What does the API answer when a name breaks a rule?
   - Options: 422 `{ "error": "validation_failed", "fields": { "name": "<code>" } }`, with one code per field: `blank`, `too_long`, or `taken`; a name that is missing or is not text (a number, a list, null) counts as `blank` (recommended: every error keeps its `error` code, and the field map lets a form show each message next to its field, which the note forms of AC-09 will need for several fields); 422 with one code for the whole answer, such as `{ "error": "name_taken" }`; 422 with the server's sentences, such as `{ "error": "validation_failed", "messages": ["Name has already been taken"] }`.
   - Answer: 422 `{ "error": "validation_failed", "fields": { "name": "<code>" } }`, one code per field: `blank`, `too_long`, or `taken`. A name that is missing or is not text counts as `blank`. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
2. What does a request answer when its body cannot be read as JSON?
   - Options: 400 `{ "error": "bad_request" }` (recommended: the request is malformed, which is not the same as a readable name that breaks a rule, and the body keeps the error convention); 422 `validation_failed` with `blank`, as if no name was sent.
   - Answer: 400 `{ "error": "bad_request" }`, and nothing changes. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
3. What does a rename or delete answer for another user's collection, or for one that does not exist?
   - Options: 404 `{ "error": "not_found" }` for both, so an answer never tells whether another user's collection exists (recommended: requirements.md 1 and 5); 403 `{ "error": "forbidden" }` for another user's collection and 404 for a missing one.
   - Answer: 404 `{ "error": "not_found" }` for both, and nothing changes. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
4. A request that changes data comes with no sign-in and no anti-forgery token. Which answer comes first?
   - Options: 401 `{ "error": "unauthenticated" }`, with or without a token (recommended: it tells the client to sign in whatever else is wrong, and without a sign-in nothing can change, so there is nothing for the token to protect; feature 05 also answers a logout by the sign-in state before the token); 403 `{ "error": "invalid_csrf_token" }` first.
   - Answer: 401 `{ "error": "unauthenticated" }` first, with or without a token. A signed-in request without this session's token gets 403. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
5. How are spaces in a name handled?
   - Options: spaces at the start and the end are removed, and each run of spaces, tabs, or line breaks inside the name becomes one space, before any rule is checked (recommended: a page shows "Work  notes" and "Work notes" the same way, so they must not become two collections); only the start and the end are trimmed; the name is kept exactly as typed.
   - Answer: the ends are trimmed, and each run of whitespace inside becomes one space, before any rule is checked. A name that is empty after that is blank. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
6. Does letter case make two names different?
   - Options: no: "Work" and "work" are the same name, in any alphabet ("Работа" and "работа"), and a name keeps the case it was typed with (recommended: two collections that differ only in case look like a duplicate in the list); yes: names are compared exactly.
   - Answer: no. Names that differ only in letter case are the same name, in any alphabet. A name keeps the case it was typed with, and a collection may be renamed to a change of case of its own name. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
7. How long can a name be?
   - Options: 1 to 100 characters, counted after spaces are handled (recommended: room for a descriptive name, still short enough for a sidebar); 1 to 50; 1 to 255.
   - Answer: 1 to 100 characters, counted after spaces are handled. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
8. In what order does the list show the collections?
   - Options: alphabetical by name, ignoring case (recommended: easy to scan, and a new or renamed collection lands where the user expects it); oldest first; newest first.
   - Answer: alphabetical by name, ignoring case. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
9. How does the UI create and rename a collection?
   - Options: in place, in the collections area: a "New collection" button opens a form at the top of the list, and "Rename" on a row turns that row into a form with the current name; each form has a "Collection name" field with the focus, a submit button ("Create" or "Save"), and "Cancel"; Enter submits and Escape cancels; one form or confirmation is open at a time (recommended: the change happens where the list is, without a dialog over the page); a dialog over the page for each; the browser's own prompt.
   - Answer: in place, as in the first option. "New collection" shows once the list has loaded. Opening a form or a confirmation closes the one that is open, without a request. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
10. How does the UI confirm a delete?
    - Options: the row turns into the question "Delete “<name>”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and only "Delete" sends the request (recommended: a delete cannot be undone, and the question names the collection where it is); a dialog over the page; the browser's own confirm box; no confirmation, with an Undo.
    - Answer: the row turns into the question "Delete “<name>”? This cannot be undone." with "Delete" and "Cancel". The focus moves to "Cancel". Escape cancels. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
11. Where is a name checked, and what does the UI say?
    - Options: only on the server; the UI shows the server's answer under the field: "Enter a name." (`blank`), "Use at most 100 characters." (`too_long`), "A collection with this name already exists." (`taken`) (recommended: one place holds the rules for spaces, case, and length, and requirements.md 4 asks for checks in the browser only for the note forms); in the browser first for an empty or too long name, then on the server.
    - Answer: only on the server, with those three messages under the field. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
12. What does the UI show when a collections request fails?
    - Options: the list cannot load: "Could not load collections. Try again." with a "Try again" button; a create, rename, or delete gets no answer or an error answer: "Could not create the collection. Try again." (or rename, or delete) as an alert, with the form or the confirmation still open and the typed name kept; a rename or delete of a collection that no longer exists (deleted in another tab) takes it off the list, and a rename also says "This collection no longer exists." (recommended: the same pattern as features 04 and 05, and a missing collection is not an error the user can fix by trying again); one general error message for every failure.
    - Answer: as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
13. What does the UI do when a collections request answers 401 (the sign-in ended: a logout in another tab, or 30 days without a visit)?
    - Options: it shows the sign-in screen, as after a logout (recommended: nothing in the main layout works without a sign-in, and feature 05 question 3 shows the sign-in screen with no message); an error message with a link to the sign-in screen.
    - Answer: it shows the sign-in screen, with no message. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)

## Scenarios

**My collections are listed in alphabetical order**
- Given I have the collections "Work", "books", and "Art"
- When the main layout shows
- Then the collections area lists "Art", "books", "Work", in alphabetical order ignoring case (question 8)

**I see only my own collections**
- Given another user has a collection "Secret"
- When my collections are listed
- Then "Secret" is not in my list (requirements.md 1)

**No collections yet**
- Given I have no collections
- When the main layout shows
- Then the collections area shows "No collections yet" ([conventions: Empty states](../../docs/conventions.md#ui)) and the "New collection" button

**Create a collection**
- Given I am on the main layout
- When I choose "New collection", type "Reading", and choose "Create"
- Then the create request answers 201 with the new collection's id and name
- Then "Reading" shows in the list in its alphabetical place, and the form closes

**Spaces in a name are tidied**
- Given I am creating a collection
- When I enter "  Book   notes  " and choose "Create"
- Then the collection is saved and listed as "Book notes" (question 5)

**A name I already use is refused**
- Given I have a collection "Work"
- When I create a collection named "work"
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "taken" } }`
- Then the form stays open with "work" in the field and shows "A collection with this name already exists." under it, and no collection is added (questions 1, 6, 11)

**An empty name is refused**
- Given I am creating a collection
- When I choose "Create" with an empty name, or a name of spaces only
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "blank" } }`, and the form shows "Enter a name." under the field (questions 1, 5, 11)

**A name longer than 100 characters is refused**
- Given I am creating a collection
- When I enter a name of 101 characters and choose "Create"
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "too_long" } }`, and the form shows "Use at most 100 characters." under the field (questions 1, 7, 11)

**Another user may use the same name**
- Given another user has a collection "Work"
- When I create a collection named "Work"
- Then it is created, and the create request answers 201 (requirements.md 3.2: unique per user)

**Rename a collection**
- Given I have the collections "Art" and "Work"
- When I choose "Rename" on "Work", change the name to "Agenda", and choose "Save"
- Then the rename request answers 200 with the collection's id and new name
- Then the list shows "Agenda" before "Art", and no longer "Work"

**A rename to a name I already use is refused**
- Given I have the collections "Home" and "Work"
- When I rename "Home" to "WORK"
- Then the rename request answers 422 `{ "error": "validation_failed", "fields": { "name": "taken" } }`, the form shows "A collection with this name already exists.", and "Home" keeps its name (questions 1, 6, 11)

**Change only the letter case**
- Given I have a collection "work"
- When I rename it to "Work"
- Then the rename request answers 200, and the list shows "Work" (question 6)

**Cancel a create or a rename**
- Given the create form, or the rename form of a collection, is open
- When I choose "Cancel" or press Escape
- Then the form closes, no request is sent, and the list is unchanged (question 9)

**Delete asks for confirmation**
- Given I have a collection "Work"
- When I choose "Delete" on "Work"
- Then the row shows "Delete “Work”? This cannot be undone." with "Delete" and "Cancel", and no request is sent yet (question 10)

**Confirm a delete**
- Given the row asks "Delete “Work”? This cannot be undone."
- When I choose "Delete"
- Then the delete request answers 204 with no body, and "Work" is no longer in the list, also after a reload

**Cancel a delete**
- Given the row asks "Delete “Work”? This cannot be undone."
- When I choose "Cancel" or press Escape
- Then no request is sent, and "Work" stays in the list (question 10)

**Another user's collection cannot be renamed or deleted**
- Given another user has a collection
- When I send a rename or a delete request for its id
- Then the request answers 404 `{ "error": "not_found" }`, and that collection is unchanged (question 3)

**The list cannot load**
- Given the server cannot be reached, or answers with an error
- When the collections area loads
- Then it shows "Could not load collections. Try again." as an alert, with a "Try again" button (question 12)

**Try again loads the list**
- Given the collections area shows "Could not load collections. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows while the list loads, and then my collections

**A change fails**
- Given I am creating, renaming, or deleting a collection
- When the server cannot be reached, or answers with an error other than 401, 404, or 422
- Then an alert says "Could not create the collection. Try again." (for a rename: "Could not rename the collection. Try again."; for a delete: "Could not delete the collection. Try again.")
- Then the form or the confirmation stays open, the typed name is kept, and the list is unchanged (question 12)

**Rename a collection that was deleted elsewhere**
- Given "Work" was deleted in another tab, and this tab still lists it
- When I rename "Work" here
- Then the rename request answers 404 `{ "error": "not_found" }`, "Work" leaves the list, and an alert says "This collection no longer exists." (question 12)

**Delete a collection that was deleted elsewhere**
- Given "Work" was deleted in another tab, and this tab still lists it
- When I delete "Work" here and confirm
- Then the delete request answers 404 `{ "error": "not_found" }`, and "Work" leaves the list with no error (question 12)

**The sign-in has ended**
- Given my sign-in ended (I logged out in another tab, or 30 days passed without a visit)
- When the collections area loads, or I create, rename, or delete a collection
- Then the request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen with no message (question 13)

## Edge cases

- No one signed in, including a session whose sign-in has ended (feature 05): the list, create, rename, and delete requests all answer 401 `{ "error": "unauthenticated" }`, with or without an anti-forgery token, and nothing changes (question 4).
- A create, rename, or delete without this session's anti-forgery token from `GET /api/csrf`, or with another session's token: 403 `{ "error": "invalid_csrf_token" }`, and nothing changes ([features/05_logout](../05_logout/spec.md), question 1). The list request needs no token.
- A rename or delete of a collection that does not exist (never existed, already deleted, or an id that is not a number): 404 `{ "error": "not_found" }` (question 3).
- A name that is missing, null, or not text (a number, a list, an object): 422 `{ "error": "validation_failed", "fields": { "name": "blank" } }` (question 1).
- A name of exactly 100 characters after spaces are handled is accepted. Spaces that are removed do not count (question 7).
- Names in any alphabet are compared ignoring case: "Работа" and "работа" are the same name, so the second answers 422 with `taken` (question 6).
- A rename to the collection's own current name is accepted (200) and changes nothing.
- Two requests that create the same name for one user at the same moment: one collection is created (201), and the other request answers 422 with `taken`.
- A body that cannot be read as JSON: 400 `{ "error": "bad_request" }`, and nothing changes (question 2).
- A name with markup, such as `<b>Work</b>` or a script tag, is saved as typed and shown as plain text. It never runs as markup (requirements.md 5).
- Loading: the collections area shows "Loading…" until the list arrives ([conventions: Loading](../../docs/conventions.md#ui)). "New collection" shows once the list has loaded (question 9).
- Busy: while a create, rename, or delete waits for the server, its button ("Create", "Save", or "Delete") is busy, and a second click sends no second request ([conventions: Busy button](../../docs/conventions.md#ui)).
- Validation state: the message shows under the name field, and the field is marked invalid (question 11).
- One form or confirmation is open at a time: opening another closes the open one without a request (question 9).
- Focus: a form that opens puts the focus in its name field, and a delete confirmation puts it on "Cancel" (questions 9, 10).
- UI states (requirements.md 4 `<ui_quality_checks>`): empty "No collections yet", loading "Loading…", validation messages under the field, and the error alerts of question 12.
- Deleting a collection removes only the collection here: notes do not exist yet. What a delete does to a collection's notes is AC-07 (feature 07).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
