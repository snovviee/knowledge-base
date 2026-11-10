# Feature: 17_search_and_filter

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-17: A user can search and filter notes

Sources: requirements.md 1, 3.6 (search by title, body, source URL; filters by collection, tag, status, review state; available from the main notes view; a clear empty state), 4 (main layout: search input, filter controls; `<ui_quality_checks>`: no search results, loading state, visible error handling), 5, 11 (full-text search is not required); [docs/api_contract.md](../../docs/api_contract.md) (Conventions: Authentication, Error body; Notes: `GET /api/notes`); [docs/conventions.md](../../docs/conventions.md) (UI: Loading inside an area, Load error with Try again, Sign-in ended, The left area); [docs/domain/collections.md](../../docs/domain/collections.md) (Rules: names ignore case in any alphabet; the list is alphabetical); [features/09_notes_crud/spec.md](../09_notes_crud/spec.md) (questions 1, 2, 4, 8: the address does not change, newest first, limits counted after tidying, every refused field in one answer), [features/10_note_tags/spec.md](../10_note_tags/spec.md), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (question 1: "today"), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) (questions 1 to 10: the "Review" filter, its states, `review`), and [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (questions 1 to 3); what these features decide is not yet in `docs/`.

Not part of this feature: the meanings of "due today" and "overdue" (AC-15, AC-16); tags on notes (AC-10); the left area on narrow screens (AC-25). This feature adds the search, the "Collection", "Tag", and "Status" filters, and the "Review" choices "Next 7 days" and "No review scheduled" to the "Review" filter of features 15 and 16.

## Questions

1. Where are the search and the filters, and what do they offer?
   - Options: one filter bar above the notes list (recommended); other options: TBD (the research names none).
   - Answer: one filter bar above the list holds the search, "Collection", "Tag", "Status" (All, Active, Archived), and "Review", which gains "Next 7 days" and "No review scheduled" next to feature 15's and 16's choices. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. How do the search and the filters combine?
   - Options: all of them at once (AND) (recommended); other options: TBD (the research names none).
   - Answer: all of them combine (AND): a note shows only when it matches the search and every filter. The order stays newest first (feature 09 question 2). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. Do the search and the filters survive a reload?
   - Options: no, a reload resets them, because the address does not change (feature 09 question 1) (recommended); yes, kept in the address.
   - Answer: no. A reload resets them. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. What does the search match?
   - Options: a note whose title, body, or source URL contains the text (recommended; requirements.md 11: full-text search is not required); other options: TBD (the research names none).
   - Answer: a note matches when its title, body, or source URL contains the text. It ignores letter case in any alphabet, as names do (feature 06 question 6), and counts each run of whitespace as one space. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. When does the search run?
   - Options: as the user types (recommended); other options: TBD (the research names none).
   - Answer: as the user types, after a pause of 300 ms, and only the latest answer is shown. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. How long may the search text be, and how do special characters match?
   - Options: at most 2,000 characters, each character matching as itself (recommended); other options: TBD (the research names none).
   - Answer: at most 2,000 characters; a longer text answers 422 with `too_long`. Each character matches as itself: `%` and `_` included. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. What does "Next 7 days" mean?
   - Options: from tomorrow through today plus 7 (recommended); other options: TBD (the research names none).
   - Answer: an Active note with a schedule (an interval other than None) and a next review date from tomorrow through today plus 7 days. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
8. What does "No review scheduled" mean?
   - Options: the interval None, in any status (recommended); other options: TBD (the research names none).
   - Answer: a note whose interval is None, in any status. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
9. What does the API answer for filter values that are not the user's, or not valid?
   - Options: an empty list for a collection or tag that is not the user's, and 422 for an unknown value (recommended); other options: TBD (the research names none).
   - Answer: a collection or a tag that is not mine, or an id that is not a whole number, answers 200 with an empty list. An unknown status or review value answers 422 with `invalid`. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
10. How do the filter's choices follow the left area?
    - Options: they follow its lists at once (recommended); other options: TBD (the research names none).
    - Answer: the Collection and Tag choices follow the left area's lists through create, rename, and delete. If the chosen collection or tag is deleted, its filter goes back to All. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
11. What does the list show when nothing matches?
    - Options: the messages below (recommended); other options: TBD (the research names none).
    - Answer: "No notes match your search and filters." with the button "Clear search and filters". With only a review filter set (the search empty and every other filter at All), that filter's own message shows instead, with no button: "No notes are due for review today." (feature 15), "No notes are overdue for review." (feature 16), "No notes are due for review in the next 7 days.", or "Every note has a review schedule.". (the recommended option, taken under the owner's standing instruction of 2026-11-09)
