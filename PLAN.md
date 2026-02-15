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

### 1a. Staging schema (landing zone)

Separate tables for raw external data — never pollute Ternity's target tables with sync columns.

**Toggl staging tables:**
- `sync_toggl_users` — raw user data (id, email, name, etc.)
- `sync_toggl_clients` — raw clients
- `sync_toggl_projects` — raw projects (with toggl client_id, color, etc.)
- `sync_toggl_entries` — raw time entries (with toggl project_id, user_id, tags, etc.)

**Timetastic staging tables:**
- `sync_tt_users` — raw user data (id, email, name, department, etc.)
- `sync_tt_leave_types` — raw leave types
- `sync_tt_absences` — raw absences (with timetastic user_id, leave_type_id, status, etc.)
- `sync_tt_allowances` — raw allowances (per user, per type, per year)

**Sync infrastructure:**
- `sync_runs` — `id`, `source`, `type` (full/incremental), `step` (extract/transform), `started_at`, `finished_at`, `status`, `records_processed`, `errors`
- `sync_mappings` — `source`, `external_id`, `ternity_table`, `ternity_id` (links staged records to target records)
- `users` table gets `toggl_id`, `timetastic_id` columns (user matching is the bridge between systems)

All staging tables have: `external_id` (PK from source), `raw_data` (JSONB, full API response), `synced_at`, `sync_run_id`.

### 1b. Extract — Toggl
- `apps/api/src/sync/toggl/extract.ts`
- Pull users, clients, projects, time entries from Toggl API v9
- Time entries via Reports API v3 (paginated)
- Upsert into `sync_toggl_*` staging tables (idempotent by external_id)
- Incremental mode: use `since` parameter for entries modified after last sync
- Full mode: dump everything

### 1c. Extract — Timetastic
- `apps/api/src/sync/timetastic/extract.ts`
- Pull users, leave types, absences (31-day windows), allowances
- Upsert into `sync_tt_*` staging tables (idempotent by external_id)
- Incremental mode: re-pull rolling 60-day window
- Full mode: walk entire history

### 1d. User matching
- `apps/api/src/sync/users.ts`
- Match staged users (`sync_toggl_users`, `sync_tt_users`) to Ternity `users` by email
- Create unmatched users as Ternity records (no Logto account, `external_auth_id` = null)
- Write `toggl_id` / `timetastic_id` to the `users` table
- Validation report: list matched, created, and unresolvable users before proceeding
- Must run before transform step (entries reference users)

### 1e. Transform — staging → target
- `apps/api/src/sync/transform.ts`
- Read from staging tables, write to Ternity target tables
- **Toggl:** `sync_toggl_clients` → `clients`, `sync_toggl_projects` → `projects`, `sync_toggl_entries` → `time_entries` + `entry_labels`
- **Timetastic:** `sync_tt_leave_types` → `leave_types`, `sync_tt_absences` → `leave_requests`, `sync_tt_allowances` → `leave_allowances`
- Tags → `labels` (create if new, flat tags become Ternity labels)
- Write `sync_mappings` entries to track which staging record produced which target record
- Idempotent: check mappings before inserting, update if source data changed

### 1f. CLI commands
- `pnpm sync:extract [toggl|timetastic|all] [--full]` — extract step only
- `pnpm sync:transform` — transform staged data into target tables
- `pnpm sync:run [--full]` — full pipeline: extract → user match → transform
- `pnpm sync:users` — user matching report only (dry run)
- Reads credentials from `.env.sync` (gitignored)

### 1f. Viewer mode flag
- Add `VIEWER_MODE` env var (API) and `VITE_VIEWER_MODE` (web)
- API: middleware rejects all mutation requests (POST/PATCH/DELETE on data endpoints) when viewer mode is on
- Web: flag available via context for UI phases to disable edit controls
- Prod deploys with `VIEWER_MODE=true` until native features replace sync

**Verify:**
1. `pnpm sync:extract all --full` → staging tables populated with raw data from both APIs
2. `pnpm sync:users` → user matching report shows all users matched by email
3. `pnpm sync:transform` → target tables populated with clean Ternity records
4. `pnpm sync:run --full` again → no duplicates, `sync_mappings` intact
5. Check `sync_runs` table for status of each step

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

### Sync layer (Phase 1 — pending)

```
-- User matching (columns on existing table)
users + toggl_id, timetastic_id

-- Toggl staging (landing zone)
sync_toggl_users    (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_toggl_clients  (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_toggl_projects (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_toggl_entries  (external_id PK, raw_data JSONB, synced_at, sync_run_id)

-- Timetastic staging (landing zone)
sync_tt_users       (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_tt_leave_types (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_tt_absences    (external_id PK, raw_data JSONB, synced_at, sync_run_id)
sync_tt_allowances  (external_id PK, raw_data JSONB, synced_at, sync_run_id)

-- Sync infrastructure
sync_runs     (id, source, type, step, started_at, finished_at, status, records_processed, errors)
sync_mappings (source, external_id, ternity_table, ternity_id)
```

---

## Critical References

- `assets/design-preview.html` — visual reference for all components
- `PRD.md` — feature source of truth
- `BRAND.md` — brand guidelines
- `THEMES.md` — theme definitions
- `.claude/rules/stack.md` — tech stack and build commands
