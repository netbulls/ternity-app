# Leave Management

## Overview

Leave management for a small remote team. People book time off, it shows on a shared wallchart, and the team knows who's out. Two distinct flows based on workforce type — contractors (B2B) get a simple no-approval booking, employees (umowa o prace) get formal request + approval as required by Polish labor law.

**Phase 1 (current):** Contractor flow only. Everyone treated as contractor. Simple book-and-confirm.
**Phase 2 (later):** Employee approval flow. Manager reviews and approves/rejects.

## Legal Context

Polish labor law creates two fundamentally different flows:

|                 | Contractor (B2B)                                                                  | Employee (umowa o prace)                           |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Leave flow**  | Self-booked, no approval                                                          | Formal request + manager approval                  |
| **Why**         | ZUS risk — approval process can be treated as evidence of employment relationship | Legally required to have formal leave approval     |
| **Allowances**  | Not tracked (self-managed)                                                        | Tracked per type per year (26 days holiday, etc.)  |
| **Leave types** | Simplified — mostly "time off"                                                    | Full set — holiday, sick, personal, parental, etc. |

This distinction is not optional — it's a legal requirement. The system must clearly separate the two flows.

## User Profile: Employment Type

Each user has an `employment_type` field on their profile:

| Value        | Meaning         | Leave flow                   |
| ------------ | --------------- | ---------------------------- |
| `contractor` | B2B / freelance | Self-book, autoconfirmed     |
| `employee`   | Umowa o prace   | Request + approval (Phase 2) |

Default: `contractor` (Phase 1 treats everyone as contractor regardless).

Admin can set/change this per user. It affects which leave flow applies and what UI the user sees.

## Leave Statuses

```
pending        → submitted, awaiting manager review (employee flow, Phase 2)
approved       → manager explicitly approved (employee flow, Phase 2)
autoconfirmed  → self-booked by contractor, no approval needed (Phase 1)
rejected       → manager rejected the request (employee flow, Phase 2)
cancelled      → user cancelled their own booking/request
```

Key distinction: `autoconfirmed` vs `approved` — makes it clear whether a human reviewed the request or it was automatically confirmed.

## Phase 1: Contractor Flow (No Approval)

### Core Workflow

1. User opens Leave page
2. Clicks "Book time off"
3. Selects date range (start date, end date)
4. Selects leave type (from available types)
5. Optionally adds a note
6. Submits — status is immediately `autoconfirmed`
7. Booking appears on the wallchart and team is notified

No pending state. No approval gate. No manager involvement.

### What the User Sees

**Leave page — My Leave:**

- List of own bookings (upcoming and past)
- Each booking shows: dates, leave type, status, note
- Can cancel upcoming bookings (status → `cancelled`)
- "Book time off" button

**Leave page — Wallchart:**

- Team calendar showing who's out on which days
- Color-coded by leave type
- Month view (scrollable)
- Shows all `autoconfirmed` and `approved` bookings (not `cancelled` or `rejected`)

### Cancellation

- User can cancel their own upcoming bookings at any time
- Past bookings cannot be cancelled
- Cancelled bookings disappear from the wallchart
- Cancellation is immediate (no approval needed, even in future employee flow)

### Leave Types

Seeded from Timetastic sync (23 types already exist in production). Each type has:

| Field         | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `name`        | Display name (e.g., "Holiday", "Sick Leave")         |
| `daysPerYear` | Annual allowance (used for employee flow, Phase 2)   |
| `color`       | Visual coding on wallchart                           |
| `deducted`    | Whether this type counts against allowance (Phase 2) |

For Phase 1 (contractor flow), `daysPerYear` and `deducted` are informational only — no allowance enforcement.

### Notifications

Infrastructure already exists. Phase 1 uses:

- **Team leave notification** — when someone books time off, team gets notified (email, configurable)
- **Cancellation notification** — when someone cancels a booking

Not needed in Phase 1 (no approval):

- Leave request update (approved/rejected) — this is for employee flow

### Project Context

