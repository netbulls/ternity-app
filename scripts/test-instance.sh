#!/usr/bin/env bash
# Test-instance entry point. Satisfies the `test-instance` skill contract:
#   in:  $TEST_PORT, $TEST_WORKDIR, $TEST_LOG_DIR
#   out: $TEST_WORKDIR/pids       (one "<pid> <label>" line per process)
#        $TEST_WORKDIR/meta.json  (URLs + seeded user/project IDs for clients)
#
# Spins up an isolated Ternity stack against an ephemeral Postgres container:
#   • Postgres (Docker, random host port) — wiped at teardown
#   • API on $TEST_API_PORT (offset from $TEST_PORT)
#   • Web on $TEST_PORT (Vite dev, proxies /api to the test API)
# Seeds: 1 admin, 1 contractor, 1 client, 1 project, 1 deductible leave type,
# 1 allowance row for the contractor. IDs land in meta.json so Playwright (or
# anyone interactive) can drive the app without hard-coded UUIDs.
set -euo pipefail

: "${TEST_PORT:?TEST_PORT not set (the skill should provide it)}"
: "${TEST_WORKDIR:?TEST_WORKDIR not set}"
: "${TEST_LOG_DIR:?TEST_LOG_DIR not set}"

# Repo root = parent of this script's directory.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Make node/pnpm available — non-interactive shells don't inherit nvm.
if [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_VERSION="$(ls -1 "$HOME/.nvm/versions/node" | sort -V | tail -1)"
  export PATH="$HOME/.nvm/versions/node/$NODE_VERSION/bin:$PATH"
fi

exec node "$ROOT/scripts/test-instance/orchestrate.mjs"
