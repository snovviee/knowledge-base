# Feature: 26_local_run

**Stage:** Done
**Approved:** yes, 2026-11-10 (owner's standing instruction: recommended options; question 3 changed, see Changes)

## Acceptance criterion

> AC-26: The app runs locally from README instructions

Sources: requirements.md 1 (runnable on a local developer machine; the README has the commands to start the frontend, backend, database, and tests), 6 (sample data: a seed script, documented manual steps, or a development/test endpoint; it belongs to the authenticated user), 7 (starts locally with documented commands; the README explains known limitations), 8 (README: running the backend and the frontend, sample data instructions, known limitations), 9 (containerization is optional: a Dockerfile, docker-compose, or both); project.md (runtime: the app, RSpec, and the linters all run in containers); [docs/conventions.md](../../docs/conventions.md#ui) (UI: Server error on page load); [docs/domain/users.md](../../docs/domain/users.md#sign-in) (Sign-in; Rules: a sign-in starts at sign-in and ends at logout, a browser that never logs out keeps its record); [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (question 1: "today"; question 15: the review intervals), [features/15_review_due_today/spec.md](../15_review_due_today/spec.md) and [features/16_review_overdue/spec.md](../16_review_overdue/spec.md) (due today, overdue), and [features/17_search_and_filter/spec.md](../17_search_and_filter/spec.md) (questions 7, 8: "Next 7 days", "No review scheduled"), not yet in `docs/`.

Not part of this feature: the test commands (AC-27, feature 27); the README as a whole, its configuration sections, and its troubleshooting (AC-30, feature 30).

## Questions

1. Does the app run only in Docker, or also with Ruby and Node on the host?
   - Options: Docker only, with Compose 2.24 or newer (recommended); also on the host.
   - Answer: Docker only. Docker with Compose 2.24 or newer is the one prerequisite. The README documents no way to run the app with Ruby, Node, or SQLite installed on the host, and it says why: project.md makes Docker the runtime of the app, the tests, and the linters; the images fix the versions (Ruby 4.0.9, Node 26.13.0, SQLite), so every developer gets the same ones from one prerequisite; and a second setup on the host would have to be documented, kept working, and tested on its own. requirements.md 9 makes containerization optional, and requirements.md 1 asks for commands that start each part, which Compose commands give (question 13). Compose 2.24 is the first version that accepts the optional `.env` file the app reads. The README lists two known limitations: no setup on the host is documented, and on Linux the files the containers write into the clone (the database, the frontend build, the logs) belong to root. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. How is the database prepared on the first start? Today a fresh clone does not start cleanly: nothing prepares the database, every API call fails, and the UI shows "Could not reach the server. Try again." (feature 04) until someone runs the migrations by hand.
   - Options: the server start prepares the database itself (recommended); a manual setup command in the README.
   - Answer: every start of the backend server prepares the development database before the server takes requests: it creates the database when there is none, and applies the migrations not yet applied. No setup command is needed, on the first start or after a pull that brings new migrations. Other backend commands, such as the tests, do not prepare the development database. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. What does the page show before the first frontend build finishes?
   - Options: the Rails development pages, with the README naming the "built in" log line to wait for (recommended); a placeholder page.
   - Answer: no placeholder page. Until the first frontend build finishes, http://localhost:3000 shows the Rails welcome page (the development environment answers `/` with it, status 200, when the app has no page of its own there). Any other address, such as http://localhost:3000/nope, answers 404: a browser shows the development error page "Routing Error", and `curl` gets a JSON body with `"error": "Not Found"`. The README tells the developer to wait until the frontend's log shows a line with "built in", then to reload the page. (the recommended option, taken under the owner's standing instruction of 2026-11-09, and changed on 2026-11-10: see Changes. The draft named the page "Not Found"; the probe of 2026-11-09 saw that for `curl` and "Routing Error" for a browser, but on another address than `/`.)
4. Which port does the app use?
   - Options: fixed at 3000 (recommended: the OAuth callbacks depend on it); other options: TBD (the research names none).
   - Answer: 3000, fixed. The app is at http://localhost:3000, open to this machine only. When another program already uses the port, Docker reports it and the app does not start; it never moves to another port. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. No AC names sample data, although requirements.md 6 requires it and section 8 lists "Sample data instructions" in the README. Which feature owns it?
   - Options: this feature, AC-26 (recommended in the research); another feature: TBD.
   - Answer: this feature, AC-26: sample data is part of running the app locally. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. How does a developer load sample data?
   - Options: a development and test command, `bin/rails sample_data:load`, run in the running backend with `docker compose exec` (recommended: a seed would run when the database is first prepared, before anyone has signed in); a development endpoint and a button; documented manual steps.
   - Answer: with a command for the development and test environments, run in the running backend: `docker compose exec backend bin/rails sample_data:load`. Nothing loads sample data when the database is first prepared, because no one has signed in then, and the data must belong to a signed-in user (requirements.md 6). There is no endpoint and no button. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
7. Whose workspace gets the sample data?
   - Options: the user with the newest live sign-in (recommended); other options: TBD (the research names none).
   - Answer: the user of the newest sign-in that logout has not ended ([domain/users.md](../../docs/domain/users.md#sign-in)): in practice, the developer who signed in last. With no such sign-in, the command fails with "No one is signed in. Sign in with Google or GitHub, then run this again." and adds nothing. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
8. What happens when that workspace already has data?
   - Options: nothing is added, and the command fails (recommended); other options: TBD (the research names none).
   - Answer: nothing is added, and the command fails (question 9). To start over, the developer stops the app, runs `docker compose run --rm backend bin/rails db:reset`, which deletes all development data, every user's, then starts the app, signs in again, and loads the sample data. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
9. What counts as a workspace that already has data, and what does the command print then?
   - Options: TBD (the research gives no rule and no message).
   - Answer: a workspace has data when its user has at least one collection, tag, or note. The command then prints "<display name> (<Google or GitHub>) already has collections, tags, or notes, so no sample data was added. To start over, see "Sample data" in the README." and adds nothing. Each refusal of the command (questions 7, 9, 11) prints its message as an error and ends with exit status 1. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. What does the sample data hold?
    - Options: the set below (recommended); other options: TBD (the research names none).
    - Answer: three collections, one of them empty; four tags, one of them on no note; and ten notes. Together the notes have zero, one, and several tags; at least one is archived, and at least one has a source URL; they use every review interval (None, Daily, Weekly, Monthly, and Every N days); and they cover every review state, counted from the user's "today" as features 12 to 17 define it: overdue, due today, due within the next 7 days, due later, and no review scheduled. It is added all at once: if any part fails, nothing is added. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
11. In which environments does the command work?
    - Options: development and test only (recommended); other options: TBD (the research names none).
    - Answer: development and test only. Anywhere else, it fails with "Sample data is for the development and test environments only." and adds nothing. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
12. What does the command print when it adds the data?
    - Options: one line that names the user and the counts (recommended: question 7 chooses the user for the developer, so the developer sees whose workspace got the data); nothing.
    - Answer: "Added sample data for <display name> (<Google or GitHub>): 3 collections, 4 tags, 10 notes." The exit status is 0. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
13. Which commands does the README give to start the backend, the frontend, and the database (requirements.md 1, 8)?
    - Options: one Compose command for everything, and one for each part (recommended: requirements.md 1 and 8 name the parts one by one); only the command for everything.
    - Answer: the README's "Running locally" gives:
      - everything: `docker compose up`, stopped with Ctrl+C;
      - the backend alone: `docker compose up backend`, which serves the API and the latest frontend build at http://localhost:3000;
      - the frontend alone: `docker compose up frontend`, which builds the pages again on every change for the backend to serve; the frontend has no address of its own. One build without watching: `docker compose run --rm frontend npm run build`;
      - the database: there is no database server to start. Each environment's database is an SQLite file in `backend/storage/`, which the backend prepares when it starts (question 2). To prepare it by hand: `docker compose run --rm backend bin/rails db:prepare`. To start over: `docker compose run --rm backend bin/rails db:reset`, with the app stopped; it deletes all development data;
      - any other Rails command, such as the console: `docker compose run --rm backend bin/rails <command>`.

      It also says that the first start builds the images and installs the gems and packages, which needs the network and takes a few minutes, and that later starts need no network. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**Start from a fresh clone**
- Given a fresh clone, Docker with Compose 2.24 or newer, no database, and no frontend build
- When I run `docker compose up`
- Then the database is created and migrated before the server takes requests, and once the frontend's log shows a line with "built in", http://localhost:3000 shows the sign-in screen (questions 1 to 4, 13; requirements.md 1, 7)

**New migrations after a pull**
- Given the app is stopped, and a pull brought migrations not yet applied
- When I run `docker compose up`
- Then the migrations are applied before the server takes requests, and the app works without a setup command (question 2)

**Before the first frontend build**
- Given the app has just started, and the frontend's log has not shown "built in" yet
- When I open http://localhost:3000
- Then the page shows the Rails welcome page; any other address answers 404, with the development error page "Routing Error" in a browser; after the "built in" line, a reload of http://localhost:3000 shows the sign-in screen (question 3)

**The port is already taken**
- Given another program uses port 3000
- When I run `docker compose up`
- Then Docker reports that the port is taken, and the app does not start on another port (question 4)

**Start one part at a time**
- Given a fresh clone
- When I run `docker compose up frontend`, wait for "built in", and then run `docker compose up backend` in a second terminal
- Then http://localhost:3000 shows the sign-in screen, and a change to the frontend's source shows after the next "built in" and a reload (question 13)

**Load sample data**
- Given I signed in with Google as "Ada Lovelace", and my workspace has no collections, tags, or notes
- When I run `docker compose exec backend bin/rails sample_data:load`
- Then the command prints "Added sample data for Ada Lovelace (Google): 3 collections, 4 tags, 10 notes.", ends with exit status 0, and my workspace has three collections (one of them empty), four tags (one of them on no note), and ten notes (questions 6, 7, 10, 12)

**The sample data covers every case**
- Given I loaded the sample data today
- When the notes list shows
- Then it has notes with zero, one, and several tags, an archived note, a note with a source URL, every review interval, and notes that are overdue, due today, due within the next 7 days, due later, and with no review scheduled, counted from my "today" (question 10; feature 12 question 1)

**The newest sign-in gets the data**
- Given two users are signed in, and the second signed in more recently
- When I load the sample data
- Then it goes into the second user's workspace only, and the first user's workspace is unchanged (question 7; requirements.md 6)

**No one is signed in**
- Given no sign-in exists that logout has not ended
- When I load the sample data
- Then the command prints "No one is signed in. Sign in with Google or GitHub, then run this again." as an error, ends with exit status 1, and adds nothing (questions 7, 9)

**The workspace already has data**
- Given the newest signed-in user, "Ada Lovelace" (Google), has one collection and nothing else
- When I load the sample data
- Then the command prints "Ada Lovelace (Google) already has collections, tags, or notes, so no sample data was added. To start over, see "Sample data" in the README." as an error, ends with exit status 1, and adds nothing (questions 8, 9)

**Start over**
- Given the app is stopped, and the development database has data
- When I run `docker compose run --rm backend bin/rails db:reset`, start the app, sign in, and load the sample data
- Then my workspace has the sample data, and every earlier development record is gone (questions 8, 13)

**Another environment**
- Given the backend runs in an environment other than development or test
- When I load the sample data
- Then the command prints "Sample data is for the development and test environments only." as an error, ends with exit status 1, and adds nothing (questions 9, 11)

**The README covers running locally**
- Given the README
- When a developer reads "Running locally"
- Then they find Docker with Compose 2.24 or newer as the one prerequisite, and why there is no setup on the host; the commands of question 13 for everything, the backend, the frontend, and the database; the address http://localhost:3000; the "built in" line to wait for, and the Rails welcome page that http://localhost:3000 shows before it; that the first start needs the network and takes a few minutes; and how to stop the app (questions 1 to 4, 13; requirements.md 1, 8)

**The README covers sample data**
- Given the README
- When a developer reads "Sample data"
- Then they find that they sign in first; the command; whose workspace gets the data; what it adds; each refusal, with what to do; and how to start over, with the warning that it deletes all development data, every user's (questions 5 to 12; requirements.md 6, 8)

**The README lists the limitations of running locally**
- Given the README
- When a developer reads "Known limitations"
- Then it says that no setup on the host is documented, and that on Linux the files the containers write into the clone belong to root (question 1; requirements.md 7)

## Edge cases

- The sample data is added all at once: if any part fails, nothing is added (question 10).
- The sample data goes into one user's workspace only, and no other user's data changes (question 7; requirements.md 6; AC-21).
- The review states of the sample data are counted from that user's "today": the date in their saved time zone, UTC until one is known (question 10; feature 12 question 1). Looked at on a later day, the same notes have moved on: a note due today then is overdue.
- A sign-in whose cookie expired without a logout still counts, because the server keeps its record ([domain/users.md](../../docs/domain/users.md#rules)) (question 7).
- A second load finds the data of the first, and is refused (questions 8, 9).
- A user's saved time zone and sign-ins are not data in the sense of question 9: a user with only those gets the sample data.
- A Compose version older than 2.24 is not supported, and the README names the version (question 1; feature 30 troubleshooting).
- On Linux, the files the containers write into the clone (the database, the frontend build, the logs) belong to root, and the README lists this as a known limitation (question 1).
- The first start builds the images and installs the gems and packages, which needs the network and takes a few minutes. Later starts need no network (question 13).
- The app is open to this machine only: another device on the network cannot reach it (question 4).
- Migrations that arrive while the app runs are applied at its next start. Until then, the app shows "Could not reach the server. Try again." ([conventions: Server error on page load](../../docs/conventions.md#ui)) (question 2; feature 30 troubleshooting).
- `db:reset` deletes every user's development data, not only one workspace's, and the README says so (questions 8, 13).
- Backend commands other than the server start, such as the tests or the console, do not prepare the development database: they apply no migration to it (question 2; feature 27 question 3).
- Before the first frontend build, http://localhost:3000/ answers 200 with the Rails welcome page, for a browser and for `curl` alike. Another address, such as `/nope`, answers 404: "Routing Error" for a browser, and for `curl` a JSON body whose `error` is "Not Found" (question 3).
- A new database starts empty: preparing it loads no sample data (question 6).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

### 2026-11-10: the page before the first frontend build
- Reason: Verify item 3 found that `/` shows the Rails welcome page before the first frontend build, not a 404. The development environment routes `/` to it when the app has no route there. Only other addresses give "Routing Error" and the JSON "Not Found". The code is not at fault.
- Change: question 3's answer: before the first build, "http://localhost:3000 answers 404: a browser shows "Routing Error", `curl` gets JSON `Not Found`" → "http://localhost:3000 shows the Rails welcome page (200); other addresses answer 404 ("Routing Error" in a browser, JSON `Not Found` for `curl`)"; the README tells the developer to wait for the "built in" line and reload, as before.
- Change: scenario "Before the first frontend build": "the page answers 404 with the development error page "Routing Error"" → "the page shows the Rails welcome page; any other address answers 404".
- Change: scenario "The README covers running locally": "the "Routing Error" page before it" → "the Rails welcome page that http://localhost:3000 shows before it".
- Change: edge case "Before the first frontend build": "`curl http://localhost:3000/` gets 404 with a JSON body" → "`/` answers 200 with the Rails welcome page; `/nope` answers 404, as above".
- Open question: none. The recommended answer above was taken under the owner's standing instruction of 2026-11-10 (the run continues the instruction of 2026-11-09). Feature 30's spec names "the "Routing Error" page before the first build" as a troubleshooting problem (its question 6 and a scenario); that is for feature 30's own change, listed in the report.

## Notes for Plan (draft)

From the research of 2026-11-09, before the spec was approved, with the Design step's probes added at the end. They are not part of the approved behavior. The Plan step moves what it uses into `plan.md`.

- Code gap: a fresh clone does not start cleanly. `docker/backend-entrypoint.sh` only installs gems. Nothing runs `db:prepare`, and development has `migration_error = :page_load`. Until someone runs the migrations by hand, every API call fails, and the UI shows "Could not reach the server. Try again." (feature 04). Proposed fix (question 2): `db:prepare` in the entrypoint, only when the command is `bin/rails server`.
- No AC owns sample data. requirements.md 6 requires it, section 8 lists "Sample data instructions" in the README, and feature 09 lists it as out of scope without naming an owner. Check that no other feature also claims it (question 5).
- The command is not `db/seeds.rb`, because `db:prepare` seeds a new database before anyone has signed in (question 6). "Newest live sign-in" reads feature 05's `sign_ins` (question 7). The data is added in one transaction (question 10).
- Proposed checklist (10 items): 1 [SETUP], the entrypoint runs `db:prepare`; 9 [BE] in `spec/lib/sample_data_spec.rb` and `spec/tasks/sample_data_task_spec.rb`, covering the content, the choice of user, the review states, no sign-in, a workspace with data, the environment, all-or-nothing, and the task's exit status.
- Depends on: 01, 02, 05, 06, 08, 09, 10, 12, 13, 14, 15, 16. The sample data needs the note fields and the meaning of "today" from features 10 and 12 to 16, none of which is specified yet. None of the dependencies is at Done.
- `compose.yaml` uses `env_file` with `required: false`, which needs Compose 2.24 or newer. This machine has v5.6.1.
- `compose.yaml` sets `name: knowledge-base`, so a fresh-clone check needs `-p <other>` (or `COMPOSE_PROJECT_NAME`) to get empty volumes.
- The containers run as root, so on Linux the files they write into the clone (database, build output, logs) are owned by root.
- Docs: the README sections "Running locally" and "Sample data", plus known limitations; `docs/conventions.md`.
- Design probe, 2026-11-09 (`bin/rails runner` against a throwaway database in the container's `/tmp`): with no `public/index.html`, a browser request (`Accept: text/html`) for a page that is not there gets 404 with the development page "Routing Error" (`text/html`), because `ActionDispatch::DebugExceptions` renders HTML for an HTML request even in API mode. `Accept: */*` gets 404 JSON `{"status":404,"error":"Not Found","exception":"#<ActionController::RoutingError: No route matches [GET] ...>", ...}`. Question 3's answer records both.
- Design probe, 2026-11-09: the main tree's development database had pending migrations from the features being built, and every request answered `ActiveRecord::PendingMigrationError` (500). This is question 2's gap, seen in practice.
- Feature 21's draft points its sample-data edge case to AC-26 (question 5). Feature 17 defines "Next 7 days" (tomorrow through today plus 7) and "No review scheduled" (the interval None), which question 10's states use.
- Depends on, as of Design: also 17, for the review states that question 10 names after its filter.
