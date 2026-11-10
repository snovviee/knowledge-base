---
name: sdd-polish
description: Polish step of the SDD workflow (specs/README.md). After Verify, writes or updates specs/docs/ and the README from the code as built, following the Docs section of plan.md, removes documentation drift in what the feature touched, and moves the feature to Ship.
argument-hint: "[NN | AC-NN | folder]"
disable-model-invocation: true
---

# sdd-polish: Polish step

Bring the documents in line with what the feature built: `specs/docs/` and the root `README.md`. The workflow is in `specs/README.md`, step 6, and what goes in each file is in its Docs section. Follow it wherever this file is silent.

Arguments: `$ARGUMENTS`

## Ground rules

- Talk with the owner in the language they write in. Write the documents in English.
- Document the code as built and verified, not the plan. Where the two differ, the code wins, unless it contradicts the approved spec.
- Change no code and no tests. A bug found here goes back to Build.
- Each entry names the AC that introduced or last changed it, for example `(AC-06)`.
- Keep each fact in one place. A domain area links to an endpoint instead of describing it, and the contract links to a rule instead of restating it.
- Do not commit or push. Ship makes the commit.

## 1. Find the feature

- The first argument names the feature: `06`, `6`, `AC-06`, and `06_collections_crud` all mean `specs/features/06_*`.
- No argument: take the feature at `**Stage:** Polish`. If there is none or more than one, ask.

## 2. Check the entry gates

Stop and tell the owner if either of these is false:

- `spec.md` has `**Stage:** Polish`.
- Every item in `## Test plan` of `plan.md` has a `Pass` result.

## 3. Read

1. `plan.md`: `## Docs`, `## Approach`, and `## Deviations`.
2. `spec.md`: the answers and scenarios, for the rules to record.
3. The feature's code. Nothing is committed before Ship, so `git status` and `git diff` show it, together with the files named in the checklist. This is the source for the documents.
4. The documents the Docs items name, as they are now.

## 4. Work through the Docs items

Take the unticked items in order:

1. Write or update the file from the code. If the item says `create`, start the file with the layout below.
2. Run the `Check:`. When the result of the AC is a document (AC-07, AC-26, AC-28 to AC-30), the check is its acceptance: run it as written and record `- Result: <Pass | Fail, date, what was seen>` under the item. If it fails, fix the document and run it again. If the fix needs code, it goes back to Build.
3. Tick the item.

Layouts for new files:

- `docs/domain/<area>.md`: a `## <Entity>` section for each entity (what it is, attributes with their validations, relations), then `## Rules`, then `## Chosen approaches` for the choices `requirements.md` leaves to us.
- `docs/api_contract.md`: `## Conventions` (base path, authentication, error body, status codes), then a section per resource with each endpoint (method and path, request, responses with status codes, errors), then `## WebSocket` (the connection and its authorization, channels, server → client and client → server messages with their payloads).
- `docs/conventions.md`: `## UI` and `## Code`, as short bullets.

## 5. Remove drift

Compare what the feature touched with the documents that describe it:

- every endpoint and WebSocket message the feature added or changed is in `api_contract.md` as built: paths, fields, status codes;
- every entity, validation, and rule it added or changed is in its domain area;
- every entry in `## Deviations` is reflected;
- no document still describes something the feature removed or replaced;
- links in `docs/` and in this feature's `spec.md` point to sections that exist.

For each mismatch:

- **The code matches the approved spec:** fix the document, and add the fix to `## Docs` as a ticked item ending in `(found in Polish)`.
- **The code contradicts the approved spec:** it is a bug, not drift. Do not document it. Stop and tell the owner: it goes back to Build with a failing test.
- **The drift is outside what this feature touched:** do not fix it here. List it for the owner.

## 6. Finish

1. From AC-29 on: record the Test plan results and tick the other Docs items, then tick the test mapping item if the plan has one, run `docker compose run --rm backend bin/rails test_mapping:write` and then `docker compose run --rm backend bin/rails test_mapping:check`, and leave Polish only when the check passes (`specs/README.md`, step 6).
2. Set `**Stage:** Ship` in `spec.md`.
3. Report to the owner: the files created and updated, the drift fixed, anything listed for later, and the next step, Ship.
