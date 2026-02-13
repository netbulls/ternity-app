# Local Environment Setup

Walk the developer through a fully working local environment. Run each step sequentially, stopping on failure with a clear fix suggestion.

## Steps

### 1. Prerequisites

Check that required tools are installed and meet version requirements:

- **Node.js 22.x** — run `node --version` and verify major version is 22. If missing or wrong version, suggest using `nvm install 22` or `corepack enable`.
- **pnpm 9.x** — run `pnpm --version` and verify major version is 9. If missing, suggest `corepack enable && corepack prepare pnpm@9.15.4 --activate`.
- **Docker running** — run `docker info` (suppress output, check exit code). If Docker is not running, tell the user to start Docker Desktop or the Docker daemon.

If any prerequisite fails, stop and explain how to fix it before continuing.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL

Check if the `ternity-postgres` container is already running (`docker ps --filter name=ternity-postgres --format '{{.Status}}'`). If not running:

```bash
docker compose up -d
```

Wait a few seconds, then verify the container is healthy.

### 4. Create environment files

Create each file **only if it does not already exist**. If it exists, skip it and note that it was preserved.

**`apps/api/.env.local`:**
```env
AUTH_MODE=stub
LOGTO_ENDPOINT=http://localhost:3001
LOGTO_APP_ID=your-logto-app-id
DATABASE_URL=postgres://ternity:ternity@localhost:5432/ternity
PORT=3010
CORS_ORIGIN=http://localhost:5173
```

**`apps/web/.env.local`:**
```env
VITE_AUTH_MODE=stub
VITE_LOGTO_ENDPOINT=http://localhost:3001
VITE_LOGTO_APP_ID=your-logto-app-id
VITE_API_URL=http://localhost:3010
```

### 5. Database migrations and seed

Run migrations:
```bash
pnpm db:migrate
```

Run seed (handle "already seeded" gracefully — if the seed command fails because data already exists, that's fine, just note it):
```bash
pnpm db:seed
```

### 6. Verify dev servers

Start the dev servers in background:
```bash
pnpm dev
```

Wait ~5 seconds, then verify both servers respond:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173` — expect 200
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/health` — expect 200

If either fails, check the console output for errors.

### 7. Summary

Print a summary:

```
Setup complete!

  Web:  http://localhost:5173
  API:  http://localhost:3010
  DB:   postgres://localhost:5432/ternity
  Auth: stub mode (no Logto needed)

Next steps:
  - The dev servers are running. Open http://localhost:5173 in your browser.
  - Run /project:status anytime to check environment health.
  - To use real auth, set AUTH_MODE=logto in your .env.local files
    and configure a Logto instance (see README.md → Auth Setup).
```
