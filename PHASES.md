# Ternity — Phase Tracker

> Living document. Update checkboxes as work is completed.
> Source of truth for project progress. See `.claude/rules/phases.md` for conventions.

---

## Phase 0 — Foundation

Infrastructure, auth, layout, database, themes.

### Shared

- [x] Zod schema for AuthContext
- [x] Role enums (GlobalRole, OrgRole)
- [x] Theme definitions and constants

### Backend

- [x] Fastify server with CORS
- [x] PostgreSQL connection via Drizzle ORM
- [x] Full database schema (11 tables, 3 enums)
- [x] Initial migration + external_auth_id index
- [x] Auth plugin — stub mode (dev)
- [x] Auth plugin — Logto JWT validation (prod)
- [x] JIT user provisioning from Logto claims
- [x] Health endpoint (`GET /health`)
- [x] Me endpoint (`GET /api/me`)
- [x] Seed data (users, clients, projects, labels, leave types)

### Frontend

- [x] Vite + React + Tailwind setup
- [x] App shell with sidebar navigation
- [x] Hourglass logo component
- [x] Theme provider with localStorage persistence
- [x] 6 themes with CSS custom properties (`--t-*`)
- [x] Auth provider — stub mode (dev)
- [x] Auth provider — Logto OIDC flow (prod)
- [x] Callback page for Logto redirect
- [x] Settings page with theme selector
- [x] Router with all route stubs

---

## Phase 1 — Core Time Tracking 🔄

Timer start/stop, CRUD entries, API endpoints for time tracking.

### Shared

- [ ] Zod schemas for time entry (create, update, response)
- [ ] Zod schemas for project/client (response)
- [ ] Shared constants (duration limits, validation rules)

### Backend

- [ ] Time entries CRUD endpoints (POST, GET, PUT, DELETE)
- [ ] Start/stop timer endpoints
- [ ] Running timer state (per user)
- [ ] Project list endpoint (for selector)
- [ ] Label list endpoint (for selector)
- [ ] Input validation with shared Zod schemas
- [ ] Authorization checks (own entries only, manager override)

### Frontend

- [ ] Timer start/stop logic with live counter
- [ ] Task name input with project selector
- [ ] Label selector (multi-select)
- [ ] Today's entries list (real data via TanStack Query)
- [ ] Stats cards wired to real data (today, this week)
- [ ] Edit entry inline or via modal
- [ ] Delete entry with confirmation

---

## Phase 2 — Entry Management

History, filtering, deduplication.

### Shared

- [ ] Zod schemas for entry filters and pagination
- [ ] Deduplication scoring types

### Backend

- [ ] Paginated entry list endpoint with filters (date range, project, label)
- [ ] Entry search endpoint
- [ ] Deduplication detection (similar names)
- [ ] Merge entries endpoint

### Frontend

- [ ] Entries page — data table with TanStack Table
- [ ] Filter bar (date range, project, label, search)
- [ ] Pagination controls
- [ ] Deduplication suggestions UI
- [ ] Merge confirmation dialog
- [ ] Bulk actions (delete, re-label)

---

## Phase 3 — Leave Management

Leave requests, approvals, balances.

### Shared

- [ ] Zod schemas for leave request (create, update, response)
- [ ] Leave status enum (pending, approved, rejected)

### Backend

- [ ] Leave request CRUD endpoints
- [ ] Approval/rejection endpoint (manager role)
- [ ] Leave balance calculation endpoint
- [ ] Leave allowance management (admin)
- [ ] Overlap detection (conflicting leave dates)

### Frontend

- [ ] Leave page — request form (date range, leave type, note)
- [ ] My requests list with status badges
- [ ] Manager approval queue
- [ ] Leave balance display (remaining days per type)
- [ ] Leave calendar preview (mini calendar in form)

---

## Phase 4 — Reports & Calendar

Reports, FullCalendar integration, CSV export.

### Shared

- [ ] Zod schemas for report filters and response
- [ ] Report period types (day, week, month, year)

### Backend

- [ ] Report generation endpoint (grouped by project, period)
- [ ] Individual and team report scopes
- [ ] CSV export endpoint
- [ ] Calendar feed endpoint (leave + entries)

### Frontend

- [ ] Reports page — period selector and scope toggle
- [ ] Report table with project grouping
- [ ] Charts (hours per day/project)
- [ ] CSV export button
- [ ] Calendar page — FullCalendar integration
- [ ] Calendar overlays (leave, time entries)
- [ ] Shared team calendar (who's out)

---

## Phase 5 — Admin & Organization

Client/project CRUD, member management.

### Shared

- [ ] Zod schemas for client/project CRUD
- [ ] Zod schemas for member management

### Backend

- [ ] Client CRUD endpoints (admin only)
- [ ] Project CRUD endpoints (admin only)
- [ ] Member management endpoints (add/remove, assign role)
- [ ] Leave approver assignment endpoint
- [ ] Label management endpoints (admin)

### Frontend

- [ ] Projects page — client/project hierarchy view
- [ ] Client create/edit form
- [ ] Project create/edit form (with color picker)
- [ ] Member management table (per project)
- [ ] Role assignment UI (manager/user)
- [ ] Leave approver selector per project
- [ ] Label management UI

---

## Phase 6 — Polish & Integration

Jira integration, notifications, mobile optimization, production readiness.

### Shared

- [ ] Zod schemas for Jira integration config
- [ ] Notification types

### Backend

- [ ] Jira integration — push time entries
- [ ] Jira integration — pull tasks for entry creation
- [ ] Notification system (leave approvals, reminders)
- [ ] Rate limiting and security hardening
- [ ] Production logging and monitoring

### Frontend

- [ ] Jira settings page (connect instance, map projects)
- [ ] Notification center (bell icon + dropdown)
- [ ] Toast notifications for actions
- [ ] Mobile-responsive layout
- [ ] Error boundaries and offline handling
- [ ] Production build optimization
