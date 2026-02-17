# Authentication & Authorization

Complete reference for how auth works across all environments. Read this before touching auth code, env files, or Logto configuration.

## Architecture Overview

```
┌─────────────┐    OIDC PKCE     ┌──────────────┐
│  Frontend   │ ◄──────────────► │  Logto OSS   │
│ @logto/react│                  │ (self-hosted) │
└──────┬──────┘                  └──────────────┘
       │ Bearer JWT
       ▼
┌─────────────┐     DB lookup    ┌──────────────┐
│  Backend    │ ◄──────────────► │  PostgreSQL   │
│  Fastify    │  users table     │              │
└─────────────┘                  └──────────────┘
```

**Two auth modes** controlled by `AUTH_MODE` (API) and `VITE_AUTH_MODE` (web):

| Mode | When | How |
|---|---|---|
| `logto` | Dev/Prod (remote) | Real OIDC with Logto — JWT tokens, PKCE flow, M2M for provisioning |
| `stub` | Local development | No real auth — picks a DB user based on env vars, no tokens needed |

## Environments

### Logto Instances

Each remote environment has its own Logto instance with separate databases, users, and apps.

| | Local | Dev | Prod |
|---|---|---|---|
| **Logto endpoint** | `http://localhost:3001` | `https://dev.auth.ternity.xyz` | `https://auth.ternity.xyz` |
| **SPA App ID** | `268odhl238yx2fchaij1l` | `vo3wdlr5f8kdlj4zd8efl` | `9hn5dlkc0fbf3ry6kgwmc` |
| **API resource** | `https://api.ternity.xyz` | `https://api.ternity.xyz` | `https://api.ternity.xyz` |
| **Auth mode** | `stub` (default) | `logto` | `logto` |
| **Admin console** | `http://localhost:3002` | VPS port 3012 (SSH tunnel) | VPS port 3022 (SSH tunnel) |

The local Logto Docker container (`ternity-auth`) runs on ports 3001 (app) / 3002 (admin). It exists for testing the Logto flow locally but **`stub` mode is the default for local dev** — it's faster and doesn't require the Logto container to be running.

### Environment Files

**API** (`apps/api/.env.local`):
```bash
AUTH_MODE=stub              # or "logto"
DEV_USER_ROLE=admin         # stub mode: which role to use (admin|user)
DEV_ADMIN_ID=<uuid>         # stub mode: explicit admin user ID
DEV_USER_ID=<uuid>          # stub mode: explicit employee user ID
LOGTO_ENDPOINT=...          # logto mode: Logto endpoint URL
LOGTO_APP_ID=...            # logto mode: (currently unused by backend)
LOGTO_M2M_APP_ID=...        # logto mode: M2M app for Management API
LOGTO_M2M_APP_SECRET=...    # logto mode: M2M app secret
```

**Web** (`apps/web/.env.local`):
```bash
VITE_AUTH_MODE=stub          # or "logto"
VITE_LOGTO_ENDPOINT=...     # logto mode: Logto endpoint URL
VITE_LOGTO_APP_ID=...       # logto mode: SPA app ID
VITE_LOGTO_API_RESOURCE=https://api.ternity.xyz
```

**Switching modes:** Change `AUTH_MODE` and `VITE_AUTH_MODE` together. Both dev servers auto-restart on `.env.local` changes. The `/project:auth` slash command automates this.

## Stub Mode (Local Development)

Bypasses all real authentication. The API picks a user from the database and attaches it to every request — no tokens, no Logto interaction.

### User Resolution Order

1. **`X-Dev-User-Id` header** — explicit per-request override (used by impersonation)
2. **`DEV_ADMIN_ID` / `DEV_USER_ID`** — explicit user IDs per role, set in `.env.local`
3. **First user by role** — queries `users` table for first `globalRole` match, ordered by `createdAt`
4. **First user overall** — absolute fallback

### Test Users (Local DB)

| Name | Role | ID | Email | Entries | Notes |
|---|---|---|---|---|---|
| **Lukasz Lapinski** | admin | `2988d989-9885-4de7-8abe-7fc86d4d2830` | lukasz.lapinski@netbulls.io | 8,613 | **Default stub admin.** Synced from Toggl. Linked to local Logto. |
| **Przemyslaw Rudzki** | admin | `9012c24f-803a-48f5-99bb-394b66b0a7bf` | przemyslaw.rudzki@netbulls.io | — | Synced from Toggl. Linked to local Logto. |
| **Bartosz Klak** | user | `3033c1ca-03b6-471b-8766-a4545fd51356` | bartosz.klak@netbulls.io | 7,412 | **Default stub employee.** Synced from Toggl. Rich data for testing. |
| John Smith | user | `98ea0a01-fa43-4e8a-a39d-14fd2ca8caa5` | john@ternity.xyz | 0 | Phase 0 seed user. **Inactive.** No real data — do not use for testing. |

The `DEV_ADMIN_ID` and `DEV_USER_ID` env vars in `.env.local` point to Lukasz and Bartosz respectively. To switch personas, change `DEV_USER_ROLE`:
- `DEV_USER_ROLE=admin` → logs in as Lukasz Lapinski (admin with data)
- `DEV_USER_ROLE=user` → logs in as Bartosz Klak (employee with data)