Current schema has `projectId` on leave requests (FK to projects table). This was designed for the original "approver per project" model.

For contractor flow, project context is less relevant — a contractor booking time off is out for all projects, not just one. Options:

1. **Keep projectId but make it optional** — contractors don't need to specify a project
2. **Use a default "Leave" project** — already exists from Timetastic sync (auto-created "Organization" client + "Leave" project)

Decision: Make `projectId` nullable. Contractors don't specify a project. Employees (Phase 2) will specify which project the leave is for, since different projects may have different approvers.

## Phase 2: Employee Flow (Future)

Not built yet. High-level design for reference:

1. Employee submits leave request (date range, leave type, project, note)
2. Status: `pending`
3. Request routed to project's designated approver (manager role)
4. Approver gets notification (email + SMS)
5. Approver reviews: approves → `approved`, rejects → `rejected`
6. Employee gets notification of decision
7. Approved leave appears on wallchart
8. Leave allowance decremented (`usedDays` updated on `leave_allowances`)

Additional employee-specific features:

- Allowance tracking (remaining days per type per year)
- Allowance visibility ("You have 18 of 26 holiday days remaining")
- Manager dashboard for pending requests

## Presence Integration

Approved/autoconfirmed leave auto-sets presence to "On Leave" for those days:

- Person shows as "On Leave" on the team presence board
- No need to manually mark presence — leave management handles it
- This is a data-level integration, not a UI thing — the presence board reads leave data

## Data Model

### Existing Tables (already migrated)

**`leave_types`** — leave category definitions

- `id`, `name`, `daysPerYear`, `color`, `deducted`

**`leave_allowances`** — per-user annual allowances (Phase 2, employee flow)

- `id`, `userId`, `leaveTypeId`, `year`, `totalDays`, `usedDays`

**`leave_requests`** — individual leave bookings/requests

- `id`, `userId`, `projectId`, `leaveTypeId`, `startDate`, `endDate`, `daysCount`, `hours`, `note`, `status`, `reviewedBy`, `reviewedAt`, `createdAt`

### Schema Changes Needed

1. **Add `autoconfirmed` to `leave_status` enum**
2. **Add `employment_type` enum and column to `users` table** — `contractor` | `employee`, default `contractor`
3. **Make `projectId` nullable on `leave_requests`** — contractors don't specify a project
4. **Add `hours` column to `leave_requests`** — nullable integer (1–4). Set for partial-day bookings, null for full-day bookings

### Timetastic Sync Compatibility

The sync pipeline already populates `leave_types` and `leave_requests`. Synced records use `approved`/`pending`/`rejected`/`cancelled` statuses from Timetastic's own model. The new `autoconfirmed` status is only for natively created bookings — no conflict with sync data.

## API Surface (Phase 1)

### Leave Requests

| Method   | Path                  | Purpose                                       |
| -------- | --------------------- | --------------------------------------------- |
| `POST`   | `/leave/requests`     | Book time off (autoconfirmed for contractors) |
| `GET`    | `/leave/requests`     | List own leave bookings                       |
| `DELETE` | `/leave/requests/:id` | Cancel a booking                              |

### Wallchart

| Method | Path               | Purpose                          |
| ------ | ------------------ | -------------------------------- |
| `GET`  | `/leave/wallchart` | Team leave data for a date range |

### Leave Types

| Method | Path           | Purpose                    |
| ------ | -------------- | -------------------------- |
| `GET`  | `/leave/types` | List available leave types |

### Future (Phase 2)

| Method | Path                          | Purpose                            |
| ------ | ----------------------------- | ---------------------------------- |
| `GET`  | `/leave/requests/pending`     | List pending requests for approver |
| `POST` | `/leave/requests/:id/approve` | Approve a request                  |
| `POST` | `/leave/requests/:id/reject`  | Reject a request                   |
| `GET`  | `/leave/allowances`           | Get own allowance balances         |

## Views

### Leave Page

Two tabs:

1. **My Leave** — personal bookings list + "Book time off" action
2. **Wallchart** — team calendar view

