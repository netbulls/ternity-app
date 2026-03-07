# Reports

## Overview

Reports is a dedicated module for generating branded time reports for customers. Users configure filters (date range, projects, team members, clients, tags), preview the report in-app, choose from 7 visual templates, and download as PDF. Report configurations can be saved as templates and reused with modified parameters.

Reports is a **consumer** of time entry data — it queries the same `time_entries` + `entry_segments` tables but through its own aggregation endpoints. It has its own route, API surface, and DB table for saved templates.

## Problem

Ternity tracks time at the entry level. When sending a monthly summary to a client, there's no way to:

- Aggregate entries by user, project, and date range into a coherent report
- Generate a branded PDF suitable for external consumption
- Save report configurations for recurring use (e.g., "March — Acme Corp")
- Visualize team composition (who contributed what percentage)

Currently, admins would need to manually compile this data from the Entries page — which only shows one user at a time, has no export, and no aggregation.

## User Personas

### Manager

- Generates monthly reports for client billing
- Filters by project, date range, and team
- Previews the report, picks a template, downloads PDF
- Saves frequently-used configurations as favorites
- Reuses saved templates with updated date ranges

### Admin

- Same as Manager, plus access to all users and projects (not scoped to assignments)
- May generate organization-wide reports

### Employee

- Views own time data through reports (individual scope)
- Cannot generate reports that include other users

## Core Workflow

### Generate a Report

1. User navigates to Reports page
2. Configures filters:
   - **Period**: date range (from–to) with presets (this month, last month, this quarter, custom)
   - **Projects**: multi-select from active projects (admin sees all; manager sees assigned)
   - **Users**: multi-select from team members (admin sees all; manager sees project members; user sees only self)
   - **Clients**: multi-select (filters projects by client)
   - **Tags**: multi-select (optional, only if tags enabled)
   - **Group by**: user (default), project, or date
3. Clicks "Generate" or the data loads automatically on filter change
4. Report data displays in-app as tables + charts (HTML preview)
5. User selects a PDF template from the gallery (7 templates available)
6. Live preview updates to show the selected template with real data
7. User clicks "Download PDF" — the backend renders HTML → PDF via Gotenberg

### Save a Template

1. After configuring filters, user clicks "Save as template"
2. Names the configuration (e.g., "March 2026 — Acme Corp")
3. Can toggle "Favorite" for quick access
4. Saved templates appear in a sidebar/panel for quick loading
5. Loading a template restores all filter settings
6. User can modify filters and "Save as new" (clone with changes)

## Permissions & Scope

| Role    | Can see users               | Can see projects  | Can save templates |
| ------- | --------------------------- | ----------------- | ------------------ |
| Admin   | All active users            | All projects      | Yes                |
| Manager | Members of their project(s) | Assigned projects | Yes                |
| User    | Self only                   | Assigned projects | Yes                |

Templates are private to the user who created them. No sharing in v1.

## PDF Templates

