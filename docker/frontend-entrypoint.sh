#!/bin/sh
# Entrypoint of the frontend image. Installs node_modules into their volume
# when package.json or package-lock.json changed since the last install, then
# runs the command. Before the React app exists (no package.json), it runs the
# command as is.
#
# npm install, not npm ci: npm ci deletes node_modules itself, which fails on
# a volume mount point.
set -e

lock_sum() {
  cat package.json package-lock.json 2>/dev/null | sha256sum | cut -d' ' -f1
}

if [ -f package.json ]; then
  stamp=node_modules/.install-stamp
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$(lock_sum)" ]; then
    npm install
    # npm install may rewrite package-lock.json, so the sum is taken after it.
    lock_sum > "$stamp"
  fi
fi

exec "$@"
