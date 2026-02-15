<!-- rule-version: 1.3 -->
# /dev — Component Catalog & Design Lab

Two dev-only pages (tree-shaken in production via `import.meta.env.DEV` guard):

- **`/dev`** — **Catalog.** Component standards reference (Primitives, Patterns, Pages).
- **`/dev/lab`** — **Lab.** Design archive grouped by feature (Explorations + Prototypes).

For the full design process (Experimentation → Prototyping → Implementation), see `design-workflow.md`.

## Architecture

```
pages/dev.tsx                → Catalog page shell (providers, scale state, section imports)
pages/dev-lab.tsx            → Lab page shell (same pattern)
pages/dev-*.tsx              → standalone prototype pages (e.g., dev-flair.tsx)
dev/dev-toolbar.tsx          → Catalog/Lab switcher, theme + scale switcher, Section/SubSection helpers
dev/dev-nav.tsx              → responsive navigation (side TOC + floating button), accepts items prop
dev/exploration-viewer.tsx   → Quick Look overlay for browsing explorations (iframe + keyboard nav)
dev/lab-data.ts              → Lab data model (LabExploration, LabPrototype, LAB_GROUPS, timeAgo)
dev/section-*.tsx            → one file per catalog section + section-lab.tsx for the lab
```

## Page Switcher

The `DevToolbar` renders Catalog/Lab links at the left side, before the theme controls. Active state derived from `useLocation().pathname`. Both pages share the same toolbar.

## Catalog (`/dev`)

### Sections (fixed order)

| # | Section | File | What belongs here |
|---|---------|------|-------------------|
| 1 | **Primitives** | `section-primitives.tsx` | Individual shadcn/custom base components (Button, Input, Badge, Dialog, etc.) |
| 2 | **Patterns** | `section-patterns.tsx` | Reusable compositions of primitives (stat card rows, data tables, timer bar, entry rows, day groups) |
| 3 | **Pages** | `section-pages.tsx` | Full page demos with mock data (User Management, Entries) |

### Navigation

Nav items are defined in `dev.tsx` as `CATALOG_NAV_ITEMS` and passed to `DevNav` via the `items` prop.

## Lab (`/dev/lab`)

### Data model (`lab-data.ts`)

Discriminated union for mixed item types within feature groups:

- `LabExploration` — `kind: 'exploration'`, has `file` (filename in `public/explorations/`)
- `LabPrototype` — `kind: 'prototype'`, has `route` (e.g., `/dev/flair`)
- `LabFeatureGroup` — named group with mixed `LabItem[]`

`LAB_GROUPS` constant holds all feature groups. `timeAgo()` converts ISO dates to relative strings.

### Directory view (`section-lab.tsx`)

Same collapsible file-system UI pattern as the old explorations section, but with mixed item types:

- **Exploration rows** — `FileText` icon, `Eye` on hover → opens `ExplorationViewer` overlay
- **Prototype rows** — `Play` icon, primary accent → navigates to the route

### Navigation

Nav items are derived from `LAB_GROUPS` in `dev-lab.tsx` and passed to `DevNav` via the `items` prop.

## Section & SubSection Components

Defined in `dev-toolbar.tsx`. Auto-generate `id` attributes from the title via `toSlug()`:

```tsx
<Section title="Primitives">        → id="primitives"
<SubSection label="Stat Card">      → id="stat-card"
```

These IDs power hash anchors (`/dev#stat-card`), the TOC navigation, and IntersectionObserver tracking.

**Override:** Pass an explicit `id` prop if the auto-generated slug doesn't match what you need.

## Navigation (`dev-nav.tsx`)

Accepts an `items: NavItem[]` prop — each page passes its own nav structure. Two responsive views of the same `NavTree` component:

- **xl+ screens:** Fixed right-side TOC (`fixed right-4 top-16`), always visible
- **< xl screens:** Floating button (bottom-right circle) that toggles a dropdown with the full nav tree

### When adding a new subsection

Update the `NAV_ITEMS` array in the relevant page file (`dev.tsx` for catalog, `dev-lab.tsx` for lab). The `id` must match the Section/SubSection's generated or explicit `id`.

## Hash Anchors

- Every `[id]` element has `scroll-margin-top: 4rem` (in `globals.css`) to clear the sticky toolbar
- URLs update via `history.replaceState` on nav click — survives refresh
- On page load with `#hash`, a `requestAnimationFrame` scroll fires after React renders

## Adding a New Component

1. **Decide the section** — is it a base primitive, a reusable pattern, or a page demo?
2. **Add to the section file** — wrap in `<SubSection label="Component Name">` (or `<Section>` for a new top-level section)
3. **Update the nav items** in `dev.tsx` (`CATALOG_NAV_ITEMS`)
4. **Use the real component** with mock data — never create a separate "dev version"
5. **Verify** across all 6 themes and 3 scale levels using the toolbar

## Adding a New Exploration or Prototype

1. **Add the item** to the appropriate group in `LAB_GROUPS` (`lab-data.ts`)
2. For explorations: add the HTML file to `public/explorations/`
3. For prototypes: create the page file and add the route to `router.tsx`

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
- Keyboard navigation: ArrowLeft/ArrowRight cycle, Escape closes — works even when iframe has focus (same-origin listener attached via `onLoad`)
- Floating vertical side rail (right edge) with prev/next, counter, open-in-new-tab, and close
- `key={current.file}` on the iframe forces remount on navigation

### Static HTML files

HTML design snapshots live in `apps/web/public/explorations/`. Served by Vite at `/explorations/*.html`. They share `themes.css` via relative path and include their own theme/scale switchers.

**Naming convention:** `{feature}-{4hex}.html` — random 4-char hex suffix per file.

- Every exploration file is **immutable** — once created, never modified. New iterations get new files.
- Multiple explorations for the same feature coexist (e.g., `impersonation-4a1c.html`, `impersonation-8f3d.html`)

## Prototypes

Interactive React pages for Phase 2 (Prototyping) of the design workflow. These capture what static HTML can't: motion, animation timing, interaction feedback, transitions, loading states, responsive behavior.

### Structure

Each prototype is a standalone page at `/dev/{name}`:

- **Route:** registered in `router.tsx` under the dev guard
- **File:** `pages/dev-{name}.tsx` — self-contained with its own providers, mock data, and `DevToolbar`
- **Pattern:** multiple labeled variants side by side, ending with a "Final Set" combining the winners
- **Listed in Lab:** add a `LabPrototype` entry to the relevant group in `LAB_GROUPS`

### Existing prototypes

| Route | File | What it covers |
|---|---|---|
| `/dev/flair` | `pages/dev-flair.tsx` | Timer bar flair (6 variants), inline entry editing (2 variants), project picker, project confirm animations. Final set: F3c Liquid Edge + E2 Alive + P1 + C1 Pill Pop |

### Conventions

- Self-contained — no dependency on real API, auth, or app providers
- Uses `DevToolbar` for theme + scale switching (same as `/dev`)
- Mock data and fake hooks for interactive behavior
- Each variant labeled with an ID (F1, F2, E2, C1, etc.) and a description of what makes it different
- Final set at the bottom combines the approved winners
- Dev-only — tree-shaken via `import.meta.env.DEV` guard
