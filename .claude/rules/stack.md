<!-- rule-version: 1.0 -->
# Stack

## Tech Stack

- **Runtime:** Node.js 22.x LTS
- **Language:** TypeScript
- **Package manager:** pnpm
- **Monorepo:** pnpm workspaces
- **Frontend:** Vite + React + shadcn/ui + Tailwind CSS
- **Backend:** Fastify
- **Database:** PostgreSQL 17+ + Drizzle ORM + pg driver
- **Data tables:** TanStack Table + TanStack Query
- **Calendar:** FullCalendar (MIT edition)
- **Auth:** Logto OSS (self-hosted, `netbulls.ternity.auth`)
- **Auth integration:** `@logto/react` (frontend) + JWT validation (backend)
- **Type sharing:** Zod schemas in `/packages/shared`
- **Audience:** Small team

## Monorepo Structure

```
/apps/web        → Vite + React frontend
/apps/api        → Fastify backend
/packages/shared → Shared types, Zod schemas, constants
```

## Version Injection

```bash
git describe --tags --always
```

Injected at build time via Vite's `define` (frontend) and environment variable (backend).

## Workflow

### Checks

| Item | Command |
|---|---|
| **format** | `pnpm -r format` (Prettier) |
| **lint** | `pnpm -r lint` (ESLint) |
| **type-check** | `pnpm -r type-check` (tsc --noEmit) |
| **test** | `pnpm -r test` (Vitest) |

### Actions

| Action | Command |
|---|---|
| **build** | `pnpm -r build` |
| **deploy** | TBD (per environment) |

## Environments

| | dev | preview | prod |
|---|---|---|---|
| **config** | .env.local | .env.preview | .env.production |
| **build mode** | debug | debug | release |
| **build** | `pnpm -r build` | `pnpm -r build` | `pnpm -r build` |
| **deploy** | (local) | TBD | TBD |
| **app url** | localhost:5173 | TBD | app.ternity.xyz |
| **api url** | localhost:3000 | TBD | api.ternity.xyz |
| **auth url** | dev.auth.ternity.xyz | dev.auth.ternity.xyz | auth.ternity.xyz |
| **db** | local Postgres | TBD | managed Postgres |
