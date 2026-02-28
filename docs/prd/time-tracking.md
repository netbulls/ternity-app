# Time Tracking

## Overview

Toggl-style start/stop time logging with smart entry management. Entries live under a Client → Project hierarchy with personal, opt-in tags for filtering and reporting.

## Core Workflows

### Start/Stop Timer

1. User clicks Start
2. Pastes or types task name (e.g., "PROJ-123 Fix login bug")
3. Selects Client → Project from hierarchy
4. Adds one or more tags (e.g., "jira", "bugfix") — if tags are enabled
5. Clicks Stop when done
6. Entry is saved with duration, timestamp, project, and tags

### Entry Management & Deduplication

1. System groups similarly named entries
2. Suggests merge when duplicates are detected (from copy/paste or manual entry)
3. User reviews and confirms or dismisses merge suggestions

### Reports

1. User selects report period (day, week, month, year)
2. Chooses scope: individual or group
3. Applies filters: project, client, tags, group
4. Report displays with entry-level detail within each project
5. Export available for external use

## Tags

- Personal — each user has their own set of tags, not visible to others
- Multiple tags per entry
- Opt-in — gated behind `tagsEnabled` user preference (default: `false`)
- Users who had tagged entries from Toggl sync have `tagsEnabled` set to `true` automatically
- Toggle in Settings > General to enable/disable
- Used for filtering in reports and views
- Tag pickers appear in: entries filter bar, manual entry dialog
