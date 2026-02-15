<!-- rule-version: 1.0 -->
# /dev Page — Component Catalog

The `/dev` page (`apps/web/src/pages/dev.tsx`) is the living design standards reference. It renders every UI component with mock data across all themes and scales. Dev-only — tree-shaken in production via `import.meta.env.DEV` guard.

## Architecture

```
pages/dev.tsx           → thin shell (providers, scale state, section imports)
dev/dev-toolbar.tsx     → theme + scale switcher, Section/SubSection helpers
dev/dev-nav.tsx         → responsive navigation (side TOC + floating button)
dev/section-*.tsx       → one file per section
```

### Sections (fixed order)

| # | Section | File | What belongs here |
|---|---------|------|-------------------|
| 1 | **Explorations** | `section-explorations.tsx` | Links to static HTML design snapshots in `public/explorations/` |
| 2 | **Primitives** | `section-primitives.tsx` | Individual shadcn/custom base components (Button, Input, Badge, Dialog, etc.) |
| 3 | **Patterns** | `section-patterns.tsx` | Reusable compositions of primitives (stat card rows, data tables, timer bar, entry rows, day groups) |
| 4 | **Pages** | `section-pages.tsx` | Full page demos with mock data (User Management, Entries) |

**Rule: primitives show actual app usage, not library defaults.** If the app uses StatCard, that's what the Stat Card primitive shows — not a generic shadcn Card with placeholder text. The `/dev` page defines how components look in this app.

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

## Scale & Theme Testing

The dev toolbar provides:
- **6 themes:** Ternity Dark (default), Ternity Light, Midnight, Warm Sand, Carbon, High Contrast
- **3 scales:** Compact (0.9), Default (1.1), Comfortable (1.2)

The page content uses CSS `zoom` proportional to the active scale. All `scaled()` values respond to `--t-scale` on `:root`.

## Static Explorations

HTML design snapshots live in `apps/web/public/explorations/`. They are frozen references — never modified after approval. Served by Vite at `/explorations/*.html`. They share `themes.css` via relative path.
