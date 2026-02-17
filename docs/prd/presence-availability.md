# Presence & Availability

## Problem Statement

The team works remotely with self-defined schedules. Everyone invoices 8 hours per day, but there's no visibility into when people are actually available, when they step out, or whether breaks are made up. The system runs on faith, which works asymmetrically — the employer trusts but cannot verify. Additionally, Polish labor law requires a formal attendance record (lista obecności) for employees on employment contracts, which currently lives outside the system.

### Specific Pain Points

1. **No committed schedule** — each person says "8 hours" but never declares *when*. Team coordination suffers — you can't know if someone is reachable at 14:00.
2. **Invisible breaks** — long breaks (1–2h) happen regularly. They're supposed to be made up, but there's no way to know if they actually were, or what work was done.
3. **Invoicing on faith** — contractors invoice 8h/day regardless. Time tracking exists (Toggl/Ternity) but it's not compared against a declared schedule.
4. **No team presence view** — "Is Bartosz around right now?" requires pinging on Slack and waiting.
5. **Legal gap** — employees (umowa o pracę) need a formal attendance record. No electronic system currently covers this.

## Solution

A presence and availability system that combines three functions:

1. **Schedule commitment** — each person declares their recurring weekly work schedule. This is a team coordination contract, not personal preference.
2. **Real-time presence** — mark yourself as in/out throughout the day. Short absences (errands, lunch) are declared instantly with zero friction. Visible to the whole team.
3. **Schedule vs actual reconciliation** — compare declared availability windows against actual time entries. Surface gaps, make accountability transparent.

Plus **Slack integration** (later) for zero-friction status updates and team awareness.

## User Personas

### Employee / Contractor

- Sets their weekly schedule once, adjusts as needed
- Marks short absences (stepping out) instantly — from Ternity (later: Slack)
- Sees their own day: planned schedule, actual time logged, gaps
- Confirms daily attendance (employees only — lista obecności)

### Team Member

- Sees who's available right now — a team presence board
- Knows when colleagues are expected back from breaks
- Plans collaboration around visible schedules

### Admin / Owner

- Sees team-wide presence: who's in, who's out, who's on leave
- Reviews schedule vs actual across the team — spots patterns and gaps
- Generates lista obecności reports for employees
- Reviews team schedules and overlap

## Core Concepts

### Weekly Schedule (the foundation)

Each person defines a recurring weekly pattern:

```
Monday:    09:00 – 17:00
Tuesday:   09:00 – 17:00
Wednesday: 09:00 – 15:00
Thursday:  10:00 – 18:00
Friday:    09:00 – 17:00
```

- Set once, edit anytime. Changes take effect from the next occurrence.
- This is the **team contract** — people need to overlap for collaboration.
- No system-enforced core hours — overlap is a social contract, not a system rule. If it becomes a problem, it's handled as a conversation.
- Schedule templates could be offered (e.g., "Standard 9–17", "Early bird 7–15") for convenience.

### Presence States

At any point during their declared schedule, a person is in one of:

| State | Meaning | How set |
|---|---|---|
| **Available** | Working, reachable | Default during scheduled hours; or explicit `/back` |
| **Away** | Temporarily out (break, errands, etc.) | Explicit: button, Slack `/out` |
| **Focus** | Working but do-not-disturb | Explicit: button (future — nice to have) |
| **Off schedule** | Outside declared work hours | Automatic from schedule |
| **On leave** | Approved leave (half-day or more) | From leave management |

Short absences (Away state):
- One tap / one Slack command — zero friction
- Optional: expected return time ("back in ~30min") and reason ("lunch", "errand")
- No approval needed — just transparency
- Visible to the whole team in real-time

### Absence Tiers

| | Short absence | Long absence |
|---|---|---|
| **Duration** | Under 4 hours (within a single day) | 4+ hours or 1+ full days |
| **Flow** | Self-declared, instant | Request + approval |
| **Overhead** | Zero — tap and go | Light process (acceptable for planning) |
| **Purpose** | Transparency + accountability | Resource planning + legal compliance |
| **Types** | Not categorized (just "away") | Leave types (holiday, sick, personal, etc.) |
| **4-hour rule** | Under threshold — just mark it | 4+ hours away = treated as full day off |

Short absences don't need categorization or approval. They're logged for transparency and reconciliation — not for HR bureaucracy.

If an "away" period reaches 4 hours during a scheduled day, the system flags it — this should be a leave request, not just an away mark.

