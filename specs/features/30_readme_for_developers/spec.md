# Feature: 30_readme_for_developers

**Stage:** Done
**Approved:** yes, 2026-11-10 (owner's standing instruction: recommended options; re-approved after the Changes entry of 2026-11-10)

## Acceptance criterion

> AC-30: README is sufficient for another developer to run the app without guessing

Sources: requirements.md 1 (runnable locally; the README has the commands for the frontend, backend, database, and tests), 2 (what the README must explain), 5 (the environment variables to document: Google OAuth, GitHub OAuth, session or token signing, database connection, frontend and backend callback URLs), 7 (the app starts with documented commands; the test command is documented; the README explains known limitations), 8 (what the README must include), 9 (containerization; a note when it is skipped because it is blocked); [docs/conventions.md](../../docs/conventions.md#code) (Code: Sign-in configuration, the variables the sign-in reads); [docs/api_contract.md](../../docs/api_contract.md); the README parts other features hand over: [features/07_collection_delete_rule/spec.md](../07_collection_delete_rule/spec.md), [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (question 1: "today"), [features/18_archived_no_reminders/spec.md](../18_archived_no_reminders/spec.md), [features/19_unscheduled_no_reminders/spec.md](../19_unscheduled_no_reminders/spec.md), [features/20_realtime_notifications/spec.md](../20_realtime_notifications/spec.md), [features/22_websocket_auth/spec.md](../22_websocket_auth/spec.md), and [features/23_websocket_client_message/spec.md](../23_websocket_client_message/spec.md) (each one's README edge case), and [features/26_local_run/spec.md](../26_local_run/spec.md), [features/27_local_tests/spec.md](../27_local_tests/spec.md), [features/28_spec_artifacts/spec.md](../28_spec_artifacts/spec.md), and [features/29_test_mapping/spec.md](../29_test_mapping/spec.md) (the sections they write), not yet in `docs/`.

Not part of this feature: making the app start and the tests pass (AC-26, AC-27); the specification artifacts and the test mapping (AC-28, AC-29).

## Questions

1. In which order does the README go?
   - Options: an order for a new developer (recommended); other options: TBD (the research names none).
   - Answer: in this order, for a developer who arrives new:
     1. the title, the project overview, and "Contents", a table of contents;
     2. "Stack": each part of the stack with its folder, including where the database schema and the migrations are and where each suite's tests are;
     3. "Quick start": from a clone to a signed-in app with sample data and passing tests, in numbered steps that link to the sections below;
     4. "Configuration": "Environment variables", "Google OAuth credentials", and "GitHub OAuth credentials";
     5. "Running locally", with "Sample data" (AC-26);
     6. "Running the tests" (AC-27);
     7. "Reference": "Sign-in", "API", "WebSocket message format", "Review reminder rules", "Timezone handling", and "Collection deletion behavior";
     8. "Specification": the workflow, the files, the walk through feature 06, the artifacts, and "What changed" (AC-28), with "Test coverage" (AC-29);
     9. "Troubleshooting";
     10. "Known limitations".

     (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. Is there an example environment file?
   - Options: yes, a root `.env.example` (recommended); no.
   - Answer: yes: `.env.example` at the root of the repository, committed, with a one-line comment per variable. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` are present and empty. `APP_BASE_URL` and `SECRET_KEY_BASE` are commented out, so a copied file keeps their defaults. "Quick start" copies it to `.env`. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. How does the README answer requirements.md 5's list of variables?
   - Options: as below (recommended); other options: TBD (the research names none).
   - Answer: "Environment variables" answers each of the five needs:
     - Google OAuth: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`;
     - GitHub OAuth: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`;
     - session or token signing: `SECRET_KEY_BASE`, needed in production only, because development and test make their own;
     - database connection: no variable, because each environment's database is an SQLite file in `backend/storage/`, which the backend prepares when it starts (feature 26 question 2);
     - frontend and backend callback URLs: `APP_BASE_URL` (default `http://localhost:3000`) builds both sign-in callback URLs, `<APP_BASE_URL>/auth/google_oauth2/callback` and `<APP_BASE_URL>/auth/github/callback`. The frontend needs no address of its own, because the backend serves it from the same origin.

     (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. How is the README accepted?
   - Options: a fresh-clone walkthrough (recommended); other options: TBD (the research names none).
   - Answer: by a walkthrough from a fresh clone, under another Compose project name, with no `.env` and new volumes, that follows the README from the top. It records every point where the reader had to guess, and the README is accepted when there is none. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. Which platforms does the README cover?
   - Options: macOS, Linux, and Windows through WSL 2 (recommended); other options: TBD (the research names none).
   - Answer: macOS, Linux, and Windows through WSL 2. Every command in the README is written for a POSIX shell, and the README says so once. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. What does the troubleshooting section cover?
   - Options: the cases below (recommended); other options: TBD (the research names none).
   - Answer: one entry per problem, each with what the developer sees and what to do: Docker not running; port 3000 already taken; a Compose version older than 2.24; the "Routing Error" page before the first frontend build (feature 26 question 3, which the draft called "Not Found"); an OAuth redirect mismatch at Google or GitHub; missing credentials, where a sign-in button cannot complete; and the sample-data refusals (feature 26 questions 7, 9, 11). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. How is the README organized across features, and how are the sections that other features write kept consistent?
   - Options: one section per topic, under a fixed heading, written by the feature that builds the behavior and updated in place by later ones, with each reference section summarizing its `specs/docs/` file and linking to it, and this feature checking them all (recommended: features 01 to 29 write their parts before this one, so the headings must be fixed before then, and the README stays a summary of the documents that hold the full rules); this feature rewrites the README from `specs/docs/` at the end; the README holds only links.
   - Answer:
     - Each item of requirements.md 8 `<readme_must_include>` and 2 `<readme_must_explain>` has one README section, under the heading below. The feature that builds the behavior writes its section in its Polish. A later feature that changes the behavior updates that section in place, and never adds a second section on the same topic.
     - A section under "Reference" summarizes what a developer needs and links to the file in `specs/docs/` that holds the full rules. Where both state the same fact, such as an error code, a message, a field, or the 60 seconds, they agree.
     - This feature puts the sections in the order of question 1, adds "Contents", "Quick start", and "Troubleshooting", and checks every section against its source.

     The headings, with the items they answer and the features that write them:
     - the overview, under the title (project overview): feature 01, kept current by each feature's Polish;
     - "Stack" (chosen tech stack): feature 01; this feature adds the folders (question 1);
     - "Environment variables" (required environment variables): features 01 and 02; this feature completes it (questions 3, 9);
     - "Google OAuth credentials": feature 01; "GitHub OAuth credentials": feature 02;
     - "Running locally" (how to run the backend, how to run the frontend) and "Sample data" (sample data instructions): feature 26;
     - "Running the tests" (how to run tests): feature 27;
     - "Sign-in": features 01 and 02, today the sections "Google sign-in" and "GitHub sign-in";
     - "API" (short API description): every feature that adds or changes an endpoint, from 06 on; today the sections "Collections API", "Notes API", and "Tags API";
     - "WebSocket message format": feature 20 (the batch message, the reminder fields, the 60-second check, when a batch is sent, and the duplicate prevention), feature 22 (the address, the authorization, the refusal, logout, and the same origin), and feature 23 (the `ack` message, its errors, and how long a dismissal lasts);
     - "Review reminder rules": feature 12 writes it; features 13 to 16, 18, and 19 add to it;
     - "Timezone handling": feature 12;
     - "Collection deletion behavior": feature 07;
     - "Specification" (the workflow; where the specification files are; how the specification guided the implementation; what changed): feature 28, which replaces today's "Specifications"; "Test coverage" (which requirements the automated tests cover): feature 29;
     - "Troubleshooting": this feature;
     - "Known limitations": every feature that hands one over; this feature checks the list.

     (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
8. Does "Troubleshooting" also cover new migrations that arrive while the app runs?
   - Options: yes, an entry (recommended: after a pull while the app runs, every page shows "Could not reach the server. Try again." and nothing says why); no.
   - Answer: yes. Its entry says that after a pull that brings new migrations while the app runs, the app shows "Could not reach the server. Try again." until it is restarted, and that a restart applies them (feature 26 question 2). (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. Does the README name the variables that Rails and its web server read for themselves?
   - Options: yes, in one line, as variables the app does not need (recommended: a developer who finds them in the code then knows they need nothing); no.
   - Answer: yes. One line under "Environment variables" names `PORT`, `RAILS_MAX_THREADS`, `RAILS_LOG_LEVEL`, `REDIS_URL`, `WEB_CONCURRENCY`, `PIDFILE`, `CI`, `BUNDLE_GEMFILE`, and `DATABASE_URL` as variables the app does not need. It warns that `DATABASE_URL` in `.env` would reach every backend command, the tests included, which would then use the database it names. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**A new developer runs the app without guessing**
- Given a fresh clone under another Compose project name, no `.env`, and new volumes
- When a developer follows the README from the top
- Then the app runs at http://localhost:3000, the sample data loads, `bin/test` passes, and the walkthrough records no point where the developer had to guess (question 4; AC-26, AC-27)

**The README has every required item**
- Given the README
- When it is compared with requirements.md 8 and 2
- Then each of the 17 items of section 8 (project overview, tech stack, spec-driven workflow, location of the specification files, running the backend, running the frontend, running the tests, Google OAuth credentials, GitHub OAuth credentials, required environment variables, a short API description, the WebSocket message format, the review reminder rules, the collection deletion behavior, the time zone handling, sample data instructions, known limitations) and each of the 5 things section 2 asks it to explain is in its section of question 7 (questions 1, 7)

**The sections are in order**
- Given the README
- When a developer reads "Contents"
- Then it lists the sections in the order of question 1, and each entry links to its section (question 1)

**The commands for each part are there**
- Given the README
- When a developer looks for the commands that start the frontend, the backend, and the database, and run the tests
- Then each is there (feature 26 question 13; feature 27 question 9; requirements.md 1)

**Every environment variable is documented**
- Given the variables the backend reads
- When a developer reads "Environment variables" and `.env.example`
- Then each variable a developer sets has a row with what it is for, when it is needed, and its default; the others are in the one line of question 9; each of requirements.md 5's five needs has its variable, or says why none is needed; and `.env.example` holds the same variables a developer sets as the table (questions 2, 3, 9)

**The example environment file**
- Given `.env.example` at the root
- When a developer opens it
- Then the four OAuth variables are present and empty, and `APP_BASE_URL` and `SECRET_KEY_BASE` are commented out (question 2)

**A copied example file keeps the defaults**
- Given a developer copied `.env.example` to `.env` and filled in only the Google credentials
- When the app starts
- Then the sign-in callback URLs are built from `http://localhost:3000`, "Continue with Google" leads to Google, and "Continue with GitHub" cannot complete a sign-in, as "Environment variables" says (questions 2, 3)

**The callback URLs**
- Given the README
- When a developer sets up Google and GitHub OAuth
- Then "Google OAuth credentials" and "GitHub OAuth credentials" give each callback URL, built from `APP_BASE_URL`, and say what to change when the app is served at another address (question 3)

**The commands work on each platform**
- Given macOS, Linux, or Windows through WSL 2
- When a developer runs the README's commands in a POSIX shell
- Then they work as written (question 5)

**Troubleshooting**
- Given one of these problems: Docker not running, port 3000 already taken, a Compose version older than 2.24, the "Routing Error" page before the first build, an OAuth redirect mismatch, missing credentials, a sample-data refusal, or new migrations while the app runs
- When a developer looks it up in "Troubleshooting"
- Then it has an entry that says what they see and what to do (questions 6, 8)

**One section per topic, in agreement with the documents**
- Given the README
- When it is checked
- Then no topic has two sections; each section under "Reference" links to its file in `specs/docs/`; and each fact it states, such as a code, a message, a field, or an interval, is the same in that file (question 7)

**Known limitations and links are current**
- Given the README
- When it is checked
- Then its known limitations match the app as built, and every link points to something that exists (requirements.md 7)

## Edge cases

- An optional variable left empty in a copied `.env` would replace its default with an empty value, so `.env.example` keeps the optional variables commented out (question 2).
- `DATABASE_URL` is not in `.env.example`, and the README warns against putting it in `.env` (question 9).
- The walkthrough uses another Compose project name, so it starts with no volumes from an earlier run (question 4).
- The walkthrough makes no real Google or GitHub sign-in (requirements.md 7): it checks that each sign-in button leads to its provider with the callback URL the README gives, and signs in without the provider, as the Verify walkthroughs do (question 4).
- The known limitations include those other features hand over, such as the setup in Docker only and the files owned by root on Linux (feature 26 question 1), and any that an approved spec or a plan's `## Deviations` adds later (requirements.md 7; question 7).
- A feature that changes a documented behavior after this one is polished updates its README section in place, in its own Polish (question 7).
- The README's headings are the ones of question 7, so a later check can find each required item by its heading (question 7).
- Containerization is not skipped, so the README has no note that it is blocked (requirements.md 9).
- The implementation notes get the AC-30 entry during this feature's Polish, and the test mapping shows no AC as "Not covered" when this feature leaves Polish (feature 28 question 2; feature 29 question 11).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

### 2026-11-10: the page before the first frontend build
- Reason: feature 26's Verify found that `/` shows the Rails welcome page (200) before the first frontend build, not a 404. The development environment routes `/` to it when the app has no route there. Only other addresses give "Routing Error" and the JSON `Not Found`. The code is not at fault. Feature 26's spec got the same change (its `## Changes`, 2026-11-10); this spec names the page in question 6 and in one scenario.
- Change: question 6's problem "the "Routing Error" page before the first frontend build (feature 26 question 3, which the draft called "Not Found")" → "the page before the first frontend build: `/` shows the Rails welcome page (200), and other addresses show "Routing Error" in a browser or the JSON `Not Found` for `curl` (feature 26 question 3); the entry says to wait for the "built in" line in the frontend's log, then reload".
- Change: scenario "Troubleshooting": "the "Routing Error" page before the first build" → "the Rails welcome page (or "Routing Error" at another address) before the first build".
- Open question: none. The recommended answer above was taken under the owner's standing instruction of 2026-11-10 (the run continues the instruction of 2026-11-09).
- Approved: yes, 2026-11-10 (owner's standing instruction: recommended options)

## Notes for Plan (draft)

From the research of 2026-11-09, before the spec was approved, with the Design step's notes added at the end. They are not part of the approved behavior. The Plan step moves what it uses into `plan.md`.

- Fact: the README is not GitLab's template. Commit 40f15ae (AC-01) replaced it with feature 01's sections: stack, running, environment variables, Google OAuth, known limitations, specifications. The "Gotchas" line in CLAUDE.md that calls it a template is out of date; fixing CLAUDE.md is for the owner.
- The backend reads `GOOGLE_*` and `GITHUB_*` (empty counts as unset, because of `.presence`), `APP_BASE_URL`, and Rails internals: `PORT`, `RAILS_MAX_THREADS`, `RAILS_LOG_LEVEL`, `REDIS_URL` (production cable), `WEB_CONCURRENCY`, `PIDFILE`, `CI`, `BUNDLE_GEMFILE`.
- `APP_BASE_URL` is read with `ENV.fetch`. An empty `APP_BASE_URL=` in a copied `.env.example` would replace the default with an empty string, so optional variables must be commented out in the example file.
- `compose.yaml` sets `name: knowledge-base`, so the walkthrough needs `-p <other>` (or `COMPOSE_PROJECT_NAME`) to get empty volumes.
- `compose.yaml` uses `env_file` with `required: false`, which needs Compose 2.24 or newer. This machine has v5.6.1.
- Proposed checklist (1 item): 1 [SETUP], `.env.example`.
- Depends on: 26, 27, 28, 29, and every earlier feature's README sections.
- Docs: the README, restructured, with checks for the 17 items of section 8 and the 5 of section 2, every environment variable the backend reads, the links, the current limitations, and the walkthrough; the AC-30 entry in the implementation notes; `docs/conventions.md` (the README order).
- Design, 2026-11-09: the README's headings at Design: "Stack", "Running locally", "Environment variables", "Google OAuth credentials", "GitHub OAuth credentials", "Google sign-in", "GitHub sign-in", "Collections API" (with "Notes API" and "Tags API" nested under it as `###`), "Collection deletion behavior", "Known limitations", "Specifications". Feature 12's plan already names "Timezone handling" and "Review reminder rules" (its Docs item 6), which question 7 keeps.
- Design, 2026-11-09: `DATABASE_URL` is read by Rails itself, not by the app's code. Rails merges it into the configuration of the environment that runs, so a `DATABASE_URL` in `.env` would also reach `bundle exec rspec`. The run's agents use it on purpose, one test database per lane.
- Design, 2026-11-09: the walkthrough can sign in as the Verify harness does (a sign-in made through the real callback with OmniAuth test mode on in a runner process only); no real provider is contacted.
- Design, 2026-11-09: question 7's headings must reach the plans of features 13 to 25, which are being written in parallel; the orchestrator relays them.
