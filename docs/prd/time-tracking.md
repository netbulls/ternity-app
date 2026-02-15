# Time Tracking

## Overview

Toggl-style start/stop time logging with smart entry management. Entries live under a Client → Project hierarchy with multi-label support for filtering and reporting.

## Core Workflows

### Start/Stop Timer

1. User clicks Start
2. Pastes or types task name (e.g., "PROJ-123 Fix login bug")
3. Selects Client → Project from hierarchy
4. Adds one or more labels (e.g., "jira", "bugfix")
5. Clicks Stop when done
6. Entry is saved with duration, timestamp, project, and labels

### Entry Management & Deduplication

1. System groups similarly named entries
2. Suggests merge when duplicates are detected (from copy/paste or manual entry)
3. User reviews and confirms or dismisses merge suggestions

### Reports

1. User selects report period (day, week, month, year)
2. Chooses scope: individual or group
3. Applies filters: project, client, labels, group
4. Report displays with entry-level detail within each project
5. Export available for external use

## Labels

- Multiple labels per entry
- Used for filtering in reports and views
- Key use case: Jira ticket ID prefix as label for sync identification
- System-managed labels possible (e.g., "synced-to-jira")
