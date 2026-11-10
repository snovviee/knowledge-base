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
| `time_zone` | string | no | The IANA name of the time zone that the app last reported in a session check, such as `Europe/Berlin`, when the server knows the name. Null until then, and after a check that names a zone the server does not know. "Today" is the date in this zone, and in UTC while it is null (AC-12; see [reviews.md](reviews.md#rules)). Added by `backend/db/migrate/20261109171217_add_time_zone_to_users.rb`. |
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

Relations: a user has many sign-ins. Deleting the user deletes them (`backend/app/models/user.rb`). Each open WebSocket connection belongs to one sign-in, and to that sign-in's user (AC-22; see the rules below).

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
- **A WebSocket connection belongs to one sign-in.** It opens only while the sign-in named by the browser's session cookie is live, by the same check as the HTTP API, and its user is that sign-in's user. Nothing the client sends chooses the user: not the address, a subscription, or a message (AC-22, spec question 1). The connection and its messages are in [api_contract.md](../api_contract.md#websocket).
- **A connection with no live sign-in is refused.** A browser that never signed in, a logout, a cookie past its 30 days, a kept copy of a cookie whose sign-in has ended, and a cookie that the app did not make or that was changed each get the refusal. No subscription is accepted, and nothing else is sent (AC-22, spec question 2).
- **Only the app's own pages may connect.** A connection request from another origin, or with none, is refused before the sign-in is checked, so the answer never tells whether the cookie is good (AC-22, spec question 6).
- **Logout closes this browser's connections.** Logout closes, at once, every open connection of the sign-in it ends, in every tab of this browser, and tells each not to reconnect. The same user's connections in other browsers and on other devices stay open. A logout with no sign-in closes nothing (AC-22, spec question 4).
- **A connection whose sign-in is gone receives nothing more.** Before each command it handles and each message it sends, the server checks the connection's sign-in again. Once the sign-in is gone, for any reason, nothing more is handled or sent, and the connection is closed with the refusal (AC-22, spec question 5). The cookie's 30 days are checked only when the connection opens: an open connection is closed when its sign-in is deleted, not when the 30 days pass (AC-22).
- **The session check saves the browser's time zone.** The app names the browser's zone in every session check, on page load and on "Try again" (see [api_contract.md](../api_contract.md#session)). With someone signed in, a name the server knows is saved on the account. A name it does not know saves none, so "today" is UTC: `Mars/Base`, a name in the wrong case such as `asia/tokyo`, and bytes that are not ASCII. The zone is written only when it differs from the saved one (AC-12, spec question 1).
- **The browser that loaded last decides.** The same user in two browsers in different zones has the zone of the browser whose session check came last (AC-12, spec question 1).
- **A check that names no zone keeps the saved zone.** A session check with no `X-Time-Zone`, or an empty or blank one, such as a `curl` request, changes nothing. A check with no one signed in answers 401 and saves nothing (AC-12, spec question 19).
- **A private workspace.** Each user reaches only their own collections, tags, notes, review reminders, and dismissals. There is no sharing of any kind, and no endpoint lists users or another user's records. Two accounts of one person, such as a Google and a GitHub account with the same email, are two users with two separate workspaces. Sample data goes to the user it is loaded for. What each area answers for another user's record is in [api_contract.md](../api_contract.md#conventions) (AC-21).
- **The saved time zone is the user's own.** Only the user's own session check changes it, and a session check with no sign-in saves no one's. Another user's zone never moves my "today" (AC-21).

## Chosen approaches

- **Profile fields are set once, at creation.** Later sign-ins do not refresh `display_name`, `email`, or `avatar_url`. The owner chose this for feature 01 and confirmed it for feature 03 (AC-01, AC-03). Refreshing them is open for a later feature.
- **Sign-in is the only way a user record is created.** There is no sign-up form and no user API (requirements.md section 1, SSO only).
- **GitHub identity is the numeric id.** A GitHub account's `provider_user_id` is GitHub's numeric `id` as a string, with `provider` `github`. The login and the email can change, so neither is identity (AC-02).
- **GitHub display name falls back to the login.** When GitHub sends no public name, `display_name` is the GitHub login. The login is always present for a GitHub account (AC-02).
- **A sign-in lasts until logout or 30 days without a visit (AC-04).** Every request made while signed in starts the 30 days again, and the sign-in survives closing and reopening the browser. This is the recommended option of feature 04, question 1, taken under the owner's standing instruction of 2026-11-05. The expiry is set in the cookie, so the server refuses a cookie a client kept past its date.
- **Logout with no sign-in answers 204.** A logout when no one is signed in changes nothing and answers 204 without a token check (AC-05, feature 05 question 2).
- **The time zone travels in a request header of the session check (AC-12, spec question 1).** It is not in the address, so another site cannot set it: a page on another site cannot add a custom header without a CORS preflight, and CORS is off. Which names the server knows is in [reviews.md](reviews.md#chosen-approaches).
- **The WebSocket is authorized by the browser's sign-in (AC-22, spec question 1).** The connection request carries the session cookie, as an HTTP request does, so the page needs no token of its own, and a sign-in that ended at logout or after 30 days without a visit (AC-04, AC-05) cannot open a connection either. The HTTP API and the WebSocket find the sign-in through one shared lookup, so the two cannot drift apart.
- **A refusal says why (AC-22, spec question 2).** The server sends one message with `"reconnect": false`, then closes the connection, so the client learns that trying again will not help.
- **A refusal is treated like a 401 (AC-22, spec question 3).** The tab shows the sign-in screen with no message, and does not connect again until the next sign-in ([conventions: Sign-in ended](../conventions.md#ui)). A connection lost for any other reason is the reconnecting of [conventions: The review reminders panel](../conventions.md#ui) (AC-20, its question 8).
- **Logout closes only this browser's connections (AC-22, spec question 4),** because logout ends only this browser's sign-in (AC-05).
- **The sign-in is checked again before each message (AC-22, spec question 5),** not only when the connection opens, because requirements.md 5 asks for authorization on notification delivery and on acknowledgements. Logout already closes the connections; the check covers any other way a sign-in is deleted.
- **Same origin only (AC-22, spec question 6).** The session cookie is `samesite=lax`, which would still let a page on another port of the same host, such as another local app, open the connection with the user's cookie. Only the app's own pages may connect, so the messages on the connection need no anti-forgery token.
- **The browser keeps no copies of my data (AC-21, spec questions 3 and 6).** Every API answer is `no-store` ([api_contract.md](../api_contract.md#conventions)), and the app writes nothing of the workspace to local storage, session storage, IndexedDB, or a cookie of its own: the only cookie is the session cookie, which logout empties. The workspace is private, and computers may be shared.
- **No other origin may read the API (AC-21, spec question 5).** CORS stays off. The session cookie is `samesite=lax`, so the browser sends it with a request from a page on another port of the same host, and only the browser's same-origin rule keeps that page from reading the answer. A feature that turns CORS on, or adds browser storage, must be checked against AC-21 again.
- **A tab left open after a logout (AC-21, spec question 4).** Logout closes the connections of every tab of this browser, so each of those tabs shows the sign-in screen at once. A tab whose connection was lost at the moment of the logout keeps showing what it loaded until its next request answers 401, or until its next connection attempt is refused, at most 30 seconds later while the server can be reached. This is a known limitation, listed in the README.
- **How feature 22's questions were answered.** Questions 1, 2, and 4 took the recommended option, and questions 3, 5, and 6 the agent's recommendation, under the owner's standing instruction of 2026-11-09 (AC-22).
