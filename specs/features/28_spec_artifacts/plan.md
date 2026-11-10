# Plan: 28_spec_artifacts

**Approved:** yes, 2026-11-09 (owner's standing instruction)
**Depends on:** 01 to 27 (the notes, the diagram, and the contract describe what they built; Polish starts only once each of them is Done)

## Approach

- Data, API, WebSocket, UI: no change. The result of this AC is documents, so the checks in `## Docs` are its acceptance (`specs/README.md`, Polish gates).
- Documents:
  - `specs/docs/domain/README.md` (new): the domain model as a whole, as a Mermaid `erDiagram`, and one line per area (question 4).
  - `specs/docs/implementation_notes.md` (new): one entry per AC with its approvals, the agent's own answers, how Verify ran with the items that did not pass, and its plan's deviations; then "Spec evolution" (questions 1, 2, 7).
  - `specs/docs/api_contract.md`: completed where the comparison with the code finds a gap (scenario "The API contract is complete").
  - `specs/README.md`: the section "What the specification describes" (question 8), the Layout, the Docs table, and the Polish step.
  - `README.md`: `## Specification` replaces `## Specifications` (questions 3, 5, 6).
- Decisions:
  - **No checklist items.** Build changes no code and no test. It runs the five checks (RSpec, Vitest, `npx tsc -b`, RuboCop, ESLint), which must be green, and sets `**Stage:** Verify`.
  - **The Test plan has no app walkthrough.** Every scenario is a document, so each entry names the Docs check that accepts it. Verify records each entry as `- Result: Not a walkthrough item, <date>: a document scenario, accepted by Docs item N in Polish.`, as feature 07 did for its item 5. The Polish entry gate (every item at `Pass`) applies to app walkthrough items, and this plan has none (`specs/README.md`: the Test plan covers only what the app does). When a Docs check passes, Polish adds `- Result: Pass, <date>, Docs item N's check (Polish): <what was seen>` under each entry it accepts. The last `Result:` line counts (feature 29, question 2), so the test mapping counts these entries as passed.
  - **Polish starts once features 01 to 27 are Done.** The notes record their approvals, Verify results, and deviations, and the diagram and the contract describe their code, so all of it must be final. A later change to one of them is recorded in the Polish of the feature that makes it (edge cases).
  - **README headings** (feature 30, questions 1 and 7): `## Specification`, with `### Workflow` (the framework, its steps and approval gates, where the main files are), `### How the specification guided the implementation` (the walk through feature 06), `### Artifacts` (the table of question 5), and `### What changed` (question 3), in that order. Feature 29 adds `### Test coverage` after them.
  - **What waits for feature 29.** `### Workflow` links to "Test coverage" (`README.md#test-coverage`), which feature 29's Polish writes; until then it is the one link the link check expects to fail. The artifact table's "Test plan or mapping" row and the last point of "What the specification describes" name the plans' Test plans and the implementation notes now, and feature 29's Polish adds `specs/docs/test_mapping.md` to both. Question 8 names the mapping, which exists only from AC-29 on, as question 5's edge case says of the table.
  - **Entries in "Spec evolution" are `###` headings**, `### <YYYY-MM-DD>, AC-NN: <title of the Changes entry>`, so that each line of the README's "What changed" can link to its anchor. They are ordered by date, then by AC. A Changes entry is a `### <YYYY-MM-DD>: <title>` heading under `## Changes` in a `spec.md`; other lines there, such as "No changes since approval", are not entries.
  - **Each AC entry of the notes has four lines,** so that an empty entry is never mistaken for a missing one (edge case): "Approval" (spec and plan: the owner's own review, the owner's standing approval of 2026-11-05, or the owner's standing instruction of 2026-11-09, as each `**Approved:**` line says); "Agent's own answers" (the questions whose answer says "agent's recommendation", linked, or "None."); "Verify" (by the owner by hand, or an automated walkthrough by Claude, and each Test plan item whose last `Result:` line does not start with "Pass", with its reason, or "None."); "Deviations" (one line per `## Deviations` entry of the plan, with its date and a link to `plan.md#deviations`, or "No deviations."). The entry heading is `## AC-NN: <AC text>`, and it links to the feature folder without copying its stage.
  - **The diagram shows entities and relations only.** The attributes stay in the area files, so each fact is in one place (sdd-polish ground rules). One entity per table of `backend/db/schema.rb`, named by its model class (`User`, `SignIn`, `Collection`, `Tag`, `Note`, `NoteTag`, and the ones features 12 to 27 add), and one relation per foreign key, with the "many" side at the table that holds the key.
  - **Gaps known at Plan.** `GET /up` (the Rails health check in `backend/config/routes.rb`) is not in `api_contract.md`. Drift listed by earlier Polish steps: the `422` of `PATCH /api/notes/:id` does not list the `tag_ids` codes; the status codes under Conventions say "422 for a name", though note fields get 422 too; the `## WebSocket` section says "None in feature 01". Polish fixes whichever is still there.
  - **The link check** used by the Docs checks of features 28 to 30: every relative link in the file resolves. Its path exists relative to the file, and its `#anchor`, if any, is the GitHub anchor of a heading in the target: the heading text in lowercase, with every character other than letters, digits, spaces, `-`, and `_` removed, and each space turned into `-`; a repeated heading gets `-1`, `-2`, and so on. Headings inside fenced code blocks are not headings. External links are not fetched.
  - **Not written here** (edge case): requirements.md 8's other deliverables (the frontend and backend source, the schema and migrations, the tests) are named with their folders in the README's "Stack" by feature 30 (its question 1), and the test mapping is feature 29's.
- Coverage: the scenarios and edge cases are covered by the Docs items, not by checklist items, because the result of this AC is documents. The Test plan entries say which Docs item accepts each scenario.

## Checklist

None. This AC adds no code and no tests. Its result is documents, written in Polish (`## Docs`), and their checks are its acceptance (`specs/README.md`, Polish gates).

## Test plan

Manual walkthrough for Verify. This AC changes nothing the app does, so each entry is a document scenario: Verify records it as "Not a walkthrough item", and Polish records its `Pass` when the Docs check named in it passes (see Approach).

1. Every required artifact has a location
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 5's checks of the artifact table.
   - Expected: Docs item 5's artifact table checks pass.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 5's artifact table checks passed.
2. The README explains the workflow
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 5's checks of `### Workflow` and of the section's order.
   - Expected: Docs item 5's workflow and order checks pass.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 5's workflow and order checks passed.
3. The walk through feature 06
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 5's check of the walk.
   - Expected: Docs item 5's walk check passes.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 5's walk check passed.
4. The domain model is shown as a whole
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 1's checks.
   - Expected: Docs item 1's checks pass.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 1's checks passed.
5. The domain model is complete
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 1's entity and attribute checks.
   - Expected: Docs item 1's entity and attribute checks pass.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 1's entity and attribute checks passed.
6. The implementation notes
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 2's checks.
   - Expected: Docs item 2's checks pass.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 2's checks passed.
7. At least one change is documented
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 2's "Spec evolution" check.
   - Expected: Docs item 2's "Spec evolution" check passes, with feature 01's change of the failure redirect among the entries.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 2's Spec evolution check passed, with feature 01's change among the 6 entries.
8. The README says what changed
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 5's check of `### What changed`.
   - Expected: Docs item 5's "What changed" check passes.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 5's What changed check passed.
9. The specification says where it answers each point
   - Steps: None in the app. This scenario is a document. Polish runs Docs item 4's check of "What the specification describes".
   - Expected: Docs item 4's check of that section passes.
   - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 4's check of the section passed.
10. The API contract is complete
    - Steps: None in the app. This scenario is a document. Polish runs Docs item 3's comparison of the code with the contract.
    - Expected: Docs item 3's comparison finds nothing missing.
    - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 3's comparison found one gap, `GET /up`, which is now in the contract.
11. The layout of the specs folder is current
    - Steps: None in the app. This scenario is a document. Polish runs Docs item 4's checks of the Layout and the Docs table.
    - Expected: Docs item 4's Layout and Docs table checks pass.
    - Result: Not a walkthrough item, 2026-11-10: a document scenario, accepted by the Docs check named in its steps in Polish.
   - Result: Pass, 2026-11-10, Docs check (Polish): Docs item 4's Layout and Docs table checks passed.

## Docs

Written in Polish, from the repository as it is once features 01 to 27 are Done. The checks are this AC's acceptance: record a `- Result:` under each `Check:` line. The link check is defined in Approach.

- [x] 1. `specs/docs/domain/README.md` (create): what the file shows; a Mermaid `erDiagram` block with one entity per table of `backend/db/schema.rb`, named by its model class, and one relation line per foreign key, each with its cardinality and a short label in quotes (a user owns sign-ins, collections, tags, and notes; a collection holds notes; a note's tags go through `NoteTag`; and the relations features 12 to 27 add); then one line per area file in `specs/docs/domain/` (users, collections, tags, notes, reviews, notifications, as they exist), each linking to its file and naming the entities it describes (AC-28)
  - Check: `grep -oE 'create_table "[a-z_]+"' backend/db/schema.rb | cut -d'"' -f2 | sort` compared with the entities in the diagram: each table has exactly one entity, named by its model class (`backend/app/models/<singular>.rb`), and the diagram has no other entity
    - Result: Pass, 2026-11-10, 7 tables (collections, note_tags, notes, review_dismissals, sign_ins, tags, users) and 7 entities in the diagram (Collection, Note, NoteTag, ReviewDismissal, SignIn, Tag, User), one each, each with a model in `backend/app/models/`; no other entity.
  - Check: `grep -E '^\s*add_foreign_key' backend/db/schema.rb` compared with the relation lines: each foreign key is one relation between its two entities, with `o{` or `|{` at the table that holds the key, and the diagram has no relation without a foreign key
    - Result: Pass, 2026-11-10, 9 `add_foreign_key` lines and 9 relation lines, each between the same two entities with `o{` at the table that holds the key; no relation without a foreign key.
  - Check: every line between the opening `` ```mermaid `` and its closing fence is `erDiagram`, empty, or a relation line matching `^\s*[A-Z][A-Za-z]* +(\|\||\|o)--(o\{|\|\{|o\||\|\|) +[A-Z][A-Za-z]* *: *"[^"]+"$`: no other line
    - Result: Pass, 2026-11-10, every line of the Mermaid block is `erDiagram`, empty, or a relation line that matches the pattern (script, 0 other lines).
  - Check: `ls specs/docs/domain/*.md | grep -v README.md` gives one area line each, every entity of the diagram is named by exactly one area line, and every column of each table in `backend/db/schema.rb` is in the attributes table of the area file that names its entity (a missing one is added to that file as a ticked item "(found in Polish)"); the link check finds no broken link
    - Result: Pass, 2026-11-10, 6 area files (users, collections, tags, notes, reviews, notifications), 6 area lines; each of the 7 entities is named by exactly one area line (reviews names none: it is fields and states of notes); every column of the 7 tables is in the attributes table of its area file (script, 0 missing); the link check found no broken link.
- [x] 2. `specs/docs/implementation_notes.md` (create): what the file records, and that the stage of a feature lives only in its `spec.md`; one entry per AC from AC-01 to AC-28, in AC order, each `## AC-NN: <AC text>` with a link to its feature folder and the four lines of Approach (Approval, Agent's own answers, Verify, Deviations); then `## Spec evolution`, with one `### <YYYY-MM-DD>, AC-NN: <title>` entry per `## Changes` entry of the feature specs, in date order, each with one line on what changed and a link to the entry in its `spec.md`. The AC-28 entry is written last, after Docs items 1 and 3 to 5 and the Test plan results (AC-28)
  - Check: `grep -oE '^## AC-[0-9]{2}' specs/docs/implementation_notes.md | paste -sd' ' -` equals `AC-01 AC-02 … AC-28` (28 entries, in order), each entry links to an existing `../features/NN_<topic>/` folder, and `grep -cE '\*\*Stage:\*\*|Stage: (Design|Plan|Build|Verify|Polish|Ship|Done)' specs/docs/implementation_notes.md` is 0
    - Result: Pass, 2026-11-10, 28 entries AC-01 to AC-28 in order, each links to its existing feature folder; the Stage grep prints 0.
  - Check: for each AC, "Approval" agrees with `grep -h '^\*\*Approved' specs/features/NN_*/spec.md specs/features/NN_*/plan.md`; "Agent's own answers" lists exactly the questions counted by `grep -cE "^\s*- Answer:.*agent's recommendation" specs/features/NN_*/spec.md`, or says "None." when that count is 0
    - Result: Pass, 2026-11-10, each AC's Approval quotes both `**Approved:**` lines (script, 0 mismatches); "Agent's own answers" lists the questions the grep counts, or "None." when the count is 0 (script, 0 mismatches).
  - Check: for each AC, the items "Verify" lists are exactly the Test plan items whose last `Result:` line does not start with "Pass", or that have none (`awk '/^## Test plan/{t=1;next} /^## /{t=0} t&&/^[0-9]+\. /{i=$0; r[i]="none"} t&&/Result:/{r[i]=$0} END{for(k in r) if (r[k] !~ /Result: Pass/) print k}' specs/features/NN_*/plan.md`), each with its reason, or "None." when there is none
    - Result: Pass, 2026-11-10, each AC lists exactly the Test plan items whose last Result does not start with Pass (script, 0 mismatches): feature 01's items 2, 3, 5 (waived), 03's item 3 (skipped), 07's item 5 (document item); "None." for every other AC.
  - Check: for each AC, the number of lines under "Deviations" equals `awk '/^## Deviations/{t=1;next} /^## /{t=0} t&&/^- [0-9]{4}-[0-9]{2}-[0-9]{2}/{n++} END{print n+0}' specs/features/NN_*/plan.md`, each with the entry's date, or the entry says "No deviations." when that count is 0
    - Result: Pass, 2026-11-10, each AC's Deviations line count equals the awk count (script, 0 mismatches), each with its date; "No deviations." where the count is 0.
  - Check: the `###` entries under `## Spec evolution` are exactly the headings `grep -hE '^### [0-9]{4}-[0-9]{2}-[0-9]{2}: ' specs/features/*/spec.md` (each with its feature), there is at least one, feature 01's "The failure redirect names the provider" is among them, their dates never decrease, and each links to the anchor of its entry in its `spec.md`; the link check finds no broken link
    - Result: Pass, 2026-11-10, 6 `###` entries under Spec evolution, equal to the 6 headings the grep finds (AC-01, AC-02, AC-12, AC-17, AC-27, AC-26); feature 01's "The failure redirect names the provider" is the first; dates 2026-11-05, 2026-11-05, 2026-11-09, 2026-11-09, 2026-11-09, 2026-11-10 never decrease; the link check found no broken link.
- [x] 3. `specs/docs/api_contract.md` (update): add every endpoint, response, and WebSocket channel or message the comparison below finds missing, starting with `GET /up` (known at Plan); fix any of the drift named in Approach that is still there (AC-28)
  - Check: the routes of `docker compose run --rm backend bin/rails routes`, without the `(.:format)` suffix, plus `POST /auth/google_oauth2` and `POST /auth/github` (OmniAuth's request phase) and the WebSocket address `/cable`, compared with the contract: each method and path has its `### ` entry, and a `PUT` route counts as documented by the line "`PUT` to the same path does the same" in its `PATCH` entry. Nothing is missing.
    - Result: Pass, 2026-11-10, all 22 routes of `bin/rails routes` (PUT counted by its PATCH entry) plus `POST /auth/google_oauth2`, `POST /auth/github`, and `GET /up` have a `### ` entry; `GET /up` was missing and is added under "Health check" (found in Polish); `/cable` is in the WebSocket section.
  - Check: the `## WebSocket` section names each channel class in `backend/app/channels/` other than `ApplicationCable::Channel` and `ApplicationCable::Connection`, each message type the server sends (the values found by `grep -rhoE '(type: |"type" => )"[a-z_]+"' backend/app`), and each client action (each public method of a channel other than `subscribed` and `unsubscribed`), with its payload: nothing is missing, and the section no longer says "None in feature 01"
    - Result: Pass, 2026-11-10, the WebSocket section names `ReviewRemindersChannel` (the only channel besides the two base classes), the server messages `review_reminders` and `error` with the Action Cable ones, and the client actions `ack` (and `perform_action`), with payloads; "None in feature 01" is gone; the `tag_ids` codes and the 422 wording are there.
- [x] 4. `specs/README.md` (update): a section `## What the specification describes` before `## Layout`, with one line per point of requirements.md 2 `<specification_must_describe>`, each naming where the specification answers it (question 8; the test mapping waits for feature 29, see Approach); the Layout tree shows `docs/domain/README.md`, the area files, and `docs/implementation_notes.md`; the Docs table gets rows for `domain/README.md` (the model as a whole: entities and relations; leaves out attributes and rules) and `implementation_notes.md` (per AC: approvals, the agent's own answers, Verify, deviations; spec evolution; leaves out the stage and the behavior); the Polish step (step 6) gets the line: "Add the feature's entry to `docs/implementation_notes.md`, and add each new `## Changes` entry of its spec to "Spec evolution" there and to the README's "What changed"." (questions 2 and 3, edge cases) (AC-28)
  - Check: `grep -n '^## ' specs/README.md` shows `## What the specification describes` before `## Layout`; the section has six lines, in the order of requirements.md 2 (what the app should do, what entities exist, what business rules must be enforced, what API behavior is expected, what edge cases are handled, how the implementation satisfies the acceptance criteria), and `test -e` succeeds for every path it names
    - Result: Pass, 2026-11-10, `## What the specification describes` is line 11 and `## Layout` is line 22; the section has six lines in the order of requirements.md 2; `test -e` succeeds for every path it names (the one to `docs/test_mapping.md` waits for feature 29 and is named as such, not as a link).
  - Check: `sed -n '/^## Layout/,/^## Docs/p' specs/README.md` names `README.md` under `domain/` and `implementation_notes.md`; the Docs table has one row each for `domain/README.md` and `implementation_notes.md`; step 6 has the Polish line above; the link check finds no broken link
    - Result: Pass, 2026-11-10, the Layout shows `README.md` under `domain/` and `implementation_notes.md`; the Docs table has one row each; step 6 has the Polish line (as step 4); the link check found no broken link.
- [x] 5. `README.md` (update): `## Specification` replaces `## Specifications`. `### Workflow`: the project's own spec-driven framework (project.md), described in `specs/README.md`; its steps (Foundation for new tasks, then Design, Plan, Build, Verify, Polish, Ship), with test-first Build and the owner's approval at the end of Design and of Plan; where the main files are (`requirements.md`, `specs/features/NN_topic/spec.md` and `plan.md`, `specs/docs/`); a link to "What the specification describes" in `specs/README.md`, and one to "Test coverage" for the requirements the automated tests cover (AC-29). `### How the specification guided the implementation`: the walk through feature 06, one step per stage, each with a link: AC-06 in `requirements.md` section 10; the spec's questions with their answers, scenarios, and edge cases; the approval in its header; the plan's checklist, each item with the test written first; the tests named "AC-06 …" (`backend/spec/requests/collections_spec.rb`, `frontend/src/Collections.test.tsx`, and `grep -r "AC-06" backend frontend`); its Verify results in the plan's Test plan; the `specs/docs/` entries its Polish wrote (`domain/collections.md`, `api_contract.md#collections`, `conventions.md`). `### Artifacts`: the table of question 5. `### What changed`: one line per "Spec evolution" entry, in its order, each linking to the entry in `specs/docs/implementation_notes.md` (AC-28)
  - Check: `grep -nE '^## Specifications?$' README.md` gives only `## Specification`, and `sed -n '/^## Specification$/,/^## /p' README.md | grep '^### '` gives `### Workflow`, `### How the specification guided the implementation`, `### Artifacts`, `### What changed`, in that order
    - Result: Pass, 2026-11-10, `grep` gives only `## Specification` (line 298); its `###` headings are Workflow, How the specification guided the implementation, Artifacts, What changed, in that order.
  - Check: `### Workflow` names the framework, `specs/README.md` (linked), each of the seven steps, test first, the two approval gates, and the three places of the main files
    - Result: Pass, 2026-11-10, `### Workflow` names the framework, `specs/README.md` (linked), the seven steps, test first, "owner approves" twice (Design and Plan), and the three places (`requirements.md`, `spec.md` and `plan.md`, `specs/docs`).
  - Check: the artifact table has eight rows whose first column equals requirements.md 2 `<required_artifacts>`, line for line and in order, and `test -e` succeeds for every file and folder named in it (the "Test plan or mapping" row names the plans' Test plans until feature 29)
    - Result: Pass, 2026-11-10, the table has 8 rows, and the first column equals the eight lines of `<required_artifacts>` in order (script); every file and folder named exists.
  - Check: the walk has one step per stage from the AC to Polish, and each of its links resolves and opens what the step names (`requirements.md` has the line "AC-06: A user can create, rename, and delete collections"; the spec anchors `#questions`, `#scenarios`, `#edge-cases`; the plan anchors `#checklist`, `#test-plan`; both test files contain "AC-06")
    - Result: Pass, 2026-11-10, the walk has 7 steps (AC, spec, approval, plan, tests, Verify, Polish); every link resolves; `requirements.md` has "AC-06: A user can create, rename, and delete collections"; the anchors `#questions`, `#scenarios`, `#edge-cases`, `#checklist`, `#test-plan` exist; both test files contain "AC-06" (14 and 17 times).
  - Check: `### What changed` has as many lines as "Spec evolution" has entries, in the same order, and each line links to the anchor of its entry
    - Result: Pass, 2026-11-10, `### What changed` has 6 lines, the same as the 6 entries of Spec evolution, in the same order; each links to the anchor of its entry (the link check resolves them).
  - Check: the link check of the README finds no broken link but `#test-coverage`, which feature 29's Polish resolves
    - Result: Pass, 2026-11-10, the link check of the README found one broken link, `#test-coverage`, which feature 29's Polish resolves.

## Deviations

- 2026-11-10: Build started while features 10 and 21 were at Verify, under the owner's standing instruction (pipelined run). Feature 21 was Done before Polish started; feature 10 was still at Verify, and its Docs are not part of this AC's checks beyond what `specs/docs/` already holds. The Docs checks were run again at the end of Polish. Finish gate, 2026-11-10: RSpec 311 examples, 0 failures; Vitest 247 passed; `npx tsc -b`, RuboCop (135 files), and ESLint clean.
