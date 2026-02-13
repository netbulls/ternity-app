# PRD — Ternity

## Problem Statement

Small organizations lack a unified tool for time tracking and leave management. Existing solutions (Toggl, Timetastic) handle these separately, forcing teams to juggle multiple tools with no shared context. When time entries get duplicated from copy/paste, there's no smart deduplication. Jira time sync relies on fragile external scripts.

## Solution

Ternity is a time tracking and holiday scheduling platform for small organizations. It combines Toggl-style start/stop time logging with Timetastic-style leave management in a single tool. Entries are organized under a Client → Project hierarchy with multi-label support for filtering and Jira integration. Each project has a designated leave approver. Reports span day/week/month/year with individual and group views, filtered by project and labels. Smart deduplication detects similarly named entries and suggests merges.

## User Personas

### Employee
- Logs daily work via start/stop timer
- Pastes task names and assigns project + labels
- Requests days off through the leave module
- Reviews own timesheets (weekly/monthly) to verify hours
- Views shared calendar to see who's out

### Manager
- Approves/rejects holiday requests for their project(s)
- Reviews team reports filtered by project, group, or time period
- Monitors logged hours across team members in their project(s)

### Admin
- Manages organization structure (clients, projects)
- Configures auth via Logto admin console
- Assigns project-level permissions and leave approvers
- Manages roles (user, manager, admin) and groups (dev, QA, etc.)

## Core Workflows

### 1. Time Tracking (Start/Stop)
1. User clicks Start
2. Pastes or types task name (e.g., "PROJ-123 Fix login bug")
3. Selects Client → Project from hierarchy
4. Adds one or more labels (e.g., "jira", "bugfix")
5. Clicks Stop when done
6. Entry is saved with duration, timestamp, project, and labels

### 2. Entry Management & Deduplication
1. System groups similarly named entries
2. Suggests merge when duplicates are detected (from copy/paste or manual entry)
3. User reviews and confirms or dismisses merge suggestions

### 3. Leave Management (Timetastic-style)
1. Employee submits a day-off request (date range, leave type)
2. Request is routed to the designated approver for that project
3. Approver receives notification, approves or rejects
4. Approved leave appears on the shared calendar
5. Leave allowances are tracked (remaining days per type)

### 4. Reports
1. User selects report period (day, week, month, year)
2. Chooses scope: individual or group
3. Applies filters: project, client, labels, group
4. Report displays with entry-level detail within each project
5. Export available for external use

### 5. Calendar View
1. Shared calendar shows who's out (approved leave)
2. Can overlay personal time entries for visual overview

## Organization Structure

```
Organization
├── Clients
│   └── Projects
│       ├── Entries (time logs)
│       ├── Leave Approver (per project)
│       └── Members (with roles)
├── Groups (dev, QA, design, ...)
└── Roles (user, manager, admin)
```

- **Permissions** are per-project (not per-client)
- **Roles and groups** are managed in Logto (Organizations + RBAC)
- **Manager role** can view reports and approve leave for people in their project(s)
- **Leave approver** = user with `manager` organization role on that project

## Auth & Identity

**Provider:** Logto OSS (self-hosted) — `netbulls.ternity.auth`

| | Dev | Prod |
|---|---|---|
| **URL** | dev.auth.ternity.xyz | auth.ternity.xyz |
| **Admin** | admin.dev.auth.ternity.xyz | admin.auth.ternity.xyz |

### Login Methods

- **Primary:** Phone number + SMS OTP (passwordless, via Twilio)
- **Social:** Google OAuth
- **Recovery:** Email magic links (email optional but encouraged)
- **MFA:** TOTP / passkeys (not SMS — SMS is the primary login method)

### Account Creation

Phone number is required for all accounts. Even users who sign up via Google must add and verify a phone number. Email is optional but recommended for recovery.

### Authorization Model

- **Global roles:** `admin` (system-wide)
- **Organization roles (per project):** `manager`, `user`
- Logto Organizations map to Ternity projects
- Each project has its own role assignments (who is manager, who is user)
- Leave approver = user with `manager` role on that project's organization
- Roles and permissions are included in JWT access tokens
- Backend validates scopes on every API request

### Integration

- **Frontend:** `@logto/react` SDK (OIDC PKCE flow)
- **Backend:** Fastify middleware for JWT validation + RBAC scope checks
- **Type sharing:** Zod schemas for permission definitions in `/packages/shared`

## Labels

- Multiple labels per entry
- Used for filtering in reports and views
- Key use case: Jira ticket ID prefix as label for sync identification
- System-managed labels possible (e.g., "synced-to-jira")

## Jira Integration (Nice-to-Have)

- **Mapping:** Tool project → Jira instance (not 1:1 project-to-project)
- **Sync direction:** Push time entries to Jira based on task ID prefix in entry name
- **Task import:** Pull Jira tasks assigned to user for easy entry creation
- **Labels/tags:** Mark synced entries, filter by Jira project
- **Not 1:1:** One tool project can relate to multiple Jira projects
- **Future:** Jira addon to start timer directly from a Jira issue

## Non-Goals

No hard non-goals defined for v1. The following are explicitly deferred to later iterations:

- Jira browser addon (start timer from Jira issue)
- Invoicing or billing
- Payroll integration
- Native mobile app (web-first)
