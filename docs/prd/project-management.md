# Project Management

## Problem

All 39 projects and 24 clients were bulk-imported from Toggl — spanning 6 years of history. Many are stale, renamed, or irrelevant. There's no way to create new projects, archive old ones, or control what appears in the project picker. Users see every project ever created when logging time.

## Solution

Admin-only CRUD for clients and projects with active/inactive status. Inactive clients and projects are hidden from all pickers and selectors across the app. Historical time entries referencing inactive projects remain intact — only forward-facing UI is filtered.

## Data Model

### Active/Inactive Status

Both `clients` and `projects` get an `isActive` boolean (default `true`).

**Cascade rule:** When a client is deactivated, all its projects are hidden from pickers — regardless of each project's own `isActive` flag. A project is visible in pickers only when **both** the project and its parent client are active.

Historical data is never affected — time entries, audit logs, and reports continue to show the project/client name as recorded.

### Schema Changes

```
clients
  + is_active    boolean NOT NULL DEFAULT true

projects
  + is_active    boolean NOT NULL DEFAULT true
  + description  text              -- optional project description
```

## Permissions

- **Who can manage:** Admin only (global `admin` role)
- **Who can view:** All authenticated users can see the list of active clients/projects (for picker purposes). Admin sees all (active + inactive) in the management UI.

## Features

### Client Management (Admin)

| Action                    | Details                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **List**                  | All clients with project count, entry count, active/inactive status                                       |
| **Create**                | Name (required)                                                                                           |
| **Edit**                  | Rename                                                                                                    |
| **Activate / Deactivate** | Toggle `isActive`. Deactivating hides the client and all its projects from pickers. Does not delete data. |

### Project Management (Admin)

| Action                    | Details                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **List**                  | All projects grouped by client, with entry count, active/inactive status, color                  |
| **Create**                | Name (required), client (required), color (optional, default brand teal), description (optional) |
| **Edit**                  | Name, client (reassign), color, description                                                      |
| **Activate / Deactivate** | Toggle `isActive`. Deactivating hides the project from pickers. Does not delete data.            |

### Picker Filtering

The project picker (used in timer bar, entry row, manual entry dialog) shows only projects where:

1. `projects.isActive = true`
2. `clients.isActive = true` (parent client is also active)

The reference/picker API endpoint applies this filter server-side. Admin management endpoints return all records regardless of status.

## API Endpoints

### Clients

| Method | Path                          | Description                                      |
| ------ | ----------------------------- | ------------------------------------------------ |
| GET    | `/api/clients`                | List all clients (admin: all; user: active only) |
| POST   | `/api/clients`                | Create client (admin)                            |
| PATCH  | `/api/clients/:id`            | Update client (admin)                            |
| PATCH  | `/api/clients/:id/activate`   | Activate client (admin)                          |
| PATCH  | `/api/clients/:id/deactivate` | Deactivate client (admin)                        |

### Projects

| Method | Path                           | Description                                                           |
| ------ | ------------------------------ | --------------------------------------------------------------------- |
| GET    | `/api/projects`                | List all projects (admin: all; user: active only, with active client) |
| POST   | `/api/projects`                | Create project (admin)                                                |
| PATCH  | `/api/projects/:id`            | Update project (admin)                                                |
| PATCH  | `/api/projects/:id/activate`   | Activate project (admin)                                              |
| PATCH  | `/api/projects/:id/deactivate` | Deactivate project (admin)                                            |

### Reference (existing, to be updated)

| Method | Path                      | Description                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/reference/projects` | Active projects for pickers (filter by both project + client `isActive`) |

## UX

Same level as User Management in the admin section — similar look and feel. Follows the project's design workflow (Exploration → Prototyping → Implementation). User Management page and exploration (`explorations/web/user-management.html`) are the baseline reference.

### Key UI elements (to be designed)

- **Navigation:** Admin section alongside User Management
- **List views:** Table-based, same patterns as user management (stat cards, filter tabs, bulk actions, row actions)
- **Client list:** Name, project count, entry count, status badge
- **Project list:** Name, client, color swatch, entry count, status — possibly grouped by client
- **Filter tabs:** All / Active / Inactive
- **Bulk actions:** Activate / Deactivate selected
- **Create / Edit:** Dialog or inline form — lightweight, not a full page
- **Deactivation feedback:** Confirmation dialog when deactivating a client with active projects ("will hide N active projects from pickers")

## Edge Cases

- **Time entry references inactive project** — entry keeps its `projectId`. The entry row displays the project name (possibly with a visual hint like muted text or a small "archived" indicator). Editing the entry allows changing to an active project but not re-selecting the inactive one.
- **Project picker "recent" section** — recent projects list may include inactive projects. Filter them out — only show active recents.
- **Synced projects** — projects imported from Toggl start as active. If the sync runs again (incremental), newly synced projects are created as active. Deactivation is a Ternity-only concept — Toggl doesn't know about it.
- **Audit trail** — project name is denormalized at audit write time (already implemented via `resolveProjectName`). Deactivating/reactivating doesn't affect historical audit entries.
- **Default project user preference** — if a user's default project is deactivated, clear their preference (or ignore it in the picker).

## Future: Config Sync Across Environments

Admin decisions (project/client active/inactive, user status) currently need to be repeated on local, dev, and prod independently. A future CLI tool (`pnpm admin:export` / `pnpm admin:import --env dev`) could export structural config to JSON and push it to other environments. Initial scope: projects, clients, users. Could integrate into `deploy.sh`.

## Out of Scope

- **Project members / team assignment** — `project_members` table exists but is not used yet. Member management is a separate feature.
- **Project-level reporting** — reports filtered by project are a separate feature.
- **Project budgets / hours targets** — future feature.
- **Client portal / external access** — not planned.
- **Tags management** — tags are personal (per-user, opt-in). CRUD for own tags is a separate feature.
- **Reassignment** — bulk move entries between projects, move projects between clients. Parked for now.
