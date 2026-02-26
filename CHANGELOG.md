# Changelog

## [Unreleased]

### Added
- Expose createdAt field in Entry API response for stable client-side sorting
- Soft-delete entries with deleted view toggle and restore capability
- Move time blocks between entries (block_moved audit action)
- Clone/duplicate entries with auto-incrementing copy names
- Time block drawer for segment-level management

### Changed
- Standardize all dialog widths to 512px (max-w-lg) and cancel button style (ghost variant)
- Fix switch timer dialog overflow with long descriptions and project names

### Fixed
- Redesign downloads page with framework tabs, platform tabs, and channel badges (release/snapshot)
- Restructure downloads API to group artifacts by framework and channel
- Wire CHANGELOG.md into downloads API to serve release notes per version
- Inline version label in channel badges on downloads page
- Scope checksum table to show only platform-relevant artifacts

## [0.2.0] - 2026-02-19

### Added
- Downloads page with signed download URLs, platform detection, and framework tabs
- Dashboard page with weekly/monthly charts and project breakdown
- Project management CRUD with client/project admin UI
- Entry audit trail with change history
- Inline entry editing with project selector animations
- Impersonation UI for admin users
- Manual time entry dialog
- Settings page with theme, scale, and default project preferences
- Incomplete entries filter with amber border animation
- Component catalog (`/dev`) and design lab (`/dev/lab`)

### Changed
- Redesign settings page with two-column layout

### Fixed
- Timer not stopping on sleep/wake cycle
- Stale play/stop button state when switching running entries
- 415 Unsupported Media Type on bodyless PATCH/POST/PUT requests
