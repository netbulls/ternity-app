<!-- rule-version: 1.2 -->
# Design Workflow

How UI work is done in Ternity. Design freely, standardize later — the registry is extracted from great designs, not imposed on them.

Three phases — **Experimentation**, **Prototyping**, **Implementation**. Each phase is an iterative loop (work ↔ review) with a clear exit gate. Not every feature needs all phases (a simple form might skip Prototyping), but the sequence is always the same.

## Principles

- **Design freely, standardize later.** Don't constrain creativity with premature standards.
- **Oxanium for structure, Inter for content.** Brand font (Oxanium) on: page titles, stat values, stat labels, filter tabs, column headers, nav sections, number cells. Body font (Inter) on: buttons, badges, body text, emails, timestamps, inputs.
- **Scale as user preference.** Three levels via `--t-scale` CSS variable: compact (0.9), default (1.1), comfortable (1.2). Stored alongside theme preference.
- **Real components in `/dev`, not clones.** Every component in the `/dev` catalog must be the actual production component with mock data. No static copies.
- **Primitives reflect actual usage, not library defaults.** Never show generic library examples when the app has its own established pattern.
- **Explorations are the design record.** Static iterations live in `public/explorations/` as immutable HTML snapshots, browsed via the `/dev` overlay.
- **Prototypes are the interaction record.** Interactive iterations live as standalone pages under `/dev/*` (e.g., `/dev/flair`), built in React with real animation libraries and mock data.

## Phase 1: Experimentation

*What should it look like?*

Explore the design space. Static HTML — layout, visual hierarchy, component choices, states.

- **Research** — Search UX patterns, browse shadcn base/directory/community registries, study comparable tools (Toggl, Linear, Slack, etc.). Output: brief with candidate patterns and components.
- **Design** — HTML exploration using actual theme CSS (`themes.css`). Design freely — don't constrain to existing components. Include multiple states (default, selection, dialog, success feedback). Theme switcher + scale toggle for validation. Save as immutable exploration in `public/explorations/` (see `dev-page.md` for naming convention).
- **Review** ↔ iterate — User reviews, spots what works and what doesn't. Human pattern matching. Iterate until approved.

**Exit gate:** Approved visual direction — layout, structure, visual style settled.

## Phase 2: Prototyping

*How should it feel?*

Take the approved visual direction and make it interactive. Anything static HTML can't capture: motion and animation timing, interaction feedback and transitions, complex interconnected flows, loading and error states, responsive behavior, multi-step workflows. Build it real enough to experience — mock data, no real API, but actual React with actual interactions.

- **Prototype** — Build interactive variants in React with real animation libraries (motion/react, CSS keyframes, etc.). Multiple labeled treatments side by side for comparison. Mock data and fake hooks — no real API wiring. Each variant described (what it does, how it differs). Lives as a standalone dev page under `/dev/*` (e.g., `/dev/flair`).
- **Review** ↔ iterate — User interacts with the prototypes — clicks, types, starts/stops, watches transitions. Decides on the winning combination. May request new variants or adjustments. End with a "final set" combining the winners. Iterate until approved.

**Exit gate:** Approved interaction design — the "final set" is the reference for implementation.

## Phase 3: Implementation

*Build it into the app.*

- **Plan** — Systematically prepare for implementation:
  - **Reconcile:** Inventory every component and pattern from the approved exploration + prototype. For each piece, determine the source:
    1. **Our local registry** — already standardized and proven. Use as-is, or flag if the new design improved it (propose registry update).
    2. **shadcn base** — maintained, accessible, well-tested primitives
    3. **shadcn directory / community registries** — broader ecosystem, curated blocks
    4. **Custom build** — last resort, only when nothing suitable exists
  - **Animation patterns:** What libraries are needed, what can be CSS-only, what needs shared hooks
  - **File plan:** Which files to create, modify, where components live
  - If the new design introduces a better version of an existing registry component, propose updating the standard rather than keeping the old one.
  - Iterate with user until the plan is agreed.
- **Build** ↔ verify — Build components first, fine-tune in `/dev` with mock data across all 6 themes and 3 scale levels. Compare against both the approved exploration (visual) and the approved prototype (interaction). Assemble the feature page from tuned components. Feature-specific wiring (data fetching, mutations, navigation). New components that proved useful → add to local registry.

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
