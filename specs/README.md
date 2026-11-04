# Specs

This folder holds the specification for the Personal Knowledge Base, one feature at a time. Each feature implements one acceptance criterion (AC-01 to AC-30) from [`../requirements.md`](../requirements.md), section 10.

Two rules apply to all work here:

- **Test first.** No production code is written without a failing test for it (TDD: red, green, refactor).
- **Approval gates.** Design and Plan end only when the owner approves them. Nothing is built from an unapproved spec or plan.

## Layout

```
specs/
├── README.md
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
- **`plan.md`:** how the feature is built. Holds the checklist of build steps, each with the test to write first, and the TEST PLAN used in Verify.
- **Code:** `../backend/` (Rails, RSpec) and `../frontend/` (React, Vitest).

## Workflow

| Step | Name | Driven by | Input | Output | Exit gate |
|---|---|---|---|---|---|
| 1 | Foundation | discussion with the owner | task as text | agreed requirement | owner agrees the text |
| 2 | Design | `brainstorm` skill | AC line in `spec.md` | questions, answers, approved `spec.md` | owner approves `spec.md` |
| 3 | Plan | custom `plan` skill | approved `spec.md` | `plan.md` checklist with TEST PLAN | owner approves `plan.md` |
| 4 | Build | `build-step` skill, once per plan | approved `plan.md` | code, tests, ticked checklist | all items ticked, all suites green |
| 5 | Verify | manual walkthrough | TEST PLAN in `plan.md` | recorded results | every TEST PLAN item passes |
| 6 | Ship | git | verified feature | one local commit, not pushed | feature's changes committed |

Step 1 is not run for the 30 existing features. Their requirements are already in `requirements.md`, so they start at step 2.

### Stage in the header

The current step is kept in the header of `spec.md`, and nowhere else:

```
**Stage:** Design | Plan | Build | Verify | Ship | Done
**Approved:** no | yes, YYYY-MM-DD
```

Foundation is used only for new tasks. Its feature folder starts at Design.

### 1. Foundation

Used only for a new task that is not yet in `requirements.md`.

1. The owner brings the task as text.
2. We discuss it. Nothing is written to the repo during this discussion.
3. The agreed task is recorded as a new AC in `requirements.md` section 10, and as a new feature folder with a `spec.md` at Design.

### 2. Design

1. Invoke the `brainstorm` skill for the feature, working from the AC line in `spec.md`.
2. Write each open question in the `## Questions` section of `spec.md`, numbered. Do not assume answers.
3. Stop and wait for the owner's answers.
4. Record each answer under its question. Update Scenarios and Edge cases to match.
5. The owner reviews the spec.
   - If more questions come up, go back to step 2.
   - When approved, set `**Approved:** yes, YYYY-MM-DD` and `**Stage:** Plan`.

**Gate:** no question is left without an answer when the owner approves.

### 3. Plan

1. Only after `spec.md` is approved, invoke the custom `plan` skill for the feature.
2. The skill writes `plan.md` as a checklist. Each item is one small behavior, with the automated test to write first for it.
3. The plan has a `## Test plan` section: the manual walkthrough for Verify, one entry per scenario, each with the steps and the expected result.
4. The owner reviews the plan and asks for changes in `plan.md`.
5. When approved, set `**Approved:** yes, YYYY-MM-DD` in `plan.md` and `**Stage:** Build` in `spec.md`.

**Gate:** the plan adds no behavior the spec does not describe. If it needs one, go back to Design.

### 4. Build

1. Invoke the `build-step` skill once for the feature's `plan.md`.
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
5. When every item is `Pass`, set `**Stage:** Ship` in `spec.md`.

### 6. Ship

1. Set `**Stage:** Done` in `spec.md`.
2. Check `git status`. Commit only this feature's files: its `spec.md`, `plan.md`, code, and tests. Leave out anything unrelated.
3. Commit locally:
   - Subject: `AC-NN: <topic>`
   - Body: what changed, the tests added, and the feature folder path
   - Last line: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`
4. Do not push. The owner pushes.

## Rules

- **Test names start with the AC ID.** Add the backend or frontend requirement ID when there is one:
  ```ruby
  it "AC-13 marks a note as reviewed and recalculates the next review date" do
  ```
  To find every test for an AC, run `grep -r "AC-13" backend frontend`.
- **One feature at a time.** A feature goes through Design, Plan, Build, Verify, and Ship before the next one starts. Features are taken in folder order unless a dependency says otherwise.
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

## Checklist

- [ ] 1. [BE] <behavior>
  - Test first: AC-NN <test name>
- [ ] 2. [FE] <behavior>
  - Test first: AC-NN <test name>

## Test plan

Manual walkthrough for Verify. Run each item against the running app.

1. <scenario>
   - Steps: ...
   - Expected: ...
   - Result: <Pass | Fail, date, what was seen>

## Deviations

None yet.
```
