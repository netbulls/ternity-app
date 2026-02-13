# CLAUDE.md

> **Do NOT run `/init` on this project** — it will overwrite these instructions.

## Project Overview

**Ternity** is a time tracking and holiday scheduling platform for small organizations. It combines Toggl-style start/stop time logging with Timetastic-style leave management under a unified Client → Project → Entry hierarchy. Built with Node/TypeScript for a small team. See `PRD.md` for full product requirements.

### Ternity Ecosystem

| Project | Purpose | URL (prod) |
|---|---|---|
| `netbulls.ternity.sandbox` | Main app (this repo) | app.ternity.xyz |
| `netbulls.ternity.auth` | Auth service (Logto OSS) | auth.ternity.xyz |
| `netbulls.ternity.www` | Marketing website + brand | ternity.xyz |

**VPS infrastructure** (shared proxy, network, VPS manifest) lives in `erace.vps.01` (`~/Projects/erace.vps.01`). Each project only manages its own Caddy fragment and compose files.

## Key Design Decisions

### Branding

Full brand guidelines in `BRAND.md` (copied from `netbulls.ternity.www`). Source of truth for branding is always the www project.

- **Logo assets:** `assets/brand/` — symbol, wordmark, and combo variants for all backgrounds
- **Primary colors:** Electric Teal `#00D4AA`, White `#ffffff`, Deep Charcoal `#0a0a0a`
- **Font:** Oxanium (Google Fonts) — 400/600/700 weights
- **Wordmark:** SVG paths, no font dependency

All SVGs are path-based and self-contained.

### Auth

- **Provider:** Logto OSS (self-hosted) — `netbulls.ternity.auth`
- **Dev:** `dev.auth.ternity.xyz`
- **Prod:** `auth.ternity.xyz`
- **Primary login:** Phone + SMS OTP (passwordless)
- **Social login:** Google OAuth
- **Recovery:** Email magic links
- **RBAC:** Global roles (admin) + Organization roles per project (manager, user)
- **Integration:** OIDC with `@logto/react` (frontend) + JWT validation (Fastify backend)

### Tech Stack

- **Frontend:** Vite + React + shadcn/ui + Tailwind CSS
- **Backend:** Node.js LTS + Fastify + Drizzle ORM
- **Database:** PostgreSQL 17+
- **Data tables:** TanStack Table + TanStack Query
- **Calendar:** FullCalendar (MIT)
- **Monorepo:** pnpm workspaces
- **Type sharing:** Shared Zod schemas in `/packages/shared`

### Themes

6 themes defined in `THEMES.md`. Default: Ternity Dark. All components use CSS custom properties (`--t-*`).

## Onboarding & Commands

### Slash Commands

| Command | What it does |
|---|---|
| `/project:setup` | First-time setup — prerequisites, install, DB, env files, migrations, dev servers |
| `/project:start` | Start PostgreSQL + dev servers |
| `/project:stop` | Stop all services cleanly (data preserved) |
| `/project:status` | Health check — Docker, DB, env files, dependencies, dev servers |
| `/project:build` | Full production build with type checking |
| `/project:refresh` | Post-pull — install deps, migrate, restart servers |
| `/project:logs` | Tail Docker container logs (optionally filter by service) |
| `/project:auth` | Switch auth mode between stub and logto (auto-reloads dev servers) |

### Shared Claude Config

All Claude Code configuration is committed to the repo so every developer gets the same experience:

- **`.claude/settings.json`** — Pre-approved permissions for standard dev workflows (pnpm, docker, git). No manual approval needed for everyday commands.
- **`.claude/rules/*.md`** — Project standards (versioning, environments, workflow, stack, directory boundaries). Loaded automatically.
- **`.claude/commands/*.md`** — Slash commands for common workflows.
- **`CLAUDE.md`** — Architecture context, design decisions, tech stack.

### Personal Overrides

Machine-specific settings (deploy permissions, template paths, SSH) go in `.claude/settings.local.json` (gitignored). This file merges with the shared settings — your personal additions won't conflict with the team config.

---

Standards for Directory Boundaries, Versioning, Environments, Workflow, and Stack are in `.claude/rules/*.md` — loaded automatically, do not duplicate here.

## Global Learnings

Cross-project learnings are stored at: `$CLAUDE_PROJECTS_HOME/LEARNINGS.md`

When the user says something is worth adding to global learnings, append it to that file with the project name and date. Always confirm with the user before writing.
