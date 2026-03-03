# Team Presence Board — Implementation Plan

> Derived from V5 prototype (`dev-presence-v5.tsx`) and design discussions (session 2026-03-02-59bd, 2026-03-03-e4b8).

## Design Decisions (from V5 prototype iteration)

### Mental Model: Background vs Foreground

- **Background = the plan** (when is this person expected to be around?)
  - Green band = scheduled working hours
  - Violet band = planned absence (carves out a chunk from the schedule)
  - Indigo band = on leave (full day)
  - No band = off hours (not their time, no expectations)
- **Foreground = the reality** (what are they actually doing?)
  - Colored blocks = timer entries with project color from real palette
  - Running timer pulse = actively working right now
  - Gap between entries = idle (no hatching needed — green background showing through IS the signal)

### Status Derivation (from existing data, no explicit marking yet)

- **Available** — has a running timer during scheduled hours
- **Working Off-Hours** — has a running timer outside scheduled hours
- **Idle** — no running timer, but within scheduled hours (and no planned absence covering now)
- **Away** — currently inside a planned absence window (separate from idle)
- **Off Hours** — outside their working hours window entirely
- **On Leave** — full-day approved leave

### Visual Rules

- Single-line rows: Person | Status pill | Timeline (no wrapping, no sub-content)
- All statuses as `whitespace-nowrap` pills (including "Off Hours")
- Off-hours and on-leave rows get `opacity-50`
- Off-hours people: NO schedule background (entries float on bare timeline)
- Entry blocks show project name inside when there's room (`truncate`, `overflow-hidden`)
- Text color auto-inverts based on project color brightness (ITU-R BT.601 perceived luminance)
- Color layer separated from text layer (opacity on color div, text stays fully opaque)
- Opacity: 0.8 for logged entries, 0.95 for running/highlighted, 0.15 for dimmed
- No `brightness()` CSS filter, no `mix-blend-*`, no text shadows
- Project colors from real Ternity palette (`@ternity/shared` — 10 hex colors)

### Tooltip (on entry hover)

- Matches day-timeline pattern: positioned above block with arrow
- Shows: project color dot + name, entry description (bold, truncated), time range + duration
- Uses `bg-popover` for theme compatibility

### Project Filter

- Dropdown defaults to user's default project (from preferences)
- "All Projects" option to clear filter
- When filtered: matching entries at full opacity, non-matching dimmed to 0.15 (no text)
- People are filtered to only show those with entries for the selected project

### Status Filter Bar

- Pills: All | Available | Idle | Away | Off Hours | On Leave
- Click to filter, click again to toggle back to All
- Shows count per status

### Legend

- Only background concepts: Scheduled hours | Planned absence | On Leave | Now line
- Entry blocks are self-explanatory (colored = work)

### No idle hatching

- Gap in foreground = idle. Green background visible through the gap is the signal.

## What Exists

| Component                                     | Status    |
| --------------------------------------------- | --------- |
| `working_schedules` table + API (single user) | Built     |
| `time_entries` + `entry_segments` tables      | Built     |
| Timer API (start/stop/resume, single user)    | Built     |
| `users` table                                 | Built     |
| `projects` + `clients` tables with colors     | Built     |
| `GET /api/projects` (all auth users)          | Built     |
| User list endpoints (admin-only)              | Built     |
| SSE / real-time infrastructure                | Not built |
| Presence events / away marking                | Not built |
| Team endpoints (schedules, timers, entries)   | Not built |
| Team board page + nav entry                   | Not built |

## Implementation Phases

### Phase 1: Backend — Team Data Endpoints

New route file: `apps/api/src/routes/team.ts`

**1a. `GET /api/team/members`** (all authenticated users)

- Returns all active users: `id`, `displayName`, `email`, `avatarUrl`, `globalRole`
- This is NOT admin-only — every team member can see who's on the team

**1b. `GET /api/team/board`** (all authenticated users)

