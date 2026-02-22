# Entry Segments Migration Guide

> **Audience:** Any Ternity client app (desktop, mobile, etc.) consuming the Ternity API.
> **Date:** 2026-02-21
> **Breaking change:** Yes — the `Entry` response shape has changed. Old fields removed, new fields added.

## TL;DR

Entries no longer store time data directly. Time is now tracked via **segments** — immutable records attached to each entry. The `Entry` object returned by all API endpoints has a new shape. Your app needs to:

1. Stop reading `entry.startedAt`, `entry.stoppedAt`, `entry.durationSeconds` — they no longer exist
2. Start reading `entry.segments`, `entry.totalDurationSeconds`, `entry.isRunning`
3. Use segments to compute elapsed time, time ranges, and running state
4. Update `PATCH /api/entries/:id` calls — you can no longer send `startedAt` or `stoppedAt`
5. Handle the new error response format with retry logic

---

## Table of Contents

1. [Why This Changed](#1-why-this-changed)
2. [The Segments Model](#2-the-segments-model)
3. [Entry Response Shape — Before & After](#3-entry-response-shape--before--after)
4. [API Reference — All Endpoints](#4-api-reference--all-endpoints)
5. [Computing Elapsed Time (Running Timer)](#5-computing-elapsed-time-running-timer)
6. [Computing Time Range Display](#6-computing-time-range-display)
7. [Day Grouping](#7-day-grouping)
8. [Error Handling](#8-error-handling)
9. [Performance Considerations](#9-performance-considerations)
10. [Migration Checklist](#10-migration-checklist)
11. [Testing Plan](#11-testing-plan)

---

## 1. Why This Changed

The old model stored `startedAt`, `stoppedAt`, and `durationSeconds` directly on the entry. This caused two problems:

- **Resume was a hack.** When you resumed a stopped entry, the API rewrote `startedAt` backwards to fake the elapsed time. This lost the true timing history and caused entries to jump between day groups.
- **No audit trail for time.** There was no record of when the timer was actually started, stopped, or resumed — just the final rewritten values.

The new model separates concerns:

- **Entry** = pure metadata (description, project, labels, createdAt)
- **Segments** = immutable time records (when the timer was actually running)

Resume now creates a **new segment** instead of rewriting `startedAt`. The entry stays in its original day group. The full timing history is preserved.

---

## 2. The Segments Model

Each entry has zero or more **segments**. There are two types:

### Clocked Segments (type: `"clocked"`)

Created by the timer. Represent actual periods when the timer was running.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `type` | `"clocked"` | Always `"clocked"` |
| `startedAt` | `string` | ISO 8601 timestamp — when the timer started |
| `stoppedAt` | `string \| null` | ISO 8601 — when stopped. **`null` = currently running** |
| `durationSeconds` | `number \| null` | Computed on stop. **`null` while running** |
| `note` | `null` | Always null for clocked segments |
| `createdAt` | `string` | ISO 8601 |

**Lifecycle:**
- Timer start → segment created with `startedAt=now`, `stoppedAt=null`, `durationSeconds=null`
- Timer stop → segment updated with `stoppedAt=now`, `durationSeconds=computed`
- Timer resume → **new** segment created (the old one stays as-is)

### Manual Segments (type: `"manual"`)

Created by `POST /api/entries` (manual entry creation) or `POST /api/entries/:id/adjust` (adjustments). Represent any user-entered time — as opposed to clocked segments which are timer-generated.

There are two subtypes based on context:

**Manual entry segments** — created when a user manually logs time with a start/end time:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `type` | `"manual"` | Always `"manual"` |
| `startedAt` | `string` | ISO 8601 — the start time the user entered |
| `stoppedAt` | `string` | ISO 8601 — the end time the user entered |
| `durationSeconds` | `number` | Computed from `stoppedAt - startedAt` |
| `note` | `string` | Required — justification for the manual entry (e.g., "Forgot to start timer") |
| `createdAt` | `string` | ISO 8601 |

**Adjustment segments** — created when a user adds/removes time from an existing entry:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `type` | `"manual"` | Always `"manual"` |
| `startedAt` | `null` | Always null for adjustments |
| `stoppedAt` | `null` | Always null for adjustments |
| `durationSeconds` | `number` | Seconds to add (can be **negative** for deductions) |
| `note` | `string` | Required — justification for the adjustment |
| `createdAt` | `string` | ISO 8601 |

**How to distinguish them:** Both have `type: "manual"`. Manual entry segments have `startedAt` set; adjustment segments have `startedAt: null`.

### Key Properties

- Segments are **immutable** — once created, they are never modified (except when a running clocked segment is stopped)
- Segments are **ordered by `createdAt`** in the API response
- An entry's total duration = sum of all segments' `durationSeconds` (skipping `null` for running)
- An entry is running = any clocked segment has `stoppedAt === null`
- There can be **at most one** running segment across all of a user's entries at any time

---

## 3. Entry Response Shape — Before & After

### BEFORE (old — no longer returned)

```json
{
  "id": "abc-123",
  "description": "Working on feature X",
  "projectId": "p1",
  "projectName": "API Platform",
  "projectColor": "#00D4AA",
  "clientName": "Netbulls",
  "labels": [{ "id": "l1", "name": "Development", "color": "#22c55e" }],
  "startedAt": "2026-02-21T09:00:00.000Z",     // ← REMOVED
  "stoppedAt": "2026-02-21T10:30:00.000Z",      // ← REMOVED
  "durationSeconds": 5400,                       // ← REMOVED
  "createdAt": "2026-02-21T09:00:00.000Z",
  "userId": "user-001"
}
```

### AFTER (new)

```json
{
  "id": "abc-123",
  "description": "Working on feature X",
  "projectId": "p1",
  "projectName": "API Platform",
  "projectColor": "#00D4AA",
  "clientName": "Netbulls",
  "labels": [{ "id": "l1", "name": "Development", "color": "#22c55e" }],
  "segments": [                                   // ← NEW
    {
      "id": "seg-001",
      "type": "clocked",
      "startedAt": "2026-02-21T09:00:00.000Z",
      "stoppedAt": "2026-02-21T10:30:00.000Z",
      "durationSeconds": 5400,
      "note": null,
      "createdAt": "2026-02-21T09:00:00.000Z"
    }
  ],
  "totalDurationSeconds": 5400,                   // ← NEW (server-computed)
  "isRunning": false,                              // ← NEW (server-computed)
  "createdAt": "2026-02-21T09:00:00.000Z",
  "userId": "user-001"
}
```

### Removed Fields

| Field | Replacement |
|-------|-------------|
| `entry.startedAt` | First timed segment's `startedAt` (filter by `startedAt != null`) |
| `entry.stoppedAt` | Last timed segment's `stoppedAt` (filter by `startedAt != null`) |
| `entry.durationSeconds` | `entry.totalDurationSeconds` |

### New Fields

| Field | Type | Description |
|-------|------|-------------|
| `segments` | `Segment[]` | All segments, ordered by `createdAt` |
| `totalDurationSeconds` | `number` | Sum of all segments with non-null `durationSeconds`. Always 0+ (never null) |
| `isRunning` | `boolean` | `true` if any clocked segment has `stoppedAt === null` |

---

## 4. API Reference — All Endpoints

All endpoints require authentication via Bearer token. All timestamps are ISO 8601 UTC.

### Timer Endpoints

#### `GET /api/timer`

Returns the current timer state.

**Response:**
```json
// Timer running:
{ "running": true, "entry": { /* Entry with segments */ } }

// No timer running:
{ "running": false, "entry": null }
```

#### `POST /api/timer/start`

Start a new timer. Automatically stops any currently running timer.

**Request body:**
```json
{
  "description": "Working on feature X",   // optional, defaults to ""
  "projectId": "p1",                       // optional, nullable
  "labelIds": ["l1", "l2"]                 // optional, defaults to []
}
```

**Response:**
```json
{ "running": true, "entry": { /* new Entry with one running clocked segment */ } }
```

**Behavior:**
- If another timer is running, it is automatically stopped first (new segment gets `stoppedAt` + `durationSeconds`)
- A new entry is created with one clocked segment (`startedAt=now`, `stoppedAt=null`, `durationSeconds=null`)

#### `POST /api/timer/stop`

Stop the currently running timer.

**Request body:** none (empty POST)

**Response:**
```json
{ "running": false, "entry": { /* Entry with all segments stopped */ } }
```

**Error:** `404` if no timer is currently running.

#### `POST /api/timer/resume/:id`

Resume a previously stopped entry. This is the key behavioral change — resume **adds a new segment** instead of rewriting `startedAt`.

**Request body:** none (empty POST)

**Response:**
```json
{ "running": true, "entry": { /* Entry now has an additional running segment */ } }
```

**Behavior:**
- If the entry is already running, returns it as-is (idempotent)
- If another entry's timer is running, it is automatically stopped first
- A **new** clocked segment is added to this entry (`startedAt=now`, `stoppedAt=null`)
- The entry now has multiple segments — the old stopped ones + the new running one

**Example: Entry after start → stop → resume → stop:**
```json
{
  "segments": [
    {
      "type": "clocked",
      "startedAt": "2026-02-21T09:00:00Z",
      "stoppedAt": "2026-02-21T10:30:00Z",
      "durationSeconds": 5400
    },
    {
      "type": "clocked",
      "startedAt": "2026-02-21T14:00:00Z",
      "stoppedAt": "2026-02-21T15:15:00Z",
      "durationSeconds": 4500
    }
  ],
  "totalDurationSeconds": 9900,
  "isRunning": false
}
```

### Entry Endpoints

#### `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`

List entries grouped by day.

**Response:**
```json
[
  {
    "date": "2026-02-21",
    "totalSeconds": 14400,
    "entries": [ /* Entry[] with segments */ ]
  },
  {
    "date": "2026-02-20",
    "totalSeconds": 28800,
    "entries": [ /* ... */ ]
  }
]
```

**Important:** Day grouping uses `entry.createdAt` (stable, never changes), NOT the first segment's `startedAt`. This means a resumed entry stays in the day it was originally created, even if the resume happens on a different day.

#### `POST /api/entries`

Create a manual entry (not via timer).

**Request body:**
```json
{
  "description": "Retrospective meeting",
  "projectId": "p1",
  "labelIds": ["l4"],
  "startedAt": "2026-02-21T13:00:00.000Z",   // required
  "stoppedAt": "2026-02-21T14:00:00.000Z",   // required
  "note": "Forgot to start timer"             // REQUIRED, non-empty
}
```

**Response:** The created `Entry` with one **manual** segment (not clocked — manual entries are user-entered, not timer-tracked).

**Behavior:** The API creates the entry (metadata) and one manual segment from `startedAt`/`stoppedAt`. The duration is computed server-side. The `note` is required — it serves as the justification for the manually entered time (e.g., "Forgot to start timer").

#### `PATCH /api/entries/:id`

Update entry **metadata only**. You can no longer change time fields via this endpoint.

**Request body:**
```json
{
  "description": "Updated description",    // optional
  "projectId": "p2",                       // optional, nullable (null = remove project)
  "labelIds": ["l1", "l2"]                 // optional (replaces all labels)
}
```

**Response:** The updated `Entry` with all segments.

**BREAKING CHANGE:** `startedAt` and `stoppedAt` are no longer accepted in the request body. Sending them will have no effect. Time data lives on segments and cannot be modified via this endpoint.

#### `DELETE /api/entries/:id`

Delete an entry and all its segments.

**Response:** `{ "success": true }`

#### `POST /api/entries/:id/adjust` (NEW)

Add a manual time adjustment to an entry.

**Request body:**
```json
{
  "durationSeconds": 1800,     // seconds to add (can be negative)
  "note": "Forgot to start timer for morning standup"  // REQUIRED, non-empty
}
```

**Response:** The updated `Entry` with the new manual segment included.

**Behavior:** Creates a manual segment (`type: "manual"`) on the entry. The `note` field is required — it serves as the justification for the adjustment.

#### `GET /api/entries/:id/audit`

Get the audit trail for an entry. Returns events in reverse chronological order (newest first).

**Response:**
```json
[
  {
    "id": "evt-001",
    "entryId": "abc-123",
    "action": "timer_stopped",
    "actorId": "user-001",
    "actorName": "Alex Morgan",
    "changes": {
      "stoppedAt": { "old": null, "new": "2026-02-21T10:30:00Z" },
      "durationSeconds": { "old": null, "new": 5400 }
    },
    "metadata": { "source": "timer_bar" },
    "createdAt": "2026-02-21T10:30:00.000Z"
  }
]
```

**Audit actions:**
| Action | When |
|--------|------|
| `created` | Entry created (manual or timer) |
| `updated` | Entry metadata changed |
| `deleted` | Entry deleted |
| `timer_started` | Timer started (new entry) |
| `timer_stopped` | Timer stopped |
| `timer_resumed` | Timer resumed (new segment created) |
| `adjustment_added` | Manual adjustment segment added |

### Stats Endpoint

#### `GET /api/stats`

Returns today and this week totals. **Includes currently running time** (computed server-side).

**Response:**
```json
{
  "todaySeconds": 14400,
  "weekSeconds": 86400
}
```

No changes to the request/response shape. The server internally computes from segments now.

---

## 5. Computing Elapsed Time (Running Timer)

When `entry.isRunning === true`, you need to compute elapsed time client-side for a live-ticking display.

### Algorithm

```
completedDuration = sum of all segments where durationSeconds !== null
runningSegment = segments.find(s => s.type === "clocked" && s.stoppedAt === null)
elapsed = completedDuration + Math.round((now - runningSegment.startedAt) / 1000)
```

### Why Not Just Use `totalDurationSeconds`?

`totalDurationSeconds` is computed server-side at the time of the API response. It includes completed segments but does NOT include the currently-accumulating time of a running segment (since that segment has `durationSeconds: null`). For a live-ticking display, you need the client-side computation above.

### Reference Implementation (TypeScript/React)

```typescript
function useElapsedSeconds(
  startedAt: string | null,
  running: boolean,
  offset: number = 0,
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || !startedAt) {
      setElapsed(offset);
      return;
    }

    const calc = () => {
      const start = new Date(startedAt).getTime();
      return offset + Math.max(0, Math.round((Date.now() - start) / 1000));
    };

    setElapsed(calc());
    const interval = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(interval);
  }, [startedAt, running, offset]);

  return elapsed;
}

// Usage in a timer component:
const completedDuration = entry.segments
  .filter(s => s.durationSeconds != null)
  .reduce((sum, s) => sum + s.durationSeconds!, 0);

const runningSegment = entry.segments
  .find(s => s.type === 'clocked' && !s.stoppedAt);

const elapsed = useElapsedSeconds(
  runningSegment?.startedAt ?? null,
  entry.isRunning,
  completedDuration,
);
```

### For Non-React Platforms

The pattern is the same regardless of framework:
1. Find the completed duration (sum of all non-null `durationSeconds`)
2. Find the running segment (if any)
3. Start a 1-second interval timer
4. Each tick: `elapsed = completedDuration + (now - runningSegment.startedAt)`
5. Clean up the interval when the entry stops running

---

## 6. Computing Time Range Display

To show a time range like "09:00 – 10:30" for an entry:

```typescript
// Filter segments that have a time range (clocked + manual entries — excludes pure adjustments)
const timedSegments = entry.segments.filter(s => s.startedAt != null);
const firstStartedAt = timedSegments[0]?.startedAt ?? entry.createdAt;
const lastSegment = timedSegments[timedSegments.length - 1];
const lastStoppedAt = lastSegment?.stoppedAt ?? null; // null if running

// Display:
// "09:00 – 10:30"     (stopped)
// "09:00 – now"        (running)
```

**Important:** Filter by `startedAt != null`, NOT by `type === 'clocked'`. Manual entries (created via `POST /api/entries`) also have `startedAt`/`stoppedAt` and should show a time range. Pure adjustments (created via `/adjust`) have `startedAt: null` and are correctly excluded.

For entries with multiple segments (resumed entries), this shows the span from the first start to the last stop — not each individual session. If you want to show individual sessions, iterate `timedSegments` directly.

### Duration Display

For stopped entries, just use `entry.totalDurationSeconds`:
```typescript
if (!entry.isRunning) {
  display = formatDuration(entry.totalDurationSeconds);
}
```

For running entries, use the elapsed computation from section 5.

---

## 7. Day Grouping

Entries are grouped by `entry.createdAt` (the date the entry was first created), NOT by when the timer was started or any segment's `startedAt`. This is a deliberate change — it means:

- A resumed entry stays in its original day group, even if resumed on a different day
- Day groups are stable and never shift around
- The `createdAt` field is immutable — it is set once when the entry is created and never changes

The API returns entries pre-grouped in the `GET /api/entries` response. Each group has:
- `date`: YYYY-MM-DD (derived from `entry.createdAt.slice(0, 10)`)
- `totalSeconds`: sum of all `entry.totalDurationSeconds` in the group
- `entries`: array of `Entry` objects

The client **should not re-group entries** — the API response is the source of truth for day assignment. Just render the groups as-is.

### Cross-Day Scenarios

These scenarios explain how entries behave when timer activity spans multiple calendar days. Understanding this is critical for rendering a correct day view.

#### Scenario 1: Start Monday, Stop Tuesday

User starts a timer at Monday 23:00, stops it Tuesday 01:00.

- The entry's `createdAt` is **Monday** (set when the timer was started)
- The entry appears in **Monday's group**, not Tuesday's
- The single clocked segment spans midnight: `startedAt=Mon 23:00`, `stoppedAt=Tue 01:00`, `durationSeconds=7200`
- Monday's `totalSeconds` includes the full 2 hours (7200s), even though 1 hour was "worked" on Tuesday

#### Scenario 2: Start Monday, Stop Monday, Resume Wednesday

User starts Monday 09:00, stops Monday 12:00 (3h), then resumes Wednesday 10:00 and stops Wednesday 11:00 (1h).

- The entry's `createdAt` is **Monday**
- The entry appears in **Monday's group** — it does NOT appear in Wednesday's group
- The entry has 2 clocked segments:
  - Segment 1: Mon 09:00 – Mon 12:00 (10,800s)
  - Segment 2: Wed 10:00 – Wed 11:00 (3,600s)
- `totalDurationSeconds` = 14,400 (4 hours)
- Monday's `totalSeconds` includes the full 4 hours — including the 1 hour worked on Wednesday

#### Scenario 3: Multiple Resumes Across Days

Same pattern extends to any number of resumes. An entry created on Monday that gets resumed on Tuesday, Wednesday, and Friday will still appear in Monday's group with a `totalDurationSeconds` that includes all work across all days.

### Implications for Your App

1. **Day totals may exceed actual time worked that day.** Monday's `totalSeconds` includes time from segments that physically ran on other days. This is by design — the alternative (splitting entries across days) was rejected because it breaks the entry-as-unit-of-work concept.

2. **Don't recompute day grouping client-side.** The API groups by `entry.createdAt`, and the client should trust that grouping. If you try to group by segment timestamps, you'll get different results.

3. **Time range display may span days.** An entry's time range (first `startedAt` to last `stoppedAt`) can span multiple calendar days. Display this as-is — e.g., "Mon 09:00 – Wed 11:00" for the resumed entry in Scenario 2.

4. **The `from`/`to` query parameters filter by `entry.createdAt`.** When you request `GET /api/entries?from=2026-02-16&to=2026-02-22`, you get entries **created** in that range. An entry created on Feb 16 that has segments running on Feb 23 will still be included (because `createdAt` is Feb 16). Conversely, you won't see an entry created on Feb 15 even if it has a segment that ran on Feb 16.

---

## 8. Error Handling

### Structured Error Responses

All API errors now return structured JSON:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

HTTP status codes:
- `400` — Bad request (validation failure)
- `403` — Forbidden (not your entry)
- `404` — Not found
- `500` — Internal server error

### Recommended Client Behavior

Every mutation (POST, PATCH, DELETE) should have error handling with retry. Pattern:

1. Catch the error
2. Show a user-visible notification (toast, snackbar, etc.)
3. Include a "Retry" action that re-invokes the same mutation with the same arguments

Example error messages by operation:
| Operation | Error Message |
|-----------|--------------|
| Start timer | "Failed to start timer" |
| Stop timer | "Failed to stop timer" |
| Resume timer | "Failed to resume timer" |
| Create entry | "Failed to create entry" |
| Update entry | "Failed to save changes" |
| Delete entry | "Failed to delete entry" |
| Add adjustment | "Failed to add adjustment" |

### Dev Error Simulation

For testing your error handling, the API supports a dev-only error simulation mode:

1. Send the header `X-Simulate-Error: true` on any mutating request (POST/PATCH/DELETE)
2. The API will return a 500 error **before** processing the request
3. This lets you verify your retry UI without causing real failures

This only works when the API is running in non-production mode (`NODE_ENV !== 'production'`).

### Defensive Response Handling

The API and client may be deployed at different times. During the rollout window, your client may receive either the old Entry shape (flat `startedAt`/`stoppedAt`/`durationSeconds`) or the new shape (with `segments`). If your client blindly assumes the new shape, accessing `entry.segments.filter(...)` on an old response crashes the app with a white screen and no feedback.

**Two layers of defense:**

#### 1. Response normalization (at the API boundary)

Normalize API responses immediately after fetching, before they reach any rendering code. If `entry.segments` is missing, synthesize the new shape from the old fields:

```typescript
function normalizeEntry(raw: any): Entry {
  if (raw.segments) return raw as Entry; // already new shape
  const startedAt = raw.startedAt ?? null;
  const stoppedAt = raw.stoppedAt ?? null;
  const durationSeconds = raw.durationSeconds ?? null;
  return {
    ...raw,
    segments: startedAt
      ? [{
          id: `compat-${raw.id}`,
          type: 'clocked' as const,
          startedAt,
          stoppedAt,
          durationSeconds,
          note: null,
          createdAt: raw.createdAt,
        }]
      : [],
    totalDurationSeconds: durationSeconds ?? 0,
    isRunning: startedAt != null && stoppedAt == null,
  };
}
```

Apply this to every code path that receives entries: timer state, entries list, and mutation responses. Remove it once the API migration is complete on all environments.

#### 2. Error boundary (catch-all safety net)

Wrap your data-dependent UI in a React Error Boundary (or equivalent for your framework). This catches any unexpected rendering crash — not just shape mismatches — and shows a recoverable fallback UI instead of a white screen.

```tsx
// Place around the authenticated/data-dependent portion of your app
<ErrorBoundary>
  <DataProvider>
    <TimerView />
  </DataProvider>
</ErrorBoundary>
```

The error boundary should:
- Log the error for debugging
- Show a minimal UI with the error message
- Offer a "Retry" button that resets the boundary (re-mounts children)

Layer 1 prevents known issues. Layer 2 catches everything else. Both are cheap to implement and should be in place **before** you deploy the migration to users.

---

## 9. Performance Considerations

### Response Payload Size

Every `Entry` now includes a `segments[]` array. For most entries this is a single segment, but entries that have been resumed multiple times or have manual adjustments will have more. A week of entries for an active user can easily be 200+ entries, each with 1-3 segments.

**What this means for your app:**
- The `GET /api/entries` response is larger than before
- Don't fetch more data than needed — always pass `from` and `to` query parameters
- If rendering a list, consider virtualizing long lists (especially for users with 50+ entries per day)

### Segments Are Always Inline

Every API endpoint that returns an `Entry` includes the full `segments[]` array. There is no separate "fetch segments" endpoint — they come with the entry. This means:

- You don't need extra requests to get segment data
- But you also can't opt out of receiving them
- Plan your data model/cache accordingly

### Client-Side Caching

If your app caches entries locally (e.g., SQLite on desktop):

- Cache segments alongside entries, keyed by `entry.id`
- When the timer is running, the running segment's `stoppedAt` and `durationSeconds` are `null` — these get filled in when you next fetch after stopping
- `totalDurationSeconds` and `isRunning` are server-computed — recalculate them from segments if you need offline accuracy
- `entry.createdAt` never changes and is safe to use as a stable sort/group key

### Polling vs. Push

The API does not push updates. If you need live updates (e.g., showing a running timer started from another device):

- Poll `GET /api/timer` at a reasonable interval (every 30-60 seconds)
- Do NOT poll `GET /api/entries` — only fetch when the user navigates or you know data has changed
- After any mutation (start/stop/resume/create/update/delete), refetch the relevant queries

---

## 10. Migration Checklist

Use this checklist to track your migration progress. Each item is independent — you can work through them in any order, but you must complete all of them.

### Data Model Updates

- [ ] **Remove old Entry fields from your type definitions**
  - Remove: `startedAt`, `stoppedAt`, `durationSeconds`
  - These fields no longer exist on the API response

- [ ] **Add new Entry fields to your type definitions**
  - Add: `segments: Segment[]`, `totalDurationSeconds: number`, `isRunning: boolean`
  - See section 3 for the full type definition

- [ ] **Add the Segment type**
  - Fields: `id`, `type` (`"clocked"` | `"manual"`), `startedAt`, `stoppedAt`, `durationSeconds`, `note`, `createdAt`
  - See section 2 for nullable rules per type

### Timer Display

- [ ] **Update running state detection**
  - Old: `!entry.stoppedAt`
  - New: `entry.isRunning`

- [ ] **Update elapsed time computation**
  - Old: `now - entry.startedAt`
  - New: `completedDuration + (now - runningSegment.startedAt)` — see section 5

- [ ] **Update duration display for stopped entries**
  - Old: `entry.durationSeconds`
  - New: `entry.totalDurationSeconds`

### Entry Display

- [ ] **Update time range display**
  - Old: `entry.startedAt` – `entry.stoppedAt`
  - New: first timed segment's `startedAt` – last timed segment's `stoppedAt` — filter by `startedAt != null`, see section 6

- [ ] **Update duration display**
  - Old: `entry.durationSeconds ?? 0`
  - New: `entry.totalDurationSeconds`

- [ ] **Update running indicator**
  - Old: `entry.stoppedAt === null`
  - New: `entry.isRunning === true`

### Entry Mutations

- [ ] **Update entry edit/save logic**
  - `PATCH /api/entries/:id` no longer accepts `startedAt` or `stoppedAt`
  - Only send: `description`, `projectId`, `labelIds`
  - If your app has inline time editing, you need to either remove it or redesign it to target segments

- [ ] **Manual entry creation — segment type changed + note required**
  - `POST /api/entries` still accepts `startedAt` + `stoppedAt`, but now creates a **manual** segment (not clocked)
  - `note` field is now **required** (non-empty string) — justification for the manual entry
  - The response segment will have `type: "manual"` with `startedAt`/`stoppedAt` set

### Error Handling

- [ ] **Add error handling to all mutations**
  - Every POST/PATCH/DELETE call should catch errors and show a user notification
  - Include a "Retry" action — see section 8

- [ ] **Add response normalization shim**
  - Normalize old API responses into the new segments shape at the fetch boundary
  - Prevents crashes during the rollout window when API and client may be on different versions
  - Remove once the API migration is complete on all environments — see section 8 "Defensive Response Handling"

- [ ] **Add error boundary around data-dependent UI**
  - Catches any unexpected rendering crash and shows a recoverable fallback
  - Should be in place before deploying the migration to users — see section 8 "Defensive Response Handling"

### Client-Side Filtering

- [ ] **Update any client-side duration filtering**
  - If you filter entries by duration (e.g., "incomplete entries"), use `entry.totalDurationSeconds` instead of `entry.durationSeconds`

- [ ] **Update day group total computation** (if done client-side)
  - Use `entry.totalDurationSeconds` instead of `entry.durationSeconds` when summing

---

## 11. Testing Plan

Work through these scenarios to verify your migration is complete. Each scenario should be tested in order — later scenarios depend on earlier ones working.

### 11.1 Basic Timer Flow

1. **Start timer** — verify a new entry appears with `isRunning: true` and one clocked segment with `stoppedAt: null`
2. **Verify live elapsed** — the timer display should tick up every second
3. **Stop timer** — verify `isRunning: false`, segment now has `stoppedAt` and `durationSeconds`
4. **Verify duration** — `entry.totalDurationSeconds` matches the segment's `durationSeconds`

### 11.2 Resume (Most Important Change)

1. **Start and stop** a timer entry
2. **Resume the same entry** — verify:
   - The entry now has **2 clocked segments** (the original stopped one + a new running one)
   - `isRunning: true`
   - `totalDurationSeconds` includes the first segment's duration
   - The live elapsed display = first segment duration + currently accumulating time
3. **Stop again** — verify:
   - Both segments have `stoppedAt` and `durationSeconds`
   - `totalDurationSeconds` = sum of both segments
   - `isRunning: false`

### 11.3 Auto-Stop on New Start

1. **Start timer** on entry A
2. **Start timer** on a different entry (or start a new one) — verify:
   - Entry A's running segment is now stopped (has `stoppedAt` + `durationSeconds`)
   - The new entry is running

### 11.4 Manual Entry Creation

1. **Create a manual entry** with `startedAt` and `stoppedAt`
2. Verify the response has one **manual** segment (not clocked) with matching times and computed `durationSeconds`
3. Verify the segment has a `note` field matching what was sent
4. Verify `totalDurationSeconds` matches
5. **Try creating without `note`** — should get a `400` error
5. Verify the time range display works (since the manual segment has `startedAt`/`stoppedAt`)

### 11.5 Entry Metadata Update

1. **Edit an entry's description** — verify only the description changes, segments are untouched
2. **Change the project** — verify the `projectId`, `projectName`, `projectColor` update
3. **Verify** you are NOT sending `startedAt` or `stoppedAt` in the PATCH request

### 11.6 Day Grouping Stability

1. **Start a timer** at the end of the day (or create an entry dated today)
2. **Stop it**
3. **Resume it the next day** (or simulate this)
4. **Verify** the entry stays in its **original day group** (based on `createdAt`), NOT the resume day
5. **Verify** the original day's `totalSeconds` includes time from the resumed segment (even though it ran on a different day)
6. **Verify** the resume day does NOT have a separate entry or duplicate — the entry only exists in its creation day

### 11.7 Time Range Display

1. Create an entry with **one segment** — verify the time range shows that segment's start–stop
2. Resume and stop to create **two segments** — verify the time range shows first start – last stop
3. While running — verify the end of the range shows "now" (or equivalent)

### 11.8 Error Handling

1. **Simulate an error** using the `X-Simulate-Error: true` header (or press `Ctrl+Shift+E` in the web app if applicable)
2. **Try stopping the timer** — verify an error notification appears
3. **Click Retry** — verify the operation succeeds on the second attempt
4. **Repeat** for start, resume, create, update, delete operations

### 11.9 Edge Cases

- **Entry with no segments** — should not happen with current API, but handle gracefully (show 0 duration, no time range)
- **Entry with a manual adjustment** — `totalDurationSeconds` should include the manual segment. The adjustment won't appear as a time range.
- **Negative adjustment** — a manual segment with negative `durationSeconds`. The `totalDurationSeconds` could theoretically go below the sum of clocked segments.
- **Multiple rapid start/stop** — verify no segment duplication or race conditions

---

## Appendix: Full Type Definitions

For reference, here are the complete TypeScript types. Adapt to your platform's type system as needed.

```typescript
interface Segment {
  id: string;
  type: 'clocked' | 'manual';
  startedAt: string | null;       // ISO 8601. Set for clocked + manual entries. null for adjustments.
  stoppedAt: string | null;       // ISO 8601. null while running (clocked) or for adjustments.
  durationSeconds: number | null; // null while running. Can be negative for manual adjustments.
  note: string | null;            // null for clocked. Set for manual entries + adjustments.
  createdAt: string;              // ISO 8601
}

interface EntryLabel {
  id: string;
  name: string;
  color: string | null;
}

interface Entry {
  id: string;
  description: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  clientName: string | null;
  labels: EntryLabel[];
  segments: Segment[];
  totalDurationSeconds: number;   // Server-computed. Sum of all non-null durationSeconds.
  isRunning: boolean;             // Server-computed. true if any clocked segment has stoppedAt=null.
  createdAt: string;              // ISO 8601. Stable — never changes.
  userId: string;
}

interface TimerState {
  running: boolean;
  entry: Entry | null;
}

interface DayGroup {
  date: string;                   // YYYY-MM-DD (based on entry.createdAt)
  totalSeconds: number;
  entries: Entry[];
}

// Request payloads

interface StartTimer {
  description?: string;           // defaults to ""
  projectId?: string | null;
  labelIds?: string[];            // defaults to []
}

interface CreateEntry {
  description?: string;           // defaults to ""
  projectId?: string | null;
  labelIds?: string[];            // defaults to []
  startedAt: string;              // ISO 8601, required
  stoppedAt: string;              // ISO 8601, required
  note: string;                   // required, non-empty — justification for manual entry
}

interface UpdateEntry {
  description?: string;
  projectId?: string | null;
  labelIds?: string[];
  // NOTE: startedAt and stoppedAt are NOT accepted here
}

interface AdjustEntry {
  durationSeconds: number;        // can be negative
  note: string;                   // required, non-empty
}

// Stats (unchanged)
interface Stats {
  todaySeconds: number;
  weekSeconds: number;
}
```