Long absences (1+ day) enter the leave management flow:
- Employee submits request (dates, leave type)
- Manager/admin approves
- Approved leave auto-sets presence to "On leave" for those days
- Leave allowances tracked (for employees; less relevant for contractors)

### Schedule vs Actual Reconciliation

The core accountability mechanism. For any given day:

```
Scheduled:    09:00–17:00 (8h)
Away periods: 12:00–13:30 (1.5h lunch)
Net expected: 6.5h available
Time logged:  5h 48m across 4 entries
Gap:          42 minutes unaccounted
```

The system doesn't judge — it makes the data visible:
- **Employee view:** "Today I was scheduled 8h, away 1.5h, logged 5h 48m — I still need to make up 42 minutes"
- **Admin view:** Same data across the whole team, aggregated by day/week/month

If someone takes a long lunch and works in the evening to make up:
- The evening time entries show up
- The reconciliation reflects it
- No guesswork, no faith needed

### Make-Up Time

Different models per workforce type:

**Employees (formal quarterly balance):**
- Every short absence ("wyjście prywatne") creates a time debt on the ledger
- Working extra hours (including outside scheduled times) repays the debt
- Quarterly settlement: system calculates the balance
  - **Positive** (worked more than owed) → overtime, requires compensation
  - **Negative** (still owe hours) → HR handles per labor law
- The system tracks this ledger automatically from presence events + time entries

**Contractors (accountability through content):**
- No formal balance or quota — no quarterly settlement
- They log time entries including off-hours work (e.g., 22:00–00:00)
- Admin can review: *what* was logged during off-hours — project, description, duration
- The time tracker content is the accountability tool — verifiable work vs vague filler
- Reconciliation view still available (scheduled vs logged) but no formal consequences

### Lista Obecności (Attendance Record)

For employees on employment contracts (umowa o pracę):

- Daily record: date, scheduled hours, actual start/end, breaks, total hours worked
- Employee confirms (digital signature / checkbox) at end of day or next morning
- Monthly report exportable (PDF/print) for compliance
- Admin can review and countersign

Contractors (B2B) are exempt from this formal requirement but benefit from the same transparency features.

## Slack Integration

Three integration modes:

### 1. Commands

| Command | Action |
|---|---|
| `/out [duration] [reason]` | Mark as away. e.g., `/out 30min lunch`, `/out 1h errands` |
| `/back` | Mark as available |
| `/schedule` | Show my today's schedule |
| `/whois [available]` | Who's around right now |

### 2. Status Sync (bidirectional)

- Mark "away" in Ternity → Slack status updates (e.g., emoji + "Away — back ~14:00")
- Mark "away" in Slack → Ternity presence updates (TBD — may be complex)
- Clear on `/back` or return to Available state

### 3. Notifications

- Channel notifications for team awareness:
  - "Bartosz is stepping out (~1h, lunch)"
  - "Bartosz is back"
  - "Elena is on leave today and tomorrow"
- Configurable: per-team channel, opt-in, quiet hours

## Views / UI Concepts

### Team Presence Board

Real-time view of who's in, who's out:
- List of team members with current state (Available / Away / Focus / Off schedule / On leave)
- Schedule bar showing today's plan with current time marker
- Away reason and expected return time when applicable
- Quick filter: "Who's available now?"

### My Day

Personal view for the employee:
- Today's schedule (the plan)
- Presence timeline (what actually happened — available/away blocks)
- Time entries logged (from existing timer/entries feature)
- Reconciliation summary: scheduled vs away vs logged vs gap

### Schedule Management

- Set/edit recurring weekly schedule
- View team schedules side by side (for coordination)
- Admin: review team schedules and overlap

### Admin Dashboard

- Team-wide reconciliation: who's meeting their hours, who has gaps
- Patterns over time (weekly/monthly aggregates)
- Lista obecności report generation (employees only)
- No public shaming — data is for management oversight, not broadcast

## Relationship with Existing Features

### Time Tracking (Phase 2 — built)

Presence provides the **other half** of the equation. Time tracking tells you *what* someone worked on and *how long*. Presence tells you *when they were supposed to be working*. Together they enable reconciliation.

### Leave Management (Phase 4 — planned)

Long absences (1+ day) flow through the leave management system:
- Leave requests, approvals, allowances, calendar
- Approved leave automatically sets presence state to "On leave"
- **No duplication** — you don't mark presence AND request leave separately