- The main presence board endpoint. Returns for each active user:
  - User info (id, displayName, avatarUrl)
  - Today's working schedule (from `working_schedules` table, fall back to default)
  - Running timer info (project name, color, description, startedAt) or null
  - Today's completed entries (project name, color, description, startHour, endHour)
- Query: join users → working_schedules, users → time_entries → entry_segments → projects
- Filter: only active users, only today's entries (segments with startedAt >= today 00:00)
- Running timer detection: segment where `stopped_at IS NULL` and `type = 'clocked'`

**1c. Status derivation** (server-side, in the board endpoint response)

- For each user, calculate status from schedule + running timer:
  - Has running timer + within schedule → `available`
  - Has running timer + outside schedule → `working-off-hours`
  - No running timer + within schedule → `idle`
  - Outside schedule entirely → `off-schedule`
  - (On leave / away — deferred until leave management / presence marking exists)

**Response shape:**

```typescript
interface TeamBoardMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'available' | 'working-off-hours' | 'idle' | 'off-schedule';
  schedule: { start: string; end: string } | null; // null = day off
  runningEntry: {
    projectName: string;
    projectColor: string;
    description: string;
    startedAt: string; // ISO
  } | null;
  entries: {
    id: string;
    projectName: string;
    projectColor: string;
    description: string;
    startedAt: string; // ISO
    stoppedAt: string | null; // null = running
    durationSeconds: number;
  }[];
}
```

### Phase 2: Frontend — Team Board Page

**2a. Route + navigation**

- Add `/team` route in `router.tsx` (lazy loaded)
- Add "Team" nav item in `nav-items.ts` (trackingNav, with `Users` icon)

**2b. Data hook**

- `useTeamBoard()` — React Query hook fetching `GET /api/team/board`
- Refetch interval: 30s (polling until SSE is built)
- Query key: `['team-board']`

**2c. Page component** (`apps/web/src/pages/team.tsx`)

- Port V5 prototype structure but with real data instead of mock
- Components to extract:
  - `TeamBoardPage` — main page with filters and list
  - `StatusFilterBar` — status filter pills
  - `ProjectFilter` — project dropdown
  - `TimelineRow` — single person row with person info, status pill, timeline
  - `PresenceBadge` — status pill component
  - `EntryTooltip` — hover tooltip for timeline entry blocks
- Use real project colors from API response (not hardcoded palette)
- Timeline: derive hour range from team's earliest schedule start to latest schedule end (or 7–20 default)
- `textForColor()` helper for entry block text contrast

**2d. Responsive considerations**

- Timeline column needs minimum width. Below a threshold, could hide the timeline and show a compact list view (status only).

### Phase 3: SSE for Real-Time Updates (deferred — use polling first)

When ready:

- `GET /api/team/board/stream` — SSE endpoint
- Events: `timer-started`, `timer-stopped`, `schedule-updated`
- Server pushes when any user starts/stops a timer
- Frontend: `EventSource` in the hook, falls back to polling

### Phase 4: Away Marking + Leave (future, not this implementation)

When explicit presence marking is built:

- Add `presence_events` table (user_id, type: 'away'|'back', reason, expected_return, timestamp)
- Add `GET/POST /api/presence` routes
- Add `away` and `on-leave` statuses to the board derivation
- Add planned absence blocks to the timeline background

## File Changes Summary

### New files:

- `apps/api/src/routes/team.ts` — team board API
- `apps/web/src/pages/team.tsx` — team board page
- `apps/web/src/hooks/use-team-board.ts` — data hook

### Modified files:

- `apps/api/src/server.ts` — register team routes
- `apps/web/src/router.tsx` — add `/team` route
- `apps/web/src/lib/nav-items.ts` — add Team nav item

### No DB migration needed for Phase 1

- All data comes from existing tables (users, working_schedules, time_entries, entry_segments, projects, clients)

## Build Order

1. Backend: `GET /api/team/board` endpoint
2. Frontend: hook + page skeleton with real data
3. Frontend: full UI matching V5 design
4. Test across all 6 themes
5. Deploy