### What Stub Mode Skips

- No OIDC flow, no tokens, no Logto SDK initialization
- No JWT validation — all API requests are trusted
- No JIT provisioning — user must already exist in the DB
- Frontend wraps children in a no-op provider (no `LogtoProvider` mounted)

## Logto Mode (Dev/Prod)

Real authentication via Logto OIDC with PKCE. Used on remote dev and prod environments, and optionally locally when testing the full auth flow.

### Login Flow

1. User clicks Sign In → frontend calls `logto.signIn(origin + '/callback')`
2. Logto shows login screen (phone OTP or Google OAuth)
3. After auth, redirects to `/callback` → `@logto/react` handles the code exchange
4. Frontend calls `logto.getAccessToken('https://api.ternity.xyz')` → receives a JWT
5. Frontend sends JWT as `Authorization: Bearer <token>` on every API request
6. Backend validates JWT signature, issuer, and audience via JWKS

### Frontend Auth State Machine

Located in `apps/web/src/providers/auth-provider.tsx`. Two-effect pattern to avoid flicker:

```
init → [SDK loads] → fetching → [/api/me succeeds] → done
                                 [/api/me fails]    → error (retry/sign-out buttons)
```

**Critical rules:**
- `logto.isLoading` must NEVER appear in the render `isLoading` formula — `getIdToken()` toggles it, causing flash
- Do NOT use `useRef` as eager guard before async fetch — React strict mode double-invokes effects
- `isLoading` is derived solely from the state machine: `status === 'init' || status === 'fetching'`

### Logto SDK Configuration

```typescript
const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,
  appId: import.meta.env.VITE_LOGTO_APP_ID,
  scopes: ['openid', 'profile', 'phone', 'email', 'urn:logto:scope:roles', 'admin'],
  resources: ['https://api.ternity.xyz'],
  prompt: Prompt.Login,
};
```

- **Resource indicator** `https://api.ternity.xyz` — requests a JWT access token scoped to our API (as opposed to an opaque token)
- **`urn:logto:scope:roles`** — includes the user's Logto roles in the JWT `roles` claim
- **`admin`** — custom API scope that admins have, checked by the backend
- **`Prompt.Login`** — always shows the login screen (no silent re-auth)

### Backend JWT Validation

Located in `apps/api/src/plugins/auth.ts`. Uses the `jose` library:

```typescript
const { payload } = await jwtVerify(token, jwks, {
  issuer: new URL('/oidc', endpoint).toString(),  // e.g., https://auth.ternity.xyz/oidc
  audience: 'https://api.ternity.xyz',
});
```

The JWT access token contains:
- `sub` — Logto user ID (e.g., `m0bpolojayw2`)
- `scope` — space-separated scopes (e.g., `openid profile admin`)
- `roles` — array of Logto role names (e.g., `["admin"]`)
- `aud` — `https://api.ternity.xyz`
- `iss` — `{LOGTO_ENDPOINT}/oidc`

**Important:** JWT access tokens do NOT contain profile fields (name, email, phone). These come from the database, populated by sync or JIT provisioning.

### JIT (Just-In-Time) User Provisioning

When a user logs in via Logto for the first time, the backend must create or link a DB user. The flow:

1. **Existing match by `external_auth_id`** — user has logged in before → update `globalRole` from token claims, return existing row
2. **Email auto-match** (new users only):
   a. Call Logto Management API to get the user's `primaryEmail`
   b. Find an unlinked DB user (`external_auth_id IS NULL`) with matching email
   c. Prefer rows with `toggl_id` (synced from Toggl) over plain matches
   d. Link by setting `external_auth_id = sub`
3. **Create new row** — if no match found, create with `displayName` from Logto or `'New User'`

**Email auto-match requires:**
- `LOGTO_M2M_APP_ID` and `LOGTO_M2M_APP_SECRET` env vars set on the API
- The Logto user must have `primaryEmail` set in their Logto profile
- An unlinked DB user with matching email must exist

**If auto-match fails** (M2M creds missing, no email, API error), a new minimal user row is created. This causes a duplicate profile that must be manually merged. **This is what happened on prod — see "Known Issues" below.**

### Management API (M2M)

The backend uses a Machine-to-Machine app to call the Logto Management API (for JIT email lookups). Token is cached with 60s margin before expiry.

```
POST {LOGTO_ENDPOINT}/oidc/token
  grant_type=client_credentials
  client_id={LOGTO_M2M_APP_ID}
  client_secret={LOGTO_M2M_APP_SECRET}
  resource=https://default.logto.app/api
  scope=all
```

Each environment has its own M2M app — the credentials are NOT shared across environments.

### Logto App Configuration (SPA)

Each environment has a separate SPA application in its Logto instance. Required settings:

- **Application type:** Single Page Application
- **Redirect URIs:** `{app_url}/callback` (e.g., `https://app.ternity.xyz/callback`)
- **Post sign-out redirect URIs:** `{app_url}` (e.g., `https://app.ternity.xyz`)
- **Custom client metadata:** `"alwaysIssueRefreshToken": true` — required for SPA to get refresh tokens
- **API resource:** `https://api.ternity.xyz` with scopes: `admin`

