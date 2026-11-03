# Personal Knowledge Base with Review Reminders: Requirements

<requirements>

<task>

Create a full-stack web app using a spec-driven development workflow.

</task>

<goal>

Deliver a working MVP that demonstrates end-to-end product implementation (frontend + backend + persistence + tests + documentation) using a spec-driven approach.

</goal>

<allowed_tools>

You may use any spec-driven development framework, for example OpenSpec, Spec Kit, etc.

</allowed_tools>

<business_scenario>

A user collects personal knowledge: notes, ideas, learning materials, links, and summaries. The user wants to organize this knowledge by collections and tags, quickly find information, and receive reminders to review important notes at the right time.

</business_scenario>

<section id="1" title="Core rules">

- The application supports multiple users.
- Authentication must be implemented via SSO only.
- Each user has a private workspace.
- Each user can access only their own data.
- There is no collaboration or sharing of any kind:
  - no invites
  - no public links
  - no shared collections
  - no shared notes
  - no team roles
- Technology choices (stack, database, UI library, and hosting approach) are up to you.
- The application must be runnable on a local developer machine. The README must include commands for starting the frontend, backend, database, and tests locally. Cloud deployment is not required.

</section>

<section id="2" title="Spec-driven development requirements">

<process>

- You must develop the project using a spec-driven development workflow.
- Your repository must include specification artifacts that describe the system and guide implementation.
- You may organize these artifacts according to your chosen framework.
- If you use a framework such as OpenSpec or Spec Kit, you may use the structure recommended by that framework.

</process>

<required_artifacts>

- Product requirements or feature specification
- Domain model
- API contract or endpoint specification
- Acceptance criteria
- Implementation plan
- Test plan or mapping between requirements and tests
- At least one documented change proposal or spec evolution note
- Final implementation notes

</required_artifacts>

<readme_must_explain>

- Which spec-driven workflow or framework you used
- Where the main specification files are located
- How the specification guided your implementation
- Which requirements are covered by automated tests
- What changed between the initial specification and the final implementation

</readme_must_explain>

<specification_must_describe>

Another developer should be able to understand from the specification:

- What the app should do
- What entities exist
- What business rules must be enforced
- What API behavior is expected
- What edge cases are handled
- How the implementation satisfies the acceptance criteria

</specification_must_describe>

</section>

<section id="3" title="Functional requirements">

<subsection id="3.1" title="Accounts and authentication (SSO only)">

- Authentication must be implemented via SSO only.
- The app must support both providers:
  - Google OAuth / OpenID Connect
  - GitHub OAuth
- The app must support logout.
- Authentication must persist across page refresh.
- On first successful SSO sign-in, the backend must create a local user record automatically.
- The backend must persist at least the following user profile data:
  - provider
  - provider_user_id
  - email if provided by the provider
  - display_name
  - avatar_url (optional)
- Account linking between Google and GitHub is not required.
- If the same person signs in with Google and GitHub, these may be treated as separate accounts unless you explicitly implement account linking and document it.
- GitHub may not always provide email depending on user settings, so identity must rely on provider + provider_user_id.

</subsection>

<subsection id="3.2" title="Collections">

- A collection represents a group of related notes.
- A user can create a collection.
- A user can rename a collection.
- A user can delete a collection.
- Collection name must be unique per user.
- Deleting a collection must be handled explicitly by one of these approaches:
  - Block deletion if notes exist in the collection
  - Allow deletion and move notes to a default collection, for example "Uncategorized"
  - Allow deletion and cascade delete all notes in the collection
- You must document the chosen approach in the README and in the specification.

</subsection>

<subsection id="3.3" title="Tags">

- A tag represents a flexible label that can be attached to notes.
- A user can create a tag.
- A user can rename a tag.
- A user can delete a tag.
- A user can assign tags to a note.
- A user can remove tags from a note.
- Tag name must be unique per user.
- Deleting a tag must not delete notes. It only removes the tag from associated notes.

</subsection>

<subsection id="3.4" title="Notes">

- A note belongs to exactly one user.
- A note belongs to one collection.
- A note may have zero or more tags.
- Each note must include at least the following fields:
  - title
  - content/body
  - collection
  - tags
  - source URL (optional)
  - status: Active | Archived
  - review interval
  - custom review interval days (required only when review interval is "custom number of days")
  - next review date (optional)
  - last reviewed date (optional)
  - created date
  - updated date
- Review interval values:
  - none
  - daily
  - weekly
  - monthly
  - custom number of days
- Note operations:
  - Create a note
  - Edit any note field
  - Archive a note
  - Restore an archived note
  - Delete a note
  - Move a note to another collection
  - Assign and remove tags
