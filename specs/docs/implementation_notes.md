# Implementation notes

What the feature folders do not show in one place: for each acceptance criterion, how its spec and plan were approved, which answers were the agent's own recommendation, how its Verify was run and what did not pass, and how the build differed from the plan. The last section, [Spec evolution](#spec-evolution), lists every change made to an approved spec.

- The notes link to each feature's folder and copy no stage: the stage of a feature lives only in the header of its `spec.md` (`specs/README.md`).
- "Approval" quotes the `**Approved:**` lines of `spec.md` and `plan.md`. The owner's standing approval of 2026-11-05 and the standing instruction of 2026-11-09 (continued on 2026-11-10) mean that the recommended option was taken for each question; the owner reviews those answers afterwards.
- "Agent's own answers" lists the questions of the spec whose answer says "the agent's recommendation": the research found no recommended option, so the agent chose one. Find them with `grep -rn "agent.s recommendation" specs`.
- "Verify" says how the walkthrough of the plan's Test plan was run, and lists every Test plan item whose last `Result:` does not start with "Pass", with its reason. "None." means every item passed.
- "Deviations" has one line per entry of the plan's `## Deviations`, with its date and a link to the section. "No deviations." means the plan has none.

## AC-01: A user can sign in with Google

Feature folder: [`specs/features/01_google_sign_in/`](../features/01_google_sign_in/)

- **Approval:** spec: yes, 2026-11-05 (the owner's own review); plan: yes, 2026-11-05 (the owner's own review).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand. Items that did not pass:
  - Item 2. First sign-in with Google: Waived by the owner, 2026-11-05. Not run and not Pass; see the waiver in Deviations.
  - Item 3. Sign in again with the same Google account: Waived by the owner, 2026-11-05. Not run and not Pass; see the waiver in Deviations.
  - Item 5. Google sign-in fails: Waived by the owner, 2026-11-05. Marked complete, not run and not Pass, at the owner's request.