Seven visual templates ship from day one. Templates are **independent from the app theme** — they always use Ternity branding (hourglass logo, Oxanium font, #00D4AA teal). The app theme (Ternity Dark, Carbon, Warm Sand, etc.) does not affect report output.

Templates are tagged by intended medium:

### Print-Friendly

| Template              | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| **Classic Corporate** | Traditional: table-heavy, light background, repeating header/footer |
| **Minimal Swiss**     | Ultra-clean typography, no cards/borders, horizontal bar chart      |
| **Magazine Spread**   | Two-column cover, pull-quote metrics, editorial layout              |
| **Dashboard Print**   | Web dashboard on paper — cards, rounded corners, Light theme        |
| **Invoice Style**     | Dense, utilitarian, max data per page, signature block, appendix    |

### Screen-Optimized

| Template             | Description                                        |
| -------------------- | -------------------------------------------------- |
| **Dark Executive**   | Dark background, teal accents, premium SaaS feel   |
| **Cover + Chapters** | Dark cover page, table of contents, chapter breaks |

### PDF Content (All Templates)

Every template includes the following sections:

1. **Header** — Ternity logo (SVG), report title, date range, generation timestamp
2. **Executive Summary** — Total hours, total entries, team member count, project count
3. **Team Composition Chart** — Pie/donut/bar chart showing each user's percentage contribution
4. **Per-User Detail** — For each user:
   - User name, role, total hours, entry count
   - Entries grouped by date, showing: project (with color), description, Jira key (if linked), duration
   - Day subtotals
5. **Footer** — Company branding, page numbers

### Page Break Strategy

- Summary and chart always fit on page 1 (or page 1-2 for large teams)
- User sections use `page-break-inside: avoid` on the header + first day group
- Long user sections flow naturally across pages with "continued" context in the page header
- The system avoids orphaned headers (user name at bottom of page with entries on next page)

## Data Model

### New Table: `report_templates`

```
report_templates
┌────────────────────────────────────────┐
│ id              uuid PK                │
│ name            text NOT NULL           │
│ user_id         uuid FK → users         │
│ config          jsonb NOT NULL           │
│ is_favorite     boolean DEFAULT false    │
│ created_at      timestamptz DEFAULT now  │
│ updated_at      timestamptz DEFAULT now  │
└────────────────────────────────────────┘
```

### Config JSONB Structure

```typescript
interface ReportConfig {
  dateFrom: string; // ISO date YYYY-MM-DD
  dateTo: string; // ISO date YYYY-MM-DD
  projectIds: string[]; // empty = all accessible
  userIds: string[]; // empty = all accessible
  clientIds: string[]; // empty = all
  tagIds: string[]; // empty = all
  groupBy: 'user' | 'project' | 'date';
  pdfTemplate: string; // template identifier
}
```

### Existing Tables (Read Only)

Reports queries join across:

- `time_entries` — the entries themselves
- `entry_segments` — actual time data (duration, timestamps)
- `users` — user names, avatars, roles
- `projects` — project names, colors
- `clients` — client names (for grouping/filtering)
- `tags` + `entry_tags` — tag filtering
- `project_members` — for RBAC scoping (manager sees only project members)

## API Endpoints

### Report Data

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| `GET`  | `/api/reports/data` | Aggregated report data based on query params |

**Query parameters:**

- `dateFrom` (required) — ISO date
- `dateTo` (required) — ISO date
- `projectIds` — comma-separated UUIDs (empty = all accessible)
- `userIds` — comma-separated UUIDs (empty = all accessible)
- `clientIds` — comma-separated UUIDs
- `tagIds` — comma-separated UUIDs
- `groupBy` — `user` | `project` | `date` (default: `user`)

**Response shape:**

```typescript
interface ReportData {
  // Period info
  dateFrom: string;
  dateTo: string;
  generatedAt: string;

  // Summary
  summary: {
    totalSeconds: number;
    totalEntries: number;
    userCount: number;
    projectCount: number;
    workingDays: number;
  };

  // User composition (for pie chart)
  userBreakdown: Array<{
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    totalSeconds: number;
    percentage: number;
    entryCount: number;
  }>;

  // Detailed entries grouped by user, then by date
  userDetails: Array<{
    userId: string;
    userName: string;
    userRole: string; // 'Senior Developer', etc. — from employment context
    totalSeconds: number;
    entryCount: number;
    daysActive: number;
    dayGroups: Array<{
      date: string;
      dayTotalSeconds: number;
      entries: Array<{
        id: string;
        description: string;
        projectName: string;
        projectColor: string;
        clientName: string | null;
        jiraIssueKey: string | null;
        startTime: string; // HH:MM
        durationSeconds: number;
      }>;
    }>;
  }>;

  // Project breakdown
  projectBreakdown: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    clientName: string | null;
    totalSeconds: number;
    percentage: number;
    entryCount: number;
  }>;
}
```

### PDF Generation

| Method | Path               | Description                   |
| ------ | ------------------ | ----------------------------- |
| `POST` | `/api/reports/pdf` | Generate PDF from report data |

**Request body:**

```typescript
{
  template: string; // 'classic-corporate' | 'dark-executive' | ... (7 options)
  config: ReportConfig;
}
```

**Response:** Binary PDF file (`Content-Type: application/pdf`)

**Implementation:** Backend fetches report data, renders the selected HTML template with the data, sends the HTML to Gotenberg, returns the resulting PDF.

### Saved Templates

| Method   | Path                         | Description                              |
| -------- | ---------------------------- | ---------------------------------------- |
| `GET`    | `/api/reports/templates`     | List user's saved templates              |
| `POST`   | `/api/reports/templates`     | Create saved template                    |
| `PATCH`  | `/api/reports/templates/:id` | Update template (name, config, favorite) |
| `DELETE` | `/api/reports/templates/:id` | Delete saved template                    |

## Infrastructure: Gotenberg

PDF generation uses [Gotenberg](https://gotenberg.dev/) — a Docker-based service that converts HTML to PDF using Chromium.

### Local Development

Add to `docker-compose.yml`:

```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  container_name: ternity-gotenberg
  restart: unless-stopped
  ports:
    - '3030:3000'
```

### Dev/Prod Deployment

Add to `deploy/dev/docker-compose.yml` and `deploy/prod/docker-compose.yml`:

```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  container_name: ternity-app-{env}-gotenberg
  networks:
    - internal
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
  security_opt:
    - no-new-privileges:true
```

API connects to Gotenberg via internal network: `http://ternity-app-{env}-gotenberg:3000`.

Environment variable: `GOTENBERG_URL=http://gotenberg:3000` (local) or `http://ternity-app-{env}-gotenberg:3000` (deployed).

### HTML → PDF Flow

1. Backend builds report data from DB (same as `/api/reports/data`)
2. Selects the HTML template file for the chosen PDF template
3. Interpolates report data into the template (server-side rendering)
4. POSTs the rendered HTML to Gotenberg's `/forms/chromium/convert/html` endpoint
5. Gotenberg returns the PDF binary
6. Backend streams the PDF to the client

## Views

### Reports Page (`/reports`)

Replaces the current dashboard redirect. Contains:

1. **Filter Panel** (top or sidebar):
   - Date range picker with presets
   - Project multi-select
   - User multi-select (scoped by role)
   - Client multi-select
   - Tag multi-select (if tags enabled)
   - Group-by toggle

2. **Saved Templates Panel** (sidebar or dropdown):
   - List of saved configurations with names
   - Favorites starred at top
   - Click to load, with "Save as new" option
   - Delete option

3. **Report Preview Area** (main content):
   - Shows aggregated data as in-app tables + charts
   - Template gallery: horizontal strip of 7 template thumbnails
   - Clicking a template shows a full preview (HTML rendered in an iframe or inline)
   - "Download PDF" button

### Template Gallery

- 7 template thumbnails in a horizontal scrollable strip
- Each thumbnail: small preview image + name + "Print" or "Screen" badge
- Clicking a template updates the preview
- Selected template has a teal border/highlight

## Relationship with Other Features

### Entries Page

- Entries stays focused on individual entry CRUD (start/stop, edit, adjust, split)
- Reports consumes the same underlying data but with multi-user aggregation
- Enhanced filtering on Entries (by project, client, date range) benefits both features

### Dashboard

- Dashboard shows personal weekly/monthly stats (the current `/reports` view)
- Reports adds multi-user, multi-project, exportable aggregations
- Dashboard may link to Reports for deeper analysis ("View full report →")

### Leave Management

- Leave data is NOT included in time reports (leave days have no time entries)
- Future: separate leave/absence report could be added

### Jira Integration

- Jira issue keys appear in report entries when linked
- No additional Jira integration needed for reports

## Future Enhancements (Out of Scope v1)

- **Scheduled reports** — email a report every Monday / 1st of month
- **White-label** — organization's own logo and colors instead of Ternity branding
- **Report sharing** — shareable link to a generated report
- **Template customization** — user modifies colors/layout of a template
- **CSV/Excel export** — tabular export alongside PDF
- **Saved template sharing** — share configurations with team members
- **Leave/absence reports** — separate report type for leave data
