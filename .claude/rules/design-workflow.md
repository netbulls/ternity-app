<!-- rule-version: 1.0 -->
# Design Workflow

How UI work is done in Ternity. Design freely, standardize later — the registry is extracted from great designs, not imposed on them.

## Principles

- **Design freely, standardize later.** Don't constrain creativity with premature standards.
- **Oxanium for structure, Inter for content.** Brand font (Oxanium) on: page titles, stat values, stat labels, filter tabs, column headers, nav sections, number cells. Body font (Inter) on: buttons, badges, body text, emails, timestamps, inputs.
- **Scale as user preference.** Three levels via `--t-scale` CSS variable: compact (0.9), default (1.1), comfortable (1.2). Stored alongside theme preference.
- **Real components in `/dev`, not clones.** Every component in the `/dev` catalog must be the actual production component with mock data. No static copies.
- **Primitives reflect actual usage, not library defaults.** Never show generic library examples when the app has its own established pattern.
- **Mockups are the design intent record.** Approved HTML mockups are kept permanently in `assets/mockups/`. They serve as the reference for what was intended before implementation pragmatics.

## Workflow Steps

### 1. Research
- Search UX patterns for the specific view type
- Browse shadcn base components, blocks, directory (127 community registries)
- Look at how comparable tools handle this (Toggl, Linear, Slack, etc.)
- Output: brief with candidate patterns and components

### 2. Design
- HTML mockup using actual theme CSS (`themes.css`)
- Design freely — best possible design for this specific view
- Don't constrain to existing components. Go for it.
- Include multiple states (default, selection, dialog, success feedback)
- Theme switcher + scale toggle for validation across themes
- Save approved mockup to `assets/mockups/` as permanent design intent record

### 3. Review
- User reviews the mockup
- Naturally spots: "we have this already", "I like this better than what we had", "this doesn't feel right"
- Human pattern matching — not checking every piece, just what jumps out
- Iterate until approved

### 4. Reconcile
After design approval, systematically source each component:

**Priority order:**
1. **Our local registry** — already standardized and proven. Use as-is, or flag if the new design improved it (propose registry update).
2. **shadcn base** — maintained, accessible, well-tested primitives
3. **shadcn directory / community registries** — broader ecosystem, curated blocks
4. **Custom build** — last resort, only when nothing suitable exists

Output: component plan — what exists, what to reuse, what to build, what to source. Iterate with user until agreed.

If the new design introduces a better version of an existing registry component, propose updating the standard rather than keeping the old one.

### 5. Component Prep
Get the building blocks right before assembling the feature:

- Build new components or adjust existing ones
- Fine-tune in `/dev` with mock data — verify across all 6 themes and 3 scale levels
- Compare against the design intent mockup (is the component matching the approved design?)
- New components that proved useful → add to local registry
- Improved versions of existing components → update registry

This step ends when all components look right in `/dev` and match the approved design.

### 6. Implement
- Plan the feature page — mostly composition of tuned components
- Build in React, assembling from the components prepared in step 5
- Match the approved mockup
- Feature-specific wiring (data fetching, mutations, navigation) goes here

## Design Intent Archive

Approved HTML mockups live permanently in `assets/mockups/`. They are the record of what was approved before implementation. Use them to detect unintended drift — if a live component looks different from the mockup, it should be a conscious decision, not accidental.

## Component Registry

**Location:** TBD — will follow shadcn registry pattern for cross-project portability.

### Decisions Made So Far

| Component | Decision | Source | Date |
|---|---|---|---|
| Filter tabs / segmented control | shadcn `ToggleGroup`, active style: `bg-primary/8` subtle tint (no solid fill, no underline) | shadcn base | 2026-02-14 |
| Status badge | Dot + color + label. Active=green calm, Inactive=grey receded | shadcn `Badge` + custom variants | 2026-02-14 |
| Role badge | Outline pill, muted | shadcn `Badge` variant="outline" | 2026-02-14 |
| Data table | TanStack Table + shadcn DataTable pattern | shadcn base | 2026-02-14 |
| Stat cards | Clickable summary cards above table, act as filters | Custom (based on existing pattern) | 2026-02-14 |
| Bulk action bar | Floating bottom-center, backdrop blur, appears on selection | Custom (pattern from shadcn-admin) | 2026-02-14 |
| Confirmation dialog | For destructive/consequential actions (deactivation). Safe actions (activation) skip confirmation. | shadcn `AlertDialog` | 2026-02-14 |
| Toast with undo | Success feedback after bulk actions, time-limited undo link | shadcn `Sonner` | 2026-02-14 |
| No toggle switches for consequential actions | Activation/deactivation via menu + confirmation, not inline toggles | UX research consensus | 2026-02-14 |

### Typography Standard

| Context | Font | Weight | Scale |
|---|---|---|---|
| Page titles | Oxanium | 600 | 18px × scale |
| Stat values | Oxanium | 700 | 22px × scale |
| Stat labels | Oxanium | 400 | 10px × scale |
| Filter tabs | Oxanium | 500 | 11px × scale |
| Column headers | Oxanium | 600 | 11px × scale |
| Nav sections | Oxanium | 400 | 9px × scale |
| Number cells | Oxanium | 600 | 13px × scale |
| Badge counts | Oxanium | — | 10px × scale |
| Body / table text | Inter | 400-500 | 13px × scale |
| Buttons | Inter | 500 | 12-13px × scale |
| Badges (status/role) | Inter | 500 | 10-11px × scale |
| Emails / timestamps | Inter | 400 | 11-12px × scale |
| Search input | Inter | 400 | 12px × scale |
