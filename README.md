# Personal Knowledge Base

A personal knowledge base with review reminders. Notes are organized into collections and tags, and the app reminds you to review them. Each user has a private workspace, and signs in with Google or GitHub (SSO only).

This README covers what is built so far: sign-in with Google and GitHub (features 01 to 03), the session that lasts across page reloads (feature 04), sign-out (feature 05), collections (feature 06), tags (feature 08), and collection deletion (feature 07). Notes are built and in verification (feature 09). Reviews are specified in `specs/` and are not built yet.

## Stack

- Backend: Ruby on Rails 8.1 in API mode, SQLite, OmniAuth (Google and GitHub)
- Frontend: React with TypeScript, Vite, Tailwind CSS
- Tests: RSpec (backend), Vitest with React Testing Library (frontend)
- Everything runs in Docker (`compose.yaml`)

## Running locally

Requirements: Docker with the Compose plugin.

```bash
docker compose up        # the app on http://localhost:3000
```

The first start builds the images and installs gems and packages into volumes, so it takes a few minutes.

Run the tests and linters:

```bash
docker compose run --rm backend bundle exec rspec
docker compose run --rm backend bundle exec rubocop
docker compose run --rm frontend npx vitest run
docker compose run --rm frontend npx eslint .
```

Run one backend test: `docker compose run --rm backend bundle exec rspec <file> -e "<test name>"`.

## Environment variables

Put these in a `.env` file at the repository root. Compose reads it and passes it to the backend container. Git ignores the file (`.gitignore`), so it is not committed. Copy values into it yourself.

| Variable | Needed | What it is for |
|---|---|---|
| `GOOGLE_CLIENT_ID` | to sign in with Google | The client id of your Google OAuth client. See below. |
| `GOOGLE_CLIENT_SECRET` | to sign in with Google | The client secret of that client. |
| `GITHUB_CLIENT_ID` | to sign in with GitHub | The client id of your GitHub OAuth app. See below. |
| `GITHUB_CLIENT_SECRET` | to sign in with GitHub | The client secret of that app. |
| `APP_BASE_URL` | no | The address the app is served at, used to build the sign-in callback URL. Defaults to `http://localhost:3000`. |
| `SECRET_KEY_BASE` | production only | Signs and encrypts the session cookie. Development and test generate one when none is set. Production must set it, for example with `bin/rails secret`. |

Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the app runs, but "Continue with Google" cannot complete a sign-in. Without `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, the same is true of "Continue with GitHub". Tests do not need any of them: they use placeholder values and never reach Google or GitHub.

## Google OAuth credentials

1. Open the Google Cloud Console, and create a project or choose one.
2. Configure the OAuth consent screen, and add the scopes `email` and `profile`.
3. Create an OAuth client ID of type **Web application**.
4. Add this authorized redirect URI: `http://localhost:3000/auth/google_oauth2/callback`.
5. Copy the client id and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Restart the stack: `docker compose up`.

The callback URL is built from `APP_BASE_URL`, not from the request's `Host` header, which a client can forge. If you serve the app somewhere else, set `APP_BASE_URL` and add the matching redirect URI in Google.

## GitHub OAuth credentials

1. Open GitHub, and go to Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set the Homepage URL to `http://localhost:3000`.
3. Set the Authorization callback URL to `http://localhost:3000/auth/github/callback`.
4. Register the application, then generate a client secret.
5. Copy the Client ID and the client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
6. Restart the stack: `docker compose up`.

The app asks GitHub for the `user:email` scope, so GitHub can send your verified primary email. You set no scope in GitHub. As with Google, the callback URL is built from `APP_BASE_URL`. If you serve the app somewhere else, set the callback URL in the GitHub app to match.

## Google sign-in

- The sign-in screen offers "Continue with Google". Choosing it sends you to Google.
- On the first successful sign-in, the app creates a user record. The record keeps the provider, the provider's user id, your display name, and your email and avatar if Google sends them.
- A later sign-in with the same Google account finds the same user. It creates no second record, even if your email changed at Google.
- A cancelled or failed sign-in returns to the sign-in screen with the message "Sign-in with Google did not complete. Try again." The provider's error text is not shown.

