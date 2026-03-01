<!-- rule-version: 1.1 -->

# Directory Boundaries

- Only read, write, and modify files within this project's root directory and `/tmp`.
- Never access files outside these paths without explicit user permission.
- Use `/tmp` for temporary/scratch files when needed.

## Standard Project Directories

These directories may exist in any project. When referenced by name, check locally first:

| Directory              | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `inbox/`               | Incoming files for processing — user drops files here for Claude to work with |
| `archive/screenshots/` | Playwright browser snapshots and screenshots                                  |
| `recording/`           | Democaster screencast recordings and screenplays                              |

## Recording Conventions

Files in `recording/` follow the pattern `YYYY-MM-DD-<topic>.<ext>`:

- **Screenplay:** `2026-03-01-my-day-week-nav.json`
- **Recording:** `2026-03-01-my-day-week-nav.mp4`

Date prefix keeps them sortable. Each screenplay `.json` has a matching `.mp4` output. Old/superseded recordings should be deleted — keep only the latest per screenplay.
