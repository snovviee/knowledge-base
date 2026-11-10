# Feature: 27_local_tests

**Stage:** Done
**Approved:** yes, 2026-11-09 (owner's standing instruction: recommended options)

## Acceptance criterion

> AC-27: Tests pass locally

Sources: requirements.md 1 (the README has the commands to run the tests locally), 7 (automated tests; no real Google or GitHub network calls; the test command is documented and runnable), 8 (README: how to run tests), 9 (containerization); project.md (runtime: RSpec and the linters run in containers); [docs/conventions.md](../../docs/conventions.md#code) (Code: Sign-in configuration, with test-only placeholder credentials; Test helper: OmniAuth test mode, so tests never reach Google or GitHub); [features/12_review_interval_setting/spec.md](../12_review_interval_setting/spec.md) (question 1: "today" in the user's time zone), not yet in `docs/`; [features/26_local_run/spec.md](../26_local_run/spec.md) (question 1: Docker only; question 2: only the server start prepares the development database).

Not part of this feature: which requirements the tests cover (AC-29, feature 29); starting the app (AC-26, feature 26).

## Questions

1. What must pass for "tests pass locally"?
   - Options: RSpec, Vitest, the TypeScript check, RuboCop, and ESLint (recommended); other options: TBD (the research names none).
   - Answer: five checks, each run in Docker: the backend tests (RSpec), the frontend tests (Vitest), the frontend type check (TypeScript, `tsc -b`), and the two linters, RuboCop and ESLint. All five must pass. The security checks, Brakeman and bundler-audit, stay separate commands, because they need the network: one asks for the newest Brakeman version, and the other needs the current advisory database. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
2. Is there one command that runs all of them?
   - Options: yes, a root `bin/test` (recommended); no, only the commands for each suite.
   - Answer: yes. `bin/test`, at the root of the repository, runs the five checks of question 1 in Docker, one after another. It runs every check even after one fails, prints a summary (question 7), and ends with exit status 0 when all five passed, and 1 when any failed. When Docker cannot be reached, it stops at once (question 6). The command for each check stays, and the README lists them (question 9). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
3. Must the app be running or stopped while the tests run?
   - Options: either (recommended); other options: TBD (the research names none).
   - Answer: either. The checks pass whether the app runs or not, and never read or change the development data: the backend tests use their own test database, and the frontend tests answer every request with their own stubs. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
4. How are real network calls kept out of the tests?
   - Options: every call to another host is blocked, and the test that makes it fails (recommended); other options: TBD (the research names none).
   - Answer: in both test suites, a test that tries to reach any host other than this machine fails, and its request does not leave the machine. So no test reaches Google, GitHub, or any other host, even by mistake. The sign-in tests use the providers' test mode and placeholder credentials ([conventions](../../docs/conventions.md#code)). (the recommended option, taken under the owner's standing instruction of 2026-11-09)
5. Must the tests pass on any day and in any time zone?
   - Options: yes (recommended); other options: TBD (the research names none).
   - Answer: yes. Every test whose result depends on the date or the time fixes the time it runs at. A run of the two test suites in the time zones Pacific/Kiritimati (UTC+14) and Pacific/Pago_Pago (UTC−11) proves it (question 8). This rule binds the tests of every feature that deals with dates, such as features 12 to 20. (the recommended option, taken under the owner's standing instruction of 2026-11-09)
6. What does `bin/test` print, and with which exit status, when Docker is not running?
   - Options: TBD (the research says only that it stops at once).
   - Answer: it prints "Docker is not running or not installed. Start Docker, then run bin/test again." as an error, runs no check, and ends with exit status 2. Status 2 tells a script that the checks could not run, where 1 means that a check failed. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
7. What does the summary of `bin/test` show?
   - Options: one line per check with "passed" or "failed", then a total (recommended: the result can be read at a glance after long output); only the exit status.
   - Answer: each check's own output shows as it runs. After the last check, `bin/test` prints one line per check, in the order run: "RSpec: passed" or "RSpec: failed", and the same for "Vitest", "TypeScript", "RuboCop", and "ESLint". The last line is "All 5 checks passed." or "<n> of 5 checks failed.". A check that cannot start, for example because its image fails to build, counts as failed. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
8. How does a developer run the tests in the other time zones of question 5?
   - Options: `bin/test --time-zones` (recommended: one command that anyone can repeat); a `TZ` setting on each suite's command, documented in the README; every `bin/test` run in all three zones.
   - Answer: `bin/test --time-zones` runs the backend and the frontend test suites in each of three time zones: UTC, Pacific/Kiritimati, and Pacific/Pago_Pago. Its summary has one line per suite and zone, such as "RSpec (Pacific/Kiritimati): passed", and it ends and exits as `bin/test` does (questions 2, 6, 7). The type check and the linters do not depend on the zone, so it does not run them. Plain `bin/test` runs in UTC only. An option that `bin/test` does not know makes it print how to use it, run no check, and end with exit status 2. (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
9. Which test commands does the README give (requirements.md 1, 7, 8)?
   - Options: `bin/test`, each check's own command, one test by name, and the security checks (recommended: a developer needs each of them in day-to-day work); only `bin/test`.
   - Answer: the README's "Running the tests" gives:
     - `bin/test` and `bin/test --time-zones`, with what each runs, the summary, and the exit statuses 0, 1, and 2;
     - each check on its own: `docker compose run --rm backend bundle exec rspec`, `docker compose run --rm frontend npx vitest run`, `docker compose run --rm frontend npx tsc -b`, `docker compose run --rm backend bundle exec rubocop`, and `docker compose run --rm frontend npx eslint .`;
     - one test by name: `docker compose run --rm backend bundle exec rspec <file> -e "<test name>"` and `docker compose run --rm frontend npx vitest run <file> -t "<test name>"`;
     - the security checks, `docker compose run --rm backend bin/brakeman` and `docker compose run --rm backend bin/bundler-audit`, as separate checks that need the network;
     - that the tests need no `.env`, no OAuth credentials, and no running app; that the first run on a new clone installs the gems and packages, which needs the network once; and that two test runs on one clone are run one at a time.

     (no option was proposed; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)
10. What is the last line of `bin/test --time-zones`, and in which order does it run the suites? (added on 2026-11-09, see Changes)
    - Options: the last line counts the six runs, and the runs go zone by zone (recommended: the summary reads like the one of question 7, and each zone's results stand together); the same last line, with the runs suite by suite (RSpec in the three zones, then Vitest).
    - Answer: the last line counts the checks that ran: "All 6 checks passed." or "<n> of 6 checks failed.". The runs go zone by zone, UTC, then Pacific/Kiritimati, then Pacific/Pago_Pago, with RSpec before Vitest in each zone, and the summary lists them in that order, from "RSpec (UTC): passed" to "Vitest (Pacific/Pago_Pago): passed". (a question the agent added; the agent's recommendation, taken under the owner's standing instruction of 2026-11-09)

## Scenarios

**All checks pass with one command**
- Given a clone of the repository, and Docker running
- When I run `bin/test`
- Then RSpec, Vitest, the TypeScript check, RuboCop, and ESLint run in Docker, the summary shows each as passed and ends with "All 5 checks passed.", and the exit status is 0 (questions 1, 2, 7)

**A failing check does not stop the others**
- Given ESLint finds a problem, and the other checks pass
- When I run `bin/test`
- Then every check runs, the summary shows "ESLint: failed" and the other four as passed, its last line is "1 of 5 checks failed.", and the exit status is 1 (questions 2, 7)

**Docker is not running**
- Given Docker is not running
- When I run `bin/test`
- Then it prints "Docker is not running or not installed. Start Docker, then run bin/test again." as an error, runs no check, and the exit status is 2 (question 6)

**Each check can still run on its own**
- Given Docker is running
- When I run the command for one check, such as `docker compose run --rm backend bundle exec rspec`
- Then only that check runs (questions 2, 9)

**One test by name**
- Given Docker is running
- When I run `docker compose run --rm backend bundle exec rspec <file> -e "<test name>"`, or `docker compose run --rm frontend npx vitest run <file> -t "<test name>"`
- Then only that test runs (question 9)

**The app may be running or stopped**
- Given the app is running, with data in the development database
- When I run `bin/test`, and again after stopping the app
- Then the checks pass both times, and the development data is unchanged (question 3)

**No test reaches the network**
- Given a backend test, or a frontend test, that tries to reach a host other than this machine
- When its suite runs
- Then that test fails, and no request leaves the machine (question 4; requirements.md 7)

**The tests need no credentials**
- Given a clone with no `.env`
- When I run `bin/test`
- Then the sign-in tests pass with the providers' test mode and placeholder credentials, and nothing reaches Google or GitHub (questions 4, 9; requirements.md 7)

**Any time zone**
- Given the test suites pass in UTC
- When I run `bin/test --time-zones`
- Then both test suites pass in UTC, Pacific/Kiritimati (UTC+14), and Pacific/Pago_Pago (UTC−11), the summary shows each suite and zone as passed and ends with "All 6 checks passed.", and the exit status is 0 (questions 5, 8, 10)

**Any day**
- Given a test whose result depends on today's date, such as a note that is due today
- When it runs on any day of the year, in any of the three zones
- Then it passes, because it fixes the time it runs at (question 5)

**The security checks are separate**
- Given Brakeman and bundler-audit
- When I run `bin/test`
- Then neither runs (question 1)

**The README documents the tests**
- Given the README
- When a developer reads "Running the tests"
- Then they find every command and fact that question 9 lists (question 9; requirements.md 1, 7, 8)

## Edge cases

- The tests never read or change the development data, and they never prepare it (question 3; feature 26 question 2).
- The first run on a new clone installs the gems and packages into Docker volumes, which needs the network once. Later runs work offline (question 9).
- A check that cannot start, for example because its image fails to build, counts as failed in the summary (questions 2, 7).
- With `--time-zones`, a suite that fails in one zone shows "failed" on its own line, such as "Vitest (Pacific/Pago_Pago): failed", the last line is "1 of 6 checks failed.", and the exit status is 1 (questions 7, 8, 10).
- Two test runs at the same time on one clone share the backend's test database and can fail each other, so the README says to run one at a time (questions 3, 9).
- A test whose result depends on the date passes on any day, because it fixes the time (question 5). This binds the tests of every feature that deals with dates, such as features 12 to 20.
- The security checks need the network, so they are not part of "tests pass locally" (question 1).
- `bin/test` runs in a POSIX shell: on macOS, on Linux, and on Windows through WSL 2 (feature 30 question 5).
- `bin/test` with an option it does not know prints how to use it and runs no check, with exit status 2 (question 8).

## Changes

<!-- Empty until the spec is approved. Then: date, reason, what changes. -->

### 2026-11-09: The last line of `bin/test --time-zones`

- Reason: the Plan step found that question 7 writes the last line for five checks ("All 5 checks passed."), while question 8 says that `bin/test --time-zones` ends as `bin/test` does, and that run has six checks. The tests of `bin/test` assert the line, so it must be stated.
- Change: new question 10: the last line counts the checks that ran, so `--time-zones` ends with "All 6 checks passed." or "<n> of 6 checks failed."; the runs go zone by zone (UTC, Pacific/Kiritimati, Pacific/Pago_Pago), RSpec before Vitest in each, and the summary lists them in that order. It is the agent's recommendation, taken under the owner's standing instruction of 2026-11-09.
- Change: scenario "Any time zone": the summary ends with "All 6 checks passed.".
- Change: new edge case: a suite that fails in one zone, with "1 of 6 checks failed." and exit status 1.
- Stage: approved again on 2026-11-09 under the owner's standing instruction (recommended options).

## Notes for Plan (draft)

From the research of 2026-11-09, before the spec was approved, with the Design step's notes added at the end. They are not part of the approved behavior. The Plan step moves what it uses into `plan.md`.

- Proposed checklist (4 items): 3 [SETUP], the webmock gem, `bin/test`, and the time-zone check; 1 [BE], the network-block test.
- `bin/test` runs each check through `docker compose run --rm`.
- Network block: WebMock with `disable_net_connect!(allow_localhost: true)`. The probe test uses 192.0.2.1 (TEST-NET-1), so even its red run reaches no real host. WebMock's compatibility with Ruby 4.0.9 is not checked.
- Date-dependent tests fix the time with `travel_to` or `vi.setSystemTime`.
- The security checks need the network: `bin/brakeman` adds `--ensure-latest`, which queries rubygems.org, and bundler-audit needs its advisory database. Neither is deterministic offline.
- `rails_helper` runs `maintain_test_schema!`, so the tests prepare their own SQLite database. The only date-dependent test today (`session_spec`) uses relative `travel`.
- Risk: the rule that tests fix the time binds the tests of features 12 to 20, which other groups own.
- Depends on: 01. It runs after 01 to 26 in folder order.
- Docs: the README section "Running the tests"; `docs/conventions.md`.
- Design, 2026-11-09: question 4 also covers the frontend, where no gem is needed. Every frontend test stubs `fetch` with `vi.stubGlobal`; a default `fetch` in `src/test/setup.ts` that fails a request to any host but localhost, replaced by each test's own stub, would meet it, with a probe test (a [FE] item). jsdom's default address is `http://localhost:3000`, which inside the frontend container reaches nothing, because the app runs in the backend container.
- Design, 2026-11-09: adding WebMock changes the shared bundle volume; the Build step reports it (brief).
- Design, 2026-11-09: the run's agents give RSpec its own database per lane with `DATABASE_URL=sqlite3:storage/test_<lane>.sqlite3`. `bin/test` uses the default test database, so two `bin/test` runs on one clone collide (edge case).
- Design, 2026-11-09: feature 12's plan already runs its tests with `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago` (its item 41). Node in the frontend container is UTC by default; Ruby's `Date.today` follows `TZ`, so the zone runs catch code that reads the host's date instead of the user's "today".
- Design, 2026-11-09: 245 tests at the time of Design (127 RSpec in 18 files, 118 Vitest in 8 files).
