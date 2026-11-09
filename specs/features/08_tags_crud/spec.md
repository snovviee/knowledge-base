# Feature: 08_tags_crud

**Stage:** Done
**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question)

## Acceptance criterion

> AC-08: A user can create, rename, and delete tags

Sources: requirements.md 1, 3.3, 4 (main layout: the left area; tag management UI; `<ui_quality_checks>`: the empty state for no tags), 5, 6, 7; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Loading, Busy button, Empty states); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 1 to 13: the API's error answers, the name rules, and how the collections area creates, renames, and deletes) and [features/05_logout/spec.md](../05_logout/spec.md) (question 1: the anti-forgery token for requests that change data), both not yet in `docs/`.

Not part of this feature: putting tags on notes and taking them off (AC-10, feature 10); what deleting a tag does to its notes, which requirements.md 3.3 settles (the notes stay, and only the tag leaves them) and AC-10 builds; notes themselves (AC-09); filtering notes by tag (AC-17); the left area on narrow screens (AC-25).

## Questions

Feature 06 answered, for collections, how the API answers errors (its questions 1 to 4), the name rules (5 to 8), and how the UI creates, renames, and deletes and shows failures (9 to 13). Tags use the same answers, with "tag" in place of "collection" in every label and message, because requirements.md 3.2 and 3.3 give collections and tags the same operations and a name that is unique per user. Each scenario and edge case below names the feature 06 question it comes from. The questions here are only what tags leave open.

1. Where in the main layout does the user manage tags (requirements.md 4: "Tag management UI")?
   - Options: in a "Tags" area in the left area, below the collections area, built the same way: the heading "Tags", a "New tag" button, and the list of tags with "Rename" and "Delete" on each row (recommended: requirements.md 4 puts the collections in the left area, and tags are the other way to organize notes, so both sit side by side and work alike; the empty state "No tags yet" is then in view on the main layout, and no dialog or extra page is needed); a "Manage tags" button in the header that opens a dialog over the page with the same list; a separate tags page, reached from the header.
   - Answer: in a "Tags" area in the left area, below the collections area, built the same way: the heading "Tags", a "New tag" button, and the list of tags with "Rename" and "Delete" on each row. The two areas load, and fail, on their own. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
2. Feature 06 keeps one form or confirmation open at a time in the collections area (its question 9). Now that tags sit next to collections, can a collection form and a tag form be open at the same time?
   - Options: yes: each area keeps one form or confirmation of its own, and opening one in an area leaves the other area as it is (recommended: the two areas are independent, and closing a form in the other area would throw away what the user typed there without a word); no: one form or confirmation in the whole left area, so opening a tag form closes an open collection form without a request.
   - Answer: yes. Each area keeps one form or confirmation of its own. Opening a form or a confirmation in one area leaves the other area's open form or confirmation as it is, with what was typed in it. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
3. Does a tag name have rules of its own, beyond the name rules feature 06 set for collections (its questions 5 to 7: spaces tidied, letter case ignored, 1 to 100 characters)?
   - Options: no: any characters, spaces inside the name included, so "machine learning", "C#", and "#work" are kept as typed, and "#work" and "work" are two different names (recommended: requirements.md 3.3 calls a tag a flexible label and sets no rule for its characters, and the same rules as collections keep one way of naming things across the app); one word only, with no spaces and no commas, like a hashtag; a "#" at the start is dropped, so "#work" and "work" are the same name.
   - Answer: no rules of their own. A tag name may hold any characters, spaces inside it included, and is kept as typed once its spaces are tidied. "#work" and "work" are two different names. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)

## Scenarios

**The tags area is in the left area**
- Given I am signed in
- When the main layout shows
- Then the left area shows the collections area and, below it, the tags area with the heading "Tags" (question 1)

**My tags are listed in alphabetical order**
- Given I have the tags "rails", "Books", and "art"
- When the main layout shows
- Then the tags area lists "art", "Books", "rails", in alphabetical order ignoring case (feature 06 question 8)

**I see only my own tags**
- Given another user has a tag "secret"
- When my tags are listed
- Then "secret" is not in my list (requirements.md 1)

