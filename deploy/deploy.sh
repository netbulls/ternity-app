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
  echo "=== Updating proxy ==="
  scp "$SCRIPT_DIR/Caddyfile.app" "$SSH_HOST:/opt/proxy/sites-enabled/ternity-app.caddy"
  ssh "$SSH_HOST" "docker exec proxy-caddy caddy reload --config /etc/caddy/Caddyfile"
  echo "=== Proxy reloaded ==="
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
