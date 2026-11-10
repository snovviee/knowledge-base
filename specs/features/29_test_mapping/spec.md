# Feature: 29_test_mapping

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-29: Tests are mapped to requirements or acceptance criteria

Sources: requirements.md 2 (a test plan or a mapping between requirements and tests; the README says which requirements automated tests cover), 7 (the nine cases the automated tests must cover), 8 (a test mapping that links acceptance criteria to automated tests or documented manual validation); project.md (`sdd_rules`: each automated test references the requirement or AC ID it verifies); `specs/README.md` (Rules: test names start with the AC ID, and `grep -r "AC-NN" backend frontend` finds an AC's tests; Polish gates: the Docs checks of an AC whose result is a document are its acceptance); [features/27_local_tests/spec.md](../27_local_tests/spec.md) (question 2: `bin/test`) and [features/28_spec_artifacts/spec.md](../28_spec_artifacts/spec.md) (question 5: the artifact table's "Test plan or mapping" row; question 8: where the specification shows how the implementation satisfies the ACs), not yet in `docs/`.

Not part of this feature: running the tests (AC-27, feature 27); the other specification artifacts (AC-28, feature 28).

## Questions

1. How is the mapping produced?
   - Options: generated from the test names by a command, with a command that checks it (recommended); other options: TBD (the research names none).
   - Answer: it is generated. `docker compose run --rm backend bin/rails test_mapping:write` writes `specs/docs/test_mapping.md` from the names of the tests and from the plans. `docker compose run --rm backend bin/rails test_mapping:check` passes when the file is exactly what `test_mapping:write` would write now, and otherwise fails and names what differs. Both read the test files and the plans, and neither runs a test. The check is not part of `bin/test` (AC-27), because the mapping changes whenever a test is added, and a new test would make `bin/test` fail until the mapping is written again. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. What does the mapping show for each AC?
   - Options: the counts, the tests, and the manual validation (recommended); other options: TBD (the research names none).
   - Answer: for each AC from AC-01 to AC-30: its text from requirements.md section 10; the number of its backend tests and of its frontend tests; each test file, with the names of the AC's tests in it; and its manual validation. The manual validation is the plan's Test plan: its number of items and how many passed, where an item passed when its last `Result:` line starts with "Pass", with a link to the section. For the ACs whose result is a document (AC-07, AC-26, AC-28, AC-29, AC-30), it also shows the plan's Docs checks: their number and how many are ticked, with a link. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How are the nine cases of requirements.md 7 mapped?
   - Options: a table kept by hand (recommended); other options: TBD (the research names none).
   - Answer: a table kept by hand maps each of the nine cases of requirements.md 7 to its AC and to the tests that cover it, each named by its file and its full name. The table is in the README's "Test coverage" (question 7), and the mapping file links to it. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. What happens to a test whose name has an unknown AC ID, or none?
   - Options: it is listed apart, and the check fails (recommended); other options: TBD (the research names none).
   - Answer: it is listed in a section of its own, "Tests with no known AC", and the check fails. An AC ID is known when requirements.md section 10 has it (AC-01 to AC-30). A test whose name is not plain text in the source, such as a name built while the tests run, cannot be read without running the tests, so it is listed there too. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. What happens to a test whose name starts with two AC IDs?
   - Options: it is listed under both (recommended); other options: TBD (the research names none).
   - Answer: it is listed under both ACs, and counted once in each. In the totals, it counts once. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. What happens to a skipped test?
   - Options: it is marked as skipped and not counted (recommended); other options: TBD (the research names none).
   - Answer: it is listed under its AC, marked as skipped, and not counted. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. What does the README's "Test coverage" section hold?
   - Options: the table of question 3, a summary line, and a link to the mapping (recommended); other options: TBD (the research names none).
   - Answer: the table of question 3; a one-line summary with the number of backend tests and of frontend tests, the number of the 30 ACs that have automated tests, the number that rely on manual validation alone, and the number not covered (question 11); a link to `specs/docs/test_mapping.md`; and the two commands of question 1. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