**No tags yet**
- Given I have no tags
- When the main layout shows
- Then the tags area shows "No tags yet" ([conventions: Empty states](../../docs/conventions.md#ui); requirements.md 4: an empty state for no tags) and the "New tag" button

**Create a tag**
- Given I am on the main layout
- When I choose "New tag", type "reading", and choose "Create"
- Then the create request answers 201 with the new tag's id and name
- Then "reading" shows in the list in its alphabetical place, and the form closes

**Spaces in a name are tidied**
- Given I am creating a tag
- When I enter "  machine   learning  " and choose "Create"
- Then the tag is saved and listed as "machine learning" (feature 06 question 5)

**A name may hold any characters**
- Given I have no tags
- When I create the tags "C#", "#work", and "work"
- Then all three are created and listed as typed (question 3)

**A name I already use is refused**
- Given I have a tag "Work"
- When I create a tag named "work"
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "taken" } }`
- Then the form stays open with "work" in the field and shows "A tag with this name already exists." under it, and no tag is added (feature 06 questions 1, 6, 11)

**An empty name is refused**
- Given I am creating a tag
- When I choose "Create" with an empty name, or a name of spaces only
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "blank" } }`, and the form shows "Enter a name." under the field (feature 06 questions 1, 5, 11)

**A name longer than 100 characters is refused**
- Given I am creating a tag
- When I enter a name of 101 characters and choose "Create"
- Then the create request answers 422 `{ "error": "validation_failed", "fields": { "name": "too_long" } }`, and the form shows "Use at most 100 characters." under the field (feature 06 questions 1, 7, 11)

**Another user may use the same name**
- Given another user has a tag "work"
- When I create a tag named "work"
- Then it is created, and the create request answers 201 (requirements.md 3.3: unique per user)

**Rename a tag**
- Given I have the tags "art" and "work"
- When I choose "Rename" on "work", change the name to "agenda", and choose "Save"
- Then the rename request answers 200 with the tag's id and new name
- Then the list shows "agenda" before "art", and no longer "work"

**A rename to a name I already use is refused**
- Given I have the tags "home" and "work"
- When I rename "home" to "WORK"
- Then the rename request answers 422 `{ "error": "validation_failed", "fields": { "name": "taken" } }`, the form shows "A tag with this name already exists.", and "home" keeps its name (feature 06 questions 1, 6, 11)

**Change only the letter case**
- Given I have a tag "work"
- When I rename it to "Work"
- Then the rename request answers 200, and the list shows "Work" (feature 06 question 6)

**Cancel a create or a rename**
- Given the create form, or the rename form of a tag, is open
- When I choose "Cancel" or press Escape
- Then the form closes, no request is sent, and the list is unchanged (feature 06 question 9)

**A collection form and a tag form can be open at once**
- Given the form for a new collection is open, with "Reading" typed in it
- When I choose "New tag"
- Then the tag form opens with the focus in its "Tag name" field
- Then the collection form stays open with "Reading" in its field (question 2)

**Delete asks for confirmation**
- Given I have a tag "work"
- When I choose "Delete" on "work"
- Then the row shows "Delete “work”? This cannot be undone." with "Delete" and "Cancel", and no request is sent yet (feature 06 question 10)

**Confirm a delete**
- Given the row asks "Delete “work”? This cannot be undone."
- When I choose "Delete"
- Then the delete request answers 204 with no body, and "work" is no longer in the list, also after a reload

**Cancel a delete**
- Given the row asks "Delete “work”? This cannot be undone."
- When I choose "Cancel" or press Escape
- Then no request is sent, and "work" stays in the list (feature 06 question 10)

**Another user's tag cannot be renamed or deleted**
- Given another user has a tag
- When I send a rename or a delete request for its id
- Then the request answers 404 `{ "error": "not_found" }`, and that tag is unchanged (feature 06 question 3)

**The list cannot load**
- Given the server cannot be reached, or answers the tags request with an error
- When the tags area loads
- Then it shows "Could not load tags. Try again." as an alert, with a "Try again" button (feature 06 question 12)

**Try again loads the list**
- Given the tags area shows "Could not load tags. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows while the list loads, and then my tags

