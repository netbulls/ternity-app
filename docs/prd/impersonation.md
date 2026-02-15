# Impersonation

## Problem

Admins need to see the app exactly as a specific user sees it — their data, their permissions, their dashboard. Without this, debugging user issues requires either screen-sharing or building separate admin views for every page. Managers who want to review an employee's time breakdown across projects would need a dedicated manager dashboard — impersonation makes every existing page serve that purpose.

## Use Cases

1. **Debugging & testing** — Verify what a specific user sees. Test different data sets, permission levels, and edge cases without maintaining separate test accounts.
2. **Operational review** — Admin (or eventually manager) views an employee's dashboard to see their time breakdown, project allocation, and entries — using the same UI the employee uses, not a separate admin report.

## Scope

- **Who can impersonate:** Admins only (global `admin` role)
- **Who can be impersonated:** Any user in the system
- **Permission model:** Full lockdown — the admin sees and can do exactly what the target user can. No retained admin powers during impersonation.
- **Persistence:** Survives page refresh and new tabs (stored client-side). Ends explicitly when the admin clicks "Exit" or closes/clears the session.

## UX

### Entry Point

The existing **User Management** page has a list of users (with active/inactive status). Each user row gets an impersonation action (e.g., an icon button or menu item) — "View as [user]".

Clicking it:
1. Stores the impersonation target (user ID) client-side
2. Reloads the app state as that user
3. Shows the persistent impersonation indicator

### Impersonation Indicator

A **persistent, prominent bar** visible on every page while impersonating. Not buried in a menu — unmistakably visible. Should include:

- The impersonated user's name (e.g., "Viewing as Elena Marsh")
- An "Exit" button that immediately returns to the admin's own session
- Visual treatment that stands out from the normal UI (e.g., colored banner at top or bottom of viewport)

The indicator must be visible across all views — entries, dashboard, calendar, settings, everything.

### Exiting Impersonation

- Click "Exit" on the impersonation bar
- Clears the stored impersonation state
- Returns to the admin's own session and data
- Navigates back to a sensible page (e.g., User Management or the page they were on)

## Technical Approach

### Frontend

- **State:** Impersonation target user ID stored in `localStorage` (survives refresh). Also held in React state/context for reactivity.
- **API calls:** When impersonating, all API requests include an impersonation header (e.g., `X-Impersonate-User: <userId>`) so the backend returns that user's data.
- **Auth context:** The app's auth context should expose `currentUser` (who is actually logged in) and `effectiveUser` (who the app is acting as). All UI reads `effectiveUser`. The impersonation bar reads `currentUser` to know who the admin is.
- **Route guards:** No special handling — since the app behaves as the impersonated user, their role determines accessible routes. The only exception is the impersonation bar itself, which is always rendered when impersonation is active.

### Backend

- **Header:** API reads `X-Impersonate-User` header on incoming requests.
- **Authorization:** Only requests from users with the `admin` role are allowed to include this header. Non-admin requests with the header are rejected (403).
- **Data resolution:** When the header is present, the backend resolves all data queries against the impersonated user's ID, roles, and permissions — not the admin's.
- **Audit:** Impersonation events should be logged (who impersonated whom, when) for accountability.

### What Changes for Impersonation

| Concern | Behavior |
|---|---|
| Data queries | Resolved against impersonated user |
| Permissions/roles | Impersonated user's roles apply |
| UI rendering | Identical to what the impersonated user sees |
| Navigation/routes | Impersonated user's access level |
| Impersonation bar | Always visible (only extra UI element) |
| Audit trail | Logged server-side |

## Out of Scope (for now)

- **Manager impersonation** — only admins for v1. Manager access can be added later by extending the permission check.
- **Write actions while impersonating** — v1 is primarily read-only observation. If write actions are allowed, they execute as the impersonated user (with audit logging). Decision: allow full actions (it's admin-only, and useful for debugging), but revisit if manager impersonation is added.
- **Notification to impersonated user** — the user being impersonated is not notified. This is an admin tool.

## Edge Cases

- **Impersonating a deactivated user** — should work (useful for debugging why they can't access something). The app shows whatever that user would see, which may be nothing if access is revoked.
- **Impersonated user is deleted** — clear impersonation state, return to admin session.
- **Multiple tabs** — since state is in `localStorage`, all tabs share the same impersonation. Starting/stopping impersonation in one tab affects all tabs on next state sync.
- **Admin impersonating another admin** — allowed. The impersonating admin sees exactly what the other admin sees.
