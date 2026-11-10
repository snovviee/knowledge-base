# Feature: 25_responsive_layout

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-25: The app is responsive on narrow screens

Sources: requirements.md 4 (the UI is responsive; `<ui_quality_checks>`: hover and focus states; on narrow screens the sidebar collapses into a menu, collections move into a dropdown, and note cards stack vertically; the main layout: a left area for collections and a main area for notes, the search input, the filter controls, the profile area, and the logout action; the notes view, the note create/edit UI, the note detail; visible real-time review notifications), 3.6 (search and filters available from the main notes view); [docs/conventions.md](../../docs/conventions.md#ui) (UI: The left area, Forms in place, Delete confirmation, Logout, The notes area, Escape, Load error with Try again); [features/05_logout/spec.md](../05_logout/spec.md) (the profile area on narrow screens is left to AC-25), [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (question 1: one view at a time in the notes area), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (question 18: the review fields of the form), [features/13_mark_reviewed/spec.md](../13_mark_reviewed/spec.md) (question 6: "Mark as reviewed" in the detail), [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (questions 1, 10, 15, 16: the filter bar, and its "Collection" and "Tag" choices, which follow the left area's lists), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md) (question 6: the "Review reminders" panel; question 8: its states), and [features/24_ui_states/spec.md](../24_ui_states/spec.md) (questions 3 to 5: hover and focus states, spacing), not yet in `docs/`.

Not part of this feature: the rules for hover and focus states, spacing, and typography (AC-24, feature 24), which this feature's bar and buttons follow; what the areas, the notes view, the filter bar, and the reminders panel do, which their own features define. This feature decides only how they fit a narrow screen.

## Questions

1. Which widths are narrow?
   - Options: narrower than 768 px (recommended); other options: TBD (the research names none).
   - Answer: a window narrower than 768 px (in CSS pixels) is narrow. A window 768 px wide or wider is wide. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What is the narrowest width the app supports?
   - Options: 320 px, with no sideways scrolling (recommended); other options: TBD (the research names none).
   - Answer: 320 px. From 320 px up, no screen of the app scrolls sideways: the loading screen, the server-error screen, the sign-in screen, and the main layout with each of its views and panels. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How do "the sidebar collapses into a menu" and "collections move into a dropdown" apply?
   - Options: a bar under the header with the buttons "Collections" and "Menu" (recommended); other options: TBD (the research names none).
   - Answer: on a narrow screen, the left area does not show beside the notes. A bar under the header holds two buttons, "Collections" and "Menu". "Collections" opens a dropdown with the collections area, and "Menu" a panel with the rest of the left area: the tags area. Each area works inside its panel as it does in the left area. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. How do the panels open and close?
   - Options: push-down panels toggled by their buttons, one open at a time (recommended); other options: TBD (the research names none).
   - Answer: each panel opens below the bar, across the full width of the window, and pushes the content under it down. Its button opens and closes it, and tells assistive technology whether it is open (`aria-expanded` is `"true"` or `"false"`). One panel is open at a time: opening one closes the other. A closed panel keeps its content as it was, such as an open form and what was typed in it. Inside the areas, Escape keeps its meaning (it closes a name form or cancels a delete confirmation) and does not close the panel. Apart from a change of width (question 10), only the bar's buttons open and close the panels. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. Where do the profile area and "Log out" go on a narrow screen?
   - Options: they stay in the header (recommended); other options: TBD (the research names none).
   - Answer: they stay in the header, which may wrap onto a second line. A display name too long for its line is cut with "…", and "Log out" always shows in full. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. Do the collections and the tags load while their panels are closed? (a question the agent added)
   - Options: yes, when the main layout shows, as on a wide screen (recommended: the filter bar's "Collection" and "Tag" offer the left area's lists once they have loaded (feature 17 question 16), and a panel then opens with its list ready); no, each loads when its panel first opens.
   - Answer: yes. The collections and the tags load when the main layout shows, whether a panel is open or not, so the filter bar offers them at once. A list that cannot load shows its failure inside its panel, with its "Try again", when the panel is opened. A list request answered 401 shows the sign-in screen at once, as on a wide screen. Opening or closing a panel sends no request. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
7. Where does the "Review reminders" panel of feature 20 go on a narrow screen? (a question the agent added)
   - Options: it stays at the top of the main area, above the notes area, across the full width (recommended: requirements.md 4 asks for notifications that are visible while connected, so they are not hidden behind a button); inside the "Menu" panel; behind a third button in the bar.
   - Answer: it stays where feature 20 puts it, at the top of the main area: below the bar and any open panel, above the notes area, across the full width, and always shown. Its list scrolls inside it when it is long (feature 20 question 6), so with no panel of the bar open, the heading "Notes" still shows on the first screen of a 320 × 568 px window, without scrolling the page. Its states ("Loading…", "No review reminders", and "Review reminders are offline. Reconnecting…") show as on a wide screen. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
8. How does the filter bar of feature 17 fit a narrow screen? (a question the agent added)
   - Options: it wraps: "Search" on its own line across the full width, and the drop-down lists below it, as many to a line as fit (recommended: every control stays in view and usable with no extra button, and requirements.md 3.6 asks for them in the main notes view); a "Filters" button that shows and hides the drop-down lists; a bar that scrolls sideways.
   - Answer: it wraps. On a narrow screen, "Search" takes the full width of the bar, on its own line. "Collection", "Tag", "Status", and "Review" follow below it in that order, as many to a line as fit, each with its label, whole and inside the window. On a wide screen, the bar also wraps when its controls do not fit on one line. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. How do the notes list, a note's detail, and the note forms fit a narrow screen? (a question the agent added)
   - Options: one column across the full width of the notes area, with text and buttons wrapping (recommended: it follows requirements.md 4, "note cards stack vertically", and the one-view-at-a-time notes area, feature 09 question 1); a narrower layout that hides some fields.
   - Answer: each note's entry takes the full width of the list, one below the other, as on a wide screen (the list is one column at every width). Its title, collection, tags, review line, and labels wrap inside the entry. The detail and the new-note and edit forms take the full width of the notes area. Each form field takes the full width of the form. A row of buttons wraps onto more lines when it does not fit, and each button shows whole. A long word or web address, such as a title of 200 characters with no space or a source URL of 2,000 characters, breaks inside its line instead of widening the page. Every field, label, and value of the wide layout also shows on a narrow screen. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. What happens when the window's width crosses 768 px while the app is open, such as a turned phone or a resized window? (a question the agent added)
    - Options: the layout switches at once, keeping what is on the page (recommended: nothing typed is lost, and no request is needed); the page reloads.
    - Answer: the layout switches at once, with no reload and no request. Forms keep what was typed, the notes area keeps its view, and the filter bar keeps its values. When the window turns narrow, both panels start closed. When it turns wide, the left area shows both areas beside the notes, as they were. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above. The window sizes are in CSS pixels, width × height. Where only a width is given, the height is 800 px.

**A narrow screen shows the bar**
- Given the window is 375 × 667 px, and I am signed in
- When the main layout shows
- Then the collections and tags areas do not show, and a bar under the header shows the buttons "Collections" and "Menu", each with `aria-expanded="false"` (questions 1, 3, 4)

**767 px is narrow, 768 px is wide**
- Given I am signed in
- When the window is 767 px wide
- Then the bar shows, and the collections and tags areas do not
- When the window is 768 px wide
- Then the left area shows beside the notes, the collections area above the tags area, and there is no bar (question 1; [conventions: The left area](../../docs/conventions.md#ui))

**A wide screen keeps the left area**
- Given the window is 1280 × 800 px
- When the main layout shows
- Then the collections and tags areas show in the left column beside the reminders panel and the notes, as before this feature, and there is no bar (question 1)

**Open the collections dropdown**
- Given the window is 375 px wide, and the bar shows "Collections" and "Menu"
- When I choose "Collections"
- Then the collections area, with its heading "Collections", its list, and "New collection", opens below the bar across the full width, the reminders panel and the notes move down below it, and "Collections" has `aria-expanded="true"` (questions 3, 4)

**Open the menu**
- Given the window is 375 px wide
- When I choose "Menu"
- Then the tags area, with its heading "Tags", its list, and "New tag", opens below the bar, and "Menu" has `aria-expanded="true"` (questions 3, 4)

**One panel at a time**
- Given the window is 375 px wide, and the collections panel is open
- When I choose "Menu"
- Then the tags panel opens, the collections panel closes, "Menu" has `aria-expanded="true"`, and "Collections" has `aria-expanded="false"` (question 4)

**Close a panel**
- Given the window is 375 px wide, and the collections panel is open
- When I choose "Collections" again
- Then the panel closes, the reminders panel and the notes move back up under the bar, and "Collections" has `aria-expanded="false"` (question 4)

**Manage collections in the dropdown**
- Given the window is 375 px wide, and the collections panel is open
- When I create the collection "Work", rename it to "Job", and delete it
- Then each works as on a wide screen (features 06, 07), and the panel stays open (questions 3, 4)

**A closed panel keeps its content**
- Given the window is 375 px wide, and I typed "Wo" in the new-collection form inside the collections panel
- When I close the panel and open it again
- Then the form still shows "Wo", and no request was sent (question 4)

**Escape inside a panel**
- Given the window is 375 px wide, and the new-tag form is open inside the "Menu" panel
- When I press Escape in its field
- Then the form closes as on a wide screen ([conventions: Forms in place](../../docs/conventions.md#ui)), and the panel stays open (question 4)

**The lists load while the panels are closed**
- Given the window is 375 px wide, and I have the collections "Books" and "Work" and the tag "ruby"
- When the main layout shows, and I open no panel
- Then the filter bar's "Collection" offers "All", "Books", and "Work", and "Tag" offers "All" and "ruby" (question 6; feature 17 question 16)

**A list that cannot load shows its failure in its panel**
- Given the window is 375 px wide, and the server cannot be reached for the collections
- When I choose "Collections"
- Then the panel shows "Could not load collections. Try again." with "Try again" ([conventions: Load error with Try again](../../docs/conventions.md#ui)) (question 6)

**Note cards stack vertically**
- Given the window is 375 px wide, and I have three notes
- When the notes list shows
- Then each note's entry takes the full width of the list, one below the other, newest first (question 9; requirements.md 4)

**A long title and a long address wrap**
- Given the window is 320 px wide, and a note whose title is one word of 200 characters, and whose source URL has 2,000 characters
- When its entry in the list, and then its detail, show
- Then the title and the address break across lines inside the entry and the detail, and the page does not scroll sideways (questions 2, 9)

**The filter bar on a narrow screen**
- Given the window is 320 px wide
- When the notes list shows
- Then "Search" takes the full width of the bar, on its own line, and "Collection", "Tag", "Status", and "Review" follow below it in that order, each with its label, whole and inside the window (question 8; feature 17 question 15)

**The note detail on a narrow screen**
- Given the window is 320 px wide, and the detail of a weekly note "Rails tips" with two tags and a source URL is open
- When it shows
- Then its title, its fields ("Collection", "Tags", "Source URL", "Review interval", "Next review", and "Last reviewed"), and its body take the full width of the notes area, and its buttons "Back to notes", "Edit", "Archive", "Delete", and "Mark as reviewed" each show whole, on as many lines as they need (question 9; features 09, 12, 13)

**The note form on a narrow screen**
- Given the window is 320 px wide
- When I open the new-note form, and choose "Every N days" in "Review interval"
- Then "Title", "Body", "Source URL (optional)", "Collection", "Tags", "Review interval", "Number of days", and "Next review date (optional)" each take the full width of the form, and "Create" and "Cancel" show whole (question 9; feature 12 question 18)

**The reminders panel on a narrow screen**
- Given the window is 320 × 568 px, no panel of the bar is open, and I have 10 notes due today or overdue
- When the main layout shows, and the first batch arrives
- Then the panel "Review reminders" shows below the bar across the full width, its list scrolls inside it, and the heading "Notes" shows inside the window without scrolling the page (question 7; feature 20 question 6)

**The profile area and "Log out" stay in the header**
- Given the window is 320 px wide, and my display name is "Maximilian Alexander von Habsburg-Lothringen"
- When the main layout shows
- Then the header shows "Personal Knowledge Base", my name cut with "…", and "Log out" in full, all inside the window; the header may take two lines (question 5)

**No sideways scrolling at any supported width**
- Given the window is 320, 375, 767, 768, or 1280 px wide
- When each screen shows: the loading screen, the sign-in screen with "Sign-in with Google did not complete. Try again.", the server-error screen, and the main layout with the notes list, a note's detail, the new-note form, the edit form, and, below 768 px, each panel of the bar open
- Then the page does not scroll sideways (question 2)

**The layout follows a change of width**
- Given the window is 1280 px wide, the detail of "Rails tips" is open, and I typed "Wo" in the new-collection form
- When the window becomes 375 px wide
- Then the bar shows with both panels closed, the detail of "Rails tips" still shows, and choosing "Collections" shows the form with "Wo"
- When the window becomes 1280 px wide again
- Then the left area shows beside the notes, with the form and "Wo", and no request was sent (question 10)

## Edge cases

Based on the answers to the questions above.

- A window exactly 768 px wide is wide; 767 px is narrow (question 1).
- Below 320 px the layout is not supported, and the page may scroll sideways (question 2).
- Apart from a change of width (question 10), only the bar's buttons open and close a panel. Escape inside an area closes its name form or cancels its delete confirmation ([conventions: Forms in place, Delete confirmation](../../docs/conventions.md#ui)), and the panel stays open. Choosing something outside a panel does not close it (question 4).
- The bar's buttons are buttons: they are reached with Tab, and Enter or Space opens and closes their panel, as a click does (question 4).
- The bar's buttons "Collections" and "Menu" have a visible hover state and a visible focus state, and the bar has the same inner side padding as the header and the notes area, by the rules of feature 24 (its questions 3 to 5), which is built before this feature.
- One panel is open at a time (question 4).
- A closed panel keeps its content: an open name form with what was typed, an open delete confirmation, and a message such as "This collection still has notes. Move or delete them first." (question 4).
- Each area keeps its own form or confirmation, as in the left area ([conventions: The left area](../../docs/conventions.md#ui)): a form open in the collections panel stays open while the tags panel is used (question 4).
- The collections and the tags load when the main layout shows, whatever the panels show. Opening or closing a panel sends no request (question 6).
- A list request answered 401 `{ "error": "unauthenticated" }` shows the sign-in screen at once, even while its panel is closed ([conventions: Sign-in ended](../../docs/conventions.md#ui)) (question 6).
- The filter bar's "Collection" and "Tag" follow the areas' creates, renames, and deletes made inside the panels, as they do on a wide screen (feature 17 question 10).
- At 768 px the notes area shares the window with the left area, so it is much narrower than the window. The filter bar wraps there too, and no control leaves the window (question 8).
- The notes list is one column at every width (question 9; feature 09).
- Long titles, bodies, collection and tag names, and web addresses break inside their lines (question 9).
- Every field, label, and value that shows on a wide screen also shows on a narrow one. Nothing is hidden for lack of room, except the left area, which moves into the panels (questions 3, 9).
- A long display name is cut with "…", and "Log out" always shows in full. The header may wrap. "Could not log out. Try again." shows under the header across the full width ([conventions: Logout](../../docs/conventions.md#ui)) (question 5).
- The "Review reminders" panel never goes inside "Collections" or "Menu", and an open panel of the bar pushes it down with the notes (question 7).
- "Open" in the reminders panel shows the note's detail in the notes area below, with the focus on its title (feature 20 question 6), which brings the title into view (question 7).
- A crossing of 768 px switches the layout at once, with no reload and no request. What was typed stays. Turning narrow starts with both panels closed (question 10).
- The loading screen, the server-error screen, and the sign-in screen are one centered column, which fits from 320 px up (question 2).
- UI states (requirements.md 4 `<ui_quality_checks>`): every loading state, empty state, message, and alert of the areas, the notes view, the filter bar, and the reminders panel shows on a narrow screen as on a wide one, inside the window (questions 2, 6, 7).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09. These move to `plan.md` once the spec is approved.

- Code fact: `App.tsx` has a fixed `w-64` left column and nothing responsive. This is what AC-25 builds, so it needs no question of its own.
- jsdom has no `matchMedia`, so a [SETUP] stub (wide by default) is needed in `src/test/setup.ts`.
- A `useNarrowScreen` hook would choose the classes, with no `md:` variants, because Tailwind breakpoints are in rem.
- A closed panel keeps its content because it is hidden, not unmounted (question 4). The same holds when the layout switches at 768 px (question 10): the areas must not be unmounted and mounted again, or a typed name would be lost and the lists loaded twice.
- The note list is already one column.
- Feature 09 was mid-build during the research (`NoteForm.tsx` had just appeared). The plan must read its final UI.
- Added 2026-11-09 (Design): this feature is built after features 11 to 23. Read their final UI first: the filter bar (17), the review fields (12), "Mark as reviewed" (13), and the reminders panel (20). The panel's scrolling list must leave "Notes" on the first screen at 320 × 568 px (question 7).
- Added 2026-11-09 (Design): the Verify walkthrough sets the window sizes with Playwright's viewport (the harness default is 1280 × 800) and checks sideways scrolling by comparing the page's scroll width with the window's width, at 320, 375, 767, 768, and 1280 px.
- Added 2026-11-09 (Design): the button "Collections" and the area's heading "Collections" have the same text, and so do "Collection" in the filter bar and in the note form. Tests should find them by role and scope.
