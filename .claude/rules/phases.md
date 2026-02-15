<!-- rule-version: 1.0 -->
# Phases

## Phase Tracker

The living progress document is `PHASES.md` in the project root. It defines every deliverable grouped by phase and layer.

## Naming Convention

Phases use the format: `Phase N — Short Name`

| Phase | Name |
|---|---|
| Phase 0 | Foundation |
| Phase 1 | Core Time Tracking |
| Phase 2 | Entry Management |
| Phase 3 | Leave Management |
| Phase 4 | Reports & Calendar |
| Phase 5 | Admin & Organization |
| Phase 6 | Polish & Integration |

## Status Indicators

- `✅` or all checkboxes checked — phase complete
- `🔄` suffix on heading — phase currently in progress
- No indicator — phase is pending (future work)

Only one phase should have the 🔄 indicator at a time.

## Layer Priority

Within each phase, work follows API-first order:

1. **Shared** — schemas, types, constants
2. **Backend** — endpoints, DB changes, validation
3. **Frontend** — UI, data fetching, interactions

This ensures the frontend always builds against a working API.

## Transition Rules

- Only the user initiates a phase transition (marking a phase as current or complete).
- Claude updates individual checkboxes in `PHASES.md` as work is completed during a session.
- A phase is complete when all its checkboxes are checked.
- Do not skip phases — they are sequential by design.

## Checkbox Updates

When completing a deliverable listed in `PHASES.md`:

1. Finish the implementation.
2. Check the corresponding checkbox (`- [ ]` → `- [x]`).
3. If the last checkbox in a phase is checked, inform the user so they can decide whether to transition.