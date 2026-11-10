# Feature: 28_spec_artifacts

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-28: Specification artifacts are present in the repository

Sources: requirements.md 2 (the process; the required artifacts; what the README explains; what the specification describes), 8 (the repository contains spec-driven artifacts; the spec artifacts it must include; the README); project.md (`sdd_rules`: specs in the project's own framework; every change starts as a change proposal; each spec links to AC IDs; each test references its AC ID; a change of agreed behavior is a change proposal, not an edit in place); `specs/README.md` (the layout, the workflow, the Docs rules, the templates); [docs/api_contract.md](../../docs/api_contract.md), [docs/conventions.md](../../docs/conventions.md), [docs/domain/users.md](../../docs/domain/users.md), [docs/domain/collections.md](../../docs/domain/collections.md), [docs/domain/tags.md](../../docs/domain/tags.md), and [docs/domain/notes.md](../../docs/domain/notes.md) (what is documented so far).

Not part of this feature: the test mapping (AC-29, feature 29); the README as a whole (AC-30, feature 30).

## Questions

1. What do the implementation notes record, beyond what each feature folder holds?
   - Options: the approvals and the Verify items below (recommended); other options: TBD (the research names none).
   - Answer: for each AC, two things a reader cannot see in one place in the folders. First, how its spec and its plan were approved: by the owner's own review, or under a standing approval of the owner (2026-11-05, 2026-11-09), with the answers that were the agent's own recommendation. Second, how its Verify was run (by the owner by hand, or as an automated walkthrough by Claude), with each Test plan item that was waived, not run, or failed, and the reason. Where an AC has none of these, its entry says "None.". (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. Where are the implementation notes, and how are they arranged?
   - Options: one file in `specs/docs/` (recommended); other options: TBD (the research names none).
   - Answer: one file, `specs/docs/implementation_notes.md`. It has one entry per AC, in AC order, which links to the feature's folder and does not copy its stage, because the stage lives only in `spec.md`. It ends with "Spec evolution": every `## Changes` entry of the feature specs, in date order, each with its date, its feature, its title, and a link. AC-29 and AC-30 add their own entries during their Polish. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How does the README tell what changed between the first specification and the final implementation?
   - Options: a summary with one line per change, linking to the implementation notes (recommended); other options: TBD (the research names none).
   - Answer: a "What changed" part of the README's "Specification" section: one line per entry of "Spec evolution", in date order, each linking to the entry in the implementation notes. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. Where is the domain model shown as a whole?
   - Options: `specs/docs/domain/README.md`, with a Mermaid entity diagram (recommended: the remote is GitHub, which renders it); other options: TBD (the research names none).
   - Answer: `specs/docs/domain/README.md`. It holds a Mermaid entity diagram (`erDiagram`) of every entity the app stores and the relations between them, and one line per area that links to the area's file. GitHub, where the repository is hosted, draws the diagram. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. How does the README point to each required artifact?
   - Options: a table of the eight artifacts of requirements.md 2 and their locations (recommended); other options: TBD (the research names none).
   - Answer: the README's "Specification" section has a table of the eight artifacts of requirements.md 2 and where each one is:
     - product requirements or feature specification: `requirements.md`, and `spec.md` in each feature folder `specs/features/NN_topic/`;
     - domain model: `specs/docs/domain/`, with `README.md` for the whole model and one file per area;
     - API contract or endpoint specification: `specs/docs/api_contract.md`, for HTTP and the WebSocket;
     - acceptance criteria: `requirements.md` section 10, and the `## Acceptance criterion` and the scenarios of each `spec.md`;
     - implementation plan: `plan.md` in each feature folder;
     - test plan or mapping: the `## Test plan` of each `plan.md`, and from AC-29 on `specs/docs/test_mapping.md`;
     - change proposal or spec evolution note: the `## Changes` of each `spec.md` and the `## Deviations` of each `plan.md`, listed in the implementation notes;
     - final implementation notes: `specs/docs/implementation_notes.md`.

     AC-29 adds the test mapping to its row. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. How does the README show that the specification guided the implementation?
   - Options: a walk through one feature (recommended); other options: TBD (the research names none).
   - Answer: the README walks through feature 06 (collections), one step per stage, each with a link: AC-06 in `requirements.md`; its spec's questions, answers, scenarios, and edge cases; the approval; its plan's checklist, each item with the test written first; the tests named "AC-06 …"; its Verify results; and the `specs/docs/` entries its Polish wrote. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. Do the implementation notes also list how the build differed from each plan?
   - Options: yes, one line per `## Deviations` entry, with a link (recommended: the notes are where a reader sees how the build differed from the plans, without opening thirty folders); no, the folders hold them.
   - Answer: yes. Under each AC, the notes have one line per `## Deviations` entry of its plan, with its date and a link to it, or "No deviations." when its plan has none. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
8. Where does the specification say where it answers each of the six points of requirements.md 2 `<specification_must_describe>`?
   - Options: a section of `specs/README.md`, linked from the README (recommended: `specs/README.md` is where a reader of the specification starts); more rows in the README's artifact table.
   - Answer: `specs/README.md` gets a section "What the specification describes", with one line per point: what the app should do: `requirements.md` and each feature's `spec.md`; what entities exist: `docs/domain/`; what business rules are enforced: the Rules of `docs/domain/` and each spec's scenarios; what API behavior is expected: `docs/api_contract.md`; what edge cases are handled: the Edge cases of each `spec.md`; how the implementation satisfies the acceptance criteria: `docs/test_mapping.md`, each plan's Test plan results, and `docs/implementation_notes.md`. The README's "Specification" section links to it. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**Every required artifact has a location**
- Given the README
- When a developer reads the artifact table
- Then each of the eight artifacts of requirements.md 2 has a row, and every file and folder named in it exists (question 5; requirements.md 2, 8)

**The README explains the workflow**
- Given the README
- When a developer reads its "Specification" section
- Then it names the workflow: the project's own spec-driven framework, described in `specs/README.md`, with its steps and approval gates; it says where the main specification files are; it walks through feature 06 (question 6); it links to "Test coverage" for the requirements the automated tests cover (AC-29); and it has "What changed" (question 3) (requirements.md 2)

**The walk through feature 06**
- Given the README's walk through feature 06
- When a developer follows its links
- Then each one opens the step it names: the AC, the spec's questions and scenarios, the plan's checklist, the tests named "AC-06 …", the Verify results, and the docs entries (question 6)

**The domain model is shown as a whole**
- Given `specs/docs/domain/README.md`
- When a developer opens it on GitHub
- Then a diagram shows every entity the app stores and the relations between them, and each area links to its file (question 4)

**The domain model is complete**
- Given the entities the app stores
- When Polish compares them with the diagram and the area files
- Then each entity is in the diagram, and its area file lists its attributes (question 4; requirements.md 2, 6)

**The implementation notes**
- Given `specs/docs/implementation_notes.md`
- When a developer reads it
- Then it has one entry per AC, each linking to its feature folder, with how its spec and plan were approved, the answers that were the agent's own recommendation, how its Verify was run and the items waived, not run, or failed, and its plan's deviations; and it ends with "Spec evolution" (questions 1, 2, 7)

**At least one change is documented**
- Given the feature folders
- When the implementation notes list the `## Changes` entries
- Then the list has at least one entry, among them feature 01's change of the failure redirect (requirements.md 2: at least one documented change proposal or spec evolution note)

**The README says what changed**
- Given the README's "What changed"
- When a developer reads it
- Then it has one line per entry of "Spec evolution", in date order, each linking to that entry (question 3; requirements.md 2)

**The specification says where it answers each point**
- Given `specs/README.md`
- When a developer reads "What the specification describes"
- Then each of the six points of requirements.md 2 names where the specification answers it, and each place exists (question 8)

**The API contract is complete**
- Given every endpoint the backend serves, and the WebSocket connection with its messages
- When Polish compares them with `specs/docs/api_contract.md`
- Then each one is there; Polish adds any that the comparison finds missing (requirements.md 2: API contract)

**The layout of the specs folder is current**
- Given `specs/README.md`
- When a developer reads its Layout and its Docs table
- Then they show the files this feature adds, `docs/domain/README.md` and `docs/implementation_notes.md` (questions 2, 4)

## Edge cases

- The result of this AC is documents, so the Docs checks of its plan are its acceptance (`specs/README.md`, Polish gates).
- When this feature is polished, the notes have entries up to AC-28. AC-29 and AC-30 add theirs during their own Polish (question 2).
- The "Test plan or mapping" row names the plans' Test plans until AC-29 adds `specs/docs/test_mapping.md` to it (question 5).
- The notes link to the feature folders and copy no stage: the stage lives only in each `spec.md` (question 2; `specs/README.md`).
- A spec that gets a `## Changes` entry after this feature is polished adds its line to "Spec evolution" and to the README's "What changed" in its own Polish (questions 2, 3).
- An AC whose plan has no deviations says "No deviations.", and one with nothing to record under question 1 says "None.", so an empty entry is not mistaken for a missing one (questions 1, 7).
- requirements.md 8's other deliverables, the frontend and backend source, the schema and migrations, and the tests, are named with their folders in the README's "Stack" (feature 30 question 1). The test mapping is AC-29's.

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

## Notes for Plan (draft)

From the research of 2026-11-09, before the spec was approved, with the Design step's notes added at the end. They are not part of the approved behavior. The Plan step moves what it uses into `plan.md`.

- No checklist items: the result is documents, so Polish's Docs checks are the acceptance.
- Docs: a README section that replaces "Specifications"; `implementation_notes.md`; `domain/README.md`; `api_contract.md`, but only where the completeness check finds a gap; the layout in `specs/README.md`.
- The README already has a "Specifications" section, written by feature 01.
- The remote is GitHub, which renders Mermaid.
- Depends on: the documents of 01 to 27.
- Design, 2026-11-09: Polish here writes `specs/README.md` (its Layout, its Docs table, and the section of question 8), a file outside the usual Polish files (`specs/docs/` and the root README). The orchestrator knows.
- Design, 2026-11-09: the areas documented at Design are users, collections, tags, and notes. Reviews (feature 12) and notifications (features 20 and 23, the dismissals) come before this feature's Polish.
- Design, 2026-11-09: the answers of the agent's own can be found with `grep -rn "agent.s recommendation" specs` (the brief's marker), and the standing approvals with `grep -rn "standing" specs/features/*/spec.md specs/features/*/plan.md`. The Verify results of this run read "automated walkthrough by Claude".
- Design, 2026-11-09: `## Changes` entries at Design: feature 01 (the failure redirect names the provider) and feature 12 (the names of the review fields; questions 17 to 19).