12. Which names and values does the list request use for the search, the collection, the tag, the status, and the review values "Next 7 days" and "No review scheduled"?
    - Options: TBD. The research names only `review=due_today` and `review=overdue` (features 15, 16).
    - Answer: `GET /api/notes` takes these query parameters, each optional: `search` (the search text), `collection_id` (one collection's id), `tag_id` (one tag's id), `status` (`active` or `archived`), and `review` (`due_today`, `overdue`, `next_7_days`, or `unscheduled`). A parameter left out or empty does not filter: that is the choice "All", as for `review` in feature 15 (its question 10). Values are written exactly as here, in lower case. In a 422 answer, `fields` names the parameter: `search`, `status`, or `review`. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
13. How are spaces in the search text handled: are its ends trimmed, does a text of only spaces mean no search, and does a run of whitespace in a note's fields also count as one space?
    - Options: TBD (the research does not cover it).
    - Answer: yes to all three. The ends of the search text are trimmed, and each run of whitespace inside it (spaces, tabs, line breaks) counts as one space. A text that is empty after that means no search. In a note's title, body, and source URL each run of whitespace also counts as one space, so "use rails" finds a body with "use" at the end of one line and "rails" at the start of the next. The limit of 2,000 characters counts the text after this tidying, as the note's limits do (feature 09 question 4). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
14. What does the list show while a search or filter answer loads, and when it cannot load? (Feature 15 question 7 asks the same for its filter.)
    - Options: TBD (the research does not cover it).
    - Answer: the same as feature 15's answer (its question 7). While an answer loads, "Loading…" shows as a status in place of the entries, and the search and the filters keep their values and can be changed; only the answer to the latest search and filters is shown (question 5). When the list cannot load (no answer, or an error answer other than 401), "Could not load notes. Try again." shows as an alert with a "Try again" button, which asks again with the current search and filters. A 401 shows the sign-in screen. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