### Book Time Off (Dialog/Sheet)

- **Duration toggle**: Partial day (hours) / Full day(s)
- **Partial day**: Single date picker + hours selector (1h, 2h, 3h, 4h)
- **Full day**: Date range picker (start–end), weekends/holidays auto-excluded with count shown
- Leave type selector
- Optional note field
- Submit button → immediate autoconfirm
- Overlap validation — shows error if dates conflict with existing booking

### Wallchart

- Month grid view
- Rows = team members, columns = days
- Color-coded blocks for leave periods
- Scrollable across months
- Filter by department/group (if applicable)

## Relationship with Other Features

### Time Tracking

- Leave days are not time-tracked — you don't log entries for days off
- Wallchart helps explain gaps in time entry reports

### Presence & Availability

- Autoconfirmed/approved leave → "On Leave" presence state
- 4-hour rule: away 4+ hours during scheduled day → should be a leave booking, not just presence marking
- Short absences (<4h) bypass leave management entirely

### Calendar (Future)

- Calendar view will overlay approved leave with other data
- Wallchart is the leave-specific view; calendar is the unified view

### Data Sync

- Timetastic sync populates leave data in production (23 types, 4,163 absences)
- Native leave features (this PRD) will coexist with synced data
- On cutover: disable Timetastic sync, team uses Ternity natively

## Resolved Questions

1. **Booking duration** — bookings are in 1-hour increments up to 4 hours. Anything beyond 4 hours is a full-day booking. This aligns with the 4-hour rule from presence: under 4h is a short absence, 4h+ is leave territory. So partial-day bookings are 1h, 2h, 3h, or 4h. Beyond that, it's a full day.
2. **Weekend/holiday exclusion** — the system auto-excludes weekends and Polish public holidays when calculating a booking. If you book Mon–Fri, only the 5 weekdays count. If Wednesday is a public holiday, only 4 days count. Requires a Polish public holiday calendar in the system.
3. **Overlapping bookings** — rules:
   - **Full-day booking**: blocks the entire date. No other booking allowed on that date.
   - **Partial-day bookings**: multiple allowed on the same date as long as total hours don't exceed 4h.
   - **Over 4h**: if a new partial-day booking would push the total past 4h, the system **blocks it** with an explanation: "You already have Xh booked on this date. Total would exceed 4h — cancel existing bookings and book a full day instead." No auto-conversion.
   - Only active bookings (`autoconfirmed` or `approved`) count. Cancelled bookings don't block.

## Booking Duration Model

Bookings come in two forms:

### Partial Day (1–4 hours)

- Booked in 1-hour increments: 1h, 2h, 3h, 4h
- Single date only (no range — partial days don't span multiple days)
- `daysCount` stores the fraction: 1h = 0.125, 2h = 0.25, 3h = 0.375, 4h = 0.5 (based on 8h workday)
- UI shows hours, not fractions ("Taking 2 hours off on Thursday")
- Partial-day booking stores a `hours` field (1–4) in addition to `daysCount`

### Full Day (5+ hours / whole day)

- Always counted as a full day (1.0 per day)
- Can span a date range (e.g., Mon–Wed = 3 days)
- Weekends and public holidays auto-excluded from the count
- `daysCount` = number of working days in the range

### Why 4 Hours is the Boundary

This matches the presence/availability 4-hour rule: if you're away for 4+ hours during a scheduled day, it should be a leave booking. The partial-day model accommodates the 1–4h range for things like doctor appointments, errands, or half-day offs. Beyond 4h, you're effectively gone for the day.

## Public Holidays

The system needs a Polish public holiday calendar for:

- Auto-excluding holidays from booking date range calculations
- Showing holidays on the wallchart
- Preventing unnecessary bookings on holidays

Polish public holidays are fixed by law (some are date-fixed, some are moveable like Easter). The system should store holidays per year, either:

- Hardcoded for known years (simple, good enough for a small team)
- Calculated from rules (more robust, handles future years automatically)

Phase 1: Hardcode 2025–2027 Polish public holidays. Extend as needed.