8. How is the mapping file laid out?
   - Options: a summary table, then one section per AC, then the tests with no known AC (recommended: the table answers "is every AC covered?" at a glance, and the sections hold the detail); one long list of tests.
   - Answer: the file starts with a line saying that `bin/rails test_mapping:write` generates it and that it is not edited by hand. Then a summary table with one row per AC: the AC ID and its text, the number of backend tests, the number of frontend tests, and the manual validation, written "Test plan: <n> items, <m> passed" and, for the document ACs, "Docs checks: <n>, <m> ticked". Then one section per AC, with its test files and test names. Then "Tests with no known AC", which says "None." when it is empty. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. How is the mapping kept current?
   - Options: the Polish step of each feature writes it again and runs the check (recommended: Polish already brings the documents in line with the code, and the mapping is one of them); `bin/test` runs the check; a hook before each commit.
   - Answer: from this feature on, the Polish step of every feature runs `test_mapping:write` and then `test_mapping:check`, and the feature leaves Polish only when the check passes. `specs/README.md` says so in its Polish step. A developer can run the check at any time. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. Is the table kept by hand checked too?
    - Options: yes, the check fails when a test that the table names is not found (recommended: tests are renamed, and a table kept by hand would go stale with no sign); no.
    - Answer: yes. `test_mapping:check` also fails when a test named in the README's table of question 3 matches no test, and names it. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
