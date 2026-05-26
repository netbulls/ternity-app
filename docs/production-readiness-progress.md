# Production-Readiness: Testing & Hardening — Progress

Branch: `refactor`. This tracks the effort to take Ternity from "vibe-coded, zero
tests" toward production-ready, by first building a characterization safety net and
then fixing/hardening behind it. Pick up here in a new session.

> Related: the `prodify` production-readiness pipeline (audit + checklist + detectors)
> is on a git stash (`git stash list` → "prodify pipeline"). The audit findings (S1–S10,
> Q*, O*) drove the prioritization below.

## Status snapshot

- **~900 tests, all green** (shared **57**, api **843**), 56 test files. `tsc --noEmit` passes; build clean.
- **CI**: `.github/workflows/test.yml` runs the suite on push to `main` + every PR (Testcontainers works on `ubuntu-latest`).
- **Mutation testing**: Stryker pilot on `packages/shared` (`reports.ts`), score 70.83% → **85.42%**.

## What's done (by layer)

1. **Test harness** (`apps/api/test/`): ephemeral Postgres via Testcontainers (random port — no dev-DB conflict), Drizzle migrations applied, per-test `truncateAll()`. `buildApp()` = Fastify + auth(stub) + the shared global error handler + given routes, driven by `app.inject()`. `fileParallelism: false` (one shared container).
2. **`@ternity/shared`**: schemas + date helpers (reports, time-entries, notification-settings) characterized.
3. **`apps/api` — full coverage of testable backend (no external services):**
   - sync/transform: all 8 transforms (mappings, clients, users, time-entries, projects, absences, tags, leave-types)
   - auth plugin: stub mode, impersonation RBAC, logto JIT (jose + fetch mocked), M2M token cache
   - **all route files**: entries (11 routes), jira (JQL builders, S2), timer, admin (users/projects/members/leave-types), leave, reports/dashboard/stats, me/team/working-hours/reference/sync-status/prefs/notif/downloads/health
   - sync HTTP clients (toggl/timetastic/jira — mocked fetch), extract pipelines, lib (audit, changelog-parser), services (notification-content), plugins (viewer-mode, error-simulation), retry-with-backoff, config, pdf-template dispatch
4. **CI** wired (GitHub Actions).
5. **Mutation pilot** (Stryker) on shared.
6. **Fixes done (fix phase)**:
   - **S4 (body validation)**: shared `ZodError → 400` handler; all `entries.ts` mutating routes (POST/PATCH/adjust/move-block/split) and `timer.ts` (start, start-or-resume) now `.parse()` the body. Remaining: admin-* and leave routes (schemas may need adding).
   - **admin-leave-types bulk PATCH**: was always 500 (`sql\`= ANY(${jsArray})\``) → now `inArray`.
   - **error-simulation plugin**: now `fp()`-wrapped, so `X-Simulate-Error` actually fires (was a silent no-op in an encapsulated scope).
   - **toggl extract**: single-day range (`from===to`) was skipped → loop bound `< end` changed to `<= end`.
   - **S2 JQL injection**: `escapeJqlString` applied to free-text/config interpolation + property-based "no input breaks out" invariants.

## Bugs found & pinned (current behavior pinned in tests; fix flips the test)

| # | Where | Issue | Status |
|---|---|---|---|
| S1 | `entries.ts` search | audit's "SQL injection" — **FALSE POSITIVE** (drizzle `sql\`\`` parameterizes); proven by injection tests | no action needed |
| S2 | `jira.ts` JQL builders | **REAL** JQL injection — `text ~ "${text}"` + config values interpolate unescaped quotes | **DONE** (escapeJqlString + invariants) |
| S4 | many routes | `request.body as Type` (no validation) → 500 instead of 400 | **partly done**: handler + all entries routes + timer done; admin-*/leave routes TODO |
| — | `admin-leave-types` bulk PATCH | always 500: `sql\`= ANY(${jsArray})\`` not serializable → use `inArray` | **DONE** |
| — | `plugins/error-simulation.ts` | not `fp()`-wrapped → encapsulated scope → `X-Simulate-Error` silent no-op | **DONE** |
| — | `sync/toggl/extract.ts` | single-day range (`from===to`) → 0 windows (`while < end` should be `<=`) | **DONE** |
| — | `leave.ts` PATCH | no past-date guard (POST has one); `allowances.usedDays` never auto-updated | TODO |
| — | `stats.ts` | filters by `time_entries.createdAt`, not segment start time | TODO (decide intent) |
| — | drizzle journal | `0012/0013/0015` not registered → `drizzle-kit migrate` doesn't reproduce prod (harness works around it) | TODO: register in journal |

## What's left (suggested order)

1. **Finish S4 on the remaining routes** (entries + timer done). Need body validation on:
   - `admin-users.ts` (set-project, employment-type, bulk activate/deactivate userIds)
   - `admin-projects.ts` (bulk projectIds / clientIds)
   - `admin-leave-types.ts` (create/update group + type, bulk)
   - `leave.ts` (POST/PATCH request bodies), `jira.ts` exchange (`{ code }`)
   - Schemas for these mostly DON'T exist yet in `@ternity/shared` — add them as part of the fix.
