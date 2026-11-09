# Feature: 09_notes_crud

**Stage:** Done
**Approved:** yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question)

## Acceptance criterion

> AC-09: A user can create, edit, archive, restore, and delete notes

Sources: requirements.md 1, 3.4, 4 (main layout: the main area for notes; notes view; note create/edit UI; note detail view; `<ui_quality_checks>`), 5, 6, 7, 11; [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body); [docs/conventions.md](../../docs/conventions.md) (UI: Loading, Busy button, Empty states); [features/06_collections_crud/spec.md](../06_collections_crud/spec.md) (questions 1 to 4: the API's error answers; 5: spaces in a name; 8: alphabetical order; 9 to 13: changes in place, the delete confirmation, the messages, failures, and an ended sign-in), [features/08_tags_crud/spec.md](../08_tags_crud/spec.md) (question 1: each area of the main layout loads and fails on its own), and [features/05_logout/spec.md](../05_logout/spec.md) (question 1: the anti-forgery token for requests that change data), none of them in `docs/` yet.

Not part of this feature: tags on notes (AC-10, feature 10); moving a note to another collection (AC-11, feature 11); the review interval, its custom number of days, and the next and last review dates (AC-12 to AC-14, features 12 to 14), with the "mark as reviewed" action (AC-13) and the review state in the list (AC-15, AC-16); search and filters, including the notes of one chosen collection (AC-17, feature 17); review reminders, and that archived notes get none (AC-18 to AC-20); what deleting a collection does to its notes (AC-07, feature 07), beyond question 15, which keeps the notes safe until then; the notes area on narrow screens (AC-25); sample data (requirements.md 6).

## Questions

Feature 06 answered, for collections, how the API answers errors (its questions 1 to 4) and how the UI shows loading, failures, a record deleted elsewhere, and an ended sign-in (its questions 12 and 13). Notes use the same answers, with "note" in place of "collection" in every message. Each scenario and edge case below names the question it comes from. The questions here are what notes leave open.

1. How does the notes area show the list, a note's detail, and the note form (requirements.md 4: the form may be a modal, a drawer, or a separate page; the detail may be a view or a section)?
   - Options: one view at a time, in place, in the notes area: the list; a note's detail in place of the list, opened by choosing the note's title, with "Back to notes"; the create form in place of the list, opened by "New note"; the edit form in place of the detail, opened by "Edit". After "Create" the new note's detail shows, and after "Save" the note's detail shows with its new values. "Cancel" goes back to the view the form came from. The address does not change, so a reload, or the browser's Back button, does not return to a note (recommended: feature 06 changes things in place without a dialog (its question 9), one view at a time also works on a narrow screen (AC-25), and no new pages or addresses are needed); a dialog over the page for the create and edit forms, and the detail in a panel beside the list; separate pages with their own addresses, such as `/notes/12`.
   - Answer: one view at a time, in place, in the notes area, as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
2. In what order does the list show the notes?
   - Options: newest first, by the date the note was created; editing, archiving, or restoring a note does not move it (recommended: a new note shows at the top, where the user looks for it, and the list does not jump while the user works through it); most recently updated first; alphabetical by title.
   - Answer: newest first, by the date the note was created. Editing, archiving, or restoring a note does not move it. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
3. How are spaces handled in a note's fields?
   - Options: in the title, the ends are trimmed and each run of whitespace inside becomes one space, as in a name (feature 06 question 5); the body is kept exactly as typed, line breaks included; the source URL's ends are trimmed, and a source URL that is empty after that means the note has none; a title or a body that is empty after that, or holds only spaces and line breaks, is empty (recommended: a title is one line, like a name, while line breaks in the body carry meaning in plain-text and Markdown-style notes, requirements.md 11); every field kept exactly as typed, with only the emptiness check ignoring spaces; the ends of every field trimmed.
   - Answer: as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
4. How long can the fields be?
   - Options: a title of 1 to 200 characters, a body of 1 to 100,000 characters, and a source URL of at most 2,000 characters, each counted after its spaces are handled (recommended: a title fits on one line of the list, a body has room for a long article, and 2,000 characters hold any link that browsers handle well; a limit keeps one request from storing unbounded text, requirements.md 5); a title of at most 100 characters, like a name, and a body of at most 10,000; no limits beyond "not empty".
   - Answer: a title of 1 to 200 characters, a body of 1 to 100,000 characters, and a source URL of at most 2,000 characters, each counted after its spaces are handled. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
5. What counts as a valid source URL (requirements.md 3.4: "must be a valid URL")?
   - Options: a web address: it starts with `http://` or `https://` (in any letter case), a host name follows, and it has no spaces; the detail shows it as a link that opens in a new tab (recommended: a source is a page to go back to, and other kinds of address, such as `javascript:` or `data:`, are not safe to open as a link); any address with a scheme, such as `mailto:` or `ftp:`, shown as plain text; an address without a scheme, such as `example.com`, accepted with `https://` put in front.
   - Answer: a web address, as in the first option, shown in the detail as a link that opens in a new tab. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
6. When does the note form check its fields in the browser (requirements.md 4: "Client-side validation feedback for note create/edit forms")?
   - Options: when the user chooses "Create" or "Save": each field that breaks a rule shows its message under it and is marked invalid, the focus moves to the first such field, and nothing is sent; the fields are checked again at the next "Create" or "Save"; the server checks the same rules again, and its 422 answer shows the same messages under the same fields (recommended: the user sees every problem at once, nothing is flagged while it is still being typed, and the server stays the final check); as the user types or leaves each field, and again on submit; only on the server, as for names (feature 06 question 11).
   - Answer: when the user chooses "Create" or "Save", as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
7. What do the messages under the fields say?
   - Options: title: "Enter a title." (empty) and "Use at most 200 characters." (too long); body: "Enter a body." (empty) and "Use at most 100,000 characters." (too long); source URL: "Enter a URL that starts with http:// or https://." (not a web address) and "Use at most 2,000 characters." (too long); collection: "Choose a collection." (none chosen) and "This collection no longer exists. Choose another." (not one of the user's collections, for example deleted in another tab) (recommended: the style of feature 06 question 11, which says what to do); one message for the whole form, "Check the highlighted fields."
   - Answer: the messages of the first option, each under its field. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
8. What does the API answer when note fields break a rule?
   - Options: 422 `{ "error": "validation_failed", "fields": { "<field>": "<code>", ... } }`, naming every field that breaks a rule, one code each, as in feature 06 question 1: `title` and `body`: `blank` or `too_long`; `source_url`: `invalid` or `too_long`; `collection_id`: `blank` (none given) or `not_found` (not one of the user's collections: another user's, a deleted one, or a value that is not a whole number, all with the same answer, so it never tells whether another user's collection exists, as in feature 06 question 3); `status`: `invalid`. A title or a body that is missing, null, or not text counts as `blank`; a source URL that is null counts as none, and one that is not text as `invalid` (recommended: the field map lets the form show each message next to its field, which is why feature 06 chose it); 404 `{ "error": "not_found" }` for a collection that is not the user's, and 422 for the rest.
   - Answer: 422 with every field that breaks a rule and one code each, as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
9. An edit request sends only some of the fields. What happens to the others?
   - Options: they stay as they are: only the fields the request sends change, so an archive or a restore sends only the status (recommended: the usual meaning of an edit request, and two tabs that change different fields of a note do not undo each other); every edit must send the title, the body, and the source URL, and a missing one counts as empty.
   - Answer: they stay as they are. Only the fields the request sends change. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
10. Which collection does a new note go into?
    - Options: the one the user chooses in the form: the "Collection" field lists the user's collections in alphabetical order (feature 06 question 8) and starts with none chosen, and "Create" with none chosen shows "Choose a collection." (recommended: requirements.md 3.4 puts every note in one collection, and the note goes only where the user puts it); the first collection in alphabetical order, chosen in advance; a default collection, such as "Uncategorized", created when needed (that would decide part of AC-07, feature 07).
    - Answer: the one the user chooses in the form, as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
11. What does "New note" show when the user has no collections?
    - Options: the form says "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields, so nothing is typed in vain (recommended: requirements.md 3.4 puts every note in a collection, and the user learns it before typing); the form opens with all its fields, and "Create" shows "Choose a collection."; "New note" is hidden while the user has no collections.
    - Answer: the form says "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
12. Where are "Archive", "Restore", and "Delete", and which of them ask first?
    - Options: in the note's detail, next to "Edit": "Archive" for an active note, "Restore" for an archived one, and "Delete". "Archive" and "Restore" act at once, because each undoes the other. "Delete" turns the actions into the question "Delete “<title>”? This cannot be undone." with "Delete" and "Cancel", the focus on "Cancel", and Escape cancels, as in feature 06 question 10 (recommended: the list stays easy to scan, and only a delete cannot be undone); on each entry of the list as well as in the detail; "Archive" asks for confirmation too.
    - Answer: in the note's detail, as in the first option. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
13. Does Escape close the note form, as it closes the collection and tag forms (feature 06 question 9)?
    - Options: no: only "Cancel" closes the note form, so a stray key never throws away a long body; Escape still cancels a delete confirmation (recommended: a note holds far more typing than a name); yes, as in the collection form.
    - Answer: no. Only "Cancel" closes the note form. Escape still cancels a delete confirmation. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
14. Two tabs save changes to the same note. What happens?
    - Options: the later save wins, with no warning, and each save changes only the fields it sends (question 9) (recommended: one person uses the app, so two tabs on one note are rare, and a warning would need a conflict screen); the later save is refused with 409 when the note changed after it was opened, and the user reloads.
    - Answer: the later save wins, with no warning. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)
15. Feature 07 decides what deleting a collection does to its notes (AC-07, requirements.md 3.2). Until then, what happens when the user deletes a collection that has notes?
    - Options: the delete is refused with 409 `{ "error": "collection_not_empty" }`: the collection and its notes stay, and the collections area shows its failure alert "Could not delete the collection. Try again." with the confirmation still open; a collection with no notes is deleted as before (recommended: no note is lost or left without a collection, and feature 07 can then choose any of the three approaches of requirements.md 3.2, with its own message); the notes are deleted with the collection; the notes move to a default collection.
    - Answer: the delete is refused with 409 `{ "error": "collection_not_empty" }`, as in the first option, until feature 07 decides. (Recommended option, taken under the owner's standing instruction of 2026-11-05.)

## Scenarios

**My notes are listed, newest first**
- Given I created the notes "First", "Second", and "Third", in that order, "First" in the collection "Work" and the others in "Books"
- When the main layout shows
- Then the notes area lists "Third", "Second", "First", each with the name of its collection (question 2)

**I see only my own notes**
- Given another user has a note "Secret plan"
- When my notes are listed
- Then "Secret plan" is not in my list (requirements.md 1)

**No notes yet**
- Given I have no notes
- When the main layout shows
- Then the notes area shows "No notes yet" ([conventions: Empty states](../../docs/conventions.md#ui)) and the "New note" button

**An archived note is marked in the list**
- Given I have the active note "Fresh idea" and the archived note "Old idea"
- When my notes are listed
- Then both are listed, "Old idea" shows "Archived", and "Fresh idea" shows no status (requirements.md 4: the list shows the archived status)

**The list cannot load**
- Given the server cannot be reached, or answers the notes request with an error
- When the notes area loads
- Then it shows "Could not load notes. Try again." as an alert, with a "Try again" button, and the collections and tags areas work as before (feature 06 question 12, feature 08 question 1)

**Try again loads the list**
- Given the notes area shows "Could not load notes. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows while the list loads, and then my notes

**The new-note form**
- Given I have the collections "Work" and "Books"
- When I choose "New note"
- Then the form "New note" shows in place of the list: "Loading…" until my collections arrive, then the fields "Title" (with the focus), "Body", "Source URL (optional)", and "Collection", which lists "Books" and "Work" with none chosen, and the buttons "Create" and "Cancel" (questions 1, 10)

**Create a note**
- Given the new-note form is open
- When I enter the title "Rails tips", the body "Use bin/rails.", and the source URL "https://guides.rubyonrails.org", choose the collection "Work", and choose "Create"
- Then the create request answers 201 with the new note: its id, title, body, source URL, collection, the status `active`, and its created and updated dates
- Then the new note's detail shows, and the list, when I go back to it, has "Rails tips" at the top (questions 1, 2)

**Spaces in a title are tidied, and the body keeps its line breaks**
- Given the new-note form is open
- When I create a note with the title "  Rails   tips  " and a body of two lines
- Then the note is saved with the title "Rails tips", and its detail shows the body on two lines (question 3)

**The form checks the fields before sending**
- Given the new-note form is open
- When I choose "Create" with the title empty, a body of spaces only, the source URL "example.com", and no collection chosen
- Then no request is sent
- Then "Enter a title." shows under "Title", "Enter a body." under "Body", "Enter a URL that starts with http:// or https://." under "Source URL (optional)", and "Choose a collection." under "Collection"; each of these fields is marked invalid, and the focus moves to "Title" (questions 5 to 7, 10)

**Values that are too long are refused**
- Given the new-note form is open
- When I enter a title of 201 characters, a body of 100,001 characters, or a source URL of 2,001 characters, and choose "Create"
- Then no request is sent, and the field shows "Use at most 200 characters.", "Use at most 100,000 characters.", or "Use at most 2,000 characters." (questions 4, 7)

**The server refuses a field**
- Given the new-note form is open, and its fields pass the browser's checks
- When the create request answers 422 `{ "error": "validation_failed", "fields": { "collection_id": "not_found" } }`, because the chosen collection was deleted in another tab
- Then the form stays open with what I typed, and "This collection no longer exists. Choose another." shows under "Collection"; any other field the answer names shows its message the same way (questions 6 to 8)

**A source URL must be a web address**
- Given I am signed in
- When a create request sends the source URL "javascript:alert(1)", "ftp://example.com/file", "example.com", or "https://exa mple.com"
- Then it answers 422 `{ "error": "validation_failed", "fields": { "source_url": "invalid" } }`, and no note is created (questions 5, 8)

**A new note goes only into one of my collections**
- Given another user has the collection "Secret"
- When I send a create request with that collection's id
- Then it answers 422 `{ "error": "validation_failed", "fields": { "collection_id": "not_found" } }`, the same answer as for a collection that does not exist, and no note is created (question 8)

**I have no collections yet**
- Given I have no collections
- When I choose "New note"
- Then the form says "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields (question 11)

**The form's collections cannot load**
- Given the server cannot be reached, or answers the collections request with an error
- When I choose "New note"
- Then the form shows "Could not load collections. Try again." as an alert, with "Try again" and "Cancel" (feature 06 question 12)

**Try again loads the form's collections**
- Given the new-note form shows "Could not load collections. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows while my collections load, and then the form's fields

**Cancel a create**
- Given the new-note form is open with a title typed
- When I choose "Cancel"
- Then the list shows again, unchanged, and no create request is sent (question 1)

**Escape does not close the note form**
- Given the new-note form, or the edit form, is open with text typed
- When I press Escape
- Then the form stays open with what I typed (question 13)

**Open a note**
- Given I have the note "Rails tips" in "Work", with a body of two lines and a source URL
- When I choose "Rails tips" in the list
- Then "Loading…" shows, and then its detail in place of the list: the title (with the focus), the collection "Work", the source URL as a link that opens in a new tab, the body as plain text on two lines, and the buttons "Back to notes", "Edit", "Archive", and "Delete" (questions 1, 5, 12)

**Back to notes**
- Given a note's detail is open
- When I choose "Back to notes"
- Then the list shows again (question 1)

**The note cannot load**
- Given the server cannot be reached, or answers the note request with an error
- When I open a note
- Then the notes area shows "Could not load the note. Try again." as an alert, with "Try again" and "Back to notes" (feature 06 question 12)

**Try again loads the note**
- Given the notes area shows "Could not load the note. Try again."
- When I choose "Try again" and the server answers
- Then "Loading…" shows while the note loads, and then its detail

**Open a note that was deleted elsewhere**
- Given "Rails tips" was deleted in another tab, and this tab still lists it
- When I open it here
- Then the note request answers 404 `{ "error": "not_found" }`, the list shows again without "Rails tips", and an alert says "This note no longer exists." (feature 06 question 12)

**The edit form**
- Given the detail of "Rails tips" is open
- When I choose "Edit"
- Then the form "Edit note" shows in place of the detail, with the note's title (with the focus), body, and source URL, no collection field (moving a note is AC-11), and the buttons "Save" and "Cancel" (question 1)

**Save an edit**
- Given the edit form of "Rails tips" is open
- When I change the title to "Rails guides" and change the body, and choose "Save"
- Then the edit request answers 200 with the note and its new values
- Then the detail shows the new values, and the list shows "Rails guides" in the place of "Rails tips" (questions 1, 2)

**Remove a source URL**
- Given the edit form of a note with a source URL is open
- When I empty "Source URL (optional)" and choose "Save"
- Then the note has no source URL (the answer's `source_url` is null), and the detail shows no source URL (question 3)

**An edit is checked like a create**
- Given the edit form is open
- When I empty the title and choose "Save"
- Then no request is sent, "Enter a title." shows under "Title", and the note is unchanged; a 422 answer shows its messages as in "The server refuses a field" (questions 6, 7)

**Cancel an edit**
- Given the edit form is open with changes typed
- When I choose "Cancel"
- Then the detail shows again with the note unchanged, and no edit request is sent (question 1)

**Archive a note**
- Given the detail of the active note "Rails tips" is open
- When I choose "Archive"
- Then nothing asks first, and the archive request answers 200 with the note and the status `archived`
- Then the detail shows "Archived" and "Restore" in place of "Archive", and the list shows "Archived" on "Rails tips" (question 12)

**Restore a note**
- Given the detail of the archived note "Old idea" is open
- When I choose "Restore"
- Then the restore request answers 200 with the note and the status `active`
- Then the detail no longer shows "Archived" and shows "Archive" in place of "Restore", and the list no longer shows "Archived" on "Old idea" (question 12)

**Delete asks for confirmation**
- Given the detail of "Rails tips" is open
- When I choose "Delete"
- Then the actions turn into "Delete “Rails tips”? This cannot be undone." with "Delete" and "Cancel", the focus is on "Cancel", and no request is sent yet (question 12)

**Confirm a delete**
- Given the detail asks "Delete “Rails tips”? This cannot be undone."
- When I choose "Delete"
- Then the delete request answers 204 with no body, and the list shows again without "Rails tips", also after a reload

**Cancel a delete**
- Given the detail asks "Delete “Rails tips”? This cannot be undone."
- When I choose "Cancel" or press Escape
- Then no request is sent, and the detail shows its actions again (question 12)

**A change fails**
- Given I am creating, saving, archiving, restoring, or deleting a note
- When the server cannot be reached, or answers with an error other than 401, 404, or 422
- Then an alert says "Could not create the note. Try again." (for a save: "Could not save the note. Try again."; for an archive: "Could not archive the note. Try again."; for a restore: "Could not restore the note. Try again."; for a delete: "Could not delete the note. Try again.")
- Then the form, the detail, or the confirmation stays as it was, with what I typed (feature 06 question 12)

**Change a note that was deleted elsewhere**
- Given "Rails tips" was deleted in another tab, and its detail or its edit form is still open here
- When I save, archive, or restore it
- Then the request answers 404 `{ "error": "not_found" }`, the list shows again without "Rails tips", and an alert says "This note no longer exists." (feature 06 question 12)

**Delete a note that was deleted elsewhere**
- Given "Rails tips" was deleted in another tab, and its detail is still open here
- When I delete it here and confirm
- Then the delete request answers 404 `{ "error": "not_found" }`, and the list shows again without "Rails tips", with no error (feature 06 question 12)

**Another user's note cannot be read, changed, or deleted**
- Given another user has a note
- When I send a read, edit, archive, restore, or delete request for its id
- Then the request answers 404 `{ "error": "not_found" }`, and that note is unchanged (feature 06 question 3)

**The sign-in has ended**
- Given my sign-in ended (I logged out in another tab, or 30 days passed without a visit)
- When the notes area loads, the new-note form loads my collections, or I open, create, save, archive, restore, or delete a note
- Then the request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen with no message (feature 06 question 13)

**A renamed collection shows its new name on its notes**
- Given the note "Rails tips" is in "Work", and the list or the note's detail shows
- When I rename "Work" to "Job" in the collections area
- Then the list, or the detail, shows "Job" for "Rails tips", without a reload

**A collection that has notes is not deleted yet**
- Given my collection "Work" has the note "Rails tips"
- When I delete "Work" in the collections area and confirm
- Then the delete request answers 409 `{ "error": "collection_not_empty" }`, "Work" stays in the list, the confirmation stays open with "Could not delete the collection. Try again.", and "Rails tips" is unchanged (question 15)

## Edge cases

- No one signed in, including a session whose sign-in has ended (feature 05): every notes request (the list, a read, a create, an edit, an archive, a restore, a delete) answers 401 `{ "error": "unauthenticated" }`, with or without an anti-forgery token, and nothing changes (feature 06 question 4).
- A create, edit, archive, restore, or delete without this session's anti-forgery token from `GET /api/csrf`, or with another session's token: 403 `{ "error": "invalid_csrf_token" }`, and nothing changes ([features/05_logout](../05_logout/spec.md), question 1). The list and a read need no token.
- A read, edit, archive, restore, or delete of a note that is not mine or does not exist (another user's, already deleted, or an id that is not a number): 404 `{ "error": "not_found" }`, and nothing changes (feature 06 question 3).
- A body that cannot be read as JSON: 400 `{ "error": "bad_request" }`, and nothing changes (feature 06 question 2).
- Every field that breaks a rule is named in the same 422 answer, one code each, for example `{ "error": "validation_failed", "fields": { "title": "blank", "source_url": "invalid" } }` (question 8).
- A title or a body that is missing, null, or not text (a number, a list, an object): 422 with `blank`. In an edit, a field that is not sent stays as it is (questions 8, 9).
- A source URL that is missing (in a create), null, empty, or spaces only: the note has no source URL. One that is not text (a number, a list, an object): 422 with `invalid` (questions 3, 8).
- A collection that is missing or null in a create: 422 `{ "fields": { "collection_id": "blank" } }`. Another user's, a deleted one, or a value that is not a whole number: 422 with `not_found` (question 8).
- A status other than `active` or `archived` in an edit: 422 `{ "error": "validation_failed", "fields": { "status": "invalid" } }` (question 8).
- A new note is always active: a status sent with a create is ignored. A note always belongs to the signed-in user: a user id sent with a request is ignored. Any other field a request sends is ignored, including a collection in an edit (moving a note is AC-11).
- A title of exactly 200 characters, a body of exactly 100,000 characters, and a source URL of exactly 2,000 characters are accepted. Spaces that are removed do not count (question 4).
- A source URL in any letter case of `http://` or `https://`, such as `HTTPS://Example.com/Page`, is accepted and kept as typed (question 5).
- Archiving an archived note, or restoring an active one, answers 200 and changes nothing.
- An archived note can be edited and deleted, and an edit keeps it archived (requirements.md 3.4 sets no rule against it).
- Two notes may have the same title (requirements.md 3.4 sets no rule against it).
- Two tabs save the same note: the later save wins, with no warning (question 14).
- A note created in a collection at the same moment as that collection is deleted: either the note is created and the delete answers 409 `{ "error": "collection_not_empty" }`, or the delete answers 204 and the create answers 422 with `collection_id` `not_found`. No note is left without a collection (question 15).
- A collection with no notes is deleted as before (feature 06), with 204.
- A title, a body, or a source URL with markup, such as `<b>bold</b>` or a script tag, is saved as typed and shown as plain text. It never runs as markup. Markdown in a body is shown as typed, not formatted (requirements.md 5, 11).
- The detail shows no created or updated date: requirements.md 4 does not list them for the detail. The API sends both, in UTC (requirements.md 3.4).
- Loading: the notes area shows "Loading…" until its list arrives, and "New note" shows once the list has loaded; the detail shows "Loading…" until the note arrives; the new-note form shows "Loading…" until my collections arrive ([conventions: Loading](../../docs/conventions.md#ui)).
- The notes area loads on its own: when its list cannot load, the collections and tags areas work as before, and the other way round (feature 08 question 1).
- Busy: while a create, save, archive, restore, or delete waits for the server, its button ("Create", "Save", "Archive", "Restore", or "Delete") is busy, and a second click sends no second request ([conventions: Busy button](../../docs/conventions.md#ui)).
- Validation state: each message shows under its field, and the field is marked invalid (question 6).
- Focus: a form puts the focus in "Title", and after a failed check on the first field with a message; an opened detail puts it on the note's title; a delete confirmation puts it on "Cancel" (questions 1, 6, 12).
- The new-note form's list of collections is the one loaded when the form opened. A collection created or renamed in the collections area while the form is open shows there the next time the form opens.
- A change made in another tab shows in this tab's list after a reload. A note's detail is loaded each time it opens, so it shows the note as the server has it.
- All my notes show in one list. There is no paging.
- The address does not change between the list, a detail, and a form: a reload shows the list (question 1).
- UI states (requirements.md 4 `<ui_quality_checks>`): empty "No notes yet", loading "Loading…", the validation messages under the fields, and the failure alerts of "The list cannot load", "The form's collections cannot load", "The note cannot load", and "A change fails".

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
