---
name: sdd-build
description: Build step of the SDD workflow (specs/README.md). Works through every unticked item of an approved plan.md with strict TDD (red, green, refactor), ticks each one, then runs all test and lint suites and moves the feature to Verify.
argument-hint: "[NN | AC-NN | folder]"
disable-model-invocation: true
---

# sdd-build: Build step

Build the checklist in `specs/features/<NN>_<topic>/plan.md`, item by item, test first. The workflow is in `specs/README.md`, step 4. Follow it wherever this file is silent.

Arguments: `$ARGUMENTS`

## Ground rules

- Talk with the owner in the language they write in. Write code, tests, and repo files in English.
- No production code without a failing test for it. The plan is the scope: build what the items say and nothing more.
- Never weaken, skip, or delete a test to get to green. Never tick an item while a test fails.
- Write no documentation. `specs/docs/` and the README are written in Polish, from what this step builds.
- Do not commit or push. Ship makes the commit, and the owner pushes.

## 1. Find the feature

- The first argument names the feature: `06`, `6`, `AC-06`, and `06_collections_crud` all mean `specs/features/06_*`.
- No argument: take the feature at `**Stage:** Build`. If there is none or more than one, ask.

## 2. Check the entry gates

Stop and tell the owner if any of these is false:

- `spec.md` has `**Stage:** Build`.
- `plan.md` has `**Approved:** yes, <date>`.
- Every feature in `**Depends on:**` has `**Stage:** Done` in its `spec.md`.

Then run `git status` and note what is already changed, so that Polish and Ship can tell this feature's changes apart. Read `specs/docs/conventions.md` and the `docs/` files the plan links to: the code layout, the test helpers, and the contract of what already exists.

## 3. Commands

Everything runs in Docker, in the services from `compose.yaml` (project.md). Never run Ruby, Bundler, Node, or npm on the host. Use the commands from the root `README.md` once it documents them. Until then, use these, with file paths relative to `backend/` or `frontend/`:

- one backend test: `docker compose run --rm backend bundle exec rspec <file> -e "<test name>"`
- one frontend test: `docker compose run --rm frontend npx vitest run <file> -t "<test name>"`
- full suites, the same ones `.claude/hooks/check-changed.sh` runs: `bundle exec rspec` and `bundle exec rubocop` in the backend service, `npx vitest run` and `npx eslint .` in the frontend service, each as `docker compose run --rm <service> <command>`
- anything else in the app, such as a generator or a migration: `docker compose run --rm backend bin/rails <command>`

If a command cannot run at all (Docker not running, an image that does not build, a broken setup), stop and tell the owner. That is not a red test.

## 4. Work through the checklist

Take the unticked items in order. After each one, post one short line: the item number, its title, and red → green.

**`[SETUP]` items.** Do the work, run or perform the `Check:`, and tick the item when the check gives the expected result.

**`[BE]` and `[FE]` items:**

1. **Red.** Write the test from `Test first:`, with that exact name, in that file. Run only this test. It must fail because the behavior is missing. A missing class, route, or component that this item creates counts. A typo, a wrong path, a syntax error, a missing gem or package, a broken factory, or a database setup error does not: fix it and run again until the test fails on the missing behavior.
2. **Gate: passes too early.** If the test passes before its code is written, stop and find out why. If the test checks the wrong thing, fix the test. If the behavior already exists, tell the owner and ask whether to keep the test or drop the item.
3. **Green.** Write the least code that makes the test pass. Run it, then the full suite on that side (backend or frontend). Everything must be green.
4. **Refactor.** Clean up names and duplication in the code you touched, keeping the tests green. Run the linter on the changed files.
5. **Tick.** Change `- [ ]` to `- [x]` for this item in `plan.md`.

Resuming an interrupted run: if the first unticked item's test already exists, run it. If it fails on the missing behavior, go on from Green. If it passes and its code is in place, go on from Refactor.

## 5. When the plan does not fit

- **A needed step is missing from the plan** (a migration, a config change, a test for a behavior the spec has): stop. Add it to `plan.md` as an unticked item where it must run, set `**Approved:** no`, show it to the owner, and wait. On an explicit yes, set `**Approved:** yes, YYYY-MM-DD` (today's date) and go on.
- **A behavior the spec does not describe is needed:** stop. Do not build it. It goes back to Design: `/sdd-spec <NN>` with a note.
- **A change of approach** (another library, another file layout): add an entry under `## Deviations` in `plan.md` with the date, what changes, and why, then go on. List it in the final report. Polish reads it when it updates `docs/`.

## 6. Finish

When every item is ticked:

1. Run the full RSpec, Vitest, RuboCop, and ESLint suites. All must pass. Fix failures without adding behavior. If a fix needs more than that, follow section 5.
2. Set `**Stage:** Verify` in `spec.md`.
3. Report to the owner: the items done, the tests added (by name), the suite results, and any deviations. The next step is Verify: walk through `## Test plan` in `plan.md` against the running app. After it, `/sdd-polish <NN>`.
