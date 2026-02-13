# Ternity — Implementation Plan

## Context

Ternity has complete product documentation (PRD, brand, themes, tech stack) and a working monorepo scaffold with auth integration. The team currently uses Toggl Track (time tracking) and Timetastic (leave management) daily. Ternity replaces both, but the migration is gradual — sync real data first, build UI around it, then cut over.

## Approach

- **Auth-independent first** — stub auth, swap in real Logto later with zero component changes
- **Real data first** — sync from Toggl/Timetastic before building UI, so every screen shows actual team data from day one
- **Vertical slices** — each phase delivers a working feature (schema → API → UI)
- **Strangler fig migration** — team keeps using existing tools while Ternity is built out; prod is read-only viewer until native features are ready

---

## Phase 0: Monorepo Scaffold ✅

**Goal:** Running dev environment — both frontend and backend start, connect, share types.

**Deliverables:**
- Root: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.prettierrc`, `.eslintrc.cjs`, `docker-compose.yml` (Postgres on 5432)
- `packages/shared/` — Zod schemas for `AuthContext`, role constants, theme IDs
- `apps/api/` — Fastify server on port 3000, auth stub plugin (`AUTH_MODE=stub` reads `X-Dev-User-Id` header), Drizzle + pg setup, health route
- `apps/web/` — Vite + React on 5173, shadcn/ui init, Tailwind, themes.css wired in, `ThemeProvider`, `AuthProvider` (stub), app shell layout (sidebar + main area matching `design-preview.html`)
- **Foundation DB tables:** `users`, `clients`, `projects`, `project_members`, `labels`
- Seed: 2 users, 2 clients, 3 projects, 5 labels

**Verify:** `pnpm dev` starts both apps, sidebar renders with theme switching, `/health` returns OK, types shared across packages.

---

## Phase 1: Data Sync — Toggl & Timetastic ⬜

**Goal:** Import real team data from Toggl Track and Timetastic into Ternity's DB. CLI-driven, no UI yet.

**Deliverables:**

### 1a. Schema extensions
- Add sync tracking columns: `external_source`, `external_id` on `time_entries` and `leave_requests`
- Add `toggl_id`, `timetastic_id` on `users` (a user exists in both systems)
- Add `sync_runs` table: `id`, `source` (toggl/timetastic), `type` (full/incremental), `started_at`, `finished_at`, `status`, `records_synced`, `errors`
- Migration for all new columns

### 1b. User matching
- Pull users from Toggl API (`GET /organizations/{org_id}/users`) and Timetastic API (`GET /users`)
- Match to Ternity users by email
- Create unmatched users as Ternity records (no Logto account, `external_auth_id` = null)
- Validation report: list matched, created, and unresolvable users before proceeding

### 1c. Toggl sync adapter
- `apps/api/src/sync/toggl/` — adapter module
- Pull clients → upsert `clients`
- Pull projects → upsert `projects` (link to client, preserve color)
- Pull time entries via Reports API v3 (paginated) → translate to `time_entries` with `entry_labels`
- Tags → `labels` (create if new)
- Incremental mode: use `since` parameter for entries modified after last sync
- Idempotent: external_id prevents duplicates on re-run

### 1d. Timetastic sync adapter
- `apps/api/src/sync/timetastic/` — adapter module
- Pull leave types → upsert `leave_types`
- Pull absences in 31-day windows → translate to `leave_requests` (status mapping: Approved/Pending/Declined)
- Pull allowances → upsert `leave_allowances` (per-user, per-type, per-year)
- Incremental mode: re-pull rolling 60-day window, compare and upsert
- Departments stored as user metadata for reference

### 1e. CLI commands
- `pnpm sync:toggl [--full]` — incremental by default, `--full` for historical dump
- `pnpm sync:timetastic [--full]` — same
- `pnpm sync:all` — run both sequentially
- `pnpm sync:users` — user matching report only (dry run)
- Reads credentials from `.env.sync` (gitignored)

### 1f. Viewer mode flag
- Add `VIEWER_MODE` env var (API) and `VITE_VIEWER_MODE` (web)
- API: middleware rejects all mutation requests (POST/PATCH/DELETE on data endpoints) when viewer mode is on
- Web: flag available via context for UI phases to disable edit controls
- Prod deploys with `VIEWER_MODE=true` until native features replace sync

**Verify:** Run `pnpm sync:all --full` → DB contains real team data (clients, projects, entries, leave). Run again → no duplicates. Check `sync_runs` table for status.

**API rate limits:** Toggl 240 req/hr (comfortable), Timetastic 1 req/sec on absences (comfortable for ~75 users).

---

## Phase 2: Timer and Time Entries ⬜

**Goal:** Start/stop timer, entries saved to DB, today's entries in a table. Real synced data visible alongside new entries.

**Deliverables:**
- DB: `time_entries`, `entry_labels` tables (schema exists from Phase 0, extended in Phase 1)
- API: `POST /api/timer/start`, `POST /api/timer/stop`, `GET /api/timer/active`, entries CRUD (`GET/POST/PATCH/DELETE /api/entries`), `GET /api/projects`, `GET /api/labels`
- UI: Timer bar (task input, project picker, label picker, elapsed time, stop button), entry table (TanStack Table), stats row (today total, week total, leave placeholder), manual entry dialog
- Viewer mode: timer and manual entry disabled, entry table is read-only, synced entries show source badge
- Hooks: `useTimer`, `useEntries` (TanStack Query)

**Verify:** Start timer → ticking display → stop → entry in table with correct duration. Manual entry works. Stats show correct totals. In viewer mode: timer hidden, entries read-only.

---

## Phase 3: Entry Management & Day/Week Views ⬜

**Goal:** Edit entries, navigate days/weeks, deduplication suggestions.

**Deliverables:**
- Entries page with filters (date range, project, labels)
- Inline editing of entry description/times (disabled in viewer mode)
- Day/week toggle with navigation
- Week view grouped by day with subtotals
- Basic dedup: `GET /api/entries/duplicates`, `POST /api/entries/merge`, merge dialog
- Synced entries visually distinguished (source indicator, edit restrictions)

**Verify:** Navigate between days, switch to week view, edit entry inline, merge two similar entries. Synced entries cannot be edited in viewer mode.

**Can run in parallel with Phase 4** (different tables, different pages).

---

## Phase 4: Leave Management ⬜

**Goal:** Request time off, manager approves, balance tracked. Real Timetastic leave data visible.

**Deliverables:**
- DB: `leave_types`, `leave_allowances`, `leave_requests` tables (schema exists from Phase 0, extended in Phase 1)
- API: leave CRUD, approval endpoint (manager-only), allowances
- UI: Leave page (my requests + pending approvals tabs), request dialog (matching design-preview), approval cards, balance cards
- Viewer mode: request/approve actions disabled, leave history and balances are read-only
- Auth stub enhancement: dev-only toolbar to switch between Employee/Manager personas
- Timer stats: leave balance card now shows real data

**Verify:** Submit request as employee → switch to manager → approve → balance updates. In viewer mode: synced leave visible, request button disabled.

---

## Phase 5: Calendar & Reports ⬜

**Goal:** Who's out calendar, reports with filters and charts. Works in viewer mode (read-only data is perfect for reports).

**Deliverables:**
- Calendar page: FullCalendar showing approved leave, month/week toggle, project filter
- Reports page: period selector (day/week/month/year), scope (individual/group), project/label filters
- Report table grouped by project with subtotals
- Bar chart (hours per day) using shadcn chart primitives + `--chart-*` theme vars
- CSV export
- Reports work identically in viewer mode (no mutations involved)

**Verify:** Calendar shows leave events, reports filter correctly, chart uses theme colors, CSV downloads. Reports work with synced data.

---

## Phase 6: Logto Integration & Admin ⬜ (auth done, admin pending)

**Goal:** Real auth replaces stub. Admin pages for org management.

**Deliverables:**
- ~~Frontend: `@logto/react` in AuthProvider (when `VITE_AUTH_MODE=logto`), callback page, real Bearer tokens~~ ✅
- ~~Backend: JWT validation via `jose` against Logto JWKS, org role extraction from tokens~~ ✅
- ~~User sync: JIT provisioning on first authenticated request~~ ✅
- Admin pages: client CRUD, project CRUD, member management with roles
- Settings page: profile, theme preference (persisted to DB)
- Sync admin: status dashboard, last sync time, error log, manual trigger

**Verify:** Full login flow via phone/Google, API validates real tokens, admin can manage orgs.

---

## Phase 7: Polish & Edge Cases ⬜

- Error boundaries, loading skeletons, toast notifications
- Timer edge cases (midnight rollover, multi-tab, offline queue)
- Responsive design (sidebar collapse, card layouts on mobile)
- DB indexes on hot queries
- Jira integration foundation (API-only, no UI)
- Sync edge cases: timezone normalization, deleted entries in source, conflict resolution

---

## Auth Stub Strategy

**Backend:** Fastify plugin checks `AUTH_MODE` env var. In `stub` mode, reads `X-Dev-User-Id` header or `DEV_USER_ROLE` env var (defaults to admin seed user), attaches typed `AuthContext` matching real Logto JWT shape. In `logto` mode, validates JWT via JWKS.

**Frontend:** `AuthProvider` context. In `stub` mode, provides user from `/api/me` + no-op signIn/signOut. In `logto` mode, delegates to `@logto/react`. Components only use `useAuth()` — never import Logto directly.

**Switch:** `/project:auth` command. Zero component changes.

---

## DB Schema

### Foundation tables (Phase 0 — migrated)

```
users (id, external_auth_id, display_name, email, phone, avatar_url, global_role, theme_preference)
clients (id, name)
projects (id, client_id FK, name, color)
project_members (user_id FK, project_id FK, role enum)
labels (id, name, color)
time_entries (id, user_id FK, project_id FK, description, started_at, stopped_at, duration_seconds)
entry_labels (entry_id FK, label_id FK)
leave_types (id, name, days_per_year)
leave_allowances (id, user_id FK, leave_type_id FK, year, total_days, used_days)
leave_requests (id, user_id FK, project_id FK, leave_type_id FK, start_date, end_date, days_count, note, status, reviewed_by FK, reviewed_at)
```

### Sync extensions (Phase 1 — pending)

```
-- New columns on existing tables
users          + toggl_id, timetastic_id
time_entries   + external_source, external_id
leave_requests + external_source, external_id

-- New table
sync_runs (id, source, type, started_at, finished_at, status, records_synced, errors)
```

---

## Critical References

- `assets/design-preview.html` — visual reference for all components
- `PRD.md` — feature source of truth
- `BRAND.md` — brand guidelines
- `THEMES.md` — theme definitions
- `.claude/rules/stack.md` — tech stack and build commands
