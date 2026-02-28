#!/usr/bin/env bash
set -euo pipefail

# Ternity App — Deploy to VPS
# Usage: ./deploy.sh [dev|prod|both] [--migrate]

ENV="${1:-dev}"
MIGRATE=false
for arg in "$@"; do
  [[ "$arg" == "--migrate" ]] && MIGRATE=true
done

SSH_HOST="${SSH_HOST:-deploy@89.167.28.70}"
REMOTE_BASE="/opt/ternity-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_VERSION="$(cd "$PROJECT_ROOT" && git describe --tags --always 2>/dev/null || echo 'unknown')"

sync_source() {
  echo "=== Syncing source to VPS ==="
  ssh "$SSH_HOST" "mkdir -p $REMOTE_BASE/src"
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.env*' \
    --exclude='.claude' \
    --exclude='assets' \
    --exclude='*.png' \
    --exclude='*.jpg' \
    "$PROJECT_ROOT/" "$SSH_HOST:$REMOTE_BASE/src/"
  echo "=== Source synced ==="
}

deploy_env() {
  local env="$1"
  echo "=== Deploying $env ==="

  # Create remote directory
  ssh "$SSH_HOST" "mkdir -p $REMOTE_BASE/$env"

  # Sync docker-compose
  scp "$SCRIPT_DIR/$env/docker-compose.yml" "$SSH_HOST:$REMOTE_BASE/$env/"

  # Check .env exists remotely
  if ! ssh "$SSH_HOST" "test -f $REMOTE_BASE/$env/.env"; then
    echo "WARNING: No .env on server at $REMOTE_BASE/$env/.env"
    echo "Copy .env.example and fill in credentials first:"
    echo "  scp $SCRIPT_DIR/$env/.env.example $SSH_HOST:$REMOTE_BASE/$env/.env"
    echo "  ssh $SSH_HOST nano $REMOTE_BASE/$env/.env"
    return 1
  fi

  # Build and start (pass version + env name as build args)
  ssh "$SSH_HOST" "cd $REMOTE_BASE/$env && VITE_APP_VERSION=$APP_VERSION VITE_ENV_NAME=$env docker compose build && docker compose up -d"

  # Run migrations if requested
  if [[ "$MIGRATE" == true ]]; then
    echo "=== Running migrations ($env) ==="
    ssh "$SSH_HOST" "cd $REMOTE_BASE/$env && docker compose exec -w /app/apps/api api npx drizzle-kit migrate"
  fi

  echo "=== $env deployed ==="
}

update_caddy() {
  echo "=== Updating proxy ==="
  scp "$SCRIPT_DIR/Caddyfile.app" "$SSH_HOST:/opt/proxy/sites-enabled/ternity-app.caddy"
  ssh "$SSH_HOST" "docker exec proxy-caddy caddy reload --config /etc/caddy/Caddyfile"
  echo "=== Proxy reloaded ==="
}

# ── Post-deploy smoke checks ────────────────────────────────────────
DOMAINS_dev="dev.app.ternity.xyz"
DOMAINS_prod="app.ternity.xyz"
SPA_ROUTES="/ /entries /reports /calendar /leave /projects /users /downloads /settings"

verify_env() {
  local env="$1"
  local domain
  if [[ "$env" == "dev" ]]; then
    domain="$DOMAINS_dev"
  else
    domain="$DOMAINS_prod"
  fi
  local failed=0

  echo ""
  echo "=== Verifying $env ($domain) ==="

  # 1. Container health — all 3 services must be running
  echo -n "  Containers: "
  local running
  running=$(ssh "$SSH_HOST" "docker ps --filter name=ternity-app-${env} --filter status=running --format '{{.Names}}' | wc -l" | tr -d ' ')
  if [[ "$running" -ge 3 ]]; then
    echo "OK ($running running)"
  else
    echo "FAIL (only $running/3 running)"
    ssh "$SSH_HOST" "docker ps --filter name=ternity-app-${env} --format '{{.Names}} {{.Status}}'"
    failed=1
  fi

  # 2. API health — unauthenticated /health must return 200 + {"status":"ok"}
  echo -n "  API health: "
  local health_status health_body
  health_body=$(curl -s --max-time 10 "https://${domain}/health" 2>/dev/null || echo "TIMEOUT")
  if echo "$health_body" | grep -q '"status":"ok"'; then
    echo "OK"
  else
    echo "FAIL ($health_body)"
    failed=1
  fi

  # 3. SPA routes — each must return 200
  echo -n "  SPA routes: "
  local route_fails=0
  for route in $SPA_ROUTES; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${domain}${route}" 2>/dev/null || echo "000")
    if [[ "$code" != "200" ]]; then
      echo ""
      echo "    FAIL: ${route} → HTTP $code"
      route_fails=$((route_fails + 1))
    fi
  done
  if [[ "$route_fails" -eq 0 ]]; then
    local route_count
    route_count=$(echo $SPA_ROUTES | wc -w | tr -d ' ')
    echo "OK (${route_count}/${route_count} routes)"
  else
    failed=1
  fi

  # 4. API auth gate — /api/timer should return 401 (not 502/503)
  echo -n "  API auth:   "
  local api_code
  api_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${domain}/api/timer" 2>/dev/null || echo "000")
  if [[ "$api_code" == "401" ]]; then
    echo "OK (401 as expected)"
  else
    echo "FAIL (expected 401, got $api_code)"
    failed=1
  fi

  # 5. Error logs — check for any ERROR level in the last 30 seconds of API logs
  echo -n "  API errors: "
  local errors
  errors=$(ssh "$SSH_HOST" "docker logs ternity-app-${env}-api --since 30s 2>&1 | grep -ci 'error' || true" | tr -d ' ')
  if [[ "$errors" -eq 0 ]]; then
    echo "OK (none)"
  else
    echo "WARN ($errors error(s) in last 30s)"
    ssh "$SSH_HOST" "docker logs ternity-app-${env}-api --since 30s 2>&1 | grep -i 'error'" || true
  fi

  echo ""
  if [[ "$failed" -eq 0 ]]; then
    echo "=== $env verification PASSED ==="
  else
    echo "=== $env verification FAILED ==="
    return 1
  fi
}

case "$ENV" in
  dev)
    sync_source
    deploy_env dev
    update_caddy
    verify_env dev
    ;;
  prod)
    sync_source
    deploy_env prod
    update_caddy
    verify_env prod
    ;;
  both)
    sync_source
    deploy_env dev
    deploy_env prod
    update_caddy
    verify_env dev
    verify_env prod
    ;;
  *)
    echo "Usage: $0 [dev|prod|both] [--migrate]"
    exit 1
    ;;
esac
