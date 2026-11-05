# Specs

This folder holds the specification for the Personal Knowledge Base, one feature at a time. Each feature implements one acceptance criterion (AC-01 to AC-30) from [`../requirements.md`](../requirements.md), section 10.

Three rules apply to all work here:

- **Test first.** No production code is written without a failing test for it (TDD: red, green, refactor).
- **Approval gates.** Design and Plan end only when the owner approves them. Nothing is built from an unapproved spec or plan.
- **Docs follow the code.** `docs/` describes the system as built. Only the Polish step writes it, after the feature is built and verified.

## Layout

```
specs/
├── README.md
├── docs/                  (written in the Polish step)
│   ├── domain/
│   │   ├── collections.md
│   │   └── ...            (one file per area)
│   ├── api_contract.md
│   └── conventions.md
└── features/
    ├── 01_google_sign_in/
    │   ├── spec.md
    │   └── plan.md        (created in the Plan step)
    ├── 02_github_sign_in/
    │   ├── spec.md
    │   └── plan.md
    └── ...                (30 feature folders)
```

- **Folder name:** `<NN>_<topic>`. `NN` is the AC number, two digits, so folders sort in AC order. For example, `20_realtime_notifications` implements AC-20.
- **`spec.md`:** what the feature must do, seen from outside the system. Holds the AC line, the questions from Design with the owner's answers, scenarios, and edge cases. Its header holds the feature's current stage.
- **`plan.md`:** how the feature is built. Holds the approach, the checklist of build steps, each with the test to write first, the TEST PLAN used in Verify, and the documents to write in Polish.
- **`docs/`:** the system as built, across features: domain areas, the API contract, and shared conventions. See [Docs](#docs).
- **Code:** `../backend/` (Rails, RSpec) and `../frontend/` (React, Vitest).

## Docs

`docs/` holds what earlier features built, so that the next spec, plan, or build reads it there instead of re-reading other features' folders.

| File | Holds | Leaves out |
|---|---|---|
| `domain/<area>.md` | entities with their attributes, validations, and relations; business rules; the approaches chosen where `requirements.md` leaves the choice to us | tables, classes, endpoints |
| `api_contract.md` | conventions (base path, authentication, error body, status codes); every endpoint with its request, responses, and errors; the WebSocket connection, channels, and messages | how the server implements them |
| `conventions.md` | patterns that features reuse: how the UI shows errors, empty, loading, and validation states; code layout, libraries, and test helpers | anything only one feature uses |

The areas in `domain/` are `users`, `collections`, `tags`, `notes`, `reviews`, and `notifications`. A rule that spans two areas lives in the area whose action triggers it, and the other area links to it. For example, what deleting a collection does to its notes lives in `collections.md`.

- **Only Polish writes `docs/`,** from the code as built and verified. Design, Plan, and Build only read it.
- **A file is created when a feature first needs it.** Nothing is written ahead from `requirements.md`.
- **Each entry names the AC** that introduced or last changed it, for example `(AC-06)`.
- **Specs and plans link to `docs/` only for what is already there.** Anything new is described in the feature itself, and the plan's `## Docs` says where it will go.
- **`docs/` is edited in place.** It shows the current state. The history of a rule is in the feature folders.

## Workflow

| Step | Name | Driven by | Input | Output | Exit gate |
|---|---|---|---|---|---|
| 1 | Foundation | discussion with the owner | task as text | agreed requirement | owner agrees the text |
| 2 | Design | `/sdd-spec NN` | AC line in `spec.md`, `requirements.md`, `docs/` | questions, answers, approved `spec.md` | owner approves `spec.md` |
| 3 | Plan | `/sdd-plan NN` | approved `spec.md`, `docs/` | `plan.md`: approach, checklist, TEST PLAN, docs | owner approves `plan.md` |
| 4 | Build | `/sdd-build NN`, once per plan | approved `plan.md` | code, tests, ticked checklist | all items ticked, all suites green |
| 5 | Verify | manual walkthrough | TEST PLAN in `plan.md` | recorded results | every TEST PLAN item passes |
| 6 | Polish | `/sdd-polish NN` | `## Docs` in `plan.md`, the feature's code | updated `docs/` and README | every Docs item ticked, no drift |
| 7 | Ship | git | polished feature | one local commit, not pushed | feature's changes committed |

Step 1 is not run for the 30 existing features. Their requirements are already in `requirements.md`, so they start at step 2.

### Skills

Steps 2, 3, 4, and 6 are run by project skills in [`../.claude/skills/`](../.claude/skills/). Only the owner starts them. The argument is the feature: `06`, `AC-06`, or the folder name. The names carry an `sdd-` prefix because `/plan` is a built-in Claude Code command.

| Command | Runs | Reads | Writes |
|---|---|---|---|
| `/sdd-spec NN` | Design, or a behavior change to an approved spec | the AC line, the sections of `requirements.md` that govern it, `docs/`, the owner's answers | `spec.md` |
| `/sdd-plan NN` | Plan, or a revision of an approved plan | the approved `spec.md`; `docs/`; technical details from `requirements.md` and `project.md`; existing code | `plan.md` |
| `/sdd-build NN` | Build | the approved `plan.md`; `docs/conventions.md` and the docs the plan links to | code, tests, ticked checklist |
| `/sdd-polish NN` | Polish | `## Docs` and `## Deviations` in `plan.md`; the feature's code; `docs/` | `docs/`, README, ticked Docs items |

### Stage in the header

The current step is kept in the header of `spec.md`, and nowhere else:

```
**Stage:** Design | Plan | Build | Verify | Polish | Ship | Done
**Approved:** no | yes, YYYY-MM-DD
```

Foundation is used only for new tasks. Its feature folder starts at Design.

### 1. Foundation

Used only for a new task that is not yet in `requirements.md`.

1. The owner brings the task as text.
2. We discuss it. Nothing is written to the repo during this discussion.
3. The agreed task is recorded as a new AC in `requirements.md` section 10, and as a new feature folder with a `spec.md` at Design.

### 2. Design

1. Run `/sdd-spec NN`. It works from the AC line in `spec.md` and the sections of `requirements.md` that govern it, and turns their rules into scenarios and edge cases. It links to what `docs/` already holds and does not ask about it again. Technical details stay out of the spec.
2. Write each open question in the `## Questions` section of `spec.md`, numbered: whatever `requirements.md` leaves open or leaves to our choice. Do not assume answers.
3. Stop and wait for the owner's answers.
4. Record each answer under its question. Update Scenarios and Edge cases to match.
5. The owner reviews the spec.
   - If more questions come up, go back to step 2.
   - When approved, set `**Approved:** yes, YYYY-MM-DD` and `**Stage:** Plan`.

**Gate:** no question is left without an answer when the owner approves.

### 3. Plan

1. Only after `spec.md` is approved, run `/sdd-plan NN`. Behavior comes only from `spec.md`. Technical details may come from `requirements.md` and `project.md`.
2. The skill writes `plan.md`: a short `## Approach` (data, API, WebSocket, UI, decisions), then the checklist. Each item is one small behavior, with the automated test to write first for it. `[SETUP]` items (scaffolding, config) carry no behavior, so they name a check instead of a test. Documentation is never a checklist item.
3. The plan has a `## Test plan` section: the manual walkthrough for Verify, one entry per scenario, each with the steps and the expected result.
4. The plan has a `## Docs` section: what Polish creates or updates in `docs/` and the README, one item per file, each with a check.
5. The owner reviews the plan and asks for changes in `plan.md`.
6. When approved, set `**Approved:** yes, YYYY-MM-DD` in `plan.md` and `**Stage:** Build` in `spec.md`.

**Gate:** the plan adds no behavior the spec does not describe. If it needs one, go back to Design.

### 4. Build

1. Run `/sdd-build NN` once for the feature's `plan.md`.
2. For each unticked checklist item, in order:
   1. Write the test named in the item. Run it. It must fail, and it must fail because the behavior is missing, not because of a typo or a setup error.
   2. Write the least code that makes the test pass.
   3. Refactor with the tests green.
   4. Tick the item.
3. When every item is ticked, run the full RSpec, Vitest, RuboCop, and ESLint suites. All must pass.
4. Set `**Stage:** Verify` in `spec.md`.

**Gates:**
- A test that passes before its code is written is wrong or redundant. Stop and find out why before going on.
- A feature listed under `Depends on` must be at Done before this feature starts Build.
- If something needed is missing from the plan, stop. Add it to `plan.md`, and the owner approves it before it is built.

### 5. Verify

1. Walk through every item in `## Test plan` by hand, against the running app.
2. Under each item, record `Pass` or `Fail`, the date, and what was seen.
3. For each failure:
   - If the code does not match the spec, add a failing test to the checklist and return to Build for that fix.
   - If the spec itself is wrong, return to Design.
4. After a fix, re-run the failed items.
5. When every item is `Pass`, set `**Stage:** Polish` in `spec.md`.

### 6. Polish

1. Run `/sdd-polish NN`.
2. For each unticked item in `## Docs`, in order: write or update the document from the code as built, run its check, and tick the item.
3. Look for drift in what the feature touched: its code, its `## Deviations`, and the documents that describe them. Fix each document that disagrees with code that matches the approved spec, and add the fix to `## Docs` as a ticked item.
4. Set `**Stage:** Ship` in `spec.md`.

**Gates:**
- Code that contradicts the approved spec is a bug, not drift, and is not documented. Add a failing test to the checklist and return to Build.
- When the result of an AC is a document (AC-07, AC-26, AC-28 to AC-30), the checks in `## Docs` are its acceptance. The TEST PLAN covers only what the app does.

### 7. Ship

1. Set `**Stage:** Done` in `spec.md`.
2. Check `git status`. Commit only this feature's files: its `spec.md`, `plan.md`, code, tests, and the documents changed in Polish. Leave out anything unrelated.
3. Commit locally:
   - Subject: `AC-NN: <topic>`
   - Body: what changed, the tests added, and the feature folder path
4. Do not push. The owner pushes.

## Rules

- **Test names start with the AC ID.** Add the backend or frontend requirement ID when there is one:
  ```ruby
  it "AC-13 marks a note as reviewed and recalculates the next review date" do
  ```
  To find every test for an AC, run `grep -r "AC-13" backend frontend`.
- **One feature at a time.** A feature goes through Design, Plan, Build, Verify, Polish, and Ship before the next one starts. Features are taken in folder order unless a dependency says otherwise.
- **The spec says what, the plan says how.** `spec.md` does not name classes, gems, or components. `plan.md` does not add behavior the spec lacks.
- **Approved documents are not edited in place.** A behavior change goes into the `## Changes` section of `spec.md`, with the date, the reason, and what changes. The stage goes back to Design, `Approved` is set back to `no`, and the owner approves again.
- **Technical deviations go in the plan.** A change of approach (a different library, a different file layout) is written under `## Deviations` in `plan.md`. A change of behavior follows the rule above.
- **Shipping does not push.** Only the owner pushes.

## Templates

`spec.md`:

```markdown
# Feature: <NN>_<topic>

**Stage:** Design
**Approved:** no

## Acceptance criterion

> AC-NN: <text copied from requirements.md>

Sources: requirements.md <section numbers>; <docs/ files this spec links to, if any>

## Questions

1. <question>
   - Answer: <owner's answer>

## Scenarios

**<name>**
- Given ...
- When ...
- Then ...

## Edge cases

- <case>: <behavior, with status code and error body where relevant>

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->
```

`plan.md`:

```markdown
# Plan: <NN>_<topic>

**Approved:** no
**Depends on:** none

## Approach

- Data: <tables, columns, indexes>
- API: <METHOD /path: request → response, status codes>
- WebSocket: <channel, message types, payloads>
- UI: <screens, components, states>
- Decisions: <technical choice: reason>

## Checklist

- [ ] 1. [SETUP] <scaffolding or config, no behavior>
  - Check: <command>: <expected result>
- [ ] 2. [BE] <behavior>
  - Test first: AC-NN <test name> (<test file>)
- [ ] 3. [FE] <behavior>
  - Test first: AC-NN <test name> (<test file>)

## Test plan

Manual walkthrough for Verify. Run each item against the running app.

1. <scenario>
   - Steps: ...
   - Expected: ...
   - Result: <Pass | Fail, date, what was seen>

## Docs

Written in Polish, from the code as built.

- [ ] 1. <file> (create | update): <what is added or changed>
  - Check: <what Polish compares>: <expected result>

## Deviations

None yet.
```
