# Data Sync — Toggl Track & Timetastic

## Context

The team currently uses Toggl Track for time tracking and Timetastic for leave management. Ternity replaces both tools, but the migration is gradual — the team continues using the existing tools while Ternity is built out. Data sync bridges the gap: pull real data into Ternity so the team can see their work in the new UI immediately, and eventually cut over completely.

## Strategy: Strangler Fig Migration

1. **Phase 1 — Read-only mirror:** Sync all historical data from Toggl and Timetastic into Ternity. Prod is viewer-only — team logs into Ternity, sees their data, but cannot modify it. Dev is fully writable for testing and feedback.
2. **Phase 2 — Daily sync:** Automated daily pulls keep Ternity up to date as the team continues using the existing tools.
3. **Phase 3 — Cut over:** When Ternity's own time tracking and leave features are ready, disable sync and switch the team to entering data directly in Ternity.

## Sync Direction

**One-way only:** External tools → Ternity. Ternity never pushes data back to Toggl or Timetastic. This keeps the sync simple and avoids conflicts.

## Architecture: ELT with Staging Tables

The sync follows an **ELT (Extract, Load, Transform)** pattern with a clear separation between raw external data and Ternity's own model:

1. **Extract** — pull data from Toggl/Timetastic APIs
2. **Load** — store raw data in **staging tables** (the "landing zone") that mirror the external schema
3. **Transform** — translate staged data into Ternity's clean target tables

```
Toggl API  →  sync_toggl_*  (staging)   ─┐
                                          ├─  transform  →  Ternity tables (target)
Timetastic API  →  sync_tt_*  (staging)  ─┘
```

**Why staging tables?**
- **Target tables stay clean** — no sync columns (`external_id`, `external_source`) polluting Ternity's model
- **Raw data preserved** — if transform logic changes, re-process from staging without re-fetching from APIs
- **Clear audit trail** — compare raw vs. transformed to debug sync issues
- **Clean cut-over** — when the team stops using Toggl/Timetastic, drop the staging tables; target tables are untouched

## Data Model Philosophy

Ternity has its own data model, designed for Ternity's needs — not a mirror of Toggl or Timetastic schemas. The staging tables preserve external data as-is. The transform step interprets and adapts it into Ternity's smarter model:

- Toggl has flat tags → Ternity has structured labels (potentially hierarchical, typed, with colors)
- Toggl has no client→project→entry enforcement → Ternity has a strict hierarchy
- Timetastic has basic absence records → Ternity has richer leave requests with approval workflows, notes, and project context
- Both tools have separate user pools → Ternity unifies identity across time tracking and leave

The transform step normalizes, enriches, and validates. It doesn't preserve quirks of the source systems — it produces clean Ternity records.

## Data Sources

### Toggl Track (Time Tracking)

What we pull and how it translates:

| Toggl concept | Ternity equivalent | Translation |
|---|---|---|
| Clients | `clients` | Direct mapping by name |
| Projects | `projects` | Linked to matched client, color preserved |
| Project users | `project_members` | All imported as `user` role (managers assigned manually in Ternity) |
| Time entries | `time_entries` | Timestamps, duration, description preserved. Project/client linkage resolved. |
| Tags | `labels` | Flat tags become Ternity labels. Ternity may later add structure (categories, colors) beyond what Toggl supports. |
| Workspace users | `users` | Email-based matching. Toggl-specific fields (workspace role, rate) are not imported. |

**API:** Toggl Track API v9. Basic Auth with API token. Rate limit: 240 requests/hour (Starter plan). Reports API v3 for bulk time entry export. Supports `since` parameter for incremental sync (entries modified after a given date).

**Sync approach:**
- Initial: Full historical dump via Reports API (paginated, all workspaces)
- Daily: Incremental pull using `since` = last sync timestamp. Catches edits and deletes.

### Timetastic (Leave Management)

What we pull and how it translates:

| Timetastic concept | Ternity equivalent | Translation |
|---|---|---|
| Users | `users` | Email-based matching. Timetastic-specific fields (start date, approver chain) are not imported. |
| Departments | (no direct mapping) | Stored as metadata for reference during migration. Ternity uses project-based structure, not departments. |
| Leave types | `leave_types` | Name-matched or created. Ternity may rename or consolidate types to fit its own categorization. |
| Absences | `leave_requests` | Status mapped (Approved/Pending/Declined → Ternity equivalents). No project linkage in Timetastic — left unlinked or assigned by admin. |
| Allowances | `leave_allowances` | Per-user, per-type, per-year. Ternity may recalculate based on its own rules rather than blindly copying balances. |

**API:** Timetastic REST API. Bearer token auth (admin-level token). Rate limit: 1 request/second on absences endpoint. Absence queries limited to 31-day windows.

**Sync approach:**
- Initial: Walk full history in 31-day windows from earliest date to today
- Daily: Re-pull a rolling recent window (e.g., last 60 days) since there's no reliable `updatedAt` field on absences. Compare and upsert.

## User Matching

Users are matched across systems by **email address**. The sync process:

1. Pull all users from Toggl and Timetastic
2. Match to existing Ternity users by email
3. For unmatched users: create Ternity user records with `external_auth_id` = null (no Logto account yet)
4. Validation step: report mismatches before syncing entries (e.g., "5 Toggl users have no Ternity match — create accounts?")

## External ID Tracking

External IDs and source metadata live on the **staging tables**, not on Ternity's target tables. This keeps the target model clean:

- **Staging tables** have `external_id` (source system's primary key) for idempotent upserts and change detection
- **Target tables** have no sync-specific columns — they are pure Ternity records
- **Mapping** between staging and target is maintained via a `sync_mappings` table: `(source, external_id) → ternity_table, ternity_id`
- **Users** are the bridge: `toggl_id` and `timetastic_id` on the `users` table (since a user exists in both systems and user matching is the foundation of all other syncs)

## Prod vs Dev Behavior

| | Dev | Prod |
|---|---|---|
| **Sync** | On-demand (manual trigger) | Daily automated |
| **UI mode** | Full read-write | Read-only (viewer) |
| **Data edits** | Allowed (for testing) | Blocked (synced data is immutable) |
| **User accounts** | Stub auth OK | Real Logto accounts required |

**Viewer mode in prod:** Users can browse entries, reports, calendar, and leave data. All create/edit/delete actions are disabled in the UI with a "This data is synced from Toggl/Timetastic" notice. This is a temporary state until native entry features are ready.

## Rate Limits & Scheduling

| Service | Limit | Daily sync budget | Comfortable? |
|---|---|---|---|
| Toggl Track | 240 req/hour | ~50 requests (incremental) | Yes |
| Timetastic | 1 req/sec (absences) | ~120 requests (60-day window) | Yes |

Daily sync runs during off-hours (e.g., 3 AM). No risk of hitting rate limits with ~75 users and daily incremental pulls.

## Sync CLI / Admin

- `pnpm sync:toggl [--full]` — Run Toggl sync (incremental by default, `--full` for historical dump)
- `pnpm sync:timetastic [--full]` — Run Timetastic sync
- `pnpm sync:all` — Run both
- Admin UI (future): sync status dashboard, last sync time, error log, manual trigger button