- Validation rules:
  - title must be non-empty
  - content/body must be non-empty
  - source URL, if provided, must be a valid URL
  - custom review interval days must be greater than 0 when review interval is "custom number of days"
  - Archived notes must not generate review reminders

</subsection>

<subsection id="3.5" title="Review reminders">

- The system must support review reminders for notes.
- A note is considered **due for review** if `next_review_date` is today or earlier, note status is Active, and review interval is not `none`.
- A note is considered **overdue for review** if `next_review_date` is before today, note status is Active, and review interval is not `none`.
- A user can mark a note as reviewed.
- When a note is marked as reviewed:
  - `last_reviewed_date` is set to today.
  - `next_review_date` is recalculated based on the selected review interval.
- Review interval calculation:
  - daily: next review date is today + 1 day
  - weekly: next review date is today + 7 days
  - monthly: next review date is today + 1 calendar month
  - custom number of days: next review date is today + custom review interval days
- You must document the chosen timezone approach in the README and in the specification.
- The app must clearly handle the case when a note has no review schedule.

</subsection>

<subsection id="3.6" title="Search and filters">

- The app must allow the user to search notes by:
  - title
  - content/body
  - source URL
- The app must allow filtering notes by:
  - collection
  - tag
  - status: Active, Archived
  - review state: due today, overdue, next 7 days, no review scheduled, all
- Search and filters must be available from the main notes view.
- If search returns no results, the UI must show a clear empty state.

</subsection>

<subsection id="3.7" title="Real-time communication: WebSocket review notifications">

- The app must include two-way communication using WebSocket.
- Server → client behavior:
  - The backend must push review reminder notifications over WebSocket.
  - Notification types must include notes due for review today and notes overdue for review.
  - When the WebSocket connection opens, the server sends an initial notification batch.
  - While connected, the server repeats the review check periodically. You choose the interval and document it.
  - Archived notes must not generate review notifications.
  - Notes without a review schedule must not generate review notifications.
  - Notifications must include enough data for the client to display useful information:
    - notification type
    - note ID
    - note title
    - collection name
    - next review date
    - overdue/due status
  - The app should avoid spamming identical notifications in the UI. You may handle duplicate prevention on the client or server, but the chosen approach must be documented.
- Client → server behavior:
  - The client must send at least one meaningful WebSocket message to the server. Acceptable examples: `subscribe`, `ack`, `update_preferences`.
  - The chosen message type and payload format must be documented in the README and in the specification.
  - The message must affect server behavior in a meaningful way.
- UI behavior for notifications:
  - Review notifications must be visible in the UI.
  - Acceptable presentation: toast notifications, alert banner, or notification panel.

</subsection>

</section>

<section id="4" title="UI requirements">

- The UI must be modern, styled, responsive, and interactive.
- Authentication screen must include:
  - Continue with Google
  - Continue with GitHub
- Main layout:
  - A left area or navigation area for collections and a main area for notes
  - Search input, filter controls, visible user profile area, and logout action
- Notes view:
  - List or card view of notes showing: note title, collection, tags, review state, next review date (if scheduled), archived status (if applicable)
- Note create/edit UI (modal, drawer, or separate page is acceptable).
- Collection management UI.
- Tag management UI.
- Note detail view or detail section showing: title, content/body, source URL, collection, tags, review interval, last reviewed date, next review date, and a "mark as reviewed" action.
- Visible real-time review notifications while connected to WebSocket.
- Responsive behavior for narrow screens is required:
  - Sidebar collapses into a menu
  - Collections move into a dropdown
  - Note cards stack vertically

<ui_quality_checks>

- Consistent spacing and typography across major screens
- Visible hover states for interactive elements
- Visible focus states for keyboard navigation
- Clear empty states for:
  - no collections
  - no notes
  - no tags
  - no search results
  - no review reminders
- At least one visible loading state on a main screen or major data block
- Client-side validation feedback for note create/edit forms
- Basic error handling visible in the UI
- Light theme only. Dark mode is not required.

</ui_quality_checks>

</section>

<section id="5" title="Backend requirements">

- The backend must provide an HTTP API that supports all UI flows.
- The backend must enforce authorization for every operation involving:
  - collections
  - tags
  - notes
  - review reminders
  - notification acknowledgements
- The backend must enforce authorization on WebSocket connections and notification delivery.
- A user must never receive another user's data or notifications.
- The backend must validate inputs and return clear errors for invalid requests.
- The backend must implement Google and GitHub SSO securely.
- The backend must document required environment variables for:
  - Google OAuth
  - GitHub OAuth
  - session or token signing
  - database connection
  - frontend/backend callback URLs
- The backend must persist data in a database chosen by you.
- The backend must store dates consistently and document the chosen timezone approach.

</section>

<section id="6" title="Data requirements">

