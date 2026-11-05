# Personal Knowledge Base

A personal knowledge base with review reminders. Notes are organized into collections and tags, and the app reminds you to review them. Each user has a private workspace, and signs in with Google or GitHub (SSO only).

This README covers what is built so far: Google sign-in (feature 01). The rest of the app is specified in `specs/` and is not built yet.

## Stack

- Backend: Ruby on Rails 8.1 in API mode, SQLite, OmniAuth (Google)
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
| `APP_BASE_URL` | no | The address the app is served at, used to build the sign-in callback URL. Defaults to `http://localhost:3000`. |
| `SECRET_KEY_BASE` | production only | Signs and encrypts the session cookie. Development and test generate one when none is set. Production must set it, for example with `bin/rails secret`. |

Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the app runs, but "Continue with Google" cannot complete a sign-in. Tests do not need them: they use placeholder values and never reach Google.

## Google OAuth credentials

1. Open the Google Cloud Console, and create a project or choose one.
2. Configure the OAuth consent screen, and add the scopes `email` and `profile`.
3. Create an OAuth client ID of type **Web application**.
4. Add this authorized redirect URI: `http://localhost:3000/auth/google_oauth2/callback`.
5. Copy the client id and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Restart the stack: `docker compose up`.

The callback URL is built from `APP_BASE_URL`, not from the request's `Host` header, which a client can forge. If you serve the app somewhere else, set `APP_BASE_URL` and add the matching redirect URI in Google.

## Google sign-in

- The sign-in screen offers "Continue with Google". Choosing it sends you to Google.
- On the first successful sign-in, the app creates a user record. The record keeps the provider, the provider's user id, your display name, and your email and avatar if Google sends them.
- A later sign-in with the same Google account finds the same user. It creates no second record, even if your email changed at Google.
- A cancelled or failed sign-in returns to the sign-in screen with the message "Sign-in with Google did not complete. Try again." The provider's error text is not shown.

## Known limitations

- **Sign-in with GitHub** is not built (feature 02).
- **Sign-out** is not built (feature 05). Use a private browser window to start over.
- **Logs contain personal data in one place.** The SQL log of a user insert shows the email, the avatar URL, and the Google user id. Rails does not filter SQL in logs. Feature 21 (data privacy) owns this.
- **The session cookie is not marked `secure`** in the app code. Production sets `force_ssl`, which redirects HTTP to HTTPS, but the cookie flag itself is not set. Open for review before production use.
- **Profile fields are set once.** A later sign-in does not refresh the display name, email, or avatar.
- **The app shows no notes or collections yet.** The main layout shows the empty states only (features 06 and 09).
- **Timezone.** Times are stored in UTC. The review features define how "today" is computed (requirements.md section 11).

## Specifications

The specification is in `specs/`. Each feature has a folder `specs/features/NN_topic/` with `spec.md` (what the feature does) and `plan.md` (how it is built, the test-first checklist, and the manual test plan). The current system is documented in `specs/docs/`. The workflow is in `specs/README.md`.
