# Changelog

## [Unreleased]

### Added
- Expose createdAt field in Entry API response for stable client-side sorting

### Changed
- Redesign downloads page with framework tabs, platform tabs, and channel badges (release/snapshot)
- Restructure downloads API to group artifacts by framework and channel
- Wire CHANGELOG.md into downloads API to serve release notes per version

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