15. What is the search field called, and where is it?
    - Answer: a text field labelled "Search", empty at first, first in the bar, before the drop-down lists "Collection", "Tag", "Status", and "Review", which are labelled with those words and start at "All". (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
16. What do "Collection" and "Tag" offer before the left area has loaded its lists, or when a list cannot load?
    - Answer: only "All". Once the left area has loaded my collections (or tags), the filter offers them after "All", in the left area's alphabetical order (feature 06 question 8). A "Try again" there that succeeds fills the filter too. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
17. What does the search field do with a text longer than 2,000 characters?
    - Answer: it takes at most 2,000 characters: typing stops there, and a longer paste is cut at 2,000. So the browser never sends a longer search; the 422 `too_long` of question 6 is for other API clients. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
18. What does the list request answer for a `search` that is not text, such as a list (`search[]=rails`) or an object (`search[a]=b`)? (added on 2026-11-09, see Changes)
    - Options: 422 with `invalid`, as the notes API answers other values of the wrong type (recommended: the client learns that its request is wrong, as for a `source_url` that is not text in feature 09 and a `tag_ids` that is not a list in feature 10); treat it as no search, so 200 with every note.
    - Answer: 422 `{ "error": "validation_failed", "fields": { "search": "invalid" } }`, named in the same answer as every other parameter that breaks a rule (question 12). The browser never sends one. (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

Based on the answers to the questions above.

**Search and filters are in the notes view**
- Given I am signed in
- When the main layout shows
- Then a bar above the notes list shows the empty field "Search" and the drop-down lists "Collection", "Tag", "Status", and "Review", each with "All" chosen (questions 1, 15; requirements.md 3.6)

**The filters' choices**
- Given I have the collections "Work" and "Books" and the tags "ruby" and "ai", and the left area has loaded them
- When I open each drop-down list in the bar
- Then "Collection" offers "All", "Books", "Work"; "Tag" offers "All", "ai", "ruby"; "Status" offers "All", "Active", "Archived"; and "Review" offers "All", "Due today", "Overdue", "Next 7 days", "No review scheduled", in that order (questions 1, 10, 16; features 15, 16; requirements.md 3.6 lists the review states in this order)

**Search by title, body, or source URL**
- Given the notes "Rails tips" (in its title), "Ruby notes" (whose body says "use rails"), "Framework" (whose source URL is "https://rubyonrails.org"), and "Cooking" (with "rails" nowhere)
- When I type "rails" in "Search"
- Then the list request is `GET /api/notes?search=rails`, and the list shows "Rails tips", "Ruby notes", and "Framework", newest first, and not "Cooking" (questions 2, 4, 12)

**Search ignores letter case in any alphabet**
- Given the note "Привет мир"
- When I type "ПРИВЕТ" in "Search"
- Then "Привет мир" shows (question 4)

**Spaces in the search text**
- Given the note "Rails tips"
- When I type "  rails   tips " in "Search"
- Then "Rails tips" shows (questions 4, 13)

**Line breaks in a note count as one space**
- Given the note "Ruby notes", whose body has "use" at the end of one line and "rails" at the start of the next
- When I type "use rails" in "Search"
- Then "Ruby notes" shows (question 13)

**A search of only spaces is no search**
- Given I have notes, and every filter shows "All"
- When I type three spaces in "Search"
- Then the list shows all my notes (question 13)

**The search runs as I type**
- Given the list shows my notes
- When I type "rails" with less than 300 ms between the keys
- Then one list request is sent, 300 ms after the last key, and the list shows its answer (question 5)

**Only the latest answer is shown**
- Given I typed "ra", and its answer has not arrived
- When I type "ils", and the answer for "rails" arrives before the answer for "ra"
- Then the list shows the answer for "rails", and the late answer for "ra" changes nothing (question 5)

**Special characters match as themselves**
- Given the notes "100% done", "100 done", "a_b", and "axb"
- When I type "100%" in "Search", and then "a_b"
- Then "100%" finds only "100% done", and "a_b" finds only "a_b" (question 6)

**Filter by collection**
- Given "Rails tips" is in "Work", and "Book list" is in "Books"
- When I choose "Work" in "Collection"
- Then the list request sends `collection_id` with the id of "Work", and the list shows "Rails tips" and not "Book list" (questions 1, 12)

**Filter by tag**
- Given "Rails tips" has the tag "ruby", and "Book list" has no tags
- When I choose "ruby" in "Tag"
- Then the list request sends `tag_id` with the id of "ruby", and the list shows "Rails tips" and not "Book list" (questions 1, 12)

**Filter by status**
- Given the active note "Rails tips" and the archived note "Old idea"
- When I choose "Archived" in "Status"
- Then the list request sends `status=archived`, and the list shows "Old idea", with "Archived", and not "Rails tips" (questions 1, 12)

**Filters combine**
- Given notes in "Work" and "Books", with and without the tag "ruby", active and archived
- When I choose "Work" in "Collection", "ruby" in "Tag", and "Active" in "Status"
- Then the list request sends `collection_id`, `tag_id`, and `status=active`, and only the active notes in "Work" with the tag "ruby" show, newest first (questions 2, 12)

**Search and filters combine**
- Given the active notes "Rails tips" in "Work" and "Rails history" in "Books"
- When I type "rails" in "Search" and choose "Work" in "Collection"
- Then only "Rails tips" shows (question 2)

**Next 7 days**
- Given today is 2026-11-09 in my time zone; the active weekly notes "Due now" (next review date 2026-11-09), "Tomorrow" (2026-11-10), "In a week" (2026-11-16), "In 8 days" (2026-11-17), and "Last week" (2026-11-02); the archived weekly note "Archived soon" (2026-11-12); and the note "Someday" with the interval None
- When I choose "Next 7 days" in "Review"
- Then the list request sends `review=next_7_days`, and only "Tomorrow" and "In a week" show (questions 7, 12)

**No review scheduled**
- Given the active note "Someday" and the archived note "Old someday", both with the interval None, and the weekly note "Rails tips"
- When I choose "No review scheduled" in "Review"
- Then the list request sends `review=unscheduled`, and "Someday" and "Old someday" show, and not "Rails tips" (questions 8, 12)

**No results**
- Given no note contains "zzz"
- When I type "zzz" in "Search"
- Then the list shows "No notes match your search and filters." with the button "Clear search and filters" (question 11; requirements.md 3.6)

**Clear search and filters**
- Given "Search" holds "zzz", "Status" shows "Archived", and the list shows "No notes match your search and filters."
- When I choose "Clear search and filters"
- Then "Search" is empty, every filter shows "All", the list request is `GET /api/notes` with no parameters, and all my notes show (question 11)

**Nothing in the next 7 days**
- Given no note of mine is due in the next 7 days, "Search" is empty, and every other filter shows "All"
- When I choose "Next 7 days" in "Review"
- Then the list shows "No notes are due for review in the next 7 days.", with no "Clear search and filters" (question 11)

**Every note has a schedule**
- Given every note of mine has a review interval other than None, "Search" is empty, and every other filter shows "All"
- When I choose "No review scheduled" in "Review"
- Then the list shows "Every note has a review schedule.", with no "Clear search and filters" (question 11)

**A review filter with another filter**
- Given "Status" shows "Archived"
- When I choose "Due today" in "Review"
- Then the list shows "No notes match your search and filters." with "Clear search and filters", because a note due today is Active (questions 2, 11; feature 15 question 1)

**Search and filters stay while I open a note**
- Given "Search" holds "rails", "Status" shows "Active", and the list shows "Rails tips"
- When I open "Rails tips" and choose "Back to notes"
- Then "Search" still holds "rails", "Status" still shows "Active", and the list shows the same notes (question 1; feature 15 question 8)

**A reload resets the search and filters**
- Given "Search" holds "rails", and "Status" shows "Archived"
- When I reload the page
- Then "Search" is empty, every filter shows "All", and all my notes show (question 3)

**New and renamed collections reach the filter**
- Given "Collection" offers "Books" and "Work", and "Work" is chosen
- When I create the collection "Ideas" and rename "Work" to "Job" in the left area
- Then "Collection" offers "All", "Books", "Ideas", and "Job", and "Job" is still chosen (question 10)

**A deleted tag leaves the filter**
- Given "Tag" shows "ruby" as chosen
- When I delete the tag "ruby" in the left area
- Then "Tag" shows "All" and no longer offers "ruby", and the list loads again without a tag filter (question 10)

**The filters wait for the left area**
- Given the left area still shows "Loading…" for my collections and tags
- When I open "Collection" or "Tag"
- Then each offers only "All" (question 16)

**The list loads after a change**
- Given the server has not answered the list request yet
- When I choose "Archived" in "Status"
- Then "Loading…" shows in place of the entries, and "Search" and every filter keep their values (question 14)

**The list cannot load**
- Given the server cannot be reached, or answers the list request with an error other than 401
- When I type "rails" in "Search"
- Then "Could not load notes. Try again." shows as an alert, with the button "Try again", and "Search" still holds "rails" (question 14)

**Try again keeps the search and filters**
- Given the list shows "Could not load notes. Try again.", and "Search" holds "rails"
- When I choose "Try again", and the server answers
- Then the list request is sent again with `search=rails`, "Loading…" shows while it waits, and then the notes that match show (question 14)

**The sign-in has ended**
- Given my sign-in ended
- When I type "rails" in "Search"
- Then the list request answers 401 `{ "error": "unauthenticated" }`, and the app shows the sign-in screen (question 14; [conventions: Sign-in ended](../../docs/conventions.md#ui))

**Another user's collection or tag finds nothing**
- Given another user has the collection "Secret" and the tag "private"
- When I send a list request with `collection_id` set to the id of "Secret", or `tag_id` set to the id of "private"
- Then it answers 200 `{ "notes": [] }`, the same answer as for a collection or tag that does not exist (question 9; requirements.md 1)

**Unknown filter values are refused**
- Given I am signed in
- When a list request sends `status=deleted` and `review=soon`
- Then it answers 422 `{ "error": "validation_failed", "fields": { "status": "invalid", "review": "invalid" } }` (questions 9, 12; feature 09 question 8)

**A search that is too long is refused**
- Given I am signed in
- When a list request sends a `search` of 2,001 characters
- Then it answers 422 `{ "error": "validation_failed", "fields": { "search": "too_long" } }`; a `search` of 2,000 characters answers 200 (questions 6, 12)

**The search field takes at most 2,000 characters**
- Given the field "Search" is empty
- When I paste a text of 2,001 characters into it
- Then the field holds the first 2,000 characters, and the list request sends those (question 17)

## Edge cases

Based on the answers to the questions above.

- The results keep the list's order: newest first, by the date the note was created (question 2; feature 09 question 2).
- The search looks only in the title, the body, and the source URL, each field on its own. It does not look in tag or collection names, and it does not match across two fields: "tips use" does not find a note whose title ends with "tips" and whose body starts with "use" (question 4; requirements.md 3.6).
- Letter case is ignored in any alphabet, but accents are not: "CAFÉ" finds "Café", and "cafe" does not (question 4; feature 06 question 6).
- `%`, `_`, `*`, `\`, and quotes match as themselves (question 6).
- A search text that is empty or only whitespace: no search (question 13).
- `search` longer than 2,000 characters after tidying: 422 `{ "error": "validation_failed", "fields": { "search": "too_long" } }`. Exactly 2,000 are accepted (questions 6, 12, 13).
- `search` that is not text, such as a list (`search[]=rails`) or an object (`search[a]=b`): 422 `{ "error": "validation_failed", "fields": { "search": "invalid" } }` (question 18).
- A `collection_id` or `tag_id` that is not mine (another user's, or a deleted one), or that is not a whole number (`abc`, `1.5`): 200 `{ "notes": [] }` (question 9).
- A `status` or `review` that is not one of the values, another letter case included (`Active`): 422 `{ "error": "validation_failed", "fields": { "status": "invalid" } }`, or `"review": "invalid"`. Every parameter that breaks a rule is named in the same answer, a `search` that is too long included (questions 9, 12; feature 09 question 8).
- A parameter left out or empty does not filter (question 12; feature 15 question 10).
- Every filter and the search combine. "Archived" with "Due today", "Overdue", or "Next 7 days" shows nothing, because those need an Active note. "Archived" with "No review scheduled" shows the archived notes with the interval None (questions 2, 7, 8; features 15, 16).
- "Next 7 days" leaves out notes due today and overdue notes: "Due today", "Overdue", and "Next 7 days" never overlap (question 7; features 15, 16).
- "Today" for "Next 7 days" is the date in my saved time zone, UTC until one is known (feature 12 question 1).
- Choosing a filter or "Clear search and filters" loads the list at once. Only typing in "Search" waits for the pause (question 5; feature 15 question 4).
- Only the answer to the latest search and filters is shown (question 5).
- No one signed in: 401 `{ "error": "unauthenticated" }`, whatever the parameters (feature 09).
- Another user's notes never match a search or a filter (requirements.md 1).
- States hold as of the list load. A note changed in this tab so that it no longer matches (edited, moved, retagged, archived, restored, or reviewed) stays in the list, with its new values, until the list loads again. A note created meanwhile shows at the top until then (feature 15 questions 6, 9).
- The search and the filters keep their values while a note or a form is open. A reload resets them (question 3; feature 15 question 8).
- The chosen collection or tag deleted in the left area: its filter goes back to "All", and the list loads again. A collection can be deleted only when it has no notes (question 10; AC-07). A chosen collection or tag renamed in the left area stays chosen, with its new name (question 10).
- "Collection" and "Tag" offer only "All" until the left area's lists load, and while they cannot load (question 16).
- "No notes yet" shows only when "Search" is empty, every filter shows "All", and I have no notes. With a search or any filter set, an empty list shows a message of question 11 (question 11; feature 09).
- The field "Search" takes at most 2,000 characters (question 17).
- UI states (requirements.md 4 `<ui_quality_checks>`): the empty states of question 11, the loading state "Loading…", and the alert "Could not load notes. Try again." with "Try again" (questions 11, 14).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

### 2026-11-09: A search that is not text

- Reason: the Plan step found that the spec does not say what the list request answers for a `search` parameter that is not text, such as `search[]=rails`. The server must answer it somehow, and the rest of the notes API refuses a value of the wrong type with `invalid`.
- Change: new question 18, answered with the agent's recommendation: 422 `{ "error": "validation_failed", "fields": { "search": "invalid" } }`, named in the same answer as every other parameter that breaks a rule.
- Change: edge cases: a new line for a `search` that is not text. No scenario changes: the browser never sends one.
- Stage: the spec went back to Design for this change, passed the Design checks again (every question answered; the new answer is in an edge case with its status code and error body; no implementation detail), and was approved again on 2026-11-09 under the owner's standing instruction (recommended options).

## Notes for Plan (draft)

From the research of 2026-11-09 (read-only probes in the containers). These move to `plan.md` in the Plan step.

- Depends on (planned): 09, 10, 12, 15, 16. Feature 10 is Done.
- SQLite is 3.54.1. Its LIKE and LOWER fold only ASCII letters (feature 06), so a search in any alphabet needs a folded copy of the text: NFC plus case folding, as for names, with each run of whitespace made one space (question 13). A match that does not use LIKE's wildcards keeps `%` and `_` as themselves (question 6).
- The collections and tags areas load their own lists (`frontend/src/NameListArea.tsx`); the filter's choices need those lists, their changes, and their load state (questions 10, 16).
- Risk: the AC-09 frontend tests use `getAllByRole('listitem')`, `getByRole('status')`, and `findByRole('alert')` without scoping. New empty states and alerts must not collide with them. The choice "No review scheduled" in "Review" has the same text as feature 12's list label, and "Collection" is also the note form's field label: tests should scope their queries.
- The tests for an unknown `status` or `review` value must use values no feature defines, such as `deleted` and `soon`.
- AC-27 (proposed): tests that depend on the date ("Next 7 days") fix the time and pass in any time zone.
