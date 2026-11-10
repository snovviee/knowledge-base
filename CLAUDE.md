# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal Knowledge Base with review reminders. Requirements are in `requirements.md`, the stack in `project.md`, and the feature specs in `specs/`. Code is in two apps:

- `backend/`: Rails 8.1 API mode, Ruby 4.0.9, SQLite.
- `frontend/`: React 19, TypeScript, Vite, Tailwind 4.

Everything runs in Docker (`project.md`). Do not run Ruby, Bundler, Node, or npm on the host.

## Commands

Run everything through `compose.yaml`. The repo is mounted at `/app`. Gems and node_modules live in named volumes, and the entrypoints in `docker/` reinstall them when the Gemfile or package.json changes.

```bash
docker compose up                                     # app on http://localhost:3000 (backend runs bin/dev), frontend rebuilds on change
docker compose exec backend bin/rails sample_data:load  # sample data for the user who signed in last (app running)
bin/test                                              # all 5 checks in Docker: RSpec, Vitest, tsc -b, RuboCop, ESLint
bin/test --time-zones                                 # RSpec and Vitest in UTC, Pacific/Kiritimati, Pacific/Pago_Pago (6 checks)
docker compose run --rm backend bin/rails test_mapping:write   # regenerate specs/docs/test_mapping.md
docker compose run --rm backend bin/rails test_mapping:check   # fail when specs/docs/test_mapping.md is not current, or a test named in the README table does not exist
docker compose run --rm backend bundle exec rspec     # full RSpec suite
docker compose run --rm backend bundle exec rspec spec/path/to_spec.rb -e "AC-13 marks a note as reviewed"   # one test by name
docker compose run --rm backend bundle exec rubocop   # Ruby lint
docker compose run --rm backend bin/rails <cmd>       # generators, migrations, console
docker compose run --rm backend bin/brakeman          # security checks (also bin/bundler-audit), listed in backend/config/ci.rb
docker compose run --rm frontend npx vitest run       # full Vitest suite
docker compose run --rm frontend npx vitest run src/path/file.test.tsx -t "name"   # one test by name
docker compose run --rm frontend npx eslint .         # ESLint
docker compose run --rm frontend npm run build        # tsc -b && vite build, writes into backend/public
```

## Architecture

**Two apps, one build output.** `frontend/vite.config.ts` sets `build.outDir` to `../backend/public`, which is gitignored. Compose's `frontend` service runs `vite build --watch` so that directory always holds the latest build. Rails serves that directory as static files: `GET /` returns the built page.

**Backend.** `ApplicationController` inherits from `ActionController::API`. API mode drops the cookie and session middleware, so `backend/config/application.rb` adds them back for sign-in. Routes: `/api/csrf`, `/api/session` (show, destroy), `/api/collections`, `/api/tags`, and `/api/notes` (with `POST /api/notes/:id/review`), plus the sign-in routes `/auth/google_oauth2` and `/auth/github`. The `/cable` WebSocket (Action Cable, `ReviewRemindersChannel`) sends real-time review reminders and takes `ack` messages. Models: `User`, `SignIn`, `Collection`, `Tag`, `Note`, `NoteTag`, `ReviewDismissal`, `ReviewAck`, and `ReviewReminderBatch`, with `NoteListFilter` for search and filters.

**Auth.** Google sign-in (feature 01) and GitHub sign-in (feature 02) are built: OmniAuth providers in `backend/config/initializers/omniauth.rb`, the test helper in `backend/spec/support/omniauth.rb`. Logout (AC-05) is built: it deletes the `SignIn` row, so a kept session cookie signs no one in.

**Frontend.** `src/App.tsx` holds the session states (loading, the sign-in screen, the main layout) and the narrow-screen layout. The areas are components: `Collections`, `Tags`, `Notes` (with `NoteDetail`, `NoteForm`, `NoteFilters`, `NoteTags`), and `ReviewReminders`, which uses the WebSocket client in `cable.ts`. `api.ts` sends changes with a CSRF token. `src/test/setup.ts` loads jest-dom and runs RTL cleanup after each test. Vitest globals are off, so import `describe`, `it`, and `expect` from `vitest` in each test file.

**Planned domain areas.** `specs/README.md` lists six: users, collections, tags, notes, reviews, notifications. All six are built.

## Spec-driven workflow

This is how work gets done here. Read `specs/README.md` before any feature work; it has the full workflow and the templates.

- One folder per acceptance criterion: `specs/features/NN_topic/` for AC-01 to AC-30 (`requirements.md` section 10). `spec.md` says what the behavior is; `plan.md` says how to build it, as a test-first checklist.
- The stage lives only in the `spec.md` header (`**Stage:**`): Design, Plan, Build, Verify, Polish, Ship, Done. Features go one at a time, in folder order unless `Depends on` says otherwise.
- The steps are the project skills `/sdd-spec`, `/sdd-plan`, `/sdd-build`, and `/sdd-polish` in `.claude/skills/`. They are user-invoked only, so leave them for the owner to start.
- TDD is strict. No production code without a failing test, and the test must fail because the behavior is missing. Test names start with the AC ID, for example `it "AC-13 marks a note as reviewed..."`. Find every test for an AC with `grep -r "AC-13" backend frontend`.
- Approved `spec.md` and `plan.md` files are not edited in place. Behavior changes go under `## Changes` in the spec, which resets its approval. Technical deviations go under `## Deviations` in the plan.
- `specs/docs/` describes the system as built: `domain/` (one file per area), `api_contract.md`, `conventions.md`, `implementation_notes.md`, and `test_mapping.md` (generated). Only the Polish step writes it. Read it before designing a new feature.
- Ship commits locally with the subject `AC-NN: <topic>`. Never push; the owner pushes.

All 30 features are at Done. The owner reviews and commits. Polish writes `specs/docs/` after each feature is verified.

## Stop hook

`.claude/settings.json` registers a Stop hook, `.claude/hooks/check-changed.sh`. It runs the suites in Docker for changed files: full RSpec and Vitest, then RuboCop and ESLint on the changed files. It needs Docker running and `jq` installed. It reports results and never blocks the stop. During TDD Red, a "Checks FAILED" message for the test you just wrote is expected.

## Gotchas

- The root `README.md` is the real developer README (AC-30): quick start, configuration, reference, troubleshooting.
- Tests must make no real Google or GitHub calls. Use OmniAuth test mode (`requirements.md` section 7).
