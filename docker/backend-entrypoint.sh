#!/bin/sh
# Entrypoint of the backend image. Installs missing gems into the bundle
# volume, then runs the command. Before the Rails app exists (no Gemfile),
# it runs the command as is.
set -e

if [ -f Gemfile ]; then
  bundle check >/dev/null 2>&1 || bundle install
fi

exec "$@"
