<!-- rule-version: 1.0 -->
# Data Sync

ELT pipeline: Toggl Track + Timetastic → staging tables → Ternity tables. See `docs/prd/data-sync.md` for the PRD.

## Current State

- **Phase 1 complete:** All historical data synced and transformed
- Toggl: 118,566 time entries (2020–2026), 24 clients, 39 projects, 28 labels
- Timetastic: 57 users matched, 26 leave types, 2,168 leave requests
- 25 Timetastic-only users remain unmatched (522 absences) — need manual mapping

## Sync Commands

All use `.env.sync` (at project root, gitignored):

```bash
# Extract from source APIs
pnpm sync:extract [toggl|timetastic|all] [--entity name] [--from YYYY-MM-DD] [--to YYYY-MM-DD]

# Transform staging → target tables
pnpm sync:transform [--entity name]

# Full pipeline (extract + user match + transform)
pnpm sync:run

# User matching report / apply
pnpm sync:users [--apply]
```

## Toggl Track API Gotchas

- **Workspace ID:** 4801777, **Organization ID:** 4775401
- **Rate limit:** 240 req/hr on Starter plan. Returns HTTP **402** (not 429) when exceeded.
- 402 body contains "Your quota will reset in XXXX seconds" — client parses and waits automatically
- **Reports API max date range:** 366 days — must chunk into yearly windows
- **Page size:** 200 (bumped from default 50). Uses `first_row_number` param, not page numbers.
- **Search API returns GROUPED results:** Each row has nested `time_entries[]` array. Must flatten — use `time_entries[].id` as `external_id`, merge parent fields into each entry.
- **Tags are numeric IDs** (`tag_ids: [123, 456]`), not names. Must resolve via `stg_toggl_tags`.
- **Organization users endpoint:** `/organizations/{orgId}/users` (not workspace-scoped)
- **User ID mismatch:** Org users API returns `id` (org-level) but time entries use `user_id` (account-level). Fixed in `users.ts` transform + SQL data migration.

## Timetastic API Gotchas

- **Absences endpoint returns an object**, not an array: `{ holidays: [...], totalRecords, nextPageLink, previousPageLink }`
- **Pagination is non-functional** — page 2 returns same data as page 1. Just fetch page 1.
- **`nextPageLink`** is empty string `""` (truthy in JS!) even on single-page results — don't use it for loop control
- **Half-day absences:** `deductionDays` can be `0.5` — our `days_count` column is integer, so we round
- **Deactivated users:** Historical absences reference user IDs not in current `/users` endpoint. Recovered 31 by name-matching against Toggl users (exact + unaccent for Polish diacritics).

## Incremental Extract

Time entries extract is **incremental per yearly window** — each window's data is saved to staging immediately. Uses upsert (delete-by-external-id + insert) so re-runs update existing rows. If rate-limited mid-run, already-saved windows are preserved.
