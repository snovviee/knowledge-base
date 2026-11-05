# Users

## User

A person who signs in with an SSO provider. Each `User` is one account in the app (AC-01, AC-03).

Attributes (table `users`):

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `provider` | string | yes | The SSO provider. `google_oauth2` for Google (AC-01). |
| `provider_user_id` | string | yes | The provider's own id for the account. Unique together with `provider`. |
| `email` | string | no | Only when the provider sends one (requirements.md 3.1). |
| `display_name` | string | yes | The name the provider gives for the account (AC-01). |
| `avatar_url` | string | no | The picture URL the provider gives. |
| `created_at`, `updated_at` | datetime | yes | Stored in UTC. |

Validations (`backend/app/models/user.rb`):
- `provider`, `provider_user_id`, and `display_name` must be present.
- `provider_user_id` is unique within a `provider`. The same id under two providers is two users.
- A database unique index on (`provider`, `provider_user_id`) backs the validation.

## Rules

- **Identity** is `provider` plus `provider_user_id`. The email is not identity, because GitHub may not send one and an email can change (requirements.md 3.1, section 11). A changed email signs in the same user (AC-01).
- **The record is created at the first successful sign-in** with that provider account. Later sign-ins find it and create nothing (AC-01, AC-03).
- **Email is optional.** A provider account without an email signs in, and the record has no email (AC-01).
- **No account linking.** A Google account and a GitHub account of the same person are two users (requirements.md 3.1).

## Chosen approaches

- **Profile fields are set once, at creation.** Later sign-ins do not refresh `display_name`, `email`, or `avatar_url`. The owner chose this for feature 01. Refreshing them is open for a later feature.
- **Sign-in is the only way a user record is created.** There is no sign-up form and no user API (requirements.md section 1, SSO only).
