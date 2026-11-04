# Specs

This folder holds the specification for the Personal Knowledge Base, one feature at a time. Each feature implements one acceptance criterion (AC-01 to AC-30) from [`../requirements.md`](../requirements.md), section 10.

The rule for all work here: **spec, then plan, then a failing test, then code.** Nothing is implemented before its test exists and fails.

## Layout

```
specs/
├── README.md
└── features/
    ├── 01_google_sign_in/
    │   ├── spec.md
    │   └── plan.md
    ├── 02_github_sign_in/
    │   ├── spec.md
    │   └── plan.md
    └── ...                      (30 feature folders)
```

- **Folder name:** `<NN>_<topic>`. `NN` is the AC number, two digits, so folders sort in AC order. The topic is lowercase words joined by underscores. For example, `20_realtime_notifications` implements AC-20.
- **`spec.md`:** what the feature must do, seen from outside the system. It holds the AC line, scenarios, error responses, and edge cases.
- **`plan.md`:** how the feature is built. It holds the technical approach, the tasks, and the tests for each task.
- **Code:** `../backend/` (Rails, RSpec) and `../frontend/` (React, Vitest).

## Workflow for a feature

Work through the steps in order.

1. **Spec.** Write `spec.md` with status `draft`.
2. **Accept the spec.** When the owner approves it, set the status to `accepted`. Only accepted specs get a plan.
3. **Plan.** Write `plan.md` with status `draft`. Split the work into tasks, each marked `[BE]` or `[FE]`. List the tests for each task before the task starts. When the owner approves it, set the plan status to `accepted`.
4. **Red.** Write the next test from the plan and run it. It must fail because the behavior is missing, not because of a typo or a setup error.
5. **Green.** Write the least code that makes the test pass.
6. **Refactor.** Clean up while the tests stay green.
7. **Next test.** Repeat steps 4 to 6 until every test for the task passes. Then tick the task in `plan.md`.
8. **Done.** When all tasks are ticked, the full RSpec and Vitest suites pass, and RuboCop and ESLint are clean, set the spec status to `done`.

## Rules

- **No code without a failing test.** This applies to every task, however small.
- **Test names start with the AC ID.** Add the backend or frontend requirement ID when there is one:
  ```ruby
  it "AC-13 marks a note as reviewed and recalculates the next review date" do
  ```
  To find every test for an AC, run `grep -r "AC-13" backend frontend`.
- **The spec says what, the plan says how.** `spec.md` does not name classes, gems, or components. `plan.md` does not add behavior the spec lacks.
- **Behavior not in the spec means stop.** Update the spec, get it accepted, then continue. Do not add behavior silently.
- **Accepted specs are not edited in place.** A behavior change goes into a `## Changes` section at the end of `spec.md`, with the date, the reason, and what changes. The spec status returns to `draft` until the change is accepted. The original scenarios stay as the record of what was agreed.
- **Technical deviations go in the plan.** A change of approach (a different library, a different file layout) is written under `## Deviations` in `plan.md`. A behavior change follows the rule above.
- **Dependencies.** A plan lists the features it depends on in `Depends on:`. Build those first. Otherwise, work in AC order.

## Templates

`spec.md`:

```markdown
# Feature: <NN>_<topic>

**Status:** draft | accepted | done

## Acceptance criterion

> AC-NN: <text copied from requirements.md>

## Scenarios

**<name>**
- Given ...
- When ...
- Then ...

## Edge cases

- <case>: <behavior, with status code and error body where relevant>

## Changes

<!-- Empty until the spec is accepted and then changed. -->
```

`plan.md`:

```markdown
# Plan: <NN>_<topic>

**Status:** draft | accepted
**Depends on:** <feature folders, or none>

## Approach

<Technical choices: where code goes, libraries, data changes.>

## Tasks

- [ ] 1. [BE] <task>
  - Tests (write first):
    - AC-NN <test name>
- [ ] 2. [FE] <task>
  - Tests (write first):
    - AC-NN <test name>

## Deviations

None yet.
```
