# Project Context

<project>

<name>Personal Knowledge Base with Review Reminders</name>

<requirements_file>requirements.md</requirements_file>

<tech_stack>
<backend>Ruby on Rails (API mode)</backend>
<database>SQLite3</database>
<realtime>Action Cable (WebSocket)</realtime>
<sso>OmniAuth: Google (OAuth / OpenID Connect), GitHub (OAuth)</sso>
<frontend>React with TypeScript, built with Vite, styled with Tailwind CSS</frontend>
<frontend_delivery>Rails serves the React build</frontend_delivery>
<backend_tests>RSpec</backend_tests>
<frontend_tests>Vitest + React Testing Library</frontend_tests>
<linters>RuboCop (Ruby), ESLint (React)</linters>
<runtime>Docker: app, RSpec, and linters all run in containers</runtime>
</tech_stack>

<sdd_rules>
<rule>Specs are maintained with the project's own spec-driven framework.</rule>
<rule>Every feature or behavior change starts as a spec change proposal. Implementation follows the approved proposal.</rule>
<rule>Each spec links to acceptance criteria IDs (AC-01 to AC-30) in requirements.md.</rule>
<rule>Each automated test references the requirement or AC ID it verifies.</rule>
<rule>Spec changes that alter agreed behavior are recorded as a change proposal, not edited in place.</rule>
</sdd_rules>

<open_decisions>
<decision>Spec framework file layout and locations.</decision>
</open_decisions>

</project>