### Logto Admin Console Access

Admin consoles are not publicly exposed — access via SSH tunnel:

```bash
# Dev admin console
ssh -L 3012:localhost:3012 deploy@89.167.28.70
# → open http://localhost:3012

# Prod admin console
ssh -L 3022:localhost:3022 deploy@89.167.28.70
# → open http://localhost:3022

# Local (Docker)
# → open http://localhost:3002
```

## Authorization

### Roles

| Role | Scope | Who |
|---|---|---|
| `admin` (GlobalRole) | System-wide | Full access — manage users, projects, impersonate |
| `user` (GlobalRole) | System-wide | Standard employee — own time entries, leave requests |
| `manager` (OrgRole) | Per-project | Approve leave, view team reports for that project |
| `user` (OrgRole) | Per-project | Member of the project |

Global roles come from the Logto JWT (in logto mode) or from the `users.global_role` DB column (in stub mode). Org roles come from the `project_members` table.

### AuthContext

Every API request has `request.auth` populated with:

```typescript
interface AuthContext {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  globalRole: 'admin' | 'user';
  orgRoles: Record<string, 'manager' | 'user'>;  // projectId → role
  impersonating?: boolean;      // true when admin is impersonating
  realUserId?: string;          // the admin's real ID when impersonating
}
```

### Impersonation

Admins can view the app as another user by sending `X-Impersonate-User-Id` header. The backend validates:
1. Caller is an admin
2. Target user exists
3. Target is not the caller themselves

The header is set via `setImpersonateUserId()` in `lib/api.ts`. **Critical:** this must be called synchronously before `queryClient.invalidateQueries()` — not in a `useEffect`.

### Route Protection

- `/health` — no auth required (skipped in both modes)
- All other `/api/*` routes — auth required
- Frontend: `AppShell` component checks `isAuthenticated` / `isLoading` and shows login or loading screen

## Switching Between Modes

Use the `/project:auth` slash command, or manually:

1. Set `AUTH_MODE` in `apps/api/.env.local`
2. Set `VITE_AUTH_MODE` in `apps/web/.env.local`
3. Both must match (`stub`/`stub` or `logto`/`logto`)
4. Dev servers auto-restart on `.env.local` changes

**When switching from logto → stub:** Stale Logto tokens in localStorage are cleaned up automatically by `AuthProvider`.

**When switching from stub → logto:** A `ternity_force_signout` flag triggers a fresh Logto sign-in on next load.

## Known Issues & Gotchas

### Prod user mismatch (2026-02-17, fixed)
When Przemyslaw first logged into prod, M2M auto-match failed (likely M2M creds not configured yet). A duplicate "User" row was created. **Fix:** manually merged accounts in the DB — moved all FK references and linked the Logto sub to the correct synced profile. **Prevention:** always ensure `LOGTO_M2M_APP_ID` and `LOGTO_M2M_APP_SECRET` are set in the `.env` before any user logs in for the first time.

### Resource indicator trailing space
Early "invalid_target" errors were caused by a trailing space in the API resource URL in the Logto DB. The resource indicator mechanism works correctly — it was a data issue, not a SDK limitation.

### SPA refresh tokens
SPAs don't get refresh tokens by default in Logto. Must set `"alwaysIssueRefreshToken": true` in the app's `custom_client_metadata`. Without this, tokens expire and users get 401s with no way to silently refresh.

### React duplicate instances
`@logto/react` can cause duplicate React instances in pnpm monorepo. Fix: `resolve: { dedupe: ['react', 'react-dom'] }` in `vite.config.ts`.

### Logto Management API port
Use the default tenant port (3001 locally, or the main endpoint on remote). Do NOT use the admin console port (3002/3012/3022) — that's a separate tenant.

### 401 retry loop prevention
If a 401 occurs after token refresh, `auth-provider.tsx` uses `sessionStorage('ternity_auth_retry')` to prevent infinite redirect loops. On second failure, shows an error screen with Retry/Sign out buttons.

## File Reference

| File | What it does |
|---|---|
| `apps/api/src/plugins/auth.ts` | Fastify auth plugin — stub mode, logto JWT validation, JIT provisioning, impersonation |
| `apps/web/src/providers/auth-provider.tsx` | React auth context — stub provider, Logto state machine, `useAuth()` hook |
| `apps/web/src/providers/impersonation-provider.tsx` | Admin impersonation context — target state, transition animation, `useImpersonation()` hook |
| `apps/web/src/app.tsx` | LogtoProvider setup — config, scopes, resource indicators |
| `apps/web/src/pages/callback.tsx` | OIDC callback handler page |
| `apps/web/src/lib/api.ts` | API fetch wrapper — Bearer token injection, impersonation header |
| `packages/shared/src/auth.ts` | `AuthContext` Zod schema — shared between frontend and backend |
| `packages/shared/src/roles.ts` | `GlobalRole` and `OrgRole` enums |
| `docs/prd/auth-identity.md` | PRD for auth requirements |
