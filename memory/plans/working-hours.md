# Working Hours Implementation Plan

Date: 2026-02-28
Status: Ready for implementation

## Confirmed Product Decisions

- Validate day times at schema level (`start < end` and strict `HH:mm` format).
- Seed default schedule for all existing users: `08:30-16:30` Monday-Friday, Saturday/Sunday off.
- Working Hours is foundational domain data (used later by presence and notifications), not a lightweight preference.

## Scope (v1)

- Add per-user weekly working schedule storage.
- Add API for reading/updating the full schedule.
- Add Settings tab/panel implementing approved V6 UX (timeline + accordion with compact inline editing).
- Keep auto-save behavior (no save button).

## Data Model

- New table: `working_schedules`
  - `id uuid pk`
  - `user_id uuid not null unique` (FK to `users.id`)
  - `schedule jsonb not null` (`WeeklySchedule` shape)
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

## Shared Types

- New file: `packages/shared/src/working-hours.ts`
  - `DayScheduleSchema`
  - `WeeklyScheduleSchema`
  - `DEFAULT_WEEKLY_SCHEDULE`
  - exported TS types
- Export from `packages/shared/src/index.ts`.

## Migration

- New migration: `apps/api/drizzle/0018_working_schedules.sql`
  - create table + unique index/constraint on `user_id`
  - seed defaults for all existing users (`08:30-16:30` weekdays, weekends off)
- Journal update: `apps/api/drizzle/meta/_journal.json` (next idx = 15).

## API

- New route file: `apps/api/src/routes/working-hours.ts`
  - `GET /api/working-hours`
    - return user's row if exists
    - fallback to `DEFAULT_WEEKLY_SCHEDULE` if missing
  - `PUT /api/working-hours`
    - validate with `WeeklyScheduleSchema`
    - upsert by `user_id`
- Register route in `apps/api/src/app.ts`.

## Frontend

- New hook file: `apps/web/src/hooks/use-working-hours.ts`
  - `useWorkingHours()` query
  - `useUpdateWorkingHours()` mutation
- Settings integration:
  - add Working Hours tab in `apps/web/src/pages/settings.tsx`
  - new panel component `apps/web/src/components/settings/working-hours-panel.tsx`
  - implement approved V6 behavior:
    - day rows with visual timeline bars
    - accordion expand for inline edit
    - compact one-line row in expanded state
    - `Working day` toggle semantics: ON = working, OFF = off
    - no copy-to-all actions
    - weekly total summary

## Implementation Sequence

1. Shared schemas/types + exports
2. DB schema + migration + journal
3. API route + app registration
4. Frontend hooks
5. Settings tab/panel UI wiring
6. Build/test pass

## Notes for Later Presence Work

- This schedule becomes source-of-truth for:
  - off-schedule state
  - timer reminder trigger offsets
  - daily reconciliation windows
- Keep structure stable and explicit to avoid re-migrating before presence reports.
