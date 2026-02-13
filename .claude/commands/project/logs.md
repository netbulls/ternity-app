# Tail Service Logs

Show recent logs from Docker containers. Useful for diagnosing database issues or checking container health.

## Behavior

The user may specify a service name as an argument (e.g., `/project:logs postgres`). If no argument is given, show logs from all containers.

## Steps

### 1. Check Docker is running

```bash
docker info > /dev/null 2>&1
```

If Docker isn't running, say so and stop.

### 2. Show logs

**If a service is specified** (e.g., `postgres`):
```bash
docker compose logs --tail=50 <service>
```

**If no service specified**, show logs for all services:
```bash
docker compose logs --tail=30
```

### 3. Interpret

After showing the logs, briefly summarize what's happening:
- Are there any errors or warnings?
- Is the service healthy?
- If there are connection refused errors, suggest checking if dependent services are running.

### Available services

These are the services defined in `docker-compose.yml`:
- `postgres` — PostgreSQL 17 database