- **Deviations:** 15, in the [plan](../features/01_google_sign_in/plan.md#deviations):
  - 2026-11-05: Items 10 to 12 were ticked as covered.
  - 2026-11-05: Test-only client id and secret.
  - 2026-11-05: Test mode is off in the sign-in start example (item 6) as well as the state check (item 13).
  - 2026-11-05: `OmniAuth.config.full_host` comes from the new variable `APP_BASE_URL` (default `http://localhost:3000`).
  - 2026-11-05: `Api::CsrfController` includes `ActionController::RequestForgeryProtection`, because API mode leaves out the helper that `form_authenticity_token` needs.
  - 2026-11-05: Verify found that the request log records the callback's OAuth `code` and `state` in plain text, because the parameter filter list does not cover them.
  - 2026-11-05: Verify item 2 ran with the existing account, not a new one.
  - 2026-11-05: Verify items 2, 3 and 5 were skipped at the owner's request, and are not recorded as Pass.
  - 2026-11-05 (owner waiver): Verify items 2, 3 and 5 are waived.
  - 2026-11-05: During Verify, `compose.yaml` was changed to pass `.env` into the backend container (`env_file`, optional), and a root `.gitignore` was added with `.env`.
  - 2026-11-05 (Polish): Drift check found no mismatch between the feature's documents and the code.
  - 2026-11-05 (Polish): Found and listed, not fixed. The session cookie is not marked `secure` in the app code.
  - 2026-11-05 (Polish, out of scope): `backend/config/cable.yml` uses Redis in production, but the Gemfile comments out the `redis` gem.
  - 2026-11-05 (Changes, failure names the provider): Items 24 and 25 were added for the spec change approved on the same day.
  - 2026-11-05: Known limitation, not fixed here.

## AC-02: A user can sign in with GitHub

Feature folder: [`specs/features/02_github_sign_in/`](../features/02_github_sign_in/)

- **Approval:** spec: yes, 2026-11-05 (the owner's own review); plan: yes, 2026-11-05 (the owner's own review).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). None.
- **Deviations:** 5, in the [plan](../features/02_github_sign_in/plan.md#deviations):
  - 2026-11-05: Items 3, 10, 11, 12 and 13 were ticked as covered.
  - 2026-11-05: Item 15 (GitHub busy state) was ticked as covered.
  - 2026-11-05: The sign-in callbacks share one controller method (`Auth::SessionsController#sign_in_from_provider`) for Google and GitHub.
  - 2026-11-05: Item 13's check uses the `github` provider name as the redirect name.
  - 2026-11-05: Added a log-redaction test for GitHub callbacks (`code` and `state` not in the request log).

## AC-03: A local user record is created automatically on first successful SSO sign-in

Feature folder: [`specs/features/03_user_auto_create/`](../features/03_user_auto_create/)

- **Approval:** spec: yes, 2026-11-05 (the owner's standing approval for spec, plan, and workflow gates through feature 06, given 2026-11-05; the three answers above are the owner's own); plan: yes, 2026-11-05 (the owner's standing approval for spec, plan, and workflow gates through feature 06).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). Items that did not pass:
  - Item 3. No usable name fails cleanly: Skipped, 2026-11-09, not Pass. GitHub always sends a login, so the account this item needs cannot exist.
- **Deviations:** 5, in the [plan](../features/03_user_auto_create/plan.md#deviations):
  - 2026-11-05: The race fix (item 2) and the no-usable-name handling (item 3) were written before this plan, during Design.
  - 2026-11-05: The rescue in `find_or_create_user` first caught every `RecordInvalid`, which turned a no-name sign-in into a 404.
  - 2026-11-05: Item 1 was ticked as covered. Its behavior is already in features 01 and 02, and the test adds the explicit AC-03 check.
  - 2026-11-09: Test plan item 3 (no usable name) is recorded as Skipped, not Pass.
  - 2026-11-09: Polish added Docs item 3 (`docs/api_contract.md`).

## AC-04: Authentication persists across page refresh

Feature folder: [`specs/features/04_session_persistence/`](../features/04_session_persistence/)

- **Approval:** spec: yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question); plan: yes, 2026-11-05 (owner's standing approval of 2026-11-05).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). None.
- **Deviations:** 1, in the [plan](../features/04_session_persistence/plan.md#deviations):
  - 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end).

## AC-05: A user can log out

Feature folder: [`specs/features/05_logout/`](../features/05_logout/)

- **Approval:** spec: yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question); plan: yes, 2026-11-05 (owner's standing approval of 2026-11-05).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). None.
- **Deviations:** 4, in the [plan](../features/05_logout/plan.md#deviations):
  - 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end).
  - 2026-11-05: Build started while dependencies are not at Done: 02 (GitHub sign-in), 03 (user record) and 04 (session persistence) are at Verify.
  - 2026-11-05: Item 6 was ticked as covered. Its test passed before any code of its own, because item 5 deletes only this browser's sign-in.
  - 2026-11-05: Item 11 was ticked as covered.

## AC-06: A user can create, rename, and delete collections

Feature folder: [`specs/features/06_collections_crud/`](../features/06_collections_crud/)

- **Approval:** spec: yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question); plan: yes, 2026-11-05 (owner's standing approval of 2026-11-05).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). None.
- **Deviations:** 10, in the [plan](../features/06_collections_crud/plan.md#deviations):
  - 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end).
  - 2026-11-05: Build started while a dependency is not at Done: 05 (logout) is at Verify.
  - 2026-11-05: The case-folded column is `folded_name`, not `name_key` (Approach, Data and Decisions).
  - 2026-11-05: Item 16 was ticked as covered.
  - 2026-11-05: Item 18 adapted the stubs of the main-layout tests that answer every request the same way, as planned, and two more than the plan named: `AC-01 signed-in user sees the ...
  - 2026-11-05: Item 21 was ticked as covered.
  - 2026-11-05: While item 26 was built, the item 20 test failed once in four runs.
  - 2026-11-05: Build stopped before item 34 was verified.
  - 2026-11-06: Build resumed once Docker was back.
  - 2026-11-06: Item 35 was added during Build, under the owner's standing approval of 2026-11-05.

## AC-07: Collection deletion behavior is documented

Feature folder: [`specs/features/07_collection_delete_rule/`](../features/07_collection_delete_rule/)

- **Approval:** spec: yes, 2026-11-09 (the owner's own review); plan: yes, 2026-11-09 (owner's instruction of 2026-11-09: approve the plan and build it).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand. Items that did not pass:
  - Item 5. The deletion behavior is documented: Not a walkthrough item. The owner left its documentation to Claude: the README and `docs/` items in `## Docs`, written in Polish, are its acceptance.
- **Deviations:** 3, in the [plan](../features/07_collection_delete_rule/plan.md#deviations):
  - 2026-11-09: Polish of this feature ran before its stage gate was set.
  - 2026-11-09: Build started while feature 09 is at Build, not Done.
  - 2026-11-09: a conflict with an approved document, not changed here: feature 09's approved spec (scenario at its line 275) and its plan's Test plan (the entry for the 409, around ...

## AC-08: A user can create, rename, and delete tags

Feature folder: [`specs/features/08_tags_crud/`](../features/08_tags_crud/)

- **Approval:** spec: yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question); plan: yes, 2026-11-05 (owner's standing approval of 2026-11-05).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand (reported as passed). None.
- **Deviations:** 8, in the [plan](../features/08_tags_crud/plan.md#deviations):
  - 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end).
  - 2026-11-06: Build started while dependencies are not at Done: 05 (logout) and 06 (collections) are at Verify.
  - 2026-11-06: Feature 07 (AC-07, collection deletion behavior) is still at Design, so 08 is built out of folder order, as this run's brief asked.
  - 2026-11-09: Item 1 already sets `folded_name` when the name is assigned, as `Collection` does.
  - 2026-11-09: Items 14, 15, and 16 were ticked as covered.
  - 2026-11-09: Item 35 was ticked as covered.
  - 2026-11-09: Docker Desktop stopped once during item 27 (the daemon socket was gone).
  - 2026-11-09: Item 36 dropped the `Collection` type that `src/Collections.tsx` exported, and the `Tag` type of `src/Tags.tsx`.

## AC-09: A user can create, edit, archive, restore, and delete notes

Feature folder: [`specs/features/09_notes_crud/`](../features/09_notes_crud/)

- **Approval:** spec: yes, 2026-11-05 (owner's standing approval of 2026-11-05: take the recommended option for each question); plan: yes, 2026-11-05 (owner's standing approval of 2026-11-05).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand. None.
- **Deviations:** 10, in the [plan](../features/09_notes_crud/plan.md#deviations):
  - 2026-11-05: Spec and plan approved under the owner's standing approval of 2026-11-05 (auto-approve, take the recommended options, leave manual steps for the end).
  - 2026-11-09: Build started while dependencies are not at Done: 05 (logout), 06 (collections), and 08 (tags) are at Verify.
  - 2026-11-09: Feature 07 (AC-07, collection deletion behavior) is still at Design, so 09 is built out of folder order, as this run's brief asked.
  - 2026-11-09: Deviation from the approved spec, recorded after Done, not by a Change.
  - 2026-11-09: Polish of this feature ran before its Verify gate was met.
  - 2026-11-09: Items 16, 17, and 18 were ticked as covered.
  - 2026-11-09: Item 26 was ticked as covered.
  - 2026-11-09: Item 40 was ticked as covered.
  - 2026-11-09: Build stopped after item 43, because the owner asked (through the coordinator) to finish now.
  - 2026-11-09: Items 44 to 50 were built after the entry above, which is superseded: they are built and ticked.

## AC-10: A user can assign and remove tags from notes

Feature folder: [`specs/features/10_note_tags/`](../features/10_note_tags/)

- **Approval:** spec: yes, 2026-11-09 (owner approved the spec); plan: yes, 2026-11-10 (the revision that adds items 31 and 32 and Docs items 6 to 8: owner's standing instruction of 2026-11-09; the plan before it: owner approved, 2026-11-09).
- **Agent's own answers:** None.
- **Verify:** by the owner by hand. None.
- **Deviations:** 10, in the [plan](../features/10_note_tags/plan.md#deviations):
  - 2026-11-09: Items 3 and 4 were ticked without a red step that failed for the planned reason.
  - 2026-11-09: `add_tag` on `Note` (not in the plan) adds a tag once.
  - 2026-11-09: A `null` item inside `tag_ids` (`[null]`) is read by Rails as an empty list (deep munge, checked in the request params), so it removes every tag rather than answering ...
  - 2026-11-09: Item 16 is ticked for a narrower case than the plan wrote.
  - 2026-11-09: A link to a tag that is gone is refused by the `NoteTag` model's "tag must exist" validation before the database sees it (probe: `ActiveRecord::RecordInvalid`).
  - 2026-11-09: The create's note and its tags are written in one transaction (features/10_note_tags Decisions).
  - 2026-11-09: One feature 09 frontend assertion was changed, not only fixtures and stubs, as item 30 requires.
  - 2026-11-09: Build complete. The items that passed without a red step that failed for the planned reason, listed so none is hidden: 7 (a create without tag_ids gives no tags, already ...
  - 2026-11-10: Plan revised in the final stabilization step, under the owner's standing instruction of 2026-11-09 (sdd-plan step 6: ticked items kept; items 31 and 32 and Docs items 6 ...
  - 2026-11-10: Items 31 and 32 built, each red first for the planned reason.

## AC-11: A user can move notes between collections

Feature folder: [`specs/features/11_note_move/`](../features/11_note_move/)

- **Approval:** spec: yes, 2026-11-09 (owner approved the spec); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 4, in the [plan](../features/11_note_move/plan.md#deviations):
  - 2026-11-09: Two AC-09 assertions that encode the interim rule are replaced, as the spec's Notes for Plan name.
  - 2026-11-09 (Build): As built, (a) removed only the `collection_id` part of that step (and its unused "Books" collection); (b) removed only the one `queryByLabelText('Collection')` line and ...
  - 2026-11-09 (Build): Eight tests passed at once, as their items predicted, and are kept as guards.
  - 2026-11-09 (Build): The race rescue that `create` had is now one private method, `render_refused_row`, shared by `create` and `update` (`backend/app/controllers/api/notes_controller.rb`).

## AC-12: A user can configure review intervals for notes

Feature folder: [`specs/features/12_review_interval_setting/`](../features/12_review_interval_setting/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction; revised and approved again on 2026-11-09 after Verify: items 42 and 43, Test plan item 23, Docs item 9).
- **Agent's own answers:** questions 15, 17, 18, 19 of the [spec](../features/12_review_interval_setting/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 8, in the [plan](../features/12_review_interval_setting/plan.md#deviations):
  - 2026-11-09: Build started while feature 11 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-09: item 6 passed before its code, as the item foresaw: item 4's callback fills only a missing date (`||=`).
  - 2026-11-09: item 17 passed before its code.
  - 2026-11-09: item 20 passed before its code, as the item foresaw: the checks of features 05 and 09 (sign-in, JSON body, anti-forgery token, and the lookup through ...
  - 2026-11-09: the `git diff` parts of the checks of items 10 and 25 were done another way, because the files hold the uncommitted work of features 03 to 11 (`notes_spec.rb`, ...
  - 2026-11-09: two feature 10 tests in `frontend/src/NoteTags.test.tsx` ("AC-10 the Tags group loads on its own, shows its failure, and Try again loads it" and "AC-10 a chosen tag ...
  - 2026-11-09: item 40 passed before its code, as the item foresaw: items 37 to 39 already send each review field only when it differs from the note's.
  - 2026-11-09 (after Verify; the feature went from Done back to Build): the zone data changes from the backend image's `/usr/share/zoneinfo` to the `tzinfo-data` gem, installed on every platform (items 42 and 43; Approach, "Known zones"; ...

## AC-13: A user can mark a note as reviewed

Feature folder: [`specs/features/13_mark_reviewed/`](../features/13_mark_reviewed/)

- **Approval:** spec: yes, 2026-11-09 (owner approved the spec); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 9, in the [plan](../features/13_mark_reviewed/plan.md#deviations):
  - 2026-11-09: Build started while feature 12 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-09: item 5 passed before its code, as the item foresaw: items 2 and 4 already make the second review's save write nothing, because the date is already today and ...
  - 2026-11-09: item 6 passed before its code, as the item foresaw: nothing refuses an early review, and the review does not write the next review date.
  - 2026-11-09: item 7 passed before its code, as the item foresaw: item 2's review refuses no note of the user.
  - 2026-11-09: item 8 passed before its code, as the item foresaw: item 2's action reads only the id.
  - 2026-11-09: item 9 passed before its code, as the item foresaw: item 2's action looks the note up through `current_user.notes`, as the other note actions do.
  - 2026-11-09: item 10 passed before its code, as the item foresaw: the checks of features 05, 06, and 09 run before every notes action.
  - 2026-11-09: item 11 passed before its code, as the item foresaw (as item 10).
  - 2026-11-09: item 18 passed before its code, as the item foresaw: item 13 shows "Mark as reviewed" for every note.

## AC-14: The app recalculates the next review date after review

Feature folder: [`specs/features/14_review_date_recalc/`](../features/14_review_date_recalc/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 13, in the [plan](../features/14_review_date_recalc/plan.md#deviations):
  - 2026-11-09: Build started while feature 12 was at Polish and feature 13 at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-09: how the guards below were proved.
  - 2026-11-09: item 3 passed before its code, as the item foresaw: item 2's review uses feature 12's `review_date_after`, whose monthly step is `Date#next_month`.
  - 2026-11-09: item 4 passed before its code, as the item foresaw: item 2's review counts from today.
  - 2026-11-09: item 5 passed before its code, as the item foresaw: `review_date_after` gives nil for the interval none.
  - 2026-11-09: item 6 passed before its code, as the item foresaw: item 2's review sets the new date whatever the status.
  - 2026-11-09: item 7 passed before its code, as the item foresaw: item 2's review reads `user.today` once for both dates.
  - 2026-11-09: item 8 passed before its code, as the item foresaw: item 2's review uses feature 12's `review_date_after`, which adds days and months with Ruby's `Date`.
  - 2026-11-09: item 9 passed before its code, as the item foresaw: item 2's review reads the interval the note has when it is saved.
  - 2026-11-09: item 10 passed before its code, as the item foresaw: item 2's review sets today plus the interval on every review, and a review that changes nothing writes nothing ...
  - 2026-11-09: item 11 passed at once, as the item foresaw: feature 13's checks (401, 400, 403, 404) run before the review.
  - 2026-11-09: item 12 passed at once, as the item foresaw: feature 13's review shows the answer's whole note in the detail, and feature 12's "Next review" row shows its date.
  - 2026-11-09: item 14 passed once item 13 was built, as the item foresaw: only a 200 answer reaches the detail and `onChanged`.

## AC-15: The app shows notes due for review today

Feature folder: [`specs/features/15_review_due_today/`](../features/15_review_due_today/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 7, 8, 9, 10 of the [spec](../features/15_review_due_today/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 10, in the [plan](../features/15_review_due_today/plan.md#deviations):
  - 2026-11-09: Build started while feature 12 was at Verify (reopened for its time-zone fix), feature 13 at Polish, and feature 14 at Verify, under the owner's standing instruction ...
  - 2026-11-09: how the guards below were proved.
  - 2026-11-09: item 8 passed at once, as the item foresaw: `require_signed_in_user` runs first (`prepend_before_action`), and `index` checks the filter only inside the action.
  - 2026-11-09: item 9 passed at once, as the item foresaw: items 4 and 6 read `current_user.today` once per request (`Api::NotesController#today`).
  - 2026-11-09: a new file, `frontend/src/ReviewStateLabel.tsx`, made in item 11's refactor.
  - 2026-11-09: item 15 passed at once, as the item foresaw: item 13 keeps the choice in `Notes` (`review`), and `NoteFilters` only shows it, so the filter can unmount with the list and ...
  - 2026-11-09: the list's loading (Decisions, "Frontend loading"), built in items 13, 16, and 17 and settled in item 17's refactor.
  - 2026-11-09: item 18 passed once item 13 was built, as the item foresaw: the filtered list goes through the list's own `fetchNotes`, which turns a 401 into the sign-in screen.
  - 2026-11-09: item 19 passed once item 13 was built, as the item foresaw: a created note goes to the top of the kept answer (`changeList`), as in feature 09, and nothing loads the ...
  - 2026-11-09: item 20 passed once items 10, 11, and 13 were built, as the item foresaw: the label comes from the `review_state` of the note the list or the detail holds, and a review ...

## AC-16: The app shows overdue review notes

Feature folder: [`specs/features/16_review_overdue/`](../features/16_review_overdue/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 7, in the [plan](../features/16_review_overdue/plan.md#deviations):
  - 2026-11-09: Build started while feature 15 was at Verify and feature 12 at Verify (reopened for its time-zone fix), under the owner's standing instruction (pipelined run).
  - 2026-11-09: how the guards below were proved.
  - 2026-11-09: item 4 passed once item 3 was built, as the item foresaw: `NoteListFilter` compares `review` exactly with its list of values, and `require_signed_in_user` runs first.
  - 2026-11-09: item 5 passed once item 3 was built, as the item foresaw: feature 15 reads `current_user.today` once per request, and a create's answer carries `review_state`.
  - 2026-11-09: item 7 passed before its code, which the plan did not foresee.
  - 2026-11-09: item 10 passed once items 6 and 7 were built, as the item foresaw: the detail shows the note the create answered, and the created note goes to the top of the list as it ...
  - 2026-11-09: item 11 passed once items 6 and 8 were built, as the item foresaw: the loading, the failure, "Try again", and the kept list are feature 15's, keyed on the address, so ...

## AC-17: A user can search and filter notes

Feature folder: [`specs/features/17_search_and_filter/`](../features/17_search_and_filter/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 12, 13, 14, 15, 16, 17, 18 of the [spec](../features/17_search_and_filter/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner); some items were checked against the code in Polish. None.
- **Deviations:** 19, in the [plan](../features/17_search_and_filter/plan.md#deviations):
  - 2026-11-09: Build started while feature 16 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-09: item 2's migration was run without a moment in which other lanes could see it pending.
  - 2026-11-09: how the guards below were proved.
  - 2026-11-09: item 5 passed once items 3 and 4 were built, as the item foresaw: the copies and the search text go through the one rule, `Note.fold_for_search`.
  - 2026-11-09: item 6 passed once items 3 and 4 were built, as the item foresaw: `fold_for_search` ends with `squish`, for the copies and the search text, and a search that is blank is ...
  - 2026-11-09: item 7 passed once item 4 was built, as the item foresaw: `Note.matching` uses `instr`, which takes the text as it is.
  - 2026-11-09: item 8 passed once item 4 was built, as the item foresaw: `Note.matching` looks in each copy on its own, and the copies hold only the note's own fields.
  - 2026-11-09: item 10's test also asks for `collection_id=99999999999999999999`, an id that no collection has and that is larger than the database's integers: Active Record keeps no ...
  - 2026-11-09: item 15's test compares the whole body of each 422 as text, so the order of `fields` is fixed: `search`, `status`, `review`, the order of the checks in `NoteListFilter` ...
  - 2026-11-09: item 16 passed once items 10 to 14 were built, as the item foresaw: every filter narrows the same relation in `NoteListFilter#apply`.
  - 2026-11-09: item 17 passed once items 4 to 15 were built, as the item foresaw: `require_signed_in_user` runs first, and the parameters are checked only inside `index`.
  - 2026-11-09: item 20's test fakes the clock differently from Decisions, "Time in tests". It fakes only `setTimeout` and `clearTimeout`, as planned, but only after the list's first ...
  - 2026-11-09: item 21 passed before its code, which the plan did not foresee.
  - 2026-11-09: item 21's test pastes " rails tips " (`user.paste`) rather than typing it, so that the field changes once: typed with real timers on a loaded machine, a gap of more than ...
  - 2026-11-09: item 22 passed once item 20 was built, as the item foresaw: the search changes the list's address, and feature 15's effect drops an answer that arrives after another ...
  - 2026-11-09: item 26 passed once items 20 and 23 were built, as the item foresaw: the field's text, the search, and the choices are state in `Notes`, and the bar only shows them, so ...
  - 2026-11-09: item 27 passed once item 19 was built, as the item foresaw: the choices are the left area's list itself, which a create and a rename change in place (`onRecords`), and a ...
  - 2026-11-09: item 29 passed once items 20 and 23 were built, as the item foresaw: loading, the failure, "Try again", and the 401 are feature 15's, keyed on the address, and the ...
  - 2026-11-09: item 31 passed once item 23 was built, as the item foresaw: a saved note replaces its entry in the kept answer, and a created note goes to its top (features 09 and 15), ...

## AC-18: Archived notes do not generate review reminders

Feature folder: [`specs/features/18_archived_no_reminders/`](../features/18_archived_no_reminders/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 4, in the [plan](../features/18_archived_no_reminders/plan.md#deviations):
  - 2026-11-10: Build started while feature 23 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-10: item 1: `backend/tmp/ac18-earlier-tests.sha` lists 82 files.
  - 2026-11-10: no production file changed: no test went red for a missing behavior, so this Build wrote tests only (`spec/models/archived_reminders_spec.rb`, ...
  - 2026-11-10: item 9: `shasum -c backend/tmp/ac18-earlier-tests.sha` reports 81 of 82 earlier test files OK; the one that changed, `backend/spec/requests/data_privacy_spec.rb`, is ...

## AC-19: Notes without review schedules do not generate review reminders

Feature folder: [`specs/features/19_unscheduled_no_reminders/`](../features/19_unscheduled_no_reminders/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** None.
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 4, in the [plan](../features/19_unscheduled_no_reminders/plan.md#deviations):
  - 2026-11-10: Build started while feature 23 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-10: item 1: `backend/tmp/ac19-earlier-tests.sha` lists 87 files (feature 18's four new test files included).
  - 2026-11-10: no production file changed: no test went red for a missing behavior, so this Build wrote tests only (`spec/models/unscheduled_reminders_spec.rb`, ...
  - 2026-11-10: item 10: `shasum -c backend/tmp/ac19-earlier-tests.sha` reports all 87 earlier test files OK. `find ... -newer backend/tmp/ac19-start` lists no file of this feature: ...

## AC-20: While connected, the app receives real-time review notifications

Feature folder: [`specs/features/20_realtime_notifications/`](../features/20_realtime_notifications/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 5, 8, 9, 10 of the [spec](../features/20_realtime_notifications/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 7, in the [plan](../features/20_realtime_notifications/plan.md#deviations):
  - 2026-11-09: Build started while feature 16 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-09: item 1: `grep -n "note-review-state" frontend/src/Notes.tsx` prints nothing.
  - 2026-11-09: item 6: a test-only change to a feature 22 test, as feature 10 recorded its change to a feature 09 test.
  - 2026-11-09: items 17 to 25: the client's `onMessage` and `onLost` were optional in `CableHandlers` while the panel did not pass them yet, so the shared tree kept passing `tsc -b` ...
  - 2026-11-09: item 24: `App` passes `Notes` a stable `onSignedOut` (`notesSignedOut`, a `useCallback`), not a new arrow on each render.
  - 2026-11-09: items 25 and 26: Testing Library 16.3.3 ends every `findBy`, `waitFor`, and user-event action by awaiting a 0 ms `setTimeout`, and it moves fake timers only when a ...
  - 2026-11-10: item 26: a test-only change after Done, in the final stabilization step; no assertion changed.

## AC-21: Data is private per user and cannot be accessed cross-account

Feature folder: [`specs/features/21_data_privacy/`](../features/21_data_privacy/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 5, 6 of the [spec](../features/21_data_privacy/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 15, in the [plan](../features/21_data_privacy/plan.md#deviations):
  - 2026-11-09: Build started while features 17, 20, 23, and 26 were at Build, under the owner's standing instruction (pipelined run).
  - 2026-11-09: This run built items 1 to 7 and 9 to 15 first, under the pipelined run, because their code exists now.
  - 2026-11-09: Item 1: `workspace_of` leaves out review dismissals, because feature 23 has not added them yet.
  - 2026-11-09: Items 9 and 10 check the reminder half through `GET /api/notes?review=due_today`, which reads `Note.due_today`, the scope that feature 20's batch reads (planner notes): ...
  - 2026-11-09: Item 2 was red for the right reason: every answer had its expected status, with `max-age=0, private, must-revalidate` on the 200s and 201s and `no-cache` on the rest.
  - 2026-11-09: Items 3 to 7 and 9 to 15 passed when written, as the plan expected: the behavior was built by features 01 to 13 and 22.
  - 2026-11-09: The mutation runs of items 7 to 15 set `DISABLE_BOOTSNAP=1`.
  - 2026-11-10: The second run (items 8 and 16 to 26) started while feature 26 was at Verify, and 17, 20, 22, and 23 were Done, under the owner's standing instruction (pipelined run).
  - 2026-11-10: Item 1, as the first run planned: `workspace_of` now also reads the review dismissals that the user made or that name the user's notes (feature 23).
  - 2026-11-10: Items 9 and 10, as the first run planned: each test now also reads `ReviewReminderBatch.for`.
  - 2026-11-10: Items 8 and 16 to 25 passed when written, as the plan expected: the behavior was built by features 05, 17, 20, 22, 23, and 26.
  - 2026-11-10: Test details. Item 16 checks each batch with `have_broadcasted_to(me).from_channel(ReviewRemindersChannel).exactly(:once).with { … }`: it equals ...
  - 2026-11-10: Test-only change to a feature 22 test, assigned by the orchestrator: `AC-22 the app keeps one connection while the main layout shows and closes it when the sign-in ...
  - 2026-11-10: Item 26, the finish gate, with lane C's database: RSpec 309 examples, 0 failures; RuboCop 135 files, no offenses.
  - 2026-11-10: Polish. Verify ran on snapshot `snap-21` (head d8309d8 plus the uncommitted tree of 2026-11-10 03:27 CET) on Verify slot 2: all 21 Test plan items Pass.

## AC-22: WebSocket connection is authorized

Feature folder: [`specs/features/22_websocket_auth/`](../features/22_websocket_auth/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 3, 5, 6 of the [spec](../features/22_websocket_auth/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 8, in the [plan](../features/22_websocket_auth/plan.md#deviations):
  - 2026-11-09: Tests that passed before their code, kept as guards, as the plan expected.
  - 2026-11-09: Item 21 also passed before its own code, which the plan did not expect.
  - 2026-11-09: Item 6's session whose `user_id` does not match its sign-in token is made with a real cookie jar and the app's own key (`session_cookie_holding` in ...
  - 2026-11-09: Names chosen where the plan gave an example or none: the shared lookup is `SignIn.of_session(session)`; the check before each command and each message is `SignIn#ended?` ...
  - 2026-11-09: `spec/support/cable_helpers.rb` holds two modules.
  - 2026-11-09: Two tests check a little more than their item names, from the plan's own text: item 9 also checks that forgery protection is on (`disable_request_forgery_protection` ...
  - 2026-11-09: `ReviewReminders.tsx` keeps one connection while `App` re-renders with React's `useEffectEvent` for `onSignedOut`, so the effect has no dependencies.
  - 2026-11-09 (Polish): Docs item 4's README section is under the heading "WebSocket message format", not "WebSocket": that is the fixed heading of feature 30 question 7, which feature 20 (the ...

## AC-23: The WebSocket flow includes at least one client → server message that changes server behavior

Feature folder: [`specs/features/23_websocket_client_message/`](../features/23_websocket_client_message/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 4, 5 of the [spec](../features/23_websocket_client_message/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 6, in the [plan](../features/23_websocket_client_message/plan.md#deviations):
  - 2026-11-09: Build started while feature 20 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-10: order of the items: items 15 to 19 were built right after item 1, before items 2 to 14, at the orchestrator's request.
  - 2026-11-10: item 1: `backend/tmp/ac23-earlier-tests.sha` lists 73 files.
  - 2026-11-10: item 3: the test also hands on a `message` command whose `data` is a JSON object rather than JSON text (a client that does not encode it).
  - 2026-11-10: item 5 (refactor): the batch and the ack share one relation, `ReviewReminderBatch.reminded_notes(user, today)` ...
  - 2026-11-10: item 7: two parts of the Approach had no test of their own, so item 7's test gained two checks that drove them (the least code would have left both out).

## AC-24: The UI includes empty states, loading state, validation feedback, and visible error handling

Feature folder: [`specs/features/24_ui_states/`](../features/24_ui_states/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** question 5 of the [spec](../features/24_ui_states/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 23, in the [plan](../features/24_ui_states/plan.md#deviations):
  - 2026-11-10: Build started while features 17 and 20 were at Verify and feature 23 at Build (lane B built it at the same time), under the owner's standing instruction (pipelined run).
  - 2026-11-10: guards: every test that passed before its code is kept as the guard of its scenarios, as the Approach foresaw.
  - 2026-11-10: item 1: `lookOf` also returns the element's own background class (`background`), because spec question 4 makes a filled button dark, or red for a delete; and ...
  - 2026-11-10: item 3: the trigger throws in `withRenames` in `Notes.tsx`, which reads the note's `collection.id` while the notes area draws, before the list reads the collection's ...
  - 2026-11-10: item 4: red first on the missing module `./reloadPage`, which the item creates; then, with the module in place, red on the behavior (`reloadPage` called 0 times).
  - 2026-11-10: item 5: passed at once, as foreseen.
  - 2026-11-10: item 6: red on all 23 elements it names (the sign-in buttons, the server error's "Try again", the two name fields, and the 7 fields and 2 checkboxes of each note form); ...
  - 2026-11-10: items 7 to 9, the screens: the sweeps share one walk, `tour` in `src/UiQuality.test.tsx`.
  - 2026-11-10: item 7: red, as the item foresaw for elements of features 11 to 23: the filter bar's "Search", "Collection", "Tag", "Status", and "Review" (features 15 and 17) had no ...
  - 2026-11-10: item 8: passed at once, as foreseen.
  - 2026-11-10: item 9: red, as foreseen, on the alert of the collections and tags delete confirmation (`text-xs`) and on "Create a collection first.
  - 2026-11-10: item 10: passed at once, as foreseen.
  - 2026-11-10: items 11 to 20 (`src/UiStates.test.tsx`): each passed at once, as foreseen (features 01 to 23 built the states), and is kept as the guard of its scenarios, with the ...
  - 2026-11-10: item 11: mutation `Notes.item11.tsx` ("No notes yet" also shows while the list loads); the test fails on the empty state found during the load.
  - 2026-11-10: item 12: mutation `Notes.item12.tsx` ("No notes yet" for every empty answer); the test fails: no "No notes match your search and filters.".
  - 2026-11-10: item 13: built last, out of order, once feature 23 (lane B) was at Verify (00:42), because its "dismissing the last reminder" needs feature 23's "Dismiss", and lane B ...
  - 2026-11-10: item 14: mutation `NoteForm.item14.tsx` (the edit form shows its fields only once its collections have loaded); the test fails: no "Title" in the edit form while its ...
  - 2026-11-10: item 15: the change requests wait until the test answers them with a 500, so each button stays in place and is enabled again; a second click is shown to start nothing by ...
  - 2026-11-10: item 16: mutation `NoteForm.item16.tsx` (`checkNote` leaves out the title); the test fails: no message under "Title".
  - 2026-11-10: item 17: mutation `NoteForm.item17.tsx` (a 422 empties "Title" and "Body"); the test fails: the edit form's "Title" is empty.
  - 2026-11-10: item 18: each list's failure is followed by its "Try again", which loads the list (conventions: Load error with Try again).
  - 2026-11-10: item 19: the eleven changes fail with no answer in one page and with a 500 in a second page.
  - 2026-11-10: item 20: mutation `App.item20.tsx` (the sign-in screen shows "Your session has ended." as an alert when no sign-in failed); the test fails: an alert shows after the 401.

## AC-25: The app is responsive on narrow screens

Feature folder: [`specs/features/25_responsive_layout/`](../features/25_responsive_layout/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 6, 7, 8, 9, 10 of the [spec](../features/25_responsive_layout/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner). None.
- **Deviations:** 15, in the [plan](../features/25_responsive_layout/plan.md#deviations):
  - 2026-11-10: Build started while feature 24 was at Verify, under the owner's standing instruction (pipelined run).
  - 2026-11-10: item 1: the stand-in (`frontend/src/test/screen.ts`) answers `(width < Npx)`, `(max-width: Npx)`, and `(min-width: Npx)`, and any other query matches nothing; it also ...
  - 2026-11-10: item 4, a detail of the approach: a closed panel is the area's own `aside`, which takes the `hidden` attribute through a new optional `hidden` prop of `Collections`, ...
  - 2026-11-10: the tests: an element inside a hidden panel has no accessible name, so a Testing Library query by role and name cannot find it, even with `hidden: true`.
  - 2026-11-10: reds: items 3 (no "Collections" button), 4 ("Collections" opened nothing), 5 ("Menu" opened nothing), 7 (the area stayed after the second choice), 9 (no hover class on ...
  - 2026-11-10: guards: items 6, 8, 10, 11, 12, 13, 14, 19, 20, 21, and 22 passed at once, as the plan foresaw, and are kept as the guards of their scenarios.
  - 2026-11-10: the guards' mutations, each failing its test (copy in `build25/mut/`: what it changes, where the test fails): item 6 `App.item6.tsx` (one open flag per panel: the ...
  - 2026-11-10: the test file: the four tests that walk several views (items 10, 12, 18, 19) run with a 15 s timeout (`LONG_TEST_MS`) instead of Vitest's 5 s, as `src/UiStates.test.tsx` ...
  - 2026-11-10: item 23, the finish gate (lane A's database, 03:42 to 03:45 CET): `shasum -c backend/tmp/ac25-earlier-tests.sha` printed `OK` for all 88 earlier test files.
  - 2026-11-10: item 9: the test also compares each bar button's look (`lookOf`) with that of "Log out", the header's outlined button: they are equal.
  - 2026-11-10: item 16: the header's two parts are spaced with `gap-x-4 gap-y-2`, so its second line keeps a gap under the first.
  - 2026-11-10: item 17: each drop-down list of the filter bar is one element with its label (`flex max-w-full shrink-0`), and the select has `min-w-0`.
  - 2026-11-10: item 18, beyond the plan's list, for the same rule (spec question 9: long titles and names break): the detail's `dl` takes `wrap-anywhere`, so every row's value breaks ...
  - 2026-11-10: item 20: feature 20's list already had `max-h-48` (12rem) and `overflow-y-auto`, within the plan's 16rem, so it stays as built.
  - 2026-11-10: item 22: the check reads "one centered column" as: the screen's `main` is `flex min-h-screen items-center justify-center` with one child, which is a `flex-col ...

## AC-26: The app runs locally from README instructions

Feature folder: [`specs/features/26_local_run/`](../features/26_local_run/)

- **Approval:** spec: yes, 2026-11-10 (owner's standing instruction: recommended options; question 3 changed, see Changes); plan: yes, 2026-11-10 (owner's standing instruction; revised again on 2026-11-10 for the spec change to question 3; earlier: approved 2026-11-09; revised in Build and approved again on 2026-11-09: a new item 10, and the review-state test moved to item 14).
- **Agent's own answers:** questions 9, 12 of the [spec](../features/26_local_run/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner); the document items are accepted by the Docs checks in Polish. None.
- **Deviations:** 10, in the [plan](../features/26_local_run/plan.md#deviations):
  - 2026-11-09: Build started while feature 12 was at Verify (reopened that day for the old zone names, and built again), and while features 15, 16, and 17 were at Build with none of ...
  - 2026-11-09: item 10 of the approved plan became item 14, and a new item 10 took its place.
  - 2026-11-09: item 4 passed before its code, as the item foresaw: `db/seeds.rb` holds only comments.
  - 2026-11-09: the shared test helpers, as built.
  - 2026-11-09: item 8's case "one note, and nothing else" writes the note's row with `Note.insert!` in another user's collection.
  - 2026-11-09: item 9's test also checks the ten titles in the list's order, newest first, which the Approach's decision "Notes are created from 10 down to 1" gives (Test plan item 7 ...
  - 2026-11-09: for Verify: Test plan item 1 expects the backend log to show "Created database 'storage/development.sqlite3'". Rails 8.1.4.1's `db:prepare` creates a new SQLite database ...
  - 2026-11-10: item 14 was built while feature 17 was at Verify (features 15 and 16 were Done), under the owner's standing instruction (pipelined run).
  - 2026-11-10: item 14 passed at once, as the item foresaw: the states come from item 10's dates, which count from `User#today`, and the app's own definitions (`review_state`, ...
  - 2026-11-10: spec revision (its Changes, 2026-11-10: question 3).

## AC-27: Tests pass locally

Feature folder: [`specs/features/27_local_tests/`](../features/27_local_tests/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 6, 7, 8, 10 of the [spec](../features/27_local_tests/spec.md#questions).
- **Verify:** as an automated walkthrough by Claude (Playwright, `curl`, or a Rails runner); the document items are accepted by the Docs checks in Polish. None.
- **Deviations:** 7, in the [plan](../features/27_local_tests/plan.md#deviations):
  - 2026-11-09: Build started while feature 26 was at Build (13 of its 14 items ticked; its last item waits for feature 17's Build) and feature 12 at Verify, under the owner's standing ...
  - 2026-11-09: item 2's red run did not end with `Net::OpenTimeout` after 2 seconds, as the item expected, but with `EOFError: end of file reached` after about 8 seconds: Docker ...
  - 2026-11-09: item 3 passed before its code, as the item foresaw: `rails_helper` sets the test environment.
  - 2026-11-09: item 10 passed before its code, as the item foresaw: item 9's code fails a check on any status but 0.
  - 2026-11-09: item 15 was added in Build, under the owner's standing instruction, and built before item 14 was ticked.
  - 2026-11-09: item 14's runs, for Verify. Both copies were made as the item says, with no `.env`, under `COMPOSE_PROJECT_NAME=kb-build27` (its volumes `kb-build27_bundle` and ...
  - 2026-11-10: Verify ran in a fresh copy of snapshot snap-24 under its own project, `kb-verify27`, with its own volumes (the plan's slot 2 of the harness was left to other agents), ...

## AC-28: Specification artifacts are present in the repository

Feature folder: [`specs/features/28_spec_artifacts/`](../features/28_spec_artifacts/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 7, 8 of the [spec](../features/28_spec_artifacts/spec.md#questions).
- **Verify:** no app walkthrough: every Test plan item is a document item, accepted by the Docs checks in Polish. None.
- **Deviations:** 1, in the [plan](../features/28_spec_artifacts/plan.md#deviations):
  - 2026-11-10: Build started while features 10 and 21 were at Verify, under the owner's standing instruction (pipelined run).

## AC-29: Tests are mapped to requirements or acceptance criteria

Feature folder: [`specs/features/29_test_mapping/`](../features/29_test_mapping/)

- **Approval:** spec: yes, 2026-11-09 (owner's standing instruction: recommended options); plan: yes, 2026-11-09 (owner's standing instruction).
- **Agent's own answers:** questions 8, 9, 10, 11 of the [spec](../features/29_test_mapping/spec.md#questions).
- **Verify:** run in Docker in the main tree with the probes of the Test plan, each undone at once (the generator only reads files); the three document items are accepted by the Docs checks in Polish. Item 3's rename probe printed "out of date in: AC-13", not "the summary, AC-13", which the Approach defines (a rename changes no count); that was recorded as a pass. None.
- **Deviations:** 5, in the [plan](../features/29_test_mapping/plan.md#deviations):
  - 2026-11-09: Build started while feature 28 was at Build, under the owner's standing instruction (pipelined run).
  - 2026-11-09: Item 4's test passed at once, as the item expected; it is kept as the guard of the edge case "Only tests count".
  - 2026-11-09: the fixture builders of both specs are one shared context, `backend/spec/support/test_mapping_fixtures.rb`, and the code is split into `backend/lib/test_mapping.rb` and `backend/lib/test_mapping/`.
  - 2026-11-09: readings of the Approach where it left the detail open (the form of a manual validation link, a document AC with no Docs checkbox, an unknown ID among several, `[X]` as ticked, groups with `pending` metadata, folders left out, totals that count every test not skipped, sections out of order).
  - 2026-11-09: Test plan item 3 expects "the summary, AC-13" after each probe; for the rename the code prints "AC-13" alone, as the Approach defines the parts.

## AC-30: README is sufficient for another developer to run the app without guessing

Feature folder: [`specs/features/30_readme_for_developers/`](../features/30_readme_for_developers/)

- **Approval:** spec: yes, 2026-11-10 (owner's standing instruction: recommended options; re-approved after the Changes entry of 2026-11-10; first approved 2026-11-09); plan: yes, 2026-11-10 (owner's standing instruction; revised on 2026-11-10 for the spec change; first approved 2026-11-09).
- **Agent's own answers:** questions 8, 9 of the [spec](../features/30_readme_for_developers/spec.md#questions). Question 7's answer also ends "the agent's recommendation", on a line of its own, which the grep of the check does not count.
- **Verify:** as an automated walkthrough by Claude (shell, `curl`, Playwright) for the three app items (6 to 8: the example file, a copied file that keeps the defaults, the callback URLs); the nine document items are accepted by the Docs checks in Polish, and the fresh-clone walkthrough of question 4 was the last Docs check. None.
- **Deviations:** 1, in the [plan](../features/30_readme_for_developers/plan.md#deviations):
  - 2026-11-10: spec revision (its Changes, 2026-11-10: the page before the first frontend build).

## Spec evolution

Every `## Changes` entry of the feature specs, in date order, then by AC. Each was written in the spec with its reason, and the spec was approved again. A spec that gets a new entry adds its line here and to the README's "What changed".

### 2026-11-05, AC-01: The failure redirect names the provider

The sign-in failure redirect names the provider that failed (`google` or `github`), because feature 02 added a second provider. [Entry in the spec](../features/01_google_sign_in/spec.md#2026-11-05-the-failure-redirect-names-the-provider).

### 2026-11-05, AC-02: GitHub accounts with no public name

A GitHub account that sends no name gets its GitHub login as the display name; question 4, a scenario, and an edge case were added. [Entry in the spec](../features/02_github_sign_in/spec.md#2026-11-05-github-accounts-with-no-public-name).

### 2026-11-09, AC-12: Names of the review fields, and what the form sends

The review fields of a note are named in the API (`review_interval`, `review_interval_days`, `next_review_date`, `last_reviewed_date`); questions 17 to 19 say what the form sends, its texts, and what a session check without a time zone does. [Entry in the spec](../features/12_review_interval_setting/spec.md#2026-11-09-names-of-the-review-fields-and-what-the-form-sends).

### 2026-11-09, AC-17: A search that is not text

A `search` parameter that is not text answers 422 `validation_failed` with `search: invalid`; question 18 was added. [Entry in the spec](../features/17_search_and_filter/spec.md#2026-11-09-a-search-that-is-not-text).

### 2026-11-09, AC-27: The last line of `bin/test --time-zones`

The last line counts the checks that ran, so the time-zone run ends with "All 6 checks passed." or "<n> of 6 checks failed."; question 10 was added. [Entry in the spec](../features/27_local_tests/spec.md#2026-11-09-the-last-line-of-bintest---time-zones).

### 2026-11-10, AC-26: the page before the first frontend build

Before the first frontend build `/` shows the Rails welcome page (200), and other addresses answer 404, not a 404 everywhere. [Entry in the spec](../features/26_local_run/spec.md#2026-11-10-the-page-before-the-first-frontend-build).

### 2026-11-10, AC-30: the page before the first frontend build

The README's "Troubleshooting" entry for the first build says that `/` shows the Rails welcome page (200) and other addresses show "Routing Error" (JSON `Not Found` for `curl`), as feature 26's change did; question 6 and one scenario were changed. [Entry in the spec](../features/30_readme_for_developers/spec.md#2026-11-10-the-page-before-the-first-frontend-build).
