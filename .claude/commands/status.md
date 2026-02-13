# Environment Status Check

Run a quick health check of the local development environment. Check each item and print a summary table with pass/fail status and fix hints for any failures.

## Checks

Run all of these checks and collect results:

1. **Docker daemon** — `docker info` (suppress output, check exit code). Pass if Docker is running.
2. **PostgreSQL container** — `docker ps --filter name=ternity-postgres --format '{{.Status}}'`. Pass if container is running.
3. **DB connectivity** — `docker exec ternity-postgres pg_isready -U ternity -d ternity`. Pass if database accepts connections.
4. **API env file** — Check if `apps/api/.env.local` exists. Show the `AUTH_MODE` value if present.
5. **Web env file** — Check if `apps/web/.env.local` exists. Show the `VITE_AUTH_MODE` value if present.
6. **Dependencies** — Check if `node_modules` exists in the project root. If missing, suggest `pnpm install`.
7. **API server** — `curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/health`. Pass if returns 200.
8. **Web server** — `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173`. Pass if returns 200.

## Output

Print results as a table:

```
Environment Status
──────────────────────────────────

  Docker daemon      ✓ running
  PostgreSQL         ✓ running (Up 2 hours)
  DB connectivity    ✓ accepting connections
  API .env.local     ✓ present (auth: stub)
  Web .env.local     ✓ present (auth: stub)
  Dependencies       ✓ installed
  API server         ✓ responding (http://localhost:3010)
  Web server         ✓ responding (http://localhost:5173)
```

For any failures, add a hint line:

```
  PostgreSQL         ✗ not running
                     → Run: docker compose up -d
```

Common fix hints:
- Docker not running → "Start Docker Desktop or the Docker daemon"
- PostgreSQL not running → `docker compose up -d`
- DB not connectable → "Check if PostgreSQL container is healthy: `docker ps`"
- Env file missing → `Run /project:setup to create env files with defaults`
- Dependencies missing → `pnpm install`
- Servers not responding → `pnpm dev`
