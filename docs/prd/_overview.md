# Ternity — Product Overview

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

## Feature Docs

| Feature | Doc | Status |
|---|---|---|
| [Time Tracking](time-tracking.md) | Start/stop timer, entry management, deduplication, labels, reports | Core |
| [Leave Management](leave-management.md) | Leave requests, approvals, calendar view | Core |
| [Auth & Identity](auth-identity.md) | Logto integration, login methods, RBAC | Core |
| [Data Sync](data-sync.md) | Toggl + Timetastic migration (strangler fig) | Active |
| [Impersonation](impersonation.md) | Admin impersonation for support/debugging | Planned |

## Future / Nice-to-Have

### Jira Integration

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
