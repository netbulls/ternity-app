# Phase Progress Report

Read `PHASES.md` from the project root and generate a progress report.

## Steps

### 1. Parse phases

For each phase (Phase 0 through Phase 6):
- Count total checkboxes (`- [ ]` and `- [x]`)
- Count checked checkboxes (`- [x]`)
- Calculate percentage: `checked / total * 100`
- Detect current phase (has 🔄 in heading)

### 2. Build progress bars

For each phase, generate a visual bar (20 chars wide):

```
█████████████████████ 100%   Phase 0 — Foundation ✅
████░░░░░░░░░░░░░░░░  15%   Phase 1 — Core Time Tracking 🔄
░░░░░░░░░░░░░░░░░░░░   0%   Phase 2 — Entry Management
```

Bar character mapping:
- `█` for filled portion (round to nearest whole block)
- `░` for empty portion
- Width: 20 characters total

### 3. Calculate overall progress

Sum all checked checkboxes across all phases divided by total checkboxes.

### 4. Show next items

List the next 3 unchecked items (`- [ ]`) from the current phase (the one with 🔄). If the current phase has fewer than 3 remaining, include items from the next phase.

### 5. Output format

Print the report in this exact format:

```
Ternity — Phase Progress
═══════════════════════════════════════════════════

█████████████████████ 100%   Phase 0 — Foundation ✅
████░░░░░░░░░░░░░░░░  15%   Phase 1 — Core Time Tracking 🔄
░░░░░░░░░░░░░░░░░░░░   0%   Phase 2 — Entry Management
░░░░░░░░░░░░░░░░░░░░   0%   Phase 3 — Leave Management
░░░░░░░░░░░░░░░░░░░░   0%   Phase 4 — Reports & Calendar
░░░░░░░░░░░░░░░░░░░░   0%   Phase 5 — Admin & Organization
░░░░░░░░░░░░░░░░░░░░   0%   Phase 6 — Polish & Integration

Overall: 10/87 (11%)

Next up:
  → Zod schemas for time entry (create, update, response)
  → Zod schemas for project/client (response)
  → Shared constants (duration limits, validation rules)
```

Percentage is right-aligned within 4 characters (e.g., `100%`, ` 15%`, `  0%`).

Do NOT run any bash commands — this is a read-and-report task only.