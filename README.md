# Personal Knowledge Base

A personal knowledge base with review reminders. Notes are organized into collections and tags, and the app reminds you to review them. Each user has a private workspace, and signs in with Google or GitHub (SSO only). All 30 acceptance criteria of `requirements.md` section 10 are built.

What the app does:

- **Sign-in and session.** Sign in with Google or GitHub (features 01 to 03). The session lasts across page reloads (feature 04), and you can sign out (feature 05).
- **Collections, tags, and notes.** Create, rename, and delete collections (features 06 and 07) and tags (feature 08). Create, edit, archive, restore, and delete notes (feature 09), give them tags (feature 10), and move them between collections (feature 11). A collection with notes cannot be deleted.
- **Review schedule.** A note can have a review interval and a next review date (feature 12). You mark it as reviewed (feature 13), and the next review date moves to today plus its interval (feature 14). Notes due today or overdue are marked (features 15 and 16), and the notes list has a search and filters by collection, tag, status, and review state (feature 17). Archived notes and notes with no review schedule never get review reminders (features 18 and 19).
- **Real-time reminders.** The main layout keeps a WebSocket connection open, authorized by the browser's sign-in (feature 22). The "Review reminders" panel shows the notes due or overdue in real time (feature 20), and a reminder can be dismissed (feature 23).
- **Privacy and screens.** Each user sees only their own data (feature 21). Every screen shows empty, loading, validation, and error states, with hover and focus looks (feature 24), and the layout works on narrow screens (feature 25).
- **Running and testing.** The app starts with one command and has sample data to try it with (feature 26). `bin/test` runs every check (feature 27). The specification, its implementation notes, and the test mapping are in the repository (features 28 and 29).

## Contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
  - [Environment variables](#environment-variables)
  - [Google OAuth credentials](#google-oauth-credentials)
  - [GitHub OAuth credentials](#github-oauth-credentials)
- [Running locally](#running-locally)
  - [Sample data](#sample-data)
- [Running the tests](#running-the-tests)
- [Reference](#reference)
  - [Sign-in](#sign-in)
  - [API](#api)
  - [WebSocket message format](#websocket-message-format)
  - [Review reminder rules](#review-reminder-rules)
  - [Timezone handling](#timezone-handling)
  - [Collection deletion behavior](#collection-deletion-behavior)
- [Specification](#specification)
  - [Workflow](#workflow)
  - [How the specification guided the implementation](#how-the-specification-guided-the-implementation)
  - [Artifacts](#artifacts)
  - [What changed](#what-changed)
  - [Test coverage](#test-coverage)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

## Stack

- Backend: Ruby on Rails 8.1 in API mode, SQLite, OmniAuth (Google and GitHub), Action Cable (WebSocket). Code in `backend/`.
- Frontend: React with TypeScript, Vite, Tailwind CSS. Code in `frontend/`. The build goes into `backend/public`, and Rails serves it, so the app has one address.
- Database: SQLite files in `backend/storage/`. The schema is `backend/db/schema.rb` and the migrations are in `backend/db/migrate/`.
- Tests: RSpec in `backend/spec/`, Vitest with React Testing Library in `frontend/src/` (the `*.test.ts` and `*.test.tsx` files). `bin/test` runs every check.
- Docker: everything runs in Docker (`compose.yaml`, `Dockerfile`, and the entrypoints in `docker/`).
- Specification: `requirements.md`, `project.md`, and `specs/` (see [Specification](#specification)).

## Quick start

From a clone to a signed-in app with sample data and passing tests. The commands are for a POSIX shell, and they work on macOS, Linux, and Windows through WSL 2.

1. Install Docker with Compose 2.24 or newer (`docker compose version` shows it). Nothing else is installed on your machine (see [Running locally](#running-locally)).
2. Clone the repository (`git clone <url-of-this-repository>`) and open a terminal in the clone.
3. Copy the example environment file, and put your Google or GitHub credentials in `.env` (see [Configuration](#configuration)):

   ```bash
   cp .env.example .env
   ```

   Without credentials the app runs, but a sign-in cannot complete.
4. Start the app, and wait for the frontend's log to show a line with "built in" (see [Running locally](#running-locally)):

   ```bash
   docker compose up
   ```

5. Open http://localhost:3000, reload it after the "built in" line, and sign in with Google or GitHub.
6. In a second terminal, in the clone, load the sample data (see [Sample data](#sample-data)):

   ```bash
   docker compose exec backend bin/rails sample_data:load
   ```

   Reload the page to see it.
7. Run every check (see [Running the tests](#running-the-tests)):

   ```bash
   bin/test
   ```

When something does not work, see [Troubleshooting](#troubleshooting).

## Configuration

### Environment variables

Put these in a `.env` file at the repository root. Copy the example file, which has the variables a developer sets, and fill it in:

```bash
cp .env.example .env
```

Compose reads `.env` and passes it to the backend container. Git ignores `.env` (`.gitignore`), so it is not committed, and `.env.example` is. `.env.example` leaves `APP_BASE_URL` and `SECRET_KEY_BASE` commented out, so a copy keeps their defaults: an empty value would replace a default. Leave a variable you do not need commented out or empty.

| Variable | Needed | What it is for | Default |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | to sign in with Google | The client id of your Google OAuth client. See [Google OAuth credentials](#google-oauth-credentials). | none (empty counts as not set) |
| `GOOGLE_CLIENT_SECRET` | to sign in with Google | The client secret of that client. | none |
| `GITHUB_CLIENT_ID` | to sign in with GitHub | The client id of your GitHub OAuth app. See [GitHub OAuth credentials](#github-oauth-credentials). | none (empty counts as not set) |
| `GITHUB_CLIENT_SECRET` | to sign in with GitHub | The client secret of that app. | none |
| `APP_BASE_URL` | no | The address the app is served at, used to build both sign-in callback URLs: `<APP_BASE_URL>/auth/google_oauth2/callback` and `<APP_BASE_URL>/auth/github/callback`. The frontend needs no address of its own, because the backend serves it from the same origin. | `http://localhost:3000` |
| `SECRET_KEY_BASE` | production only | Signs and encrypts the session cookie. Development and test make their own. Production must set it, for example with `bin/rails secret`. | none |

There is no variable for the database: each environment's database is an SQLite file in `backend/storage/`, which the backend prepares when it starts (see [Running locally](#running-locally)).

Rails and its web server read some variables for themselves, and the app needs none of them: `PORT`, `RAILS_MAX_THREADS`, `RAILS_LOG_LEVEL`, `REDIS_URL`, `WEB_CONCURRENCY`, `PIDFILE`, `CI`, `BUNDLE_GEMFILE`, and `DATABASE_URL`. Do not put `DATABASE_URL` in `.env`: it would reach every backend command, the tests included, which would then use the database it names.

Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the app runs, but "Continue with Google" cannot complete a sign-in. Without `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, the same is true of "Continue with GitHub". Tests do not need any of them: they use placeholder values and never reach Google or GitHub.

### Google OAuth credentials

1. Open the Google Cloud Console, and create a project or choose one.
2. Configure the OAuth consent screen, and add the scopes `email` and `profile`.
3. Create an OAuth client ID of type **Web application**.
4. Add this authorized redirect URI: `http://localhost:3000/auth/google_oauth2/callback`.
5. Copy the client id and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Restart the stack: `docker compose up`.

The callback URL is built from `APP_BASE_URL`, not from the request's `Host` header, which a client can forge. If you serve the app somewhere else, set `APP_BASE_URL` and add the matching redirect URI in Google.

### GitHub OAuth credentials

1. Open GitHub, and go to Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set the Homepage URL to `http://localhost:3000`.
3. Set the Authorization callback URL to `http://localhost:3000/auth/github/callback`.
4. Register the application, then generate a client secret.
5. Copy the Client ID and the client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
6. Restart the stack: `docker compose up`.

The app asks GitHub for the `user:email` scope, so GitHub can send your verified primary email. You set no scope in GitHub. As with Google, the callback URL is built from `APP_BASE_URL`. If you serve the app somewhere else, set the callback URL in the GitHub app to match.

## Running locally

Prerequisite: Docker with Compose 2.24 or newer (`docker compose version` shows it). Nothing else is installed on your machine, and this README documents no way to run the app with Ruby, Node, or SQLite on the host. The images fix the versions (Ruby 4.0.9, Node 26.13.0, SQLite), so everyone gets the same ones from one prerequisite, and a second setup would have to be documented, kept working, and tested on its own. Compose 2.24 is the first version that accepts the optional `.env` file the app reads.

Start the app from the root of the clone:

```bash
docker compose up
```

The app is at http://localhost:3000. The port is fixed at 3000 and open to this machine only. When another program already uses it, Docker reports that and the app does not start; it never moves to another port. Stop the app with Ctrl+C.

The first start builds the images and installs the gems and packages, which needs the network and takes a few minutes. Later starts need no network.

Wait for the frontend's log to show a line with "built in", then reload the page. Until the first frontend build finishes, http://localhost:3000 shows the Rails welcome page, and any other address, such as `/nope`, shows a "Routing Error" page (`curl` gets a JSON body with `"error": "Not Found"`). After the "built in" line, a reload shows the sign-in screen.

Each part has its own command:

| Part | Command |
|---|---|
| Everything | `docker compose up` |
| Backend alone | `docker compose up backend` serves the API and the latest frontend build at http://localhost:3000 |
| Frontend alone | `docker compose up frontend` builds the pages again on every change, for the backend to serve; the frontend has no address of its own. One build without watching: `docker compose run --rm frontend npm run build` |
| Database | there is no database server to start. Each environment's database is an SQLite file in `backend/storage/`, which the backend prepares at every start |
| Any other Rails command | `docker compose run --rm backend bin/rails <command>`, for example the console |

The backend prepares the development database before the server takes requests: it creates the database when there is none, and applies the migrations that are not applied yet. So a fresh clone needs no setup command, and neither does a pull that brings new migrations: stop the app and start it again. Until then, the app shows "Could not reach the server. Try again." Other backend commands, such as the tests, do not prepare the development database.

To prepare the database by hand: `docker compose run --rm backend bin/rails db:prepare`. To start over, stop the app and run `docker compose run --rm backend bin/rails db:reset`. It deletes all development data, every user's, so sign in again afterwards.

### Sample data

A new database is empty. To try the app with data, sign in with Google or GitHub in the browser first, then, with the app running, run:

```bash
docker compose exec backend bin/rails sample_data:load
```

The data goes into the workspace of the user who signed in last, the newest sign-in that logout has not ended. The command adds three collections (one of them empty), four tags (one of them on no note), and ten notes, and prints "Added sample data for <display name> (<Google or GitHub>): 3 collections, 4 tags, 10 notes." The notes have zero, one, and several tags; two are archived; six have a source URL; they use every review interval; and they cover every review state: overdue, due today, due in the next 7 days, due later, and no review scheduled. The dates count from your "today" when you run the command, so on a later day the same notes have moved on: a note that was due today is then overdue. The data is added all at once: if any part fails, nothing is added. A page that is already open shows the data after a reload.

The command works in the development and test environments only. It refuses, prints a message to standard error, ends with exit status 1, and adds nothing, in three cases:

- Nobody is signed in: "No one is signed in. Sign in with Google or GitHub, then run this again." Sign in, then run it again.
- The workspace already has a collection, a tag, or a note: "<display name> (<Google or GitHub>) already has collections, tags, or notes, so no sample data was added. To start over, see "Sample data" in the README." See "Start over" below.
- The environment is another one: "Sample data is for the development and test environments only."

Start over: stop the app, run `docker compose run --rm backend bin/rails db:reset`, start the app, sign in again, and run the command again. `db:reset` deletes all development data, every user's, not only your workspace.

## Running the tests

Run the five checks in Docker with one command:

```bash
bin/test
```

The checks run one after another, and each prints its own output: RSpec (backend), Vitest (frontend), the TypeScript check, RuboCop, and ESLint. After the last one, `bin/test` prints one line per check, such as "RSpec: passed", and a last line, "All 5 checks passed." or "<n> of 5 checks failed.". It runs every check even after one fails. The exit status is 0 when every check passed, 1 when a check failed, and 2 when no check ran: Docker cannot be reached ("Docker is not running or not installed. Start Docker, then run bin/test again."), or `bin/test` was given an option it does not know.

To run the backend and frontend test suites in three time zones, UTC, Pacific/Kiritimati, and Pacific/Pago_Pago, run `bin/test --time-zones`. It runs six checks, RSpec then Vitest in each zone, none of the linters or the type check, and ends "All 6 checks passed." or "<n> of 6 checks failed." with the same exit statuses. A test that depends on the date fixes the time it runs at, so the tests pass on any day and in any time zone.

Each check on its own:

```bash
docker compose run --rm backend bundle exec rspec
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npx vitest run
docker compose run --rm frontend npx tsc -b
docker compose run --rm frontend npx eslint .
```

Run one backend test: `docker compose run --rm backend bundle exec rspec <file> -e "<test name>"`. Run one frontend test: `docker compose run --rm frontend npx vitest run <file> -t "<test name>"`.

The security checks are separate commands, because they need the network: `docker compose run --rm backend bin/brakeman` and `docker compose run --rm backend bin/bundler-audit`.

What the tests need and do not need:

- No `.env`, no OAuth credentials, and no running app. The backend tests use their own test database, and the frontend tests answer every request with their own stubs, so the development data is never read or changed.
- The first run on a new clone installs the gems and packages, which needs the network once.
- Two test runs on one clone go one at a time, because they share the test database.
- No test reaches another host: a test that tries to reach any host other than this machine fails, and its request does not leave the machine. The sign-in tests use the providers' test mode and placeholder credentials.

## Reference

Each section summarizes what a developer needs and links to the file in `specs/docs/` that holds the full rules.

### Sign-in

The sign-in screen offers "Continue with Google" and "Continue with GitHub". The user record and the session are the same for both. The rules are in [`specs/docs/domain/users.md`](specs/docs/domain/users.md#sign-in), and the routes in [`specs/docs/api_contract.md`](specs/docs/api_contract.md#google-sign-in).

**Google**

- The sign-in screen offers "Continue with Google". Choosing it sends you to Google.
- On the first successful sign-in, the app creates a user record. The record keeps the provider, the provider's user id, your display name, and your email and avatar if Google sends them.
- A later sign-in with the same Google account finds the same user. It creates no second record, even if your email changed at Google.
- A cancelled or failed sign-in returns to the sign-in screen with the message "Sign-in with Google did not complete. Try again." The provider's error text is not shown.

**GitHub**

- The sign-in screen offers "Continue with GitHub". Choosing it sends you to GitHub.
- On the first successful sign-in, the app creates a user record. The record keeps the provider (`github`), your GitHub id, your display name, and your email and avatar if GitHub sends them. If your GitHub profile has no public name, the display name is your GitHub login.
- A later sign-in with the same GitHub account finds the same user. It creates no second record, even if your email changed at GitHub.
- A GitHub account with no email signs in, and its record has no email.
- A Google account and a GitHub account of the same person are two users. The app does not link them.
- A cancelled or failed sign-in returns to the sign-in screen with the message "Sign-in with GitHub did not complete. Try again." The provider's error text is not shown.

### API

The JSON endpoints are under `/api`, and each needs a sign-in. The sign-in routes are `/auth/google_oauth2` and `/auth/github` (browser redirects, not JSON). A JSON error is `{ "error": "<code>" }`. Every answer under `/api`, those of notes and tags included, carries `Cache-Control: no-store`. No other origin may read the API, since CORS is off. Another user's record answers like a missing one (feature 21). The full contract is in [`specs/docs/api_contract.md`](specs/docs/api_contract.md).

A request that changes data sends the header `X-CSRF-Token` with the token from `GET /api/csrf`.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/csrf` | Gives the session's anti-forgery token |
| `GET` | `/api/session` | Gives the signed-in user, or answers `401` |
| `DELETE` | `/api/session` | Logs out |
| `GET` | `/api/collections` | Lists your collections, in alphabetical order |
| `POST` | `/api/collections` | Creates one from `{ "name": "..." }` |
| `PATCH` or `PUT` | `/api/collections/:id` | Renames one from `{ "name": "..." }` |
| `DELETE` | `/api/collections/:id` | Deletes one (see [Collection deletion behavior](#collection-deletion-behavior)) |
| `GET` | `/api/tags` | Lists your tags, in alphabetical order |
| `POST` | `/api/tags` | Creates one from `{ "name": "..." }` |
| `PATCH` or `PUT` | `/api/tags/:id` | Renames one from `{ "name": "..." }` |
| `DELETE` | `/api/tags/:id` | Deletes one. Its notes are kept, and only their link to it goes |
| `GET` | `/api/notes` | Lists your notes, newest first. Five optional query parameters search and filter it, all at once (feature 17): `search`, `collection_id`, `tag_id`, `status`, and `review` (see below) |
| `GET` | `/api/notes/:id` | Shows one note in full |
| `POST` | `/api/notes` | Creates one from `title`, `body`, `source_url`, `collection_id`, and optionally `tag_ids` and a review schedule: `review_interval`, `review_interval_days`, and `next_review_date` |
| `PATCH` or `PUT` | `/api/notes/:id` | Changes only the fields you send, such as `{ "status": "archived" }` to archive, `{ "collection_id": 2 }` to move the note to another of your collections, `tag_ids` to set the note's tags, or `{ "review_interval": "weekly" }` to schedule its reviews |
| `DELETE` | `/api/notes/:id` | Deletes one for good |
| `POST` | `/api/notes/:id/review` | Marks one as reviewed: its `last_reviewed_date` becomes today (feature 13), and its `next_review_date` today plus its interval (feature 14). It takes no body, and ignores one |

Every note in an answer carries its review schedule (feature 12): `review_interval` (`none`, `daily`, `weekly`, `monthly`, or `custom`), `review_interval_days` (1 to 365 with `custom`, else null), and `next_review_date` and `last_reviewed_date`, each `YYYY-MM-DD` or null. A field that breaks a rule answers `422` with a code for it. See [Review reminder rules](#review-reminder-rules).

Every note in an answer also carries `review_state` (feature 15): `due_today` when the note is due for review today, `overdue` when it is late, and null otherwise.

The query parameters of `GET /api/notes` (features 15 to 17), each optional, written in lower case, and combined with AND, newest first:

- `search`: text, at most 2,000 characters. Keeps the notes whose title, body, or source URL contains it. Letter case is ignored in any alphabet, accents are kept, and each run of whitespace counts as one space.
- `collection_id` and `tag_id`: the id of one collection or one tag. One that is not yours, or not a whole number, answers `200` with an empty list.
- `status`: `active` or `archived`.
- `review`: `due_today`, `overdue`, `next_7_days` (Active notes with a schedule, due from tomorrow through today plus 7 days), or `unscheduled` (the interval None, in any status).

A parameter left out or empty does not filter. An unknown `status` or `review` (such as `soon` or `Due_Today`), a `search` that is not text, or a `search` over 2,000 characters answers `422` `{ "error": "validation_failed", "fields": { "review": "invalid" } }`, with `fields` naming every parameter that is wrong (`search` is `invalid` or `too_long`). The full contract is in `specs/docs/api_contract.md`.

### WebSocket message format

The main layout keeps one WebSocket connection open in each tab (feature 22). It carries the review reminders (feature 20). The client sends one message back, `ack`, to dismiss a reminder (feature 23).

- **Address.** `/cable` on the app's own address: `ws://localhost:3000/cable` locally, and `wss://` when the app is served over `https`.
- **Authorization.** The connection uses the browser's sign-in: the session cookie `_knowledge_base_session`, which the browser sends with the connection request, must name a live sign-in, as for the API. The connection carries no token and no user id. The server takes the user only from the cookie's sign-in, and ignores any parameter that names a user.
- **Same origin only.** Only pages of the app's own origin, `http://localhost:3000` locally, may connect. A connection request from another origin, or with no `Origin` header, gets `404` with the plain-text body `Page not found`, and no connection opens, whatever the cookie. A request to `/cable` that is not a WebSocket request gets the same answer. A script that tests the WebSocket must send `Origin: http://localhost:3000`.
- **Framing.** Action Cable's JSON protocol, with the subprotocol `actioncable-v1-json`. The server sends `{"type":"welcome"}` when it accepts the connection, and `{"type":"ping","message":<Unix time>}` every 3 seconds. After the welcome, the app subscribes with `{"command":"subscribe","identifier":"{\"channel\":\"ReviewRemindersChannel\"}"}`; the identifier is JSON text inside the message. The server confirms with `{"identifier":"{\"channel\":\"ReviewRemindersChannel\"}","type":"confirm_subscription"}`.
- **The review reminders batch.** After the confirmation, the server sends the user's review reminders as one message, a batch, on that subscription:

  ```json
  {"identifier":"{\"channel\":\"ReviewRemindersChannel\"}",
   "message":{"type":"review_reminders",
    "reminders":[
     {"type":"review_overdue","note_id":12,"title":"Old idea","collection_name":"Work","next_review_date":"2026-11-02","review_state":"overdue"},
     {"type":"review_due_today","note_id":7,"title":"Rails tips","collection_name":"Books","next_review_date":"2026-11-09","review_state":"due_today"}]}}
  ```

  A batch is the whole current list, with no limit. With nothing due it is `"reminders":[]`. The reminders come in order of next review date, the oldest first, and notes with the same date in the order they were created. A batch holds only your own notes, and never an archived note or a note with no schedule. "Today" is your own date (see [Timezone handling](#timezone-handling)).
- **The fields of a reminder.** `type` is `"review_due_today"` or `"review_overdue"`; `note_id` is the note's id; `title` and `collection_name` are the note's title and its collection's name when the batch is made; `next_review_date` is `YYYY-MM-DD`; `review_state` is `"due_today"` or `"overdue"`, as the notes API gives it.
- **The check every 60 seconds.** While a connection is open, the server makes the batch again every 60 seconds and sends it, even when nothing changed. A note that becomes due at midnight in your time zone shows within a minute.
- **When a batch is sent.** At once when the connection subscribes (it may arrive just before the confirmation); every 60 seconds; and right after a change in the app: creating, editing, moving, archiving, restoring, marking as reviewed, or deleting a note, or renaming a collection, sends a new batch to each of your open connections, so every tab shows the change at once.
- **Duplicate prevention.** Each batch replaces the panel's whole list, so a reminder is never shown twice and a reminder missing from a batch leaves the panel. The app keys each reminder by note, type, and next review date: a reminder that a new batch repeats stays unchanged where it is, with its focus. The server stores nothing for this, and the browser keeps nothing.
- **The panel.** The "Review reminders" panel above the notes area shows "Loading…" until the first batch, "No review reminders" for an empty batch, and else each reminder with "Open" (shows the note) and "Dismiss" (feature 23; see "The `ack` message" below). "Dismiss" takes the reminder out at once. "Open" waits while a note form is open.
- **Reconnecting.** When the connection is lost or cannot be opened, the panel keeps its last list and shows "Review reminders are offline. Reconnecting…"; "Dismiss" is disabled. The app connects again on its own, after 1 second, then 2, 4, and so on up to 30 seconds between attempts, with no button to press, and a batch ends the alert. A connection that is silent for 10 seconds counts as lost. Each tab has its own connection.
- **The `ack` message (client to server).** "Dismiss" sends it, and it is the one message that changes what the server does: the server stops sending that reminder.

  ```json
  {"command":"message","identifier":"{\"channel\":\"ReviewRemindersChannel\"}","data":"{\"action\":\"ack\",\"note_id\":7,\"next_review_date\":\"2026-11-09\"}"}
  ```

  `note_id` is a whole number and `next_review_date` is `"YYYY-MM-DD"`, the date of the reminder. An accepted ack gets no answer, and every open connection of yours receives a new batch without the reminder at once. The same ack twice is fine.
- **How long a dismissal lasts.** While the note keeps that next review date: on every tab and browser, after a reload, and after midnight, also once the note is overdue. It ends when the note's next review date changes (you mark it as reviewed, set a new date, or choose the interval None), even if the date later returns; the reminder then shows again when the note is due. Archiving, restoring, changing the interval while keeping the date, and a second review on the same day do not end it. The notes list still shows the note.
- **`ack` errors.** The sender alone gets `{"identifier":"{\"channel\":\"ReviewRemindersChannel\"}","message":{"type":"error","error":"invalid"}}` for an ack that is not well-formed (`note_id` text, a date that does not exist) or any other message (another action, data that is not JSON), and `...,"error":"not_found"}}` when none of your current reminders has that note and date (another user's note, a missing note, a reminder that has moved on). `invalid` is checked first. The connection stays open and nothing is recorded.
- **Refusal.** A connection with no live sign-in (never signed in, logged out, a cookie past its 30 days, a kept copy of a logged-out cookie, or a changed cookie) gets `{"type":"disconnect","reason":"unauthorized","reconnect":false}`, and the server closes it. The app then shows the sign-in screen, and does not connect again until you sign in.
- **Logout.** Logging out closes this browser's connections, in every tab, at once: each gets `{"type":"disconnect","reason":"remote","reconnect":false}`, and each tab shows the sign-in screen. The same account's connections in other browsers stay open.
- **Checked again.** Before it handles each command and sends each message, the server checks that the connection's sign-in still exists. When it does not, it closes the connection with the refusal message.
- **A lost connection.** A close for any other reason, such as a server restart (`{"type":"disconnect","reason":"server_restart","reconnect":true}`), is not a sign-out, and the main layout stays. The app connects again on its own (see "Reconnecting" below).

The full contract is in [`specs/docs/api_contract.md`](specs/docs/api_contract.md#websocket), and the rules of a connection's sign-in are in [`specs/docs/domain/users.md`](specs/docs/domain/users.md#rules).

### Review reminder rules

A note can have a review schedule (feature 12). Choose it in the note form under "Review interval", or send it to the notes API.

- **Intervals.** None (no schedule), Daily, Weekly, Monthly, or "Every N days", with N a whole number from 1 to 365. The API calls them `none`, `daily`, `weekly`, `monthly`, and `custom`. A new note has None.
- **The next review date.** A schedule set without a date gets today plus the interval: Daily adds 1 day, Weekly 7 days, Monthly 1 calendar month, and "Every N days" N days. "Today" is your own date (see [Timezone handling](#timezone-handling)).
- **Month end.** A month later is the same day number, or that month's last day when it has no such day: Jan 31 gives Feb 28 (Feb 29 in a leap year), and Mar 31 gives Apr 30.
- **Your own date.** "Next review date (optional)" sets the date yourself, a date in the past included. Changing the interval keeps the date, and emptying the date starts the schedule again from today.
- **Removing a schedule.** Choose None. The next review date and the number of days go, and the last reviewed date stays.
- **Marking a note as reviewed.** Open the note and choose "Mark as reviewed", or send `POST /api/notes/:id/review`. Its last reviewed date becomes today, your own date, and the note's detail shows it under "Last reviewed" ("Never" before the first review). Any note can be marked, archived notes and notes without a schedule included, and before its next review date. Its next review date moves too (see the next rule). Nothing else about the note changes, and a second mark on the same day changes nothing. The request takes no body, so a client cannot choose the date (feature 13).
- **After a review.** The next review date becomes today plus the interval the note has then, by the rules above, so the note comes up again one interval after the review (feature 14). It counts from the day of the review, never from the old date: an overdue note does not catch up, and an early review counts from the day it is made. Monthly applies the month-end rule from each review, so a monthly note drifts: Jan 31 → Feb 28 → Mar 28. A note with None keeps no next review date, and an archived note gets a new date and stays archived.
- **Due today.** A note is due today when it is Active, has an interval other than None, and its next review date is today in your time zone (feature 15). Archived notes and notes with no schedule are never due. The notes list marks such a note with "Due today", and the "Review" filter above the list, with "Due today", shows only those notes. Due today and overdue never overlap: a date before today is overdue, never due today. The API's `review_state` says which one.
- **Overdue.** A note is overdue when it is Active, has an interval other than None, and its next review date is before today in your time zone, however long ago (feature 16). Archived notes and notes with no schedule are never overdue. The list marks such a note with "Overdue", and the "Review" filter's "Overdue" shows only those notes. "Next 7 days" shows the Active notes with a schedule that come up from tomorrow through today plus 7 days, and "No review scheduled" the notes with the interval None, archived ones included (feature 17). Due today and overdue together are the notes due for review. Marking a note as reviewed moves its date to today plus the interval, so it stops being overdue; a date you set in the past makes a note overdue at once.
- **Reminders.** The "Review reminders" panel and its WebSocket batches show the notes that are due today or overdue (feature 20; see [WebSocket message format](#websocket-message-format)). Dismissing a reminder is feature 23.
- **Archived notes.** An archived note gets no review reminder, whatever its schedule and dates: no "Due today" or "Overdue" label (its `review_state` is `null`), no place under the "Due today" and "Overdue" filters, and no WebSocket reminder. Archiving a note takes its reminder away at once, and restoring it brings the reminder back when the note is due (an overdue note at once, a note dated later on its date), because an archive and a restore keep the schedule. A reminder you dismissed stays dismissed through an archive and a restore (feature 18).
- **Notes with no review schedule.** A note with the interval None gets no review reminder, whatever its status: no label, no place under the "Due today" and "Overdue" filters, and no WebSocket reminder. The list shows it as "No review scheduled", the detail's "Review interval" as "None" and its "Next review" as "Not set", and the "No review scheduled" filter finds it. Choosing None takes the reminder away at once, and a schedule set again is reminded on its new date, at once when that date is today or earlier. Marking such a note as reviewed sets only its last reviewed date (feature 19).

The full rules are in [`specs/docs/domain/reviews.md`](specs/docs/domain/reviews.md), [`specs/docs/domain/notes.md`](specs/docs/domain/notes.md), and, for the reminders, [`specs/docs/domain/notifications.md`](specs/docs/domain/notifications.md).

### Timezone handling

- **"Today" is the date in your browser's time zone.** Each time the app loads, its session check sends the browser's time zone, an IANA name such as `Europe/Berlin`, in the header `X-Time-Zone`. The server saves it on your account, and review dates count from the date in that zone (feature 12).
- **UTC until a zone is known.** Before the first session check that names a zone, and after one that names a zone the server does not know, "today" is the date in UTC. A session check without the header, such as one from `curl`, keeps the saved zone.
- **Two browsers in different zones.** The one that loaded the app last decides.
- **Dates in the API.** Review dates are calendar dates, `YYYY-MM-DD`, with no time or zone. `created_at` and `updated_at` are UTC timestamps, such as `2026-11-09T08:22:41.000Z`. The app writes review dates like "Nov 16, 2026".
- **Old zone names.** Chrome reports some zones by their old names, such as `Asia/Calcutta` for India and `Europe/Kiev` for Ukraine. The server knows them, with every other name of the tz database (the `tzinfo-data` gem's zone data), and saves them as sent, so "today" follows them. Names are case-sensitive.

The full rules are in [`specs/docs/domain/reviews.md`](specs/docs/domain/reviews.md) and [`specs/docs/domain/users.md`](specs/docs/domain/users.md#rules).

### Collection deletion behavior

A collection is deleted only when it holds no notes (AC-07). The app does not move or delete notes for you.

- A collection with notes cannot be deleted, and that includes archived notes. The API answers `409` with `{ "error": "collection_not_empty" }`, and the collection and its notes stay as they are.
- In the app, the delete confirmation then shows "This collection still has notes. Move or delete them first." Move or delete the notes first, then delete the collection again. To move a note, open it, choose "Edit", and choose another collection under "Collection" (feature 11).
- A collection with no notes is deleted, and the API answers `204` with no body.

The full rules are in [`specs/docs/domain/collections.md`](specs/docs/domain/collections.md#rules).

## Specification

### Workflow

The project follows its own spec-driven framework, written for this repository (`project.md`) and described in [`specs/README.md`](specs/README.md). Each of the 30 acceptance criteria of `requirements.md` section 10 is one feature, and each feature goes through these steps:

1. **Foundation** (only for a new task): the owner and Claude agree the requirement, and it is recorded as a new acceptance criterion.
2. **Design:** the feature's `spec.md` turns the criterion into questions, answers, scenarios, and edge cases. It ends when the owner approves it.
3. **Plan:** the feature's `plan.md` holds the approach, a test-first checklist, the manual test plan, and the documents to write. It ends when the owner approves it.
4. **Build:** every checklist item is built test first (a failing test, then the least code that passes it), and the full test and lint suites must pass.
5. **Verify:** the test plan is walked through against the running app, and each item gets a recorded result.
6. **Polish:** `specs/docs/` and this README are brought in line with what was built.
7. **Ship:** one local commit per feature.

The main files are `requirements.md` (the requirements and the 30 acceptance criteria), `specs/features/NN_topic/spec.md` and `plan.md` (one folder per criterion), and `specs/docs/` (the system as built: the domain model, the API contract, the conventions, the implementation notes). What the specification answers for a developer is listed in [What the specification describes](specs/README.md#what-the-specification-describes). The requirements the automated tests cover are in [Test coverage](#test-coverage).

### How the specification guided the implementation

Feature 06, creating, renaming, and deleting collections, shows how each stage fed the next:

1. **The requirement.** `requirements.md` section 10 has the line [AC-06: A user can create, rename, and delete collections](requirements.md) (section 10, the acceptance checklist), and the sections it names say what a collection is.
2. **The spec.** [`spec.md`](specs/features/06_collections_crud/spec.md) turns the line into [questions](specs/features/06_collections_crud/spec.md#questions) with the owner's answers, [scenarios](specs/features/06_collections_crud/spec.md#scenarios), and [edge cases](specs/features/06_collections_crud/spec.md#edge-cases), such as the same name in another case, or a rename that finds the collection gone.
3. **The approval.** The `**Approved:**` line in the [spec's header](specs/features/06_collections_crud/spec.md) and in the [plan's header](specs/features/06_collections_crud/plan.md) gives the date and who approved it. Nothing is built from an unapproved spec or plan.
4. **The plan.** The [checklist](specs/features/06_collections_crud/plan.md#checklist) breaks the spec into small items, and each item names the test to write first, for example "AC-06 ..." tests in `backend/spec/requests/collections_spec.rb` and `frontend/src/Collections.test.tsx`.
5. **The tests.** Every test of the feature starts with its criterion, "AC-06 ...". They are in [`backend/spec/requests/collections_spec.rb`](backend/spec/requests/collections_spec.rb) and [`frontend/src/Collections.test.tsx`](frontend/src/Collections.test.tsx), and `grep -r "AC-06" backend frontend` finds all of them.
6. **Verify.** The [test plan](specs/features/06_collections_crud/plan.md#test-plan) has the walkthrough with a recorded result under each item.
7. **Polish.** The feature's entries in `specs/docs/` are [`domain/collections.md`](specs/docs/domain/collections.md), the [collections endpoints](specs/docs/api_contract.md#collections) of the API contract, and the shared UI rules in [`conventions.md`](specs/docs/conventions.md).

### Artifacts

The specification artifacts that `requirements.md` section 2 requires, and where each is:

| Artifact | Where |
|---|---|
| Product requirements or feature specification | [`requirements.md`](requirements.md), and `spec.md` in each feature folder [`specs/features/NN_topic/`](specs/features/) |
| Domain model | [`specs/docs/domain/`](specs/docs/domain/README.md): `README.md` for the whole model, and one file per area |
| API contract or endpoint specification | [`specs/docs/api_contract.md`](specs/docs/api_contract.md), for HTTP and the WebSocket |
| Acceptance criteria | `requirements.md` section 10, and the `## Acceptance criterion` and the scenarios of each `spec.md` |
| Implementation plan | `plan.md` in each feature folder |
| Test plan or mapping between requirements and tests | the `## Test plan` of each `plan.md`, and [`specs/docs/test_mapping.md`](specs/docs/test_mapping.md), which maps each acceptance criterion to its tests |
| At least one documented change proposal or spec evolution note | the `## Changes` of each `spec.md` and the `## Deviations` of each `plan.md`, listed in [`specs/docs/implementation_notes.md`](specs/docs/implementation_notes.md#spec-evolution) |
| Final implementation notes | [`specs/docs/implementation_notes.md`](specs/docs/implementation_notes.md) |

### What changed

The specification changed after it was approved in these places, in date order. Each change started as a `## Changes` entry in its feature's `spec.md`, with its reason, and the spec was approved again. The implementation notes say what each one changed, and list how each build differed from its plan.

- 2026-11-05, AC-01: The failure redirect names the provider. [Details](specs/docs/implementation_notes.md#2026-11-05-ac-01-the-failure-redirect-names-the-provider)
- 2026-11-05, AC-02: GitHub accounts with no public name. [Details](specs/docs/implementation_notes.md#2026-11-05-ac-02-github-accounts-with-no-public-name)
- 2026-11-09, AC-12: Names of the review fields, and what the form sends. [Details](specs/docs/implementation_notes.md#2026-11-09-ac-12-names-of-the-review-fields-and-what-the-form-sends)
- 2026-11-09, AC-17: A search that is not text. [Details](specs/docs/implementation_notes.md#2026-11-09-ac-17-a-search-that-is-not-text)
- 2026-11-09, AC-27: The last line of `bin/test --time-zones`. [Details](specs/docs/implementation_notes.md#2026-11-09-ac-27-the-last-line-of-bintest---time-zones)
- 2026-11-10, AC-26: the page before the first frontend build. [Details](specs/docs/implementation_notes.md#2026-11-10-ac-26-the-page-before-the-first-frontend-build)
- 2026-11-10, AC-30: the page before the first frontend build, in the README's "Troubleshooting". [Details](specs/docs/implementation_notes.md#2026-11-10-ac-30-the-page-before-the-first-frontend-build)

### Test coverage

The automated tests that cover the nine cases of `requirements.md` section 7, each test named by its file and its full name. The table is kept by hand, and `bin/rails test_mapping:check` fails when a test it names does not exist.

| Case (requirements.md 7) | AC | Tests |
|---|---|---|
| SSO login success path in test mode using a mock or stub provider response | AC-01, AC-02 | `backend/spec/requests/auth/google_sign_in_spec.rb`: "AC-01 first Google sign-in creates the user record and signs the user in"<br>`backend/spec/requests/auth/github_sign_in_spec.rb`: "AC-02 first GitHub sign-in creates the user record and signs the user in" |
| A user can create a collection | AC-06 | `backend/spec/requests/collections_spec.rb`: "AC-06 POST /api/collections creates a collection and answers 201 with it" |
| A user can create a note inside a collection | AC-09 | `backend/spec/requests/notes_spec.rb`: "AC-09 POST /api/notes creates a note in one of the user's collections and answers 201 with it" |
| A user can assign tags to a note | AC-10 | `backend/spec/requests/note_tags_spec.rb`: "AC-10 PATCH /api/notes/:id with tag_ids sets the note's tags to exactly that set" |
| A user can mark a note as reviewed, and the next review date is recalculated | AC-13, AC-14 | `backend/spec/requests/mark_reviewed_spec.rb`: "AC-13 POST /api/notes/:id/review answers 200 with the note, whose last reviewed date is today"<br>`backend/spec/requests/review_date_recalc_spec.rb`: "AC-13 AC-14 marks a note as reviewed and recalculates the next review date by its interval" |
| A user cannot access another user's collections, tags, notes, or reminders | AC-21 | `backend/spec/requests/data_privacy_spec.rb`: "AC-21 every request that names another user's record in the address answers 404 like a missing one and changes nothing"<br>`backend/spec/channels/data_privacy_channel_spec.rb`: "AC-21 an ack for another user's note answers not_found like a missing note, records nothing, and leaves their reminders" |
| Archived notes do not generate review reminders | AC-18 | `backend/spec/models/archived_reminders_spec.rb`: "AC-18 archived notes do not generate review reminders, for every interval and every next review date" |
| WebSocket notifications are sent for notes due today or overdue | AC-20 | `backend/spec/models/review_reminder_batch_spec.rb`: "AC-20 a batch lists the user's notes due today and overdue, the oldest next review date first and then by creation, each with the reminder fields" |
| WebSocket client → server message affects server behavior (for example `subscribe` or `ack`) | AC-23 | `backend/spec/channels/review_reminders_ack_spec.rb`: "AC-23 an ack for a current reminder records the dismissal, and later batches leave the reminder out" |

In all: 311 backend tests and 247 frontend tests; of the 30 acceptance criteria, 28 have automated tests, 2 rely on manual validation alone, and 0 are not covered. Every acceptance criterion and its tests are in [`specs/docs/test_mapping.md`](specs/docs/test_mapping.md), a file that is generated and checked by two commands:

```bash
docker compose run --rm backend bin/rails test_mapping:write
docker compose run --rm backend bin/rails test_mapping:check
```

## Troubleshooting

Each entry says what you see and what to do. The commands are for a POSIX shell.

- **Docker is not running.** `docker compose` cannot reach Docker and fails with an error about the Docker daemon or its socket, and `bin/test` prints "Docker is not running or not installed. Start Docker, then run bin/test again." and ends with status 2. Start Docker (Docker Desktop, or the Docker service on Linux and in WSL 2), wait until `docker version` shows a server, and run the command again.
- **Port 3000 is already taken.** `docker compose up` reports that the port is already allocated (a message that ends "port is already allocated"), and the backend container is not running. The app never moves to another port. Stop the program that holds it, then run `docker compose up` again. `lsof -nP -iTCP:3000 -sTCP:LISTEN` shows what holds the port. See [Running locally](#running-locally).
- **Compose is older than 2.24.** `docker compose up` stops with an error about the `.env` entry of `compose.yaml`, because older versions do not accept an optional `env_file`. Update Docker Compose (`docker compose version` shows the version), then run it again. See [Quick start](#quick-start).
- **The page before the first frontend build.** Until the frontend's first build finishes, http://localhost:3000 shows the Rails welcome page (200), and any other address, such as `/nope`, shows a "Routing Error" page (`curl` gets the JSON `Not Found`). Wait for the frontend's log to show a line with "built in", then reload the page: it shows the sign-in screen. See [Running locally](#running-locally).
- **An OAuth redirect mismatch.** After "Continue with Google" or "Continue with GitHub", the provider shows an error page about the redirect URI instead of its sign-in page. The callback URL registered at the provider must be the one the app builds from `APP_BASE_URL`, character for character, the port included: `http://localhost:3000/auth/google_oauth2/callback` or `http://localhost:3000/auth/github/callback`. Fix it at the provider, or set `APP_BASE_URL` to the address you use and restart the app. See [Google OAuth credentials](#google-oauth-credentials) and [GitHub OAuth credentials](#github-oauth-credentials).
- **A sign-in button cannot complete (missing credentials).** The sign-in screen returns with "Sign-in with Google did not complete. Try again." or "Sign-in with GitHub did not complete. Try again.", and no provider page opened (or the provider refused the client id). The credentials for that provider are missing or wrong in `.env`. Fill in both of its variables, then run `docker compose up` again so the backend container reads the new file. See [Environment variables](#environment-variables).
- **Sample data is refused.** `sample_data:load` prints one of three messages to standard error, ends with status 1, and adds nothing. "No one is signed in. Sign in with Google or GitHub, then run this again." means: sign in in the browser, then run it again. "<display name> (<Google or GitHub>) already has collections, tags, or notes, so no sample data was added. To start over, see "Sample data" in the README." means the workspace is not empty: start over as [Sample data](#sample-data) says. "Sample data is for the development and test environments only." means the command ran in another environment.
- **New migrations arrive while the app runs.** After a pull that brings new migrations, every page shows "Could not reach the server. Try again." and nothing says why. Stop the app (Ctrl+C) and run `docker compose up` again: the backend applies the migrations when it starts. See [Running locally](#running-locally).
- **A container was killed and `docker compose up` no longer starts the backend.** After a container was killed (exit status 137, for example when Docker was quit or the machine slept and was force-stopped), the backend does not start: `docker compose up` shows "A server is already running (pid: 1, file: /tmp/rails-server.pid)." and "Exiting", because the server's pid file from the killed run is still in the stopped container. Run `docker compose down`, then `docker compose up`: that recreates the container. The data stays, because the databases are files in `backend/storage/`.
- **A console or runner crashes with a bus error.** Seen once, while a `bin/rails runner` wrote the development database in the container that also ran the server: Ruby crashed with a bus error. A likely cause is the SQLite database being used from two processes through Docker Desktop's file sharing on macOS. Stop the app and run the command again, or run it again later. Sequential use worked.

## Known limitations

- **Sign-in records stay after a cookie expires.** A browser that never logs out keeps its sign-in record after its cookie expires. The record can no longer be used, but nothing removes it (feature 05).
- **Logs contain personal data in one place.** The SQL log of a user insert shows the email, the avatar URL, and the Google user id. Rails does not filter SQL in logs. Feature 21 (data privacy) did not change it (feature 01).
- **The session cookie is not marked `secure`** in the app code. Production sets `force_ssl`, which redirects HTTP to HTTPS, but the cookie flag itself is not set. Open for review before production use.
- **Profile fields are set once.** A later sign-in does not refresh the display name, email, or avatar.
- **The notes list holds its review labels as of its last load.** A note that becomes due or overdue at midnight in your time zone, or by a change in another tab, keeps its label and its place until the list loads again, which a "Review" choice, "Try again", or a reload does. A note you review or archive in the app shows its new label at once, and stays in a filtered list until the list loads again (feature 15).
- **The search is a plain substring match.** It looks in the title, the body, and the source URL, each on its own, and is not a full-text search: there is no ranking and no stemming. It keeps accents, so "cafe" does not find "Café" (feature 17).
- **The search and the filters reset on a reload.** The address does not change, so a reload shows an empty "Search" and every filter at "All". The filter bar takes one collection and one tag at a time (feature 17).
- **Notes move one at a time.** A note moves from its edit form, and there is no way to move several notes at once (feature 11).
- **A tab whose connection was lost at a logout keeps its data for a short time.** After you log out in one tab, every other tab of the browser shows the sign-in screen at once, except a tab whose real-time connection is lost or not yet open at that moment. That tab keeps showing what it loaded, to anyone at the computer, until its next request, which answers 401, or until its next connection attempt is refused, at most 30 seconds later while the server can be reached (features 21 and 22; see [WebSocket message format](#websocket-message-format)).
- **An open connection outlives its cookie's 30 days.** The 30 days are checked when a connection opens. A connection that stays open is closed when its sign-in is deleted, by a logout or otherwise, not when the 30 days pass (feature 22).
- **A change made outside the app's requests reaches the panel at the next check.** The sample-data task or the Rails console changes notes without sending a batch, so an open panel shows the change within 60 seconds (feature 20; see [WebSocket message format](#websocket-message-format)).
- **The app has a light theme only.** It does not follow a dark system theme: the page and its controls stay light whatever the system setting (requirements.md section 4; feature 24).
- **A screen that fails to draw replaces the page.** If a part of the page fails to draw, the whole page shows "Something went wrong. Reload the page." with a "Reload page" button, and the reload loses what was typed in an open form (feature 24).
- **No setup on the host is documented.** The app, the tests, and the linters run in Docker only. This README documents no way to run them with Ruby, Node, or SQLite installed on the host (feature 26).
- **On Linux, the files the containers write into the clone belong to root.** The containers run as root, so the database and caches in `backend/storage`, the frontend build in `backend/public`, and the logs in `backend/log` are owned by root (feature 26).
- **The tests block requests to other hosts only through the usual clients.** The backend tests block Ruby's HTTP clients, and the frontend tests block `fetch`, `XMLHttpRequest`, and `WebSocket`. A test that opens a raw socket is not blocked (feature 27).
- **Narrow windows below 320 px may scroll sideways.** The layout supports windows from 320 CSS px wide, where the page does not scroll sideways; a narrower window may (feature 25).