Short absences (hours) are presence-only — they bypass leave management entirely. The leave management PRD can be simplified: it handles only full/half-day planned absences with approval flow.

### Calendar (Phase 5 — planned)

The calendar shows:
- Approved leave (from leave management)
- Scheduled availability (from presence)
- Could overlay presence data for a richer "who's around" view

## Workforce Types

Each user has an `employment_type` field on their profile: **`employee`** or **`contractor`**. This drives which compliance features apply.

| Aspect | Employee (umowa o pracę) | Contractor (B2B) |
|---|---|---|
| Schedule | Required, stable, change needs approval | Required, stable, change needs agreement |
| Short absences | Mark for transparency, creates time debt | Mark for transparency, no formal debt |
| Long absences | Request + approval | Request + approval (same flow) |
| Make-up time | Formal quarterly balance (debt/repay ledger) | Informal — verified through time entry content |
| Lista obecności | Required — daily confirmation | **Not required** — not shown |
| Reconciliation | Full — schedule vs logged, quarterly settlement | Full visibility — no formal settlement |
| Allowances | Tracked (26 days holiday, etc.) | Not tracked (self-managed) |

The key differences are compliance (lista obecności, allowances, quarterly settlement) and make-up formality — not the approval flow. Everyone goes through the same process for long absences because it's a contractual relationship regardless of employment type.

Part-time workers don't need a separate type — they're either employees or contractors with a shorter weekly schedule (e.g., 20h instead of 40h).

## Resolved Decisions

1. **Core hours** — no system enforcement. Overlap is a social contract. If it's not working, it's a conversation, not a system rule.
2. **Slack integration** — deferred. Build the core flow first, add Slack as a convenience layer later. Sync direction TBD at that point.
3. **Enforcement** — visibility through reports only. Self-correction expected. Automated nudges/alerts can be added later if transparency alone isn't enough.
4. **Reconciliation granularity** — daily summary is the baseline. Timeline view (visual bar with available/away/logged blocks) to be explored in the design phase — presentation question, not data question.
5. **Mobile** — not needed initially. Desktop-first. People should be at their computers to work.
6. **Timer as implicit signal** — nice-to-have, not core. Running timer could imply "Available" but won't be in the first version.
7. **Data retention** — keep everything forever. No auto-deletion or retention policy.
8. **Contractor leave** — same approval flow as employees. It's a contractual relationship — they request, admin approves. Only difference: no lista obecności, no tracked allowances.

## Additional Resolved Decisions

9. **Schedule change frequency** — schedules are meant to be stable. For employees, changes require formal approval (labor law). For contractors, changes need to be agreed — no arbitrary daily flipping. Modeled as: schedule persists until changed, changes go through approval (prevents retroactive gaming).

10. **Half-day boundary (4-hour rule)** — if someone is away for 4+ hours during a scheduled day, it's treated as a full day off and requires the leave/approval flow. Under 4 hours is a short absence (mark and be transparent, no approval). The system can flag when an "away" approaches the 4h threshold.

11. **Make-up time** — different models per workforce type:
    - **Employees:** formal quarterly balance. Every short absence ("wyjście prywatne") creates a time debt. Make-up time repays the debt. End-of-quarter settlement: positive balance = overtime pay, negative balance = HR handles. The system must track this ledger.
    - **Contractors:** no formal balance or quota. Accountability comes from time entry content — they log what they worked on during off-hours, and admin can review whether the work is real and substantive. The time tracker is the verification tool.

## Open Questions

None at this time. All core decisions resolved.

## Implementation Considerations

This feature has three distinct layers:

1. **Data model** — schedules, presence events, reconciliation logic. Built on existing DB.
2. **Real-time** — presence state changes need to propagate instantly (WebSocket or SSE for the team board).
3. **Slack app** — deferred. Requires a Slack app with slash commands, status API, webhooks. Separate deployment concern.

### Suggested build order

1. **Schedule management** — set/view weekly schedules, team schedule overview. No real-time needed.
2. **Presence marking** — in/out buttons with reconciliation against time entries. Core loop.
3. **Leave integration** — long absence requests with approval flow. Approved leave auto-sets presence.
4. **Team presence board** — real-time view of who's in/out.
5. **Reports & reconciliation views** — schedule vs actual, gaps, patterns.
6. **Lista obecności** — compliance reporting layer on top of presence data (employees only).
7. **Slack integration** — commands, status sync, notifications. Convenience layer last.
