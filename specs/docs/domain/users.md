# Users

## User

A person who signs in with an SSO provider. Each `User` is one account in the app (AC-01, AC-03).

Attributes (table `users`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `provider` | string | yes | The SSO provider. `google_oauth2` for Google (AC-01), `github` for GitHub (AC-02). |
| `provider_user_id` | string | yes | The provider's own id for the account. Unique together with `provider`. For GitHub, the numeric GitHub id as a string (AC-02). |
| `email` | string | no | Only when the provider sends one (requirements.md 3.1). GitHub may send none (AC-02). |
| `display_name` | string | yes | The name the provider gives for the account (AC-01). For GitHub with no public name, the login (AC-02). |
| `avatar_url` | string | no | The picture URL the provider gives. |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. |

Validations (`backend/app/models/user.rb`):
- `provider`, `provider_user_id`, and `display_name` must be present.
- `provider_user_id` is unique within a `provider`. The same id under two providers is two users.
- A database unique index on (`provider`, `provider_user_id`) backs the validation.

## Sign-in

One browser where a user is signed in (AC-05). A user has one sign-in per browser, and each sign-in belongs to one user.

Attributes (table `sign_ins`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `user_id` | integer | yes | The user this sign-in belongs to. Foreign key to `users`, indexed. |
| `token` | string | yes | A random token that the session names this sign-in by. Unique (a database unique index). |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. |

Validations (`backend/app/models/sign_in.rb`):
- A sign-in must belong to a user.
- The token is generated when the sign-in is created.

Relations: a user has many sign-ins. Deleting the user deletes them (`backend/app/models/user.rb`).

## Rules

- **Identity** is `provider` plus `provider_user_id`. The email is not identity, because GitHub may not send one and an email can change (requirements.md 3.1, section 11). A changed email signs in the same user (AC-01, AC-02).
- **The record is created at the first successful sign-in** with that provider account. Later sign-ins find it and create nothing (AC-01, AC-03).
- **Email is optional.** A provider account without an email signs in, and the record has no email (AC-01). This includes GitHub accounts, which may send no email (AC-02).
- **No account linking.** A Google account and a GitHub account of the same person are two users (requirements.md 3.1, AC-02).
- **Two sign-ins for one new account create one record.** If two sign-ins for the same provider account finish at the same time, one record is created and both sign the user in. The sign-in that loses the race uses the record the other one made, with no error page (AC-03).
- **A provider account with no usable name is not stored.** `display_name` is required, so an account with neither a name nor a login creates no record. The user is not signed in, and the sign-in shows that provider's failure message (AC-03). GitHub always sends a login, so for GitHub this rule does not apply in practice.

- **A sign-in starts at sign-in and ends at logout.** Each successful sign-in creates one sign-in for that browser, and logout deletes it (AC-05).
- **Logout ends only this browser's sign-in.** The same user, signed in in another browser or on another device, stays signed in. A copy of the session cookie kept from before logout signs no one in (AC-05, feature 05 question 5).
- **A sign-in that is gone signs no one in.** The session is checked against the sign-in record, so a cookie whose sign-in was deleted gets 401 (AC-05).
- **A browser that never logs out keeps its record after its cookie expires.** The record can no longer be used, and nothing removes it (AC-05).

## Chosen approaches

- **Profile fields are set once, at creation.** Later sign-ins do not refresh `display_name`, `email`, or `avatar_url`. The owner chose this for feature 01 and confirmed it for feature 03 (AC-01, AC-03). Refreshing them is open for a later feature.
- **Sign-in is the only way a user record is created.** There is no sign-up form and no user API (requirements.md section 1, SSO only).
- **GitHub identity is the numeric id.** A GitHub account's `provider_user_id` is GitHub's numeric `id` as a string, with `provider` `github`. The login and the email can change, so neither is identity (AC-02).
- **GitHub display name falls back to the login.** When GitHub sends no public name, `display_name` is the GitHub login. The login is always present for a GitHub account (AC-02).
- **A sign-in lasts until logout or 30 days without a visit (AC-04).** Every request made while signed in starts the 30 days again, and the sign-in survives closing and reopening the browser. This is the recommended option of feature 04, question 1, taken under the owner's standing instruction of 2026-11-05. The expiry is set in the cookie, so the server refuses a cookie a client kept past its date.
- **Logout with no sign-in answers 204.** A logout when no one is signed in changes nothing and answers 204 without a token check (AC-05, feature 05 question 2).
