<!-- rule-version: 1.1 -->
# /dev Page — Component Catalog

The `/dev` page (`apps/web/src/pages/dev.tsx`) is the living design standards reference. It renders every UI component with mock data across all themes and scales. Dev-only — tree-shaken in production via `import.meta.env.DEV` guard.

For the full design process (Research → Design → Review → Reconcile → Component Prep → Implement), see `design-workflow.md`.

## Architecture

```
pages/dev.tsx                → thin shell (providers, scale state, section imports)
dev/dev-toolbar.tsx          → theme + scale switcher, Section/SubSection helpers
dev/dev-nav.tsx              → responsive navigation (side TOC + floating button)
dev/exploration-viewer.tsx   → Quick Look overlay for browsing explorations (iframe + keyboard nav)
dev/section-*.tsx            → one file per section
```

### Sections (fixed order)

| # | Section | File | What belongs here |
|---|---------|------|-------------------|
| 1 | **Explorations** | `section-explorations.tsx` | Grouped cards opening static HTML design snapshots in an iframe overlay |
| 2 | **Primitives** | `section-primitives.tsx` | Individual shadcn/custom base components (Button, Input, Badge, Dialog, etc.) |
| 3 | **Patterns** | `section-patterns.tsx` | Reusable compositions of primitives (stat card rows, data tables, timer bar, entry rows, day groups) |
| 4 | **Pages** | `section-pages.tsx` | Full page demos with mock data (User Management, Entries) |

## Section & SubSection Components

Defined in `dev-toolbar.tsx`. Auto-generate `id` attributes from the title via `toSlug()`:

```tsx
<Section title="Primitives">        → id="primitives"
<SubSection label="Stat Card">      → id="stat-card"
```

These IDs power hash anchors (`/dev#stat-card`), the TOC navigation, and IntersectionObserver tracking.

**Override:** Pass an explicit `id` prop if the auto-generated slug doesn't match what you need.

## Navigation (`dev-nav.tsx`)

Two responsive views of the same `NavTree` component:

- **xl+ screens:** Fixed right-side TOC (`fixed right-4 top-16`), always visible
- **< xl screens:** Floating button (bottom-right circle) that toggles a dropdown with the full nav tree

### When adding a new subsection

Update `NAV_ITEMS` array in `dev-nav.tsx` — it's a hardcoded list, not auto-discovered. The `id` must match the Section/SubSection's generated or explicit `id`.

```ts
{
  id: 'patterns',
  label: 'Patterns',
  children: [
    { id: 'stat-cards', label: 'Stat Cards' },
    { id: 'your-new-item', label: 'New Item' },  // ← add here
  ],
},
```

## Hash Anchors

- Every `[id]` element has `scroll-margin-top: 4rem` (in `globals.css`) to clear the sticky toolbar
- URLs update via `history.replaceState` on nav click — survives refresh
- On page load with `#hash`, a `requestAnimationFrame` scroll fires after React renders

## Adding a New Component

1. **Decide the section** — is it a base primitive, a reusable pattern, or a page demo?
2. **Add to the section file** — wrap in `<SubSection label="Component Name">` (or `<Section>` for a new top-level section)
3. **Update `dev-nav.tsx`** — add the matching entry to `NAV_ITEMS`
4. **Use the real component** with mock data — never create a separate "dev version"
5. **Verify** across all 6 themes and 3 scale levels using the toolbar

## Mock Data Rules

- **Fictitious data only** — never use real team names, emails, or company domains
- Use obviously fake names: Elena Marsh, James Oakley, Alex Morgan, etc.
- Use generic domains: `acme.io`, `netbulls.com` (the fictional company in demos)
- This applies to all demos, previews, and static HTML explorations

## Explorations

### Viewer (`exploration-viewer.tsx`)

Explorations are browsed via a Quick Look-style overlay — not opened in new tabs. The viewer:

- Uses Radix Dialog primitives directly (not the shared `DialogContent` which is max-w-lg)
- Renders explorations in a full-viewport iframe (`fixed inset-4`)
- Keyboard navigation: ArrowLeft/ArrowRight cycle through all explorations with wrap-around
- Floating vertical side rail (right edge) with prev/next, counter, open-in-new-tab, and close
- `key={current.file}` on the iframe forces remount on navigation

### Grouped structure (`section-explorations.tsx`)

Explorations are organized into named groups, each rendered as a `<SubSection>` with an explicit `id` (suffixed `-explorations` to avoid collision with other sections):

```ts
{ name: 'Impersonation', id: 'impersonation-explorations', explorations: [...] }
```

Clicking a card opens the overlay at that exploration's index. Navigation wraps across all explorations regardless of group.

### Static HTML files

HTML design snapshots live in `apps/web/public/explorations/`. Served by Vite at `/explorations/*.html`. They share `themes.css` via relative path and include their own theme/scale switchers.

**Naming convention:** `{feature}-{4hex}.html` — random 4-char hex suffix per file.

- Every exploration file is **immutable** — once created, never modified. New iterations get new files.
- Multiple explorations for the same feature coexist (e.g., `impersonation-4a1c.html`, `impersonation-8f3d.html`)