11. What does the mapping show for an AC that has neither automated tests nor manual validation?
    - Options: "Not covered", in its row and its section (recommended: a gap shows instead of hiding); the AC is left out.
    - Answer: "Not covered", in its row of the summary table and in its section. The check does not fail for it, because features are built one after another, and a later AC has no tests yet when an earlier one is polished. When feature 30 leaves Polish, no AC shows "Not covered". (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**Write the mapping**
- Given the backend and frontend tests, each named with its AC ID
- When I run `docker compose run --rm backend bin/rails test_mapping:write`
- Then `specs/docs/test_mapping.md` says that it is generated, has one summary row per AC from AC-01 to AC-30 with its counts and its manual validation, and one section per AC with its test files and test names; "Tests with no known AC" says "None." (questions 1, 2, 8)

**The mapping matches the grep**
- Given any AC, such as AC-13
- When I compare its section with `grep -r "AC-13" backend frontend`
- Then every test whose name begins with "AC-13", alone or among the AC IDs at its start, is in the section, and the section lists no other test (questions 1, 5; `specs/README.md` Rules)

**The check finds a stale mapping**
- Given a test was added, renamed, or removed, or a Test plan result changed, since the mapping was written
- When I run `docker compose run --rm backend bin/rails test_mapping:check`
- Then it fails and names what differs; after `test_mapping:write` it passes (question 1)

**The check passes on a current mapping**
- Given the mapping was just written
- When I run the check
- Then it passes, and no file changes (question 1)

**An AC with a manual walkthrough shows its results**
- Given an AC whose plan's Test plan has 12 items, each with a last `Result:` line that starts with "Pass"
- When the mapping is written
- Then its manual validation shows "Test plan: 12 items, 12 passed", with a link to the section (questions 2, 8)

**An AC proven by a document shows its Docs checks**
- Given AC-07, AC-26, AC-28, AC-29, or AC-30
- When the mapping is written
- Then its manual validation also shows "Docs checks: <n>, <m> ticked" for its plan, with a link (questions 2, 8)

**An AC with nothing yet**
- Given an AC whose feature has no tests and no plan yet
- When the mapping is written
- Then its row and its section show "Not covered", and the check passes once the file is current (question 11)

**The nine required cases are mapped**
- Given the nine cases of requirements.md 7
- When a developer reads the README's "Test coverage"
- Then each case names its AC and at least one test, by its file and its full name (question 3)

**A test named in the table is renamed**
- Given the README's table names a test that was renamed since
- When I run the check
- Then it fails, and names the test it could not find (question 10)

**A test with an unknown or missing AC ID**
- Given a test whose name starts with "AC-99", or with no AC ID
- When the mapping is written and checked
- Then the test is listed under "Tests with no known AC", and the check fails (question 4)

**A test with two AC IDs**
- Given a test whose name starts with "AC-13 AC-14"
- When the mapping is written
- Then the test is listed under AC-13 and under AC-14, counted once in each, and once in the totals (question 5)

**A skipped test**
- Given a skipped test
- When the mapping is written
- Then it is listed under its AC, marked as skipped, and not counted (question 6)

**The README shows the coverage**
- Given the README
- When a developer reads "Test coverage"
- Then it shows the table of question 3, the one-line summary, a link to the mapping, and the commands to write and to check it (question 7; requirements.md 2)

**Polish keeps the mapping current**
- Given a feature in Polish whose build added tests
- When its Polish ends
- Then the mapping was written again, and the check passes (question 9)

## Edge cases

- The generator reads the test files and the plans, and never runs the tests (question 1).
- The check is separate from `bin/test` (question 1).
- Only tests count: the names of groups of tests are not tests, even when they hold an AC ID (questions 2, 4).
- A test listed under two ACs counts once in each, and once in the totals (question 5).
- Every test name is plain text that starts with its AC ID; a name built while the tests run is listed under "Tests with no known AC", and the check fails (question 4; project.md `sdd_rules`). This binds the tests of every feature.
- A Test plan item that failed and passed when it was run again counts as passed, because its last `Result:` line counts (question 2).
- The result of this AC is documents, so the Docs checks of its plan are its acceptance, and its own entry in the mapping lists them (question 2; `specs/README.md`, Polish gates).
- From this feature on, the "Test plan or mapping" row of the README's artifact table names `specs/docs/test_mapping.md` (feature 28 question 5).
- The implementation notes get the AC-29 entry during this feature's Polish (feature 28 question 2).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09, before the spec was approved, with the Design step's notes added at the end. They are not part of the approved behavior. The Plan step moves what it uses into `plan.md`.

- Proposed checklist: about 8 [BE] items, in `spec/lib/test_mapping_spec.rb` and `spec/tasks/test_mapping_task_spec.rb`.
- The generator parses the source, so it needs literal test names: no `it.each`, and no `${}` in names. This binds the tests of every other feature.
- Fact at the time of the research: every test name starts with an AC ID. There are 162 tests, 94 in RSpec and 68 in Vitest. The AC IDs used so far are 01 to 06, 08, and 09.
- Depends on: 01 to 28. There is no app code.
- Docs: `test_mapping.md` (generated during Polish); the README section "Test coverage" and the artifact-table row (AC-28); the AC-29 entry in the implementation notes; `docs/conventions.md`; `specs/README.md`.
- Design, 2026-11-09: 245 tests at Design (127 RSpec in 18 files, 118 Vitest in 8 files), every name a literal string that starts with an AC ID; AC IDs used: 01 to 11. Loops such as `[nil, "", ...].each` sit inside one `it` (for example in `spec/models/collection_spec.rb`), so each `it` is one test. No `xit`, `skip`, `pending`, `it.skip`, or `it.todo` exists yet.
- Design, 2026-11-09: the backend container mounts the whole repository at `/app`, so a Rails task can read `/app/frontend/src` and `/app/specs`.
- Design, 2026-11-09: question 10's check reads the README's "Test coverage" table; question 9's line goes into the Polish step of `specs/README.md`. The `sdd-polish` skill file is the owner's to update; the report says so.
- Design, 2026-11-09: a plan's Test plan item can have several `Result:` lines after a fix and a run again (question 2: the last one counts).
