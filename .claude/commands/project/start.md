# Start Development Environment

Start all services needed for local development. Skip anything that's already running.

## Steps

### 1. PostgreSQL

Check if `ternity-postgres` is already running:
```bash
docker ps --filter name=ternity-postgres --format '{{.Status}}'
```

If not running, start it:
```bash
docker compose up -d
```

Wait a few seconds, then verify the container is healthy:
```bash
docker exec ternity-postgres pg_isready -U ternity -d ternity
```

If it doesn't become ready within ~10 seconds, stop and show `docker logs ternity-postgres`.

### 2. Dev servers

Start the dev servers in background:
```bash
pnpm dev
```

Wait ~5 seconds, then verify both respond:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173` — expect 200
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/health` — expect 200

### 3. Summary

Print:
```
Services running:

  PostgreSQL   http://localhost:5432
  Web          http://localhost:5173
  API          http://localhost:3010

Auth mode: <read from apps/web/.env.local VITE_AUTH_MODE>
```
