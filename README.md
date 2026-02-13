# Ternity

Time tracking and holiday scheduling platform for small organizations. Combines Toggl-style start/stop time logging with Timetastic-style leave management under a unified Client > Project > Entry hierarchy.

## Ecosystem

| Project | Purpose | URL (prod) |
|---|---|---|
| `netbulls/ternity` | Main app (this repo) | app.ternity.xyz |
| `netbulls/ternity-auth` | Auth service (Logto OSS) | auth.ternity.xyz |
| `netbulls/ternity-www` | Marketing website + brand | ternity.xyz |

## Prerequisites

- **Node.js** 22.x LTS
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Docker** (for local PostgreSQL and optional Logto)
- **PostgreSQL** 17+ (via Docker or local install)

## Getting Started

### 1. Clone and install

```bash
git clone git@github.com:netbulls/ternity.git
cd ternity
pnpm install
```

### 2. Start local database

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with database `ternity`, user `ternity`, password `ternity`.

### 3. Configure environment

Create environment files from the examples:

**API** (`apps/api/.env.local`):
```env
AUTH_MODE=stub
LOGTO_ENDPOINT=http://localhost:3001
LOGTO_APP_ID=your-logto-app-id
DATABASE_URL=postgres://ternity:ternity@localhost:5432/ternity
PORT=3010
CORS_ORIGIN=http://localhost:5173
```

**Web** (`apps/web/.env.local`):
```env
VITE_AUTH_MODE=stub
VITE_LOGTO_ENDPOINT=http://localhost:3001
VITE_LOGTO_APP_ID=your-logto-app-id
VITE_API_URL=http://localhost:3010
```

Set `AUTH_MODE=stub` / `VITE_AUTH_MODE=stub` to bypass Logto during development. Switch to `logto` when you have a Logto instance configured.

### 4. Run migrations and seed

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Start dev servers

```bash
pnpm dev
```

This starts both services in parallel:
- **Web:** http://localhost:5173
- **API:** http://localhost:3010

## Auth Setup

Ternity uses [Logto OSS](https://logto.io/) (self-hosted) for authentication.

**For local development**, use `stub` auth mode — no Logto instance needed.

**To run with Logto locally:**

1. Set up a Logto instance (see `netbulls/ternity-auth`)
2. Create a Traditional Web application in Logto admin console
3. Set the app ID in your `.env.local` files
4. Switch `AUTH_MODE` / `VITE_AUTH_MODE` to `logto`

Login methods: Phone + SMS OTP (primary), Google OAuth (social), Email magic links (recovery).

## Claude Code Setup

This project includes Claude Code configuration for consistent AI-assisted development across the team.

### First time setup

1. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
2. Run `claude` in the project root

### Template standards

The project uses the `base` template from `erace.claude.templates`. If you manage templates locally, add the templates path to your personal settings:

Create `.claude/settings.local.json` (gitignored):
```json
{
  "permissions": {
    "additionalDirectories": [
      "/path/to/your/erace.claude.templates"
    ]
  }
}
```

### What's included

- `.claude/settings.json` — Shared permissions and tool allowlists
- `.claude/rules/*.md` — Project standards (versioning, environments, workflow, stack, directory boundaries)
- `CLAUDE.md` — Project-specific instructions and architecture decisions

## Project Structure

```
ternity/
├── apps/
│   ├── api/          # Fastify backend (Node.js)
│   │   └── src/
│   │       ├── db/       # Drizzle ORM schemas, migrations, seed
│   │       ├── plugins/  # Fastify plugins (auth, etc.)
│   │       └── routes/   # API route handlers
│   └── web/          # Vite + React frontend
│       └── src/
│           ├── components/  # UI components (shadcn/ui)
│           ├── pages/       # Route pages
│           ├── providers/   # React context providers
│           └── styles/      # CSS + theme definitions
├── packages/
│   └── shared/       # Shared types, Zod schemas, constants
├── deploy/           # Deployment configs (dev/prod Docker Compose + scripts)
├── assets/           # Brand assets (logos, icons)
└── docker-compose.yml  # Local dev services (PostgreSQL)
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Run Prettier across all packages |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run tests (Vitest) |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database with sample data |

## Deployment

Deployed to a VPS via `deploy/deploy.sh`:

```bash
./deploy/deploy.sh dev          # Deploy to dev
./deploy/deploy.sh prod         # Deploy to prod
./deploy/deploy.sh both         # Deploy to both
./deploy/deploy.sh dev --migrate  # Deploy + run migrations
```

Environment configs: `deploy/dev/.env.example` and `deploy/prod/.env.example`.

## Tech Stack

- **Frontend:** Vite + React 19 + shadcn/ui + Tailwind CSS
- **Backend:** Fastify 5 + Drizzle ORM + PostgreSQL 17
- **Auth:** Logto OSS (`@logto/react` + JWT validation)
- **Type sharing:** Zod schemas in `packages/shared`
- **Monorepo:** pnpm workspaces
