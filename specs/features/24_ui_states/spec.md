# Feature: 24_ui_states

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-24: The UI includes empty states, loading state, validation feedback, and visible error handling

Sources: requirements.md 4 (`<ui_quality_checks>`: consistent spacing and typography across major screens; visible hover states; visible focus states for keyboard navigation; clear empty states for no collections, no notes, no tags, no search results, and no review reminders; at least one visible loading state; client-side validation feedback for the note create/edit forms; basic error handling visible in the UI; light theme only), 7 (basic error handling visible in the UI); [docs/conventions.md](../../docs/conventions.md#ui) (UI: what features 01 to 10 built: Loading, Sign-in error, Busy button, Empty states, Loading inside an area, Load error with Try again, Validation messages, Change failures, A refused delete, A record that is gone, Sign-in ended, Logout, Server error on page load, The notes area, Browser checks on submit, Note failures, The Tags group in the note form, A chosen tag that no longer exists, Focus); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 6, 11: when the note form checks its fields; a new note with no collection), [features/11_note_move/spec.md](../11_note_move/spec.md) (question 3: the "Collection" field's states), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (questions 13, 18: the review fields and their messages), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 6: "Mark as reviewed" and its messages), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 5, 7), [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (question 3), [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (questions 11, 14: no results, the list's states under the search and filters), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (questions 6, 8: "No review reminders", the panel's loading and offline states), [features/22_websocket_auth/spec.md](../22_websocket_auth/spec.md) (question 3: a refused connection shows the sign-in screen), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (questions 4, 5: "Dismiss"), not yet in `docs/`.

Not part of this feature: the wording of each state, which the feature that built it defines (features 01 to 23) and which this feature checks as it is; narrow screens (AC-25, feature 25).

## Questions

1. Does AC-24 check every item of requirements.md 4 `<ui_quality_checks>`, or only the four states its AC line names?
   - Options: every item, hover, focus, spacing and typography, and light theme only included (recommended: no other AC covers the rest); only empty states, loading, validation feedback, and error handling.
   - Answer: every item: consistent spacing and typography across the major screens, visible hover states, visible focus states, the five empty states, a loading state, client-side validation feedback in the note forms, visible error handling, and light theme only. They are checked across the whole app, as features 01 to 23 built it. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What shows when a screen fails to draw?
   - Options: a page-level alert with a reload button (recommended); other options: TBD (the research names none).
   - Answer: in place of the whole page, the alert "Something went wrong. Reload the page." (`role="alert"`) with the button "Reload page". Nothing else of the page shows. "Reload page" reloads the page, which checks the session again. A failed request never brings this alert: it keeps its own message in its own place. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. Some interactive elements show no hover state today: the sign-in buttons, the "Try again" of the session error, and the name fields of the collections and tags forms. requirements.md 4 asks for visible hover states for interactive elements. How is this handled?
   - Options: AC-24 gives each of them a visible hover state, and checks hover and focus on every interactive element (recommended, from the research's plan); other options: TBD (the research names none).
   - Answer: AC-24 gives each of them a visible hover state, and checks hover and focus on every interactive element (question 5). On 2026-11-09 the fields of the note forms showed no hover state either, so they get one too. The elements that features 11 to 23 add are checked the same way: the edit form's "Collection" field (11), the review fields (12), "Mark as reviewed" (13), the filter bar's controls and "Clear search and filters" (15 to 17), and "Open" and "Dismiss" in the reminders panel (20, 23). Feature 25 is built after this one, and its bar's buttons follow these rules as part of feature 25. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. How is "consistent spacing and typography across major screens" checked?
   - Options: TBD (the research names no check).
   - Answer: by comparing elements of the same kind on the major screens: the sign-in screen, the main layout with the notes list, a note's detail, the new-note form, and the edit form, at 1280 × 800 px, together with the full-page loading and server-error screens. Each kind has one look wherever it shows:
     - one font family on every screen;
     - the area headings ("Collections", "Tags", "Review reminders", and "Notes"): one size and weight;
     - the headings of the notes area's views (a note's title in its detail, "New note", and "Edit note"): one size and weight, larger than the area headings;
     - field labels, in every form and in the filter bar: one size, weight, and color;
     - the messages under fields: one size and color;
     - in the main layout, the text of list entries, of a detail's fields, of empty states, of "Loading…" lines, and of alerts: one size. Empty states and "Loading…" lines have one gray, and alerts one red;
     - buttons: each button of the main layout is of one kind, and each kind has one font size, padding, and corner rounding wherever it shows: filled (such as "Create", "Save", "Try again", and the "Delete" that confirms a delete), outlined (such as "Edit", "Archive", "Delete" in a note's detail, "Cancel", and "Log out"), plain (such as "New collection", "New tag", "New note", and "Back to notes"), and small row actions ("Rename" and "Delete" in the collections and tags lists). Filled buttons are dark, or red for a delete;
     - the full-page screens (loading, server error, and sign-in): their text and their buttons have one look among themselves, which may be larger than in the main layout;
     - spacing: the header, each section of the left area, the reminders panel, and the notes area have the same inner side padding.
     (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
5. Which elements count as interactive, and what counts as a visible hover or focus state? (a question the agent added)
   - Options: every element the user can choose with the pointer or reach with Tab, with a change of look on hover and a ring or outline on focus (recommended: it gives questions 1 and 3 a list to walk, and it matches what features 06 to 10 built); only buttons and links.
   - Answer: an interactive element is every button, link, text field, text area, drop-down list, date field, number field, and checkbox: every element the user can choose with the pointer or reach with Tab. A hover state is a change of background, border, text color, or underline while the pointer is over the element. A focus state is a ring or outline around the element that shows while it has the keyboard focus, and that it does not show without the focus. Whether it also shows after a click is free. Elements that only the app moves the focus to are not interactive and need no ring: a note's title when its detail opens (feature 09), the "Tags" group after a refusal (feature 10), and the heading "Review reminders" after a dismissal (feature 23). A disabled element needs no hover state: a busy button, "Open" while a note form is open (feature 20), and "Dismiss" while the panel is offline (feature 23). (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above. Each scenario holds for every screen and area it names, at 1280 × 800 px unless it says otherwise.

**No collections**
- Given I have no collections
- When the main layout shows
- Then the collections area shows "No collections yet" ([conventions: Empty states](../../docs/conventions.md#ui); requirements.md 4)

**No tags**
- Given I have one collection and no tags
- When the main layout shows, and I open the new-note form
- Then the tags area shows "No tags yet", and so does the form's "Tags" group ([conventions: Empty states, The Tags group in the note form](../../docs/conventions.md#ui); requirements.md 4)

**No notes**
- Given I have no notes, "Search" is empty, and every filter shows "All"
- When the main layout shows
- Then the notes area shows "No notes yet" and "New note" ([conventions: Empty states, The notes area](../../docs/conventions.md#ui); feature 17 question 11; requirements.md 4)

**No collection for a new note**
- Given I have no collections
- When I choose "New note"
- Then the form shows "Create a collection first. Every note belongs to a collection." with only "Cancel", and no fields (feature 09 question 11)

**No search results**
- Given no note of mine contains "zzz"
- When I type "zzz" in "Search"
- Then the list shows "No notes match your search and filters." with the button "Clear search and filters" (feature 17 question 11; requirements.md 3.6, 4)

**No notes for a review choice**
- Given "Search" is empty, every other filter shows "All", and no note of mine matches the choice
- When I choose "Due today", "Overdue", "Next 7 days", or "No review scheduled" in "Review"
- Then the list shows "No notes are due for review today.", "No notes are overdue for review.", "No notes are due for review in the next 7 days.", or "Every note has a review schedule.", with no "Clear search and filters" (feature 15 question 5; feature 16 question 3; feature 17 question 11)

**No review reminders**
- Given no note of mine is due today or overdue
- When the first batch arrives
- Then the panel "Review reminders" shows "No review reminders" (feature 20 question 6; requirements.md 4)

**Loading while the session is checked**
- Given the server has not answered the session check yet
- When the page opens
- Then it shows "Loading…" as a status (`role="status"`), and neither the sign-in screen nor the main layout ([conventions: Loading](../../docs/conventions.md#ui); requirements.md 4)

**Loading inside an area**
- Given the server has not answered the collections, the tags, or the notes request yet
- When the main layout shows
- Then each waiting area shows "Loading…" as a status in its own place, and the other areas work ([conventions: Loading inside an area](../../docs/conventions.md#ui))

**Loading after a search or a filter**
- Given the server has not answered the list request yet
- When I choose "Archived" in "Status"
- Then "Loading…" shows in place of the entries, and "Search" and every filter keep their values (feature 17 question 14; feature 15 question 7)

**Loading a note's detail**
- Given the server has not answered the note's request yet
- When I choose a note's title in the list
- Then the notes area shows "Back to notes" and "Loading…" as a status (feature 09)

**Loading parts of the note forms**
- Given the server has not answered the collections or the tags request of a note form yet
- When I open the new-note form, or the edit form of "Rails tips"
- Then the new-note form shows "Loading…" until the collections arrive; the edit form shows its fields at once, with "Loading…" in its "Collection" field and in its "Tags" group, and the other fields can be typed in (features 09, 10, 11)

**Loading the reminders**
- Given my connection has not delivered its first batch yet
- When the main layout shows
- Then the panel "Review reminders" shows "Loading…" as a status, and the other areas work (feature 20 question 8)

**A busy button**
- Given I chose "Continue with Google", "Continue with GitHub", "Log out", "Create", "Save", "Delete", "Archive", "Restore", or "Mark as reviewed", and its request has not been answered yet
- When I choose it again
- Then it is disabled and busy (`aria-busy="true"`), and no second request is sent ([conventions: Busy button](../../docs/conventions.md#ui); feature 13 question 6)

**The new-note form checks its fields**
- Given I have a collection, and the new-note form is open
- When I choose "Create" with "Title" and "Body" empty, "example.com" in "Source URL (optional)", and no collection chosen
- Then "Enter a title.", "Enter a body.", "Enter a URL that starts with http:// or https://.", and "Choose a collection." show under their fields, each of those fields is marked invalid (`aria-invalid="true"`), the focus moves to "Title", and no request is sent ([conventions: Browser checks on submit](../../docs/conventions.md#ui); requirements.md 4)

**The edit form checks its fields**
- Given the edit form of "Rails tips" is open
- When I empty "Title" and choose "Save"
- Then "Enter a title." shows under "Title", the field is marked invalid and has the focus, and no request is sent ([conventions: Browser checks on submit](../../docs/conventions.md#ui))

**The review fields are checked**
- Given the new-note form is open, with a title, a body, and a collection, and "Every N days" chosen in "Review interval"
- When I choose "Create" with "Number of days" empty, and then with "0"
- Then "Enter the number of days.", and then "Enter a whole number from 1 to 365.", shows under "Number of days", the field is marked invalid, and no request is sent (feature 12 questions 5, 13)

**A fixed field loses its message**
- Given "Enter a title." shows under "Title" in the new-note form
- When I type "Rails tips" in "Title", and choose "Create" with every field valid
- Then the message goes, and the note is created (feature 09 question 6)

**The server's refusal shows under its field**
- Given the edit form of "Rails tips" is open, and the collection "Books" was deleted in another tab
- When I choose "Books" in "Collection" and choose "Save"
- Then "This collection no longer exists. Choose another." shows under "Collection", and the form keeps what I typed (feature 11; [conventions: Browser checks on submit](../../docs/conventions.md#ui))

**The server cannot be reached on page load**
- Given the session check gets no answer, or an answer other than success or 401
- When the page opens
- Then it shows "Could not reach the server. Try again." as an alert, with "Try again", which checks the session again ([conventions: Server error on page load](../../docs/conventions.md#ui))

**A sign-in that did not complete**
- Given a sign-in with GitHub was cancelled at GitHub
- When the app shows the sign-in screen again, at `/?sign_in_error=github`
- Then it shows "Sign-in with GitHub did not complete. Try again." as an alert ([conventions: Sign-in error](../../docs/conventions.md#ui))

**A list cannot load**
- Given the server cannot be reached for the collections, the tags, or the notes
- When the main layout shows
- Then each failed area shows its alert, "Could not load collections. Try again.", "Could not load tags. Try again.", or "Could not load notes. Try again.", with "Try again", and the other areas work ([conventions: Load error with Try again](../../docs/conventions.md#ui))

**A note cannot load**
- Given the server cannot be reached for a note
- When I choose its title in the list
- Then the notes area shows "Could not load the note. Try again." as an alert, with "Try again" (feature 09)

**A change fails**
- Given the server cannot be reached, or answers with an error other than 401, 404, 409, or 422
- When I create, rename, or delete a collection or a tag; create, save, archive, restore, or delete a note; or mark a note as reviewed
- Then an alert names what failed, such as "Could not create the collection. Try again.", "Could not save the note. Try again.", or "Could not mark the note as reviewed. Try again.", and the form, the detail, or the confirmation stays open with what I typed ([conventions: Change failures, Note failures](../../docs/conventions.md#ui); feature 13 question 6)

**A record that is gone**
- Given a collection, a tag, or a note was deleted in another tab
- When I rename the collection or the tag here, or save the note or mark it as reviewed here
- Then the app says "This collection no longer exists.", "This tag no longer exists.", or "This note no longer exists." as an alert ([conventions: A record that is gone](../../docs/conventions.md#ui); features 09, 13)

**A refused delete**
- Given the collection "Work" has notes
- When I confirm its delete
- Then "This collection still has notes. Move or delete them first." shows as an alert, and the confirmation stays open ([conventions: A refused delete](../../docs/conventions.md#ui))

**The logout fails**
- Given the server cannot be reached
- When I choose "Log out"
- Then "Could not log out. Try again." shows as an alert under the header, and the main layout stays ([conventions: Logout](../../docs/conventions.md#ui))

**The reminders go offline**
- Given the panel "Review reminders" shows a reminder
- When the connection is lost
- Then the panel shows "Review reminders are offline. Reconnecting…" as an alert, keeps its list, and disables "Dismiss" (feature 20 question 8; feature 23 question 5)

**The sign-in has ended**
- Given my sign-in has ended
- When a request answers 401 `{ "error": "unauthenticated" }`, or the server refuses the app's connection
- Then the sign-in screen shows with no message and no alert ([conventions: Sign-in ended](../../docs/conventions.md#ui); feature 22 question 3)

**A screen fails to draw**
- Given a part of the page fails while it is drawn, for example because the notes list answer holds a note that the app cannot show
- When the failure happens
- Then the page shows only the alert "Something went wrong. Reload the page." and the button "Reload page"
- When I choose "Reload page"
- Then the page loads again, and checks the session (question 2)

**Hover states**
- Given any interactive element on any screen (question 5)
- When the pointer moves over it
- Then its background, border, text color, or underline changes (questions 1, 3, 5; requirements.md 4)

**The elements that had no hover state**
- Given the sign-in screen, the server-error screen, an open name form in the collections or the tags area, and the new-note form
- When the pointer moves over "Continue with Google", "Continue with GitHub", the server error's "Try again", the field "Collection name" or "Tag name", and each field of the note form
- Then each one looks different while the pointer is over it (question 3)

**Focus states**
- Given any screen
- When I move through it with Tab
- Then the focus reaches, in turn, each interactive element that is shown and not disabled, and each shows a ring or outline while it has the focus (questions 1, 5; requirements.md 4)

**Consistent spacing and typography**
- Given the major screens of question 4, at 1280 × 800 px
- When I compare the elements of each kind that question 4 lists
- Then each kind has one look on every screen where it shows (question 4)

**Light theme only**
- Given my system is set to a dark theme
- When each screen shows
- Then the page has a white background and dark text, and its fields, drop-down lists, and checkboxes keep their light look, the same as with a light system theme (requirements.md 4)

## Edge cases

Based on the answers to the questions above.

- An empty state shows only once its list has loaded and is empty: never while it loads, and never after it failed ([conventions: Empty states](../../docs/conventions.md#ui)).
- "No notes yet" shows only when "Search" is empty and every filter shows "All". A review choice alone shows its own message, without "Clear search and filters"; with the search or another filter set, "No notes match your search and filters." shows, with it (feature 17 question 11).
- "No review reminders" shows after a batch with no reminders, and after the last reminder is dismissed. It never shows while the panel shows "Loading…" (features 20, 23).
- Each loading line is a status (`role="status"`), and each error message an alert (`role="alert"`), so that assistive technology announces them ([conventions](../../docs/conventions.md#ui)).
- The note forms check their fields only at "Create" or "Save", not while I type, and check them again at each "Create" or "Save" (feature 09 question 6).
- "Enter a valid date." and "Choose a review interval." show under their fields as feature 12 defines them (its question 13), and so do the server's 422 codes for the review fields.
- The names of collections and tags are checked only on the server, and its answer shows "Enter a name.", "Use at most 100 characters.", or "A collection with this name already exists." (or the tag's) under the field ([conventions: Validation messages](../../docs/conventions.md#ui)). The note forms are the only forms with checks in the browser (requirements.md 4: "for note create/edit forms").
- A chosen tag deleted elsewhere shows "A chosen tag no longer exists. Check the tags again." in the "Tags" group ([conventions: A chosen tag that no longer exists](../../docs/conventions.md#ui)).
- A failed request keeps its own message in its own place. The page-level alert of question 2 shows only when a screen fails to draw (question 2).
- A 401, or a refused connection, is not an error to show: the sign-in screen shows with no message (feature 22 question 3).
- A busy button takes no second click. A disabled element needs no hover state (question 5).
- Elements that only the app moves the focus to need no ring (question 5).
- No part of the app follows a dark system theme (requirements.md 4).
- Narrow screens are feature 25's, which is built after this feature. It checks that every state above shows inside the window on a narrow screen, and that its own new elements follow questions 3 to 5 (feature 25).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Code gaps: the sign-in buttons and the session-error "Try again" in `App.tsx` have no hover style, and neither do the name inputs in `NameListArea.tsx`. Focus looks visible everywhere (a ring, or the browser default).
- Planned tests: `src/UiStates.test.tsx`, mostly regression tests for the states that 01 to 09 built; hover and focus guard tests through a `src/test/ui.ts` helper (jsdom applies no CSS, so they check classes); the render-error test in its own file, because it needs `vi.mock`. The page-level alert would come from an error boundary.
- Later items: 07, 10, 11, 12 (client-side check of custom days), 13, 15/16 ("no review reminders"), 17 ("no search results"), 20.
- Feature 09 was mid-build during the research (`NoteForm.tsx` had just appeared). The plan must read its final UI.
- Regression tests that pass at once meet the Build gate in `specs/README.md`; the plan must say why they pass.
- Added 2026-11-09 (Design): the note form's fields (`fieldClass` in `NoteForm.tsx`) have no hover style either (question 3).
- Added 2026-11-09 (Design): "no review reminders" is feature 20's panel message "No review reminders"; the review filter's messages of 15 to 17 are checked too.
- Added 2026-11-09 (Design): the Verify walkthrough can check question 4 by comparing computed styles (font family, size, weight, color, padding, corner radius) of the listed elements, the focus states by pressing Tab and comparing outline and box shadow, the hover states with Playwright's hover, and light theme only with a context whose color scheme is dark. A screen that fails to draw can be caused in the walkthrough by answering the notes list with an entry the app cannot show; the plan names the trigger.
- Added 2026-11-09 (Design): this feature is built after features 11 to 23, and feature 25 after it (build order of 2026-11-09), so the bar of feature 25 does not exist yet when this feature is built. The plan checks the elements that exist then. Feature 25's spec makes its bar and buttons follow questions 3 to 5 (its edge cases).
- Added 2026-11-09 (Design): "Edit note" is the edit form's heading in `NoteForm.tsx` as built by feature 09; question 4 names it as built.
