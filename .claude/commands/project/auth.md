# Switch Auth Mode

Switch the local development environment between `stub` and `logto` auth modes.

## Steps

### 1. Read current mode

Read `AUTH_MODE` from `apps/api/.env.local` to determine the current mode.

### 2. Select mode

**If an argument was provided** (`stub` or `logto`): use it directly. If it matches the current mode, report "already on <mode>" and stop.

**If no argument was provided**: use `AskUserQuestion` to let the user pick. Show both options with the current mode marked as "(active)" in its label. The other mode should be listed first as the recommended option since the user likely wants to switch.

### 3. Update env files

Read each file first, then replace only the auth mode values. Preserve all other settings.

**`apps/api/.env.local`:**
- Set `AUTH_MODE=<mode>`

**`apps/web/.env.local`:**
- Set `VITE_AUTH_MODE=<mode>`

### 4. Summary

Both dev servers auto-reload on env file changes (Vite watches `.env.local`, API uses `--watch-path=.env.local`), so no manual restart is needed.

```
Auth mode: <mode>

  apps/api/.env.local  → AUTH_MODE=<mode>
  apps/web/.env.local  → VITE_AUTH_MODE=<mode>
```

If mode is `logto`, add: `Logto must be running (docker container 'ternity-auth').`
