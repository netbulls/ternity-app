# Stop Development Environment

Stop all running development services cleanly.

## Steps

### 1. Dev servers

Find and kill any running pnpm/vite/node dev processes for this project:
```bash
lsof -ti :5173 | xargs kill 2>/dev/null
lsof -ti :3010 | xargs kill 2>/dev/null
```

Verify ports are free after stopping.

### 2. PostgreSQL

Stop the Docker containers:
```bash
docker compose down
```

This stops containers but preserves volumes (data is kept).

### 3. Confirm

Print:
```
All services stopped.

  Web server (5173)    stopped
  API server (3010)    stopped
  PostgreSQL (5432)    stopped

Data volumes preserved. Run /project:start to resume.
```
