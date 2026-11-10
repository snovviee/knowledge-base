# syntax=docker/dockerfile:1

# Development and test images for the Personal Knowledge Base.
#
# project.md: the app, RSpec, and the linters all run in containers, and Rails
# serves the React build. compose.yaml mounts the repository at /app, so these
# images hold only the runtimes. Gems and node_modules live in named volumes,
# and the entrypoints in docker/ install them when the Gemfile or package.json
# changes.

ARG RUBY_VERSION=4.0.9
ARG NODE_VERSION=26.13.0

# Rails API: the server, RSpec, RuboCop. Works in backend/.
FROM ruby:${RUBY_VERSION}-slim AS backend

RUN apt-get update -qq \
 && apt-get install --no-install-recommends -y \
      build-essential curl git libyaml-dev pkg-config sqlite3 \
 && rm -rf /var/lib/apt/lists/*

ENV BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3

WORKDIR /app/backend
COPY --chmod=755 docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint
ENTRYPOINT ["backend-entrypoint"]

EXPOSE 3000
# bin/dev prepares the development database, then starts the server, as compose.yaml's
# backend command does (features/26_local_run question 2).
# The PID file lives outside the mounted source, so a killed container does not block the next start.
CMD ["bin/dev", "--binding=0.0.0.0", "--port=3000", "--pid=/tmp/rails-server.pid"]

# React with Vite: the build, Vitest, ESLint. Works in frontend/.
FROM node:${NODE_VERSION}-slim AS frontend

# Keeps npm's update and funding notices out of the check logs.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app/frontend
COPY --chmod=755 docker/frontend-entrypoint.sh /usr/local/bin/frontend-entrypoint
ENTRYPOINT ["frontend-entrypoint"]

# Rebuilds into backend/public on every change. See the frontend service in compose.yaml.
CMD ["npm", "run", "build", "--", "--watch"]