- The app must persist all main data in a database.
- Minimum required data entities:
  - User
  - Collection
  - Tag
  - Note
  - NoteTag (or equivalent many-to-many relationship)
  - Review notification or notification acknowledgement (if needed by the chosen implementation)
- The app must provide a simple way to start with sample data:
  - Seed script
  - Documented manual steps
  - Create sample data endpoint, available only in development/test mode
- Sample data must belong to the authenticated user or be created through a documented test/dev flow.

</section>

<section id="7" title="Quality requirements">

- The project must include automated tests.
- Automated tests must cover at least the following cases:
  - SSO login success path in test mode using a mock or stub provider response
  - A user can create a collection
  - A user can create a note inside a collection
  - A user can assign tags to a note
  - A user can mark a note as reviewed, and the next review date is recalculated
  - A user cannot access another user's collections, tags, notes, or reminders
  - Archived notes do not generate review reminders
  - WebSocket notifications are sent for notes due today or overdue
  - WebSocket client → server message affects server behavior (for example `subscribe` or `ack`)
- Tests must not depend on real Google or GitHub network calls.
- The project must start locally with documented commands.
- The test command must be documented and runnable.
- Basic error handling must be visible in the UI.
- The README must explain any known limitations.

</section>

<section id="8" title="Deliverables">

<repository_must_contain>

- Frontend source code
- Backend source code
- Database schema/migrations or equivalent setup
- Automated tests
- Spec-driven development artifacts
- README
- Test mapping linking acceptance criteria to automated tests or documented manual validation

</repository_must_contain>

<readme_must_include>

- Project overview
- Chosen tech stack
- Chosen spec-driven workflow or framework
- Location of specification files
- How to run the backend locally
- How to run the frontend locally
- How to run tests
- How to configure Google OAuth credentials
- How to configure GitHub OAuth credentials
- Required environment variables
- Short API description
- WebSocket message format
- Review reminder rules
- Collection deletion behavior
- Timezone handling
- Sample data instructions
- Known limitations

</readme_must_include>

<spec_artifacts_must_include>

- Product requirements or feature specification
- Domain model
- API contract or endpoint specification
- Acceptance criteria
- Implementation plan
- Test mapping
- Change proposal or spec evolution note
- Final implementation notes

</spec_artifacts_must_include>

</section>

<section id="9" title="Optional deliverable: containerization">

- Containerization is optional.
- Acceptable options:
  - Dockerfile
  - docker-compose
  - Both
- If containerization is skipped because it is blocked on your machine, this must be noted in the README.

</section>

<section id="10" title="Acceptance checklist">

- AC-01: A user can sign in with Google
- AC-02: A user can sign in with GitHub
- AC-03: A local user record is created automatically on first successful SSO sign-in
- AC-04: Authentication persists across page refresh
- AC-05: A user can log out
- AC-06: A user can create, rename, and delete collections
- AC-07: Collection deletion behavior is documented
- AC-08: A user can create, rename, and delete tags
- AC-09: A user can create, edit, archive, restore, and delete notes
- AC-10: A user can assign and remove tags from notes
- AC-11: A user can move notes between collections
- AC-12: A user can configure review intervals for notes
- AC-13: A user can mark a note as reviewed
- AC-14: The app recalculates the next review date after review
- AC-15: The app shows notes due for review today
- AC-16: The app shows overdue review notes
- AC-17: A user can search and filter notes
- AC-18: Archived notes do not generate review reminders
- AC-19: Notes without review schedules do not generate review reminders
- AC-20: While connected, the app receives real-time review notifications
- AC-21: Data is private per user and cannot be accessed cross-account
- AC-22: WebSocket connection is authorized
- AC-23: The WebSocket flow includes at least one client → server message that changes server behavior
- AC-24: The UI includes empty states, loading state, validation feedback, and visible error handling
- AC-25: The app is responsive on narrow screens
- AC-26: The app runs locally from README instructions
- AC-27: Tests pass locally
- AC-28: Specification artifacts are present in the repository
- AC-29: Tests are mapped to requirements or acceptance criteria
- AC-30: README is sufficient for another developer to run the app without guessing

</section>

<section id="11" title="Additional notes">

- GitHub may not always provide email depending on user settings, so identity must rely on provider + provider_user_id.
- The handling of "today" must be documented clearly, because review reminders depend on dates.
- The app must not send review notifications for archived notes.
- The app must not send review notifications for notes without a review interval.
- The app should avoid repeatedly showing the same notification without user action.
- Account linking between Google and GitHub is not required.
- Full-text search is not required. Basic search by title/content/source URL is acceptable.
- Rich text editing is not required. Plain text or Markdown-style content is acceptable.
- Collaboration, sharing, public links, and team workspaces are not part of the MVP.

</section>

</requirements>
