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
docker compose up                                     # app on http://localhost:3000, frontend rebuilds on change
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

**Backend.** `ApplicationController` inherits from `ActionController::API`. API mode drops the cookie and session middleware, so `backend/config/application.rb` adds them back for sign-in. Routes are `/api/csrf` and `/api/session`, plus `/auth/google_oauth2` (feature 01). `User` is the only model so far. Action Cable is loaded for the real-time review notifications, not built yet.

**Auth.** Google sign-in is built (feature 01): OmniAuth in `backend/config/initializers/omniauth.rb`, the test helper in `backend/spec/support/omniauth.rb`. GitHub (feature 02) is not built, and its OmniAuth gem is not in the Gemfile yet.

**Frontend.** `src/App.tsx` is one component with the session states: loading, the sign-in screen, and the main layout (collections and notes areas, each with its empty state). It is not split into components yet. `src/test/setup.ts` loads jest-dom and runs RTL cleanup after each test. Vitest globals are off, so import `describe`, `it`, and `expect` from `vitest` in each test file.

**Planned domain areas.** `specs/README.md` lists six: users, collections, tags, notes, reviews, notifications. `users` is built (feature 01). The other five are not.

## Spec-driven workflow

This is how work gets done here. Read `specs/README.md` before any feature work; it has the full workflow and the templates.

- One folder per acceptance criterion: `specs/features/NN_topic/` for AC-01 to AC-30 (`requirements.md` section 10). `spec.md` says what the behavior is; `plan.md` says how to build it, as a test-first checklist.
- The stage lives only in the `spec.md` header (`**Stage:**`): Design, Plan, Build, Verify, Polish, Ship, Done. Features go one at a time, in folder order unless `Depends on` says otherwise.
- The steps are the project skills `/sdd-spec`, `/sdd-plan`, `/sdd-build`, and `/sdd-polish` in `.claude/skills/`. They are user-invoked only, so leave them for the owner to start.
- TDD is strict. No production code without a failing test, and the test must fail because the behavior is missing. Test names start with the AC ID, for example `it "AC-13 marks a note as reviewed..."`. Find every test for an AC with `grep -r "AC-13" backend frontend`.
- Approved `spec.md` and `plan.md` files are not edited in place. Behavior changes go under `## Changes` in the spec, which resets its approval. Technical deviations go under `## Deviations` in the plan.
- `specs/docs/` will describe the system as built. Only the Polish step writes it, and it does not exist yet. Read it before designing a new feature once it does.
- Ship commits locally with the subject `AC-NN: <topic>`. Never push; the owner pushes.

Feature 01 (Google sign-in) is Done. `specs/docs/` describes the built features: users, the API contract, and the conventions. Polish writes it after each feature is verified.

## Stop hook

`.claude/settings.json` registers a Stop hook, `.claude/hooks/check-changed.sh`. It runs the suites in Docker for changed files: full RSpec and Vitest, then RuboCop and ESLint on the changed files. It needs Docker running and `jq` installed. It reports results and never blocks the stop. During TDD Red, a "Checks FAILED" message for the test you just wrote is expected.

## Gotchas

- The root `README.md` is still GitLab's default template and does not describe this project. Use the commands above. The real README is an open item (AC-30, feature 30).
- Tests must make no real Google or GitHub calls. Use OmniAuth test mode (`requirements.md` section 7).
