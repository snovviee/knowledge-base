---
name: sdd-spec
description: Design step of the SDD workflow (specs/README.md). Writes spec.md for one feature from its AC, the governing sections of requirements.md, and the owner's answers, then takes it to approval. Also records a behavior change to an approved spec.
argument-hint: "[NN | AC-NN | folder] [notes]"
disable-model-invocation: true
---

# sdd-spec: Design step

Write or update `specs/features/<NN>_<topic>/spec.md`: what the feature does, seen from outside the system. The workflow, the stages, and the template are in `specs/README.md`. Follow it wherever this file is silent.

Arguments: `$ARGUMENTS`

## Ground rules

- Talk with the owner in the language they write in. Write everything in the repo in English.
- Behavior comes from two sources only: `requirements.md` and the owner's answers. Never invent a rule, and never write an answer the owner did not give.
- The spec says what, not how. It names no classes, tables, gems, libraries, components, or files. HTTP status codes and error bodies are allowed, because an API client sees them.
- Only the owner approves. Never set `**Approved:** yes` on your own.

## 1. Find the feature

- The first argument names the feature: `06`, `6`, `AC-06`, and `06_collections_crud` all mean `specs/features/06_*`. Anything after it is the owner's note.
- No argument: take the lowest-numbered feature at Design (the old `**Status:** draft` header counts as Design) and say which one you took.
- No folder, but the AC is in `requirements.md` section 10: create `<NN>_<topic>/spec.md` from the template. No folder and no AC: stop. A new task goes through Foundation first (step 1 in `specs/README.md`).
- If another feature is at Plan, Build, Verify, Polish, or Ship, name it and ask the owner before going on. The rule is one feature at a time.

## 2. Pick the mode

Read the header of `spec.md`:

- `**Status:** draft` (the old header): replace it with `**Stage:** Design` and `**Approved:** no`, add the template sections that are missing, and continue as Design.
- `**Stage:** Design`: pick up where the file stands. Scenarios still empty or `TBD`: draft (step 3). Open questions: ask (step 4). All answered: check and approve (step 5).
- A later stage: the spec is approved. Treat the request as a behavior change (step 6).

## 3. Draft

1. Copy the AC text from `requirements.md` section 10 into `## Acceptance criterion`. Under the quote, add `Sources: requirements.md <sections>; <docs/ files the spec links to>`.
2. Read the sources from the table below, then search `requirements.md` for other mentions of the same entities and rules.
3. Read `specs/docs/`: the domain areas this AC touches, `api_contract.md`, and `conventions.md`. They hold what earlier features built, such as the error body or the meaning of "today". Link to them instead of restating them, and do not ask about them again. A missing file means no feature has built that area yet. If something a Done feature decided is missing, that is drift: find it in that feature's `spec.md` and tell the owner.
4. Turn every rule from the sources into a scenario or an edge case.
5. List every open point in `## Questions`: a choice the requirements leave to us ("one of these approaches", "you choose", "document the chosen..."), a gap, or an ambiguity. Do not ask about what `requirements.md` already settles.
6. Stay within this AC. Behavior that belongs to another AC gets one line naming that AC. If this feature cannot work without it, ask the owner where it goes.

| AC | Sections of requirements.md |
|---|---|
| AC-01, AC-02 | 3.1, 4 (authentication screen), 5, 11 |
| AC-03 | 3.1, 6, 11 |
| AC-04 | 3.1 |
| AC-05 | 3.1, 4 (logout action) |
| AC-06 | 3.2, 4 (collections area, collection management) |
| AC-07 | 3.2, 8 (README) |
| AC-08 | 3.3, 4 (tag management) |
| AC-09 | 3.4, 4 (notes view, create/edit, detail) |
| AC-10 | 3.3, 3.4, 4 |
| AC-11 | 3.4 |
| AC-12 | 3.4, 3.5 |
| AC-13, AC-14 | 3.5, 4 (mark as reviewed), 5 (dates), 11 |
| AC-15, AC-16 | 3.5, 3.6 (review state filter), 4, 11 |
| AC-17 | 3.6, 4 (search, filters, empty state), 11 |
| AC-18, AC-19 | 3.4, 3.5, 3.7, 11 |
| AC-20 | 3.7, 4 (visible notifications) |
| AC-21 | 1, 5 |
| AC-22 | 3.7, 5 |
| AC-23 | 3.7 |
| AC-24 | 4 (UI quality checks), 7 |
| AC-25 | 4 (narrow screens) |
| AC-26, AC-27 | 1, 7, 8, 9 |
| AC-28, AC-29 | 2, 8 |
| AC-30 | 1, 2, 5, 8, 9 |

Some sections apply to more features than the table shows. Sections 1 and 5 apply to every feature that touches user data: a user reaches only their own data, and invalid input gets a clear error. Section 4 `<ui_quality_checks>` applies to every feature with a screen: empty, loading, validation, and error states. Include them as this feature's edge cases. Once `docs/conventions.md` says how the UI shows a state, the edge case links to it instead of asking again. AC-21 and AC-24 check them across the whole app later.

## 4. Ask

1. Write the open questions in `## Questions`, numbered, before asking them.
2. Ask with the AskUserQuestion tool. At most 4 questions per round. One decision per question, 2 to 4 options. Put the recommended option first, mark it as recommended, and give the reason in its description. Add previews when options differ in layout or text (a screen, an error body, a message format).
3. Record each answer under its question as `- Answer: ...`, in English, keeping the owner's meaning exactly. If the owner picked an option and added a note, record both.
4. Update Scenarios and Edge cases to match the answers. If the answers raise new questions, run another round.

## 5. Check and approve

Before asking for approval, check that:

- every question has an answer;
- every rule from the sources and every answer appears in a scenario or an edge case;
- each scenario is Given / When / Then and checks one behavior;
- each API edge case gives the status code and the error body;
- nothing names an implementation detail;
- every link to `docs/` points to something that is there, and anything new is described in the spec itself.

Send the owner a short summary: the scenario names, the number of edge cases, the answers that shaped them, and the file path. Ask them to approve it or say what to change. Approval is an explicit yes to that question. Anything else is review feedback: apply it and ask again.

On approval, set `**Approved:** yes, YYYY-MM-DD` (today's date) and `**Stage:** Plan`. Tell the owner the next step is `/sdd-plan <NN>`.

## 6. Change an approved spec

An approved spec is not edited in place.

1. Add an entry to `## Changes`:

   ```markdown
   ### YYYY-MM-DD: <short title>
   - Reason: <why the behavior changes>
   - Change: <scenario or edge case>: <before> → <after>
   ```

2. Set `**Stage:** Design` and `**Approved:** no`.
3. Ask about anything the change leaves open (step 4). Then update the affected scenarios and edge cases.
4. Check and approve as in step 5. If `plan.md` exists, tell the owner the plan comes next: `/sdd-plan <NN>` revises it.
