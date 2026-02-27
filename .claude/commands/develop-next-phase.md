# Develop Next Phase

Pick up the next phase from `PHASES.md` and implement it end-to-end: plan, build, test, fix.

## Steps

### 1. Read current state

Read `PHASES.md` and identify:
- **Current phase** — the one with 🔄 in the heading. If none has 🔄, find the first phase with unchecked items and mark it as current.
- **Completed phases** — all checkboxes checked.
- **Remaining items** — unchecked checkboxes in the current phase, grouped by layer (Shared → Backend → Frontend).

If all phases are complete, print "All phases complete!" and stop.

### 2. Read existing code

Before planning, thoroughly read all files relevant to the current phase:
- All files in `packages/shared/src/`
- All route files in `apps/api/src/routes/`
- All relevant page files in `apps/web/src/pages/`
- Database schema in `apps/api/src/db/schema.ts`
- Existing tests (if any)

Understand existing patterns, naming conventions, and imports before writing anything.

### 3. Prepare implementation plan

Create a step-by-step plan and present it to the user before writing code. The plan must:

- List every deliverable from the current phase, in layer order: **Shared → Backend → Frontend**
- For each deliverable, specify:
  - File(s) to create or modify
  - Key decisions (API shape, component structure, validation rules)
  - Dependencies on other deliverables
- Note any items that may need to be added to `PHASES.md` (discovered during planning)
- Estimate which files will need tests

**Wait for user approval before proceeding.**

### 4. Implement — Shared layer

Implement all Shared items first:
- Create/update Zod schemas in `packages/shared/src/`
- Export from `packages/shared/src/index.ts`
- Run `pnpm -r type-check` to verify types compile

Check off each completed item in `PHASES.md`.

### 5. Implement — Backend layer

Implement all Backend items:
- Create route files in `apps/api/src/routes/`
- Register routes in `apps/api/src/server.ts`
- Add DB queries using Drizzle ORM
- Create new migrations if schema changes are needed (`pnpm db:generate`)
- Run `pnpm -r type-check` after each major piece

Check off each completed item in `PHASES.md`.

### 6. Implement — Frontend layer

Implement all Frontend items:
- Replace stub pages with real implementations
- Create components in `apps/web/src/components/`
- Add data fetching hooks using TanStack Query
- Wire up forms, modals, and interactions
- Run `pnpm -r type-check` after each major piece

Check off each completed item in `PHASES.md`.

### 7. Unit & integration tests

Write tests for the functionality created in this phase:
- **Shared:** Schema validation tests (valid/invalid inputs) in `packages/shared/src/__tests__/`
- **Backend:** Route handler tests (HTTP requests, responses, edge cases) in `apps/api/src/__tests__/`
- Use Vitest (already configured)
- Follow existing test conventions if any tests exist

Run all tests:
```bash
pnpm -r test
```

Fix any failures before continuing.

### 8. E2E tests

Write end-to-end tests for the features added in this phase:
- Create tests in `apps/web/e2e/` using Playwright
- If Playwright is not yet set up, install and configure it first:
  ```bash
  pnpm --filter @ternity/web add -D @playwright/test
  ```
- Test the key user workflows defined in the PRD for this phase
- Run against the dev environment (stub auth mode)

Run e2e tests:
```bash
pnpm --filter @ternity/web exec playwright test
```

Fix any failures before continuing.

### 9. Final verification

Run the full check suite:
```bash
pnpm -r type-check && pnpm -r lint && pnpm -r test
```

If anything fails, fix it. Repeat until all checks pass.

### 10. Update PHASES.md

- Verify all checkboxes for the current phase are checked
- If you added deliverables not originally listed (discovered during implementation), add them as checked items under the appropriate layer
- If the phase is fully complete, remove the 🔄 from the heading and inform the user so they can decide whether to mark the next phase as current

### 11. Summary

Print a summary:

```
Phase N — Name — Complete ✅

Implemented:
  Shared:    X items
  Backend:   X items
  Frontend:  X items

Tests:
  Unit/integration:  X tests (all passing)
  E2E:               X tests (all passing)

Files created:  X
Files modified: X

New items added to PHASES.md: (list or "none")

Run /project:progress to see updated progress.
```