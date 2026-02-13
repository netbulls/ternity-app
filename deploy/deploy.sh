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

  # Build and start
  ssh "$SSH_HOST" "cd $REMOTE_BASE/$env && docker compose build && docker compose up -d"

  # Run migrations if requested
  if [[ "$MIGRATE" == true ]]; then
    echo "=== Running migrations ($env) ==="
    ssh "$SSH_HOST" "cd $REMOTE_BASE/$env && docker compose exec -w /app/apps/api api npx drizzle-kit migrate"
  fi

  echo "=== $env deployed ==="
}

update_caddy() {
  echo "=== Updating Caddy ==="
  local caddy_dir="/opt/erace-weather/docker"

  # Check if app routes already exist
  if ssh "$SSH_HOST" "grep -q 'ternity-app' $caddy_dir/Caddyfile 2>/dev/null"; then
    echo "App routes already in Caddyfile, skipping"
  else
    # Append app routes
    scp "$SCRIPT_DIR/Caddyfile.app" "$SSH_HOST:/tmp/Caddyfile.app.tmp"
    ssh "$SSH_HOST" "cat /tmp/Caddyfile.app.tmp >> $caddy_dir/Caddyfile && rm /tmp/Caddyfile.app.tmp"
    echo "App routes appended to Caddyfile"
  fi

  # Reload Caddy
  ssh "$SSH_HOST" "docker exec docker-caddy-1 caddy reload --config /etc/caddy/Caddyfile"
  echo "=== Caddy reloaded ==="
}

case "$ENV" in
  dev)
    sync_source
    deploy_env dev
    update_caddy
    ;;
  prod)
    sync_source
    deploy_env prod
    update_caddy
    ;;
  both)
    sync_source
    deploy_env dev
    deploy_env prod
    update_caddy
    ;;
  *)
    echo "Usage: $0 [dev|prod|both] [--migrate]"
    exit 1
    ;;
esac
