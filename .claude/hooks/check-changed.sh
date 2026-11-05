#!/usr/bin/env bash
# Stop hook for the knowledge-base project.
#
# Runs the checks for uncommitted files changed under backend/ and frontend/
# (tracked changes vs HEAD plus untracked files). project.md runs everything
# in Docker, so the checks run in the services from compose.yaml:
#   backend:  full RSpec suite, RuboCop on the changed Ruby files
#   frontend: full Vitest run, ESLint on the changed JS/TS files
#
# A service that is already up (`docker compose up`) is reused with
# `docker compose exec`. Otherwise the check runs in a one-off container
# (`docker compose run --rm`), which builds the image on first use. Either way
# the image's entrypoint (docker/<service>-entrypoint.sh) first installs
# missing gems or node_modules.
#
# Failures are shown to the user as systemMessage. The hook never blocks the
# stop (always exits 0), so a red test written in the TDD Red step does not
# trap the session. Requires git, jq, and Docker with the Compose plugin.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

if ! command -v jq >/dev/null 2>&1; then
  echo "check-changed.sh: jq is required" >&2
  exit 0
fi

# report <message>: shows the message to the user and ends the hook.
report() {
  jq -n --arg msg "$1" '{systemMessage: $msg}'
  exit 0
}

join() { local out="" item; for item in "$@"; do out="${out:+$out, }$item"; done; echo "$out"; }

changed=$( { git diff --name-only HEAD -- backend frontend 2>/dev/null
             git ls-files --others --exclude-standard -- backend frontend 2>/dev/null
           } | sort -u )

if [ -z "$changed" ]; then
  exit 0
fi

backend_changed=0
frontend_changed=0
ruby_files=()
js_files=()

while IFS= read -r f; do
  case "$f" in
    backend/*) backend_changed=1 ;;
    frontend/*) frontend_changed=1 ;;
  esac
  [ -f "$f" ] || continue
  case "$f" in
    backend/*.rb) ruby_files+=("${f#backend/}") ;;
    frontend/*.js|frontend/*.jsx|frontend/*.ts|frontend/*.tsx|frontend/*.mjs|frontend/*.cjs)
      js_files+=("${f#frontend/}") ;;
  esac
done <<< "$changed"

# A side is checked only once its app exists.
check_backend=0
check_frontend=0
skipped=()

if [ "$backend_changed" = 1 ]; then
  if [ -f backend/Gemfile ]; then check_backend=1; else skipped+=("backend: no Gemfile yet"); fi
fi
if [ "$frontend_changed" = 1 ]; then
  if [ -f frontend/package.json ]; then check_frontend=1; else skipped+=("frontend: no package.json yet"); fi
fi

if [ "$check_backend" = 0 ] && [ "$check_frontend" = 0 ]; then
  [ ${#skipped[@]} -gt 0 ] && report "Checks skipped: $(join "${skipped[@]}")"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  report "Checks skipped: docker is not installed, and project.md runs the checks in Docker."
fi
if ! docker info >/dev/null 2>&1; then
  report "Checks skipped: Docker is not running. Start Docker Desktop to run the checks."
fi
if [ ! -f compose.yaml ]; then
  report "Checks skipped: compose.yaml is missing."
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
details="$tmp/details.txt"
: > "$details"

passed=()
failed=()
running=$(docker compose ps --status running --services 2>/dev/null)

# run_check <name> <service> <command...>
# Runs the command in the service, keeps its output in a log, and records the
# result. `exec` skips the image's entrypoint, so it is called explicitly.
run_check() {
  local name="$1" service="$2" rc log="$tmp/$1.log"
  shift 2
  if printf '%s\n' "$running" | grep -qx "$service"; then
    docker compose exec -T "$service" "$service-entrypoint" "$@" >"$log" 2>&1
  else
    docker compose --progress quiet run --rm -T "$service" "$@" >"$log" 2>&1
  fi
  rc=$?
  if [ "$rc" -eq 0 ]; then
    passed+=("$name")
  else
    failed+=("$name")
    { echo "--- $name failed (exit $rc), last lines:"; tail -n 30 "$log"; echo; } >> "$details"
  fi
}

if [ "$check_backend" = 1 ]; then
  run_check rspec backend bundle exec rspec
  if [ ${#ruby_files[@]} -gt 0 ]; then
    run_check rubocop backend bundle exec rubocop --force-exclusion "${ruby_files[@]}"
  fi
fi

if [ "$check_frontend" = 1 ]; then
  run_check vitest frontend npx vitest run --passWithNoTests
  if [ ${#js_files[@]} -gt 0 ]; then
    run_check eslint frontend npx eslint "${js_files[@]}"
  fi
fi

note=""
if [ ${#skipped[@]} -gt 0 ]; then
  note=" (skipped: $(join "${skipped[@]}"))"
fi

if [ ${#failed[@]} -gt 0 ]; then
  report "Checks FAILED: $(join "${failed[@]}")$note"$'\n\n'"$(cat "$details")"
fi
report "Checks passed: $(join "${passed[@]}")$note"
