---
name: sdd-plan
description: Plan step of the SDD workflow (specs/README.md). Turns an approved spec.md into plan.md (approach, a test-first checklist, the manual test plan, the documents for Polish) and takes it to approval. Also revises an approved plan.
argument-hint: "[NN | AC-NN | folder] [notes]"
disable-model-invocation: true
---

# sdd-plan: Plan step

Write `specs/features/<NN>_<topic>/plan.md`: how the approved spec gets built, in small test-first steps. The workflow and the template are in `specs/README.md`. Follow it wherever this file is silent.

Arguments: `$ARGUMENTS`

## Ground rules

- Talk with the owner in the language they write in. Write everything in the repo in English.
- `spec.md` is the only source of behavior. The plan adds no behavior the spec does not describe.
- Technical details may come from `requirements.md` (field lists, value sets, formulas, payload fields, required tests, environment variables) and from `project.md` (the stack). A detail that would add behavior is a gap in the spec, not a plan item.
- Only the owner approves. Never set `**Approved:** yes` on your own.

## 1. Find the feature

- The first argument names the feature: `06`, `6`, `AC-06`, and `06_collections_crud` all mean `specs/features/06_*`. Anything after it is the owner's note.
- No argument: take the feature at `**Stage:** Plan`. If there is none or more than one, ask.
- If another feature is at Build, Verify, Polish, or Ship, name it and ask the owner before going on.

## 2. Check the entry gate

- `spec.md` must have `**Approved:** yes, <date>`. If it does not, stop: the spec goes through `/sdd-spec <NN>` first.
- No `plan.md` yet: write it (steps 3 to 5).
- `plan.md` exists but is not approved: continue the review (step 5).
- `plan.md` is approved: revise it (step 6).

## 3. Read

1. `spec.md`: scenarios, edge cases, answers, and changes.
2. `specs/docs/`: the files in the spec's `Sources:` line and the domain areas the feature touches, `api_contract.md` for existing endpoints and the error body, and `conventions.md` for code layout and test helpers. Reuse what is there. If something a Done feature built is missing, that is drift: tell the owner.
3. `requirements.md`: the sections in the spec's `Sources:` line, plus 5 (backend), 6 (data), and 7 (required tests).
4. `project.md`, `compose.yaml`, and `Dockerfile`: the stack and how it runs. Every command in a test or a `Check:` runs in Docker: `docker compose run --rm <backend | frontend> <command>`.
5. `backend/` and `frontend/`: what already exists, what to reuse, and the conventions in use. Never plan to rebuild what exists.

## 4. Write plan.md

Follow the template in `specs/README.md`.

**Header.** `**Approved:** no`. `**Depends on:**` lists the features whose code this plan uses but does not build, such as `01, 03`, or `none`. If a dependency is not at Done, tell the owner: Build cannot start until it is.

**Approach.** Short bullets, only for what this feature adds or changes. Link to `docs/` for what already exists instead of restating it. Leave out lines that do not apply.

- Data: tables, columns, indexes, constraints.
- API: `METHOD /path`: request → response, status codes, error body.
- WebSocket: channel, message types, payloads.
- UI: screens, components, routes, states.
- Decisions: each technical choice, with a one-line reason.

**Checklist.** Items in build order. A behavior item:

- is one small behavior from the spec, small enough for one red-green-refactor cycle;
- is tagged `[BE]` or `[FE]`;
- names the test to write first: `- Test first: AC-NN <test name> (<test file>)`. The name starts with the AC ID and states the behavior, for example `AC-06 rejects a duplicate collection name with 422`.

Items without behavior are tagged `[SETUP]` (scaffolding, dependencies, config, tooling). They name a check instead of a test: `- Check: <command or what to look for>: <expected result>`. If such an item would change what a user or an API client sees, it is a behavior item and needs a test. Documentation is never a checklist item. It goes in `## Docs`.

Order: setup first, then the backend from data to API, then the frontend. Every item comes after the items it needs.

Choose the test level by the behavior: model specs for validations and rules, request specs for API behavior (status codes, bodies, authorization), channel specs for Action Cable, and Vitest with React Testing Library for the UI. Tests make no real Google or GitHub network calls (requirements.md section 7); use OmniAuth test mode.

**Test plan.** The manual walkthrough for Verify, run against the running app. One entry per scenario in `spec.md`, with the same name. `Steps:` are concrete actions: clicks and inputs, or `curl` and WebSocket client commands for behavior with no screen. `Expected:` is what should be seen. `Result: not run`. When the result of the AC is a document (AC-07, AC-26, AC-28 to AC-30), the Test plan covers only what the app does, and the document is accepted by its checks in `## Docs`.

**Docs.** What Polish creates or updates, one item per file: `- [ ] N. <file> (create | update): <what is added or changed>`, with `- Check: <what Polish compares>: <expected result>`. Cover:

- every entity, attribute, rule, and owner's answer the spec adds or changes: its area in `docs/domain/`;
- every endpoint, error, and WebSocket message in Approach: `docs/api_contract.md`;
- every pattern later features will reuse, such as a test helper or the way the UI shows errors: `docs/conventions.md`;
- every README section that `requirements.md` section 8 asks for and this feature provides, such as the collection deletion behavior or the WebSocket message format: `README.md`.

Write `None.` only if the feature changes nothing that a document describes.

**Deviations.** `None yet.`

## 5. Check and approve

Before showing the plan, check that:

- every scenario and edge case in the spec is covered by at least one checklist item;
- every behavior item traces back to a scenario or an edge case;
- the Test plan has one entry per scenario;
- every test name starts with the AC ID;
- no checklist item is documentation, and everything the feature adds that a document describes has a Docs item;
- nothing in the plan rebuilds code that already exists.

**Gate.** If the plan needs a behavior the spec does not describe, do not put it in the plan. List the gap for the owner and send it back to Design: `/sdd-spec <NN>` with a note.

Send the owner a short summary: the dependencies, the approach in a few lines, the number of items by tag, and the file path. Ask them to approve it or say what to change. Approval is an explicit yes to that question. Anything else is review feedback: apply it in `plan.md` and ask again.

On approval, set `**Approved:** yes, YYYY-MM-DD` (today's date) in `plan.md` and `**Stage:** Build` in `spec.md`. Tell the owner the next step is `/sdd-build <NN>`.

## 6. Revise an approved plan

A plan is revised when the spec changed (a new entry in its `## Changes`), when Build found a missing step, or when Verify found code that does not match the spec.

- Keep ticked items as they are. Never untick or delete them.
- Add new unticked items where they must run. Renumber only unticked items.
- For a Verify failure, add an item whose test reproduces the failure.
- For a change of approach (another library, another file layout), add an entry under `## Deviations` with the date, what changes, and why, and update Approach and the Docs items it affects.
- Set `**Approved:** no`, then check and approve as in step 5.
