#!/usr/bin/env bash
# Stop hook for the knowledge-base project.
#
# Runs the checks for uncommitted files changed under backend/ and frontend/
# (tracked changes vs HEAD plus untracked files):
#   backend:  full RSpec suite, RuboCop on the changed Ruby files
#   frontend: full Vitest run, ESLint on the changed JS/TS files
#
# Failures are shown to the user as systemMessage. The hook never blocks the
# stop (always exits 0), so a red test written in the TDD Red step does not
# trap the session. Requires git and jq.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

if ! command -v jq >/dev/null 2>&1; then
  echo "check-changed.sh: jq is required" >&2
  exit 0
fi

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

if [ "$backend_changed" = 0 ] && [ "$frontend_changed" = 0 ]; then
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
report="$tmp/report.txt"
: > "$report"

passed=()
failed=()
skipped=()

join() { local out="" item; for item in "$@"; do out="${out:+$out, }$item"; done; echo "$out"; }

# run_check <name> <dir> <command...>
# Runs the command inside <dir>, keeps its output in a log, and records the result.
run_check() {
  local name="$1" dir="$2" rc log="$tmp/$1.log"
  shift 2
  ( cd "$dir" && "$@" ) >"$log" 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    passed+=("$name")
  else
    failed+=("$name")
    { echo "--- $name failed (exit $rc), last lines:"; tail -n 30 "$log"; echo; } >> "$report"
  fi
}

if [ "$backend_changed" = 1 ]; then
  if [ ! -f backend/Gemfile ]; then
    skipped+=("backend: no Gemfile yet")
  elif ! command -v bundle >/dev/null 2>&1; then
    failed+=("bundler")
    echo "--- bundler is not on PATH" >> "$report"
  else
    run_check rspec backend bundle exec rspec
    if [ ${#ruby_files[@]} -gt 0 ]; then
      run_check rubocop backend bundle exec rubocop --force-exclusion "${ruby_files[@]}"
    fi
  fi
fi

if [ "$frontend_changed" = 1 ]; then
  if [ ! -f frontend/package.json ]; then
    skipped+=("frontend: no package.json yet")
  elif [ ! -d frontend/node_modules ]; then
    failed+=("frontend-deps")
    echo "--- frontend/node_modules is missing: run npm install in frontend/" >> "$report"
  else
    run_check vitest frontend npx vitest run --passWithNoTests
    if [ ${#js_files[@]} -gt 0 ]; then
      run_check eslint frontend npx eslint "${js_files[@]}"
    fi
  fi
fi

note=""
if [ ${#skipped[@]} -gt 0 ]; then
  note=" (skipped: $(join "${skipped[@]}"))"
fi

if [ ${#failed[@]} -gt 0 ]; then
  msg="Checks FAILED: $(join "${failed[@]}")$note"$'\n\n'"$(cat "$report")"
elif [ ${#passed[@]} -gt 0 ]; then
  msg="Checks passed: $(join "${passed[@]}")$note"
else
  msg="Checks skipped$note"
fi

jq -n --arg msg "$msg" '{systemMessage: $msg}'
exit 0
