# Switch Auth Mode

Switch the local development environment between `stub` and `logto` auth modes. In stub mode, optionally switch between admin and user roles.

## Steps

### 1. Read current mode

Read `AUTH_MODE` and `DEV_USER_ROLE` from `apps/api/.env.local` to determine the current mode and role.

### 2. Select mode

**If arguments were provided**: parse them and use directly.
- `stub` → AUTH_MODE=stub, DEV_USER_ROLE=admin
- `stub user` → AUTH_MODE=stub, DEV_USER_ROLE=user
- `stub admin` → AUTH_MODE=stub, DEV_USER_ROLE=admin
- `logto` → AUTH_MODE=logto (DEV_USER_ROLE unchanged)

If the result matches the current mode+role exactly, report "already on <mode>" and stop.

**If no argument was provided**: use `AskUserQuestion` to let the user pick. Show all options with the current one marked as "(active)". List the most likely switch target first as recommended.

Options:
- **stub (admin)** — Hardcoded admin user, no Logto needed
- **stub (user)** — Hardcoded regular user, no Logto needed
- **logto** — Real auth via Logto OIDC

### 3. Update env files

Read each file first, then replace only the relevant values. Preserve all other settings.

**`apps/api/.env.local`:**
- Set `AUTH_MODE=<mode>`
- Set `DEV_USER_ROLE=<role>` (add if missing, set to `admin` or `user`)

**`apps/web/.env.local`:**
- Set `VITE_AUTH_MODE=<mode>`
- Set `VITE_DEV_USER_ROLE=<role>` (add if missing — this triggers Vite full page reload so the browser picks up the new user automatically)

### 4. Restart API

After updating env files, kill any process on the API port and restart:
```bash
lsof -ti :3010 | xargs kill 2>/dev/null
sleep 1
pnpm --filter @ternity/api dev &
```
Wait ~3 seconds, then verify the API is responding:
```bash
curl -s http://localhost:3010/health
```
This is more reliable than `touch` because it handles orphaned processes and guarantees the new env vars are loaded.

### 5. Open browser (logto → stub only)

If the **previous** mode was `logto` and the **new** mode is `stub`, the browser may be stuck on the Logto login page (different origin — Vite can't reload it). Open the app to bring the user back:
```bash
open http://localhost:5173
```
Skip this step for all other transitions (stub ↔ stub role switches, stub → logto).

### 6. Summary

Vite reloads automatically on `VITE_*` env changes. The API was explicitly restarted above.

```
Auth mode: <mode>
Dev user:  <role>

  apps/api/.env.local  → AUTH_MODE=<mode>, DEV_USER_ROLE=<role>
  apps/web/.env.local  → VITE_AUTH_MODE=<mode>, VITE_DEV_USER_ROLE=<role>
```

If mode is `logto`, add: `Logto must be running (docker container 'ternity-auth'). DEV_USER_ROLE is ignored in logto mode.`