## GitHub sign-in

- The sign-in screen offers "Continue with GitHub". Choosing it sends you to GitHub.
- On the first successful sign-in, the app creates a user record. The record keeps the provider (`github`), your GitHub id, your display name, and your email and avatar if GitHub sends them. If your GitHub profile has no public name, the display name is your GitHub login.
- A later sign-in with the same GitHub account finds the same user. It creates no second record, even if your email changed at GitHub.
- A GitHub account with no email signs in, and its record has no email.
- A Google account and a GitHub account of the same person are two users. The app does not link them.
- A cancelled or failed sign-in returns to the sign-in screen with the message "Sign-in with GitHub did not complete. Try again." The provider's error text is not shown.

## Collections API

Collections are built (feature 06). All of these are under `/api`, and each needs a sign-in:

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/collections` | Lists your collections, in alphabetical order |
| `POST` | `/api/collections` | Creates one from `{ "name": "..." }` |
| `PATCH` or `PUT` | `/api/collections/:id` | Renames one from `{ "name": "..." }` |
| `DELETE` | `/api/collections/:id` | Deletes one |

### Notes API

Notes are built (feature 09). Each needs a sign-in, and a note belongs to one of your collections. Under `/api/notes`:

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/notes` | Lists your notes, newest first |
| `GET` | `/api/notes/:id` | Shows one note in full |
| `POST` | `/api/notes` | Creates one from `title`, `body`, `source_url`, and `collection_id` |
| `PATCH` or `PUT` | `/api/notes/:id` | Changes only the fields you send, such as `{ "status": "archived" }` to archive |
| `DELETE` | `/api/notes/:id` | Deletes one for good |

### Tags API

Tags are built (feature 08). The same rules and the same shape apply as for collections, under `/api/tags`:

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/tags` | Lists your tags, in alphabetical order |
| `POST` | `/api/tags` | Creates one from `{ "name": "..." }` |
| `PATCH` or `PUT` | `/api/tags/:id` | Renames one from `{ "name": "..." }` |
| `DELETE` | `/api/tags/:id` | Deletes one |

A request that changes data sends the header `X-CSRF-Token` with the token from `GET /api/csrf`. The full contract is in `specs/docs/api_contract.md`.

## Collection deletion behavior

A collection is deleted only when it holds no notes (AC-07). The app does not move or delete notes for you.

- A collection with notes cannot be deleted, and that includes archived notes. The API answers `409` with `{ "error": "collection_not_empty" }`, and the collection and its notes stay as they are.
- In the app, the delete confirmation then shows "This collection still has notes. Move or delete them first." Move or delete the notes first, then delete the collection again.
- A collection with no notes is deleted, and the API answers `204` with no body.

## Known limitations

- **Sign-in records stay after a cookie expires.** A browser that never logs out keeps its sign-in record after its cookie expires. The record can no longer be used, but nothing removes it (feature 05).
- **Logs contain personal data in one place.** The SQL log of a user insert shows the email, the avatar URL, and the Google user id. Rails does not filter SQL in logs. Feature 21 (data privacy) owns this.
- **The session cookie is not marked `secure`** in the app code. Production sets `force_ssl`, which redirects HTTP to HTTPS, but the cookie flag itself is not set. Open for review before production use.
- **Profile fields are set once.** A later sign-in does not refresh the display name, email, or avatar.
- **Notes cannot be moved yet.** A note stays in the collection it was created in. Moving a note to another collection is feature 11.
- **Timezone.** Times are stored in UTC. The review features define how "today" is computed (requirements.md section 11).

## Specifications

The specification is in `specs/`. Each feature has a folder `specs/features/NN_topic/` with `spec.md` (what the feature does) and `plan.md` (how it is built, the test-first checklist, and the manual test plan). The current system is documented in `specs/docs/`. The workflow is in `specs/README.md`.
