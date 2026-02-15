# Refresh Development Environment

The "I just pulled" command. Bring the local environment up to date after pulling new changes, without repeating first-time setup steps.

## Steps

### 1. Install dependencies

Run install to pick up any new/changed packages:
```bash
pnpm install
```

If the lockfile changed, this will update `node_modules`. If nothing changed, it's a fast no-op.

### 2. Run migrations

Apply any new database migrations:
```bash
pnpm db:migrate
```

This is idempotent — already-applied migrations are skipped.

**Prerequisite:** PostgreSQL must be running. If the migration fails with a connection error, suggest running `/project:start` first.

### 3. Restart dev servers

Stop any running dev servers (ports 5173 and 3010):
```bash
lsof -ti :5173 | xargs kill 2>/dev/null
lsof -ti :3010 | xargs kill 2>/dev/null
```

Start fresh:
```bash
pnpm dev
```

Wait ~5 seconds, verify both respond:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173` — expect 200
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/health` — expect 200

### 4. Summary

Print:
```
Environment refreshed.

  Dependencies   updated
  Migrations     applied
  Web server     http://localhost:5173
  API server     http://localhost:3010
```