**A change fails**
- Given I am creating, renaming, or deleting a tag
- When the server cannot be reached, or answers with an error other than 401, 404, or 422
- Then an alert says "Could not create the tag. Try again." (for a rename: "Could not rename the tag. Try again."; for a delete: "Could not delete the tag. Try again.")
- Then the form or the confirmation stays open, the typed name is kept, and the list is unchanged (feature 06 question 12)

**Rename a tag that was deleted elsewhere**
- Given "art" was deleted in another tab, and this tab still lists it
- When I rename "art" here
- Then the rename request answers 404 `{ "error": "not_found" }`, "art" leaves the list, and an alert says "This tag no longer exists." (feature 06 question 12)

**Delete a tag that was deleted elsewhere**
- Given "art" was deleted in another tab, and this tab still lists it
- When I delete "art" here and confirm
- Then the delete request answers 404 `{ "error": "not_found" }`, and "art" leaves the list with no error (feature 06 question 12)

**The sign-in has ended**
- Given my sign-in ended (I logged out in another tab, or 30 days passed without a visit)
- When the tags area loads, or I create, rename, or delete a tag
- Then the request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen with no message (feature 06 question 13)

## Edge cases

- No one signed in, including a session whose sign-in has ended (feature 05): the list, create, rename, and delete requests all answer 401 `{ "error": "unauthenticated" }`, with or without an anti-forgery token, and nothing changes (feature 06 question 4).
- A create, rename, or delete without this session's anti-forgery token from `GET /api/csrf`, or with another session's token: 403 `{ "error": "invalid_csrf_token" }`, and nothing changes ([features/05_logout](../05_logout/spec.md), question 1). The list request needs no token.
- A rename or delete of a tag that does not exist (never existed, already deleted, or an id that is not a number): 404 `{ "error": "not_found" }` (feature 06 question 3).
- A name that is missing, null, or not text (a number, a list, an object): 422 `{ "error": "validation_failed", "fields": { "name": "blank" } }` (feature 06 question 1).
- A name of exactly 100 characters after spaces are handled is accepted. Spaces that are removed do not count (feature 06 question 7).
- Names in any alphabet are compared ignoring case: "Работа" and "работа" are the same name, so the second answers 422 with `taken` (feature 06 question 6).
- A name may hold any characters, such as "#", ",", or "/", and spaces inside it. It is kept as typed once its spaces are tidied, and "#work" and "work" are two names (question 3).
- A tag may have the same name as one of my collections: a tag name is unique among my tags only (requirements.md 3.3).
- A rename to the tag's own current name is accepted (200) and changes nothing.
- Two requests that create the same name for one user at the same moment: one tag is created (201), and the other request answers 422 with `taken`. Two renames of different tags to the same name at the same moment: one answers 200, and the other answers 422 with `taken` and keeps its tag's name.
- A body that cannot be read as JSON: 400 `{ "error": "bad_request" }`, and nothing changes (feature 06 question 2).
- A name with markup, such as `<b>work</b>` or a script tag, is saved as typed and shown as plain text. It never runs as markup (requirements.md 5).
- Loading: the tags area shows "Loading…" until its list arrives ([conventions: Loading](../../docs/conventions.md#ui)). "New tag" shows once the list has loaded (feature 06 question 9).
- The two areas load on their own: when the tags list cannot load, only the tags area shows its error, and the collections area works as before; the same the other way round (question 1).
- Busy: while a create, rename, or delete waits for the server, its button ("Create", "Save", or "Delete") is busy, and a second click sends no second request ([conventions: Busy button](../../docs/conventions.md#ui)).
- Validation state: the message shows under the name field, and the field is marked invalid (feature 06 question 11).
- One form or confirmation is open at a time in the tags area: opening another there closes the open one without a request (feature 06 question 9). An open form or confirmation in the collections area stays as it is (question 2).
- Focus: a form that opens puts the focus in its "Tag name" field, and a delete confirmation puts it on "Cancel" (feature 06 questions 9, 10).
- UI states (requirements.md 4 `<ui_quality_checks>`): empty "No tags yet", loading "Loading…", validation messages under the field, and the error alerts of "The list cannot load" and "A change fails".
- Deleting a tag removes only the tag here: notes do not exist yet. What a delete does to the tag's notes is AC-10 (feature 10).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