2. **Remaining discrete bug fix**: `leave.ts` PATCH past-date guard + `allowances.usedDays` auto-update (decide intended behavior first).
3. **Seal by construction**: a lightweight "every mutating route declares validation" gate (the `fastify-schema-coverage` idea from the stashed prodify tools, minimal — not the whole pipeline).
5. **Register migrations 0012/0013/0015** in the drizzle journal (then the harness workaround becomes a no-op).
6. **Mutation testing phase 2**: extend Stryker to more shared files; for api, either `concurrency: 1` or give the harness a per-process DB-URL path so Stryker can parallelize.
7. **Frontend `apps/web`**: zero tests — different stack (Vitest + React Testing Library / Playwright E2E).
8. **Observability / deps**: Sentry, `pnpm audit` in CI, deep `/health` (audit O3/O6/S6).

## How to resume (environment)

- **node/pnpm are NOT on PATH** in the non-interactive shell. Prefix commands:
  `export PATH="$HOME/.nvm/versions/node/v24.11.0/bin:$PATH"` then `corepack pnpm …` (pnpm 9.15.4).
- Run api tests: `corepack pnpm --filter @ternity/api test` (spins one Testcontainers Postgres; ~30s).
- Run one file: `corepack pnpm --filter @ternity/api exec vitest run <path>`.
- Type-check: `(cd apps/api && npx tsc --noEmit)`.
- Mutation (shared): `corepack pnpm --filter @ternity/shared test:mutation`.
- Harness facts: shared tests need `TZ=UTC` (in the `test` script); module-level caches (getManagementToken, noProjectId, defaultClientId, leaveProjectId) are reset with `vi.resetModules()` + dynamic import; the global error handler maps `ZodError → 400` and lives in `lib/error-handler.ts` (used by both `server.ts` and `buildApp`).

## Production code changed so far (kept minimal & non-behavioral, except the S4 fix)

- `export` added for test seams: `users.ts` (stripDiacritics, nameToLocalPart), `jira.ts` (JQL builders).
- `lib/error-handler.ts` extracted + `ZodError → 400`; `entries.ts` (all mutating routes) + `timer.ts` validate with Zod (S4).
- `admin-leave-types.ts` bulk uses `inArray`; `error-simulation.ts` exported via `fp()`; `toggl/extract.ts` window loop `<=`; `jira.ts` adds exported `escapeJqlString` applied to all JQL string interpolation.
- Test infra: vitest configs, tsconfig split (build excludes tests), Testcontainers harness, CI workflow, Stryker config.

---

## Proposed flow: vibe-coded → production (v1, simple)

**The goal is a production-ready app — measurably.** The test net is the *enabler*, not
the destination: it makes code changes (security fixes, refactors) safe, but
production-readiness also requires workstreams that have nothing to do with tests
(backups, CI/CD, observability, secrets, rate-limiting). "Done" = meeting a defined
bar (e.g. the `prodify` checklist/score), not "we have tests."

Distilled from this effort. The order matters — each phase unlocks the next.

**Phase 0 — Triage (once).** Map the app; rank modules by **risk × change-frequency**. Aim a net under what you'll change, not uniform coverage.

**Phase 1 — Build seams / harness (the real unlock; ~80% of effort).** Legacy's problem is *untestability*, not missing tests. Make code runnable in isolation: real deps in containers (DB), mock the network (fetch), deterministic env (fixed TZ, fake timers, per-test reset), minimal `export` seams. One reusable app/test builder.

**Phase 2 — Characterize hot-spots first.** Pin **actual** behavior (bugs included) at the **coarsest stable boundary** (HTTP route / public function) — integration-first, not unit-first (unit tests calcify the structure you want to refactor). Assert real state, never self-report; no tautologies. Free byproducts: bug discovery + living documentation.

**Phase 3 — CI.** Run the suite on every PR so it can't silently rot.

**Phase 4 — Certify the net.** Mutation testing proves the tests are tight (not tautological) and shows exactly where the gaps are. Close the valuable ones; don't chase 100% (over-fitting).

**Phase 5 — Refactor & fix behind the net (small steps).** Each fix flips a pinned test. For **errors of omission** (missing validation/guards — which mutation can't see), prefer **by construction**: validate at the boundary with a shared schema, add fitness-function/negative-space lint rules, schema-coverage gates — over per-case tests.

**Phase 6 — Guard intent (ongoing).** Spec-derived tests (from requirements), property-based invariants, dependency/secret scanning, observability as the prod feedback loop.

**Phase 7 -- Close the production-readiness bar (parallel track, partly test-independent).** Beyond the code fixes the net enables, an app is production-ready only when the operational and security dimensions are met -- and these do not need the test net:
- **Security**: close the audit findings (injection, authz, secrets, CSP, rate-limit).
- **Ops/continuity**: CI/CD, DB backups + restore drill, migration rollback, runbook.
- **Observability**: error tracking (Sentry), metrics, deep /health, structured logs.
- **Reliability**: connection pooling, resource limits, graceful shutdown.
- **Supply chain**: dependency + secret scanning in CI.

Measure against a **checklist with a score and a CI gate** (exactly what the stashed prodify pipeline provides) -- that defines "done", not a green suite.

**The net (phases 1-4) buys the ability to change safely; production-readiness (phases 5-7) is the destination: code correct + secure + operable + observable, verified against a defined bar.**
