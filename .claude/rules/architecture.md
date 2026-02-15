<!-- rule-version: 1.0 -->
# Architecture

Key technical decisions and patterns. Not general docs — only things that affect how you write code in this project.

## Auth: JWT Access Tokens with RBAC

- Frontend uses `getAccessToken('https://api.ternity.xyz')` → JWT with `aud`, `scope`, `roles`
- Backend validates with `audience: 'https://api.ternity.xyz'`
- **Resource indicators work** — an early "invalid_target" error was a trailing space in the DB, not a SDK limitation
- SPA needs `alwaysIssueRefreshToken: true` in Logto app `custom_client_metadata`
- SDK must explicitly request API scopes (e.g., `'admin'` in LogtoConfig scopes array)
- Logto Management API: use port 3001 (default tenant), NOT 3002 (admin tenant)

### React + Logto Auth State Machine

**Critical patterns** — violating these causes flicker or infinite loops:

- `logto.isLoading` must NEVER be in the `isLoading` render formula — `getIdToken()` toggles it, causing flicker
- Do NOT use `useRef` as eager guard before async fetch — React strict mode double-invokes effects
- **Working pattern:** Two-effect state machine in `auth-provider.tsx`:
  - Effect 1: detects "SDK done + not authenticated" → sets `status='done'`
  - Effect 2: depends only on `isAuthenticated`, fetches user profile (never reads `isLoading`)
  - `isLoading` derived from status machine only: `status === 'init' || status === 'fetching'`
  - Error state shows Retry/Sign out buttons (no infinite redirect loop)

### Impersonation

- `setImpersonateUserId()` must be called **synchronously** before `queryClient.invalidateQueries()` — not in a `useEffect`. Otherwise refetches fire before the header is set.
- `projectId` is nullable in `time_entries` — timer can start without a project.

## Vite Monorepo

- `@logto/react` can cause duplicate React instances in pnpm monorepo → fix with `resolve: { dedupe: ['react', 'react-dom'] }` in vite.config.ts
- `tsx watch` doesn't auto-load .env files → must use `--env-file=.env.local` flag in dev script (Node 22)

## Logto Config

| Environment | App ID | Endpoint |
|---|---|---|
| Local | `268odhl238yx2fchaij1l` | `http://localhost:3001` |
| Dev | `vo3wdlr5f8kdlj4zd8efl` | `https://dev.auth.ternity.xyz` |
| Prod | `9hn5dlkc0fbf3ry6kgwmc` | `https://auth.ternity.xyz` |

Scopes: `openid, profile, phone, email`

## Environment Files

- `apps/api/.env.local`: AUTH_MODE, LOGTO_ENDPOINT, LOGTO_APP_ID, DATABASE_URL, PORT, CORS_ORIGIN
- `apps/web/.env.local`: VITE_AUTH_MODE, VITE_LOGTO_ENDPOINT, VITE_LOGTO_APP_ID, VITE_API_URL
- Default auth mode: `stub` for local dev

## Running Services (Local Dev)

| Service | Port | Command |
|---|---|---|
| API | 3010 | `pnpm --filter @ternity/api dev` |
| Web | 5173 | `pnpm --filter @ternity/web dev` |
| Logto | 3001/3002 | Docker container `ternity-auth` |
| PostgreSQL | 5432 | db=ternity, user=ternity |

## Deployment

- VPS: `deploy@89.167.28.70`, base path `/opt/ternity-app/`
- Deploy script: `deploy/deploy.sh [dev|prod|both] [--migrate]`
- Same-domain routing: Caddy proxies `/api/*` and `/health` to API, rest to Web
- Docker Compose project names: `ternity-app-dev`, `ternity-app-prod`
