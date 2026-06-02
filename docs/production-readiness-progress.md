# Production-Readiness: Testing & Hardening — Progress

Branch: `refactor`. This tracks the effort to take Ternity from "vibe-coded, zero
tests" toward production-ready, by first building a characterization safety net and
then fixing/hardening behind it. Pick up here in a new session.

> Related: the `prodify` production-readiness pipeline (audit + checklist + detectors)
> is on a git stash (`git stash list` → "prodify pipeline"). The audit findings (S1–S10,
> Q*, O*) drove the prioritization below.

## Status snapshot

- **~1040 unit/integration tests, all green** (shared **140**, api **900**), 61 test files. `tsc --noEmit` passes; build clean.
- **E2E suite (Playwright)**: **5 happy paths**, 1 worker, ~8 s/run, all green. Each spec is anchored to a PRD section (`// Verifies: docs/prd/<file>.md#<section>`). Stack isolation via `scripts/test-instance.sh` (which also satisfies the `/test-instance` skill contract for ad-hoc dev use): Postgres on a random Docker port + api + web Vite on kernel-assigned ports, teardown stops the container and deletes the temp workdir. Seed (1 admin + 1 contractor + 1 client + 1 project + 1 deducible leave type + 1 allowance row) is written once per run and the seeded IDs surface in `meta.json` so specs don't hard-code any UUID. Found one real bug on the way in (see below).
- **CI**: `.github/workflows/test.yml` runs the suite on push to `main` + every PR (Testcontainers works on `ubuntu-latest`).
- **Mutation testing — phase 2 done on shared**: 74.50% baseline → **93.00%**. `notification-settings.ts` and `time-entries.ts` both at **100%**; `reports.ts` 85.42% (remaining 14 are equivalent mutants on display strings). Key lesson banked in `stryker.config.json`: never `parse()` in describe-scope — a thrown setup is reported as a "file failed" while individual `it()` results still count as passed, so Stryker marks the mutant as survived.
- **Mutation testing — api skeleton ready + first full baseline**: harness URL handoff file moved to `process.cwd()` so each Stryker sandbox gets isolation for free (each spins its own Testcontainers Postgres on a random port — no collisions). `apps/api/stryker.config.json` mutates routes / lib / plugins / services / sync/transform with `concurrency: 2`. CI runs the mutation job ONLY on push to `main` (not PRs) with a 120-min timeout, uploading the HTML report as an artifact. Informational only — does not fail the build on regressions yet.
  - **First full api baseline** (5617 mutants, 38 files): **72.24% total, 86.67% covered** in **19m 9s**. The two-score distinction matters: `total` penalises lines no test reaches; `covered` is the honest measure of how tight the tests are where they do run.
  - **Targeted gap closures** based on the baseline (see `docs/mutation-findings.md` for the full report):
    - `lib/error-handler.ts` 44.44% → **88.89% covered** (3 new tests; killed a hidden `?? → &&` logic bug that would silently break in production)
    - `services/notification-content.ts` — 4 real day-of-week bugs killed (2 new tests; Friday users could have received "Monday delivery" emails with no test failing)
    - `routes/me.ts` 6.78% / 44.44% → **88.14% / 88.14%** (19 new tests; the entire Logto avatar/phone refresh branch was unverified — 0 mutants left in "no coverage" status)
  - Strong (covered): `sync/transform/` 93.64% (`leave-types`, `mappings` 100%); `routes/entries.ts` 98.15%; `routes/jira.ts` 90.82% (the S2 escape invariants pull their weight); `routes/sync-status`, `user-preferences`, `stats`, `plugins/error-simulation`, `plugins/viewer-mode` all 100%.
  - Still weak (next-round candidates): `routes/notification-settings.ts` 77.19%, `routes/timer.ts` ~75%, `routes/team.ts` ~82%. Diminishing returns per hour relative to the three fixed above.
  - Zero coverage (no tests at all): `services/email.ts`, `services/sms.ts`. They're external-service wrappers — tested at the call site (notification-content) but not directly.
- **Test harness tuned for speed**: Testcontainers Postgres now runs with `fsync=off`, `synchronous_commit=off`, `full_page_writes=off` and PGDATA on tmpfs. Zero risk in test env (the container is wiped at teardown). Measured impact on the full api suite (median of 3 runs each): **77.87s → 52.34s (−32.8%)**; the "tests" portion alone went **59.13s → 34.91s (−41%)**. The win compounds for mutation testing, where the suite is replayed once per mutant per sandbox.
- **Stryker / source-scan guard composition fixed**: `body-validation.guard.test.ts` and `architecture.guard.test.ts` read source files from disk to enforce code-shape rules. Stryker copies project files into `.stryker-tmp/sandbox-N/` and instruments them with mutation-switching wrappers that contain raw `request.body` references — the guards flagged them as false positives. Both guards now `describe.skipIf(process.cwd().includes('.stryker-tmp'))`. Standalone runs are unaffected; Stryker dry run no longer fails.

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
   - **S4 (body validation) — COMPLETE**: shared `ZodError → 400` handler; **every mutating route** now validates its body with Zod (`.parse`/`.safeParse`). Covered: `entries.ts` (POST/PATCH/adjust/move-block/split), `timer.ts` (start/start-or-resume/stop), `admin-projects.ts` (bulk × 4), `admin-users.ts` (team/employment-type/bulk × 2), `admin-leave-types.ts` (group + type create/update + bulk), `jira.ts` (exchange), `leave.ts` (POST + PATCH, type-only to keep domain messages). No `request.body as` casts remain in routes. New shared schemas: `BulkProjectIdsSchema`, `BulkClientIdsSchema`, `StopTimerSchema`; admin-users/admin-leave-types/leave/jira use inline zod (matching the `notification-settings.ts` pattern).
   - **admin-leave-types bulk PATCH**: was always 500 (`sql\`= ANY(${jsArray})\``) → now `inArray`.
   - **error-simulation plugin**: now `fp()`-wrapped, so `X-Simulate-Error` actually fires (was a silent no-op in an encapsulated scope).
   - **toggl extract**: single-day range (`from===to`) was skipped → loop bound `< end` changed to `<= end`.
   - **S2 JQL injection**: `escapeJqlString` applied to free-text/config interpolation + property-based "no input breaks out" invariants.

## Bugs found & pinned (current behavior pinned in tests; fix flips the test)

| # | Where | Issue | Status |
|---|---|---|---|
| S1 | `entries.ts` search | audit's "SQL injection" — **FALSE POSITIVE** (drizzle `sql\`\`` parameterizes); proven by injection tests | no action needed |
| S2 | `jira.ts` JQL builders | **REAL** JQL injection — `text ~ "${text}"` + config values interpolate unescaped quotes | **DONE** (escapeJqlString + invariants) |
| S4 | many routes | `request.body as Type` (no validation) → 500 instead of 400 | **DONE**: handler + every mutating route validates with Zod; no `request.body as` casts remain |
| — | `admin-leave-types` bulk PATCH | always 500: `sql\`= ANY(${jsArray})\`` not serializable → use `inArray` | **DONE** |
| — | `plugins/error-simulation.ts` | not `fp()`-wrapped → encapsulated scope → `X-Simulate-Error` silent no-op | **DONE** |
| — | `sync/toggl/extract.ts` | single-day range (`from===to`) → 0 windows (`while < end` should be `<=`) | **DONE** |
| — | `leave.ts` PATCH | past-date guard added (admin bypasses, since admins retro-correct entries); `allowances.usedDays` now auto-updated on POST/PATCH/DELETE in a transaction (only adjusts existing rows — admin/HR still owns initial seeding). 13 new tests pin the accounting invariants and admin-vs-user past-date behavior. | **DONE** |
| — | `stats.ts` | filters by `time_entries.createdAt`, not segment start time | TODO (decide intent) |
| — | drizzle journal | `0012_jira_connection_config`, `0013_jira_token_status`, `0015_pg_trgm_fuzzy_search` registered with sequential `idx` 12/13/15 and re-numbered later entries; `applyUnjournaledMigrations` workaround in `test/global-setup.ts` deleted. The three SQL files are idempotent (`DO $$ ... EXCEPTION WHEN duplicate_column`, `CREATE EXTENSION IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so prod re-runs are safe. The empty `0007_entry_segments.sql` stays as an inert historical artifact (not in the journal → not executed). | **DONE** |
| — | `mappings.test.ts` updatedAt assertion | container `now()` vs JS `new Date()` clock drift — same flake class as `run-tracker.test.ts`. Same fix: 1s `SKEW_MS` window. | **DONE** |
| — | `reports.ts` `aggregateReportData` | `projectBreakdown[].projectId` returns the project **name**, not the UUID. `projectSet` is keyed by `entry.projectName` and `id: key` uses the same string — two projects with the same name across clients would also be merged. Spec `e2e/specs/report-filter.spec.ts` pins the current (buggy) behavior by matching on `projectName`; flip the assertion to `projectId` when fixed. Fix needs `projectId` carried into the `entryMap` value type (not currently stored) plus re-keying `projectSet` on it. | TODO (caught by E2E) |
| — | POST endpoint status codes | `POST /api/timer/start` and `POST /api/entries` return **200**; `POST /api/leave/requests` and `POST /api/admin/projects/clients` return **201**. The E2E specs assert `.ok()` to absorb the inconsistency. Standardise (probably all 201). | TODO |

## Done since (operational track)

- **Portable guards in `tooling/`** (copy-paste reusable across Ternity-stack repos) — ESLint preset (`tooling/eslint`, bans casting `request.body`, in-editor) + dependency-free source scanners (`tooling/guards/source-guards.js`: unvalidated body, body casts, `sql ANY(${…})`, plugins missing `fp()`) + adoption README. Dogfooded here: root `eslint.config.js` spreads the preset; `body-validation.guard.test.ts` + new `architecture.guard.test.ts` call the scanners.
- **Seal by construction** — the body-validation guard (now backed by `tooling/`) fails if any handler reads `request.body` without `.parse`/`.safeParse` (or casts with `as`). Locks in S4. The architecture guard additionally pins the `sql ANY(${…})` and plugin-`fp()` bug classes.
- **Fixed flaky test** — `run-tracker.test.ts` startedAt assertion failed ~1ms intermittently (Postgres `now()` vs app clock); added a 1s skew window.
- **Deep health** — `/health` is now liveness-only (cheap; reports version + uptime); new `/health/ready` runs `SELECT 1` and returns 503 + per-dependency `checks` when the DB is down. Both public in logto mode. (audit O3/O6/S6)
- **Dependency scan in CI** — new `audit` job: informational full report on every PR + a gate that fails on **high** (and critical). All 22 high advisories cleared: direct deps bumped (fastify 5.8.5, drizzle-orm 0.45.2, vite 6.4.2) + surgical `pnpm.overrides` for transitive (minimatch/picomatch/flatted/rollup/undici/fast-uri/tmp/axios). 10 moderate remain (dev/build tooling). Verified: 863 api tests + builds green after the drizzle 0.38→0.45 jump.
  - **Open caveats**: `drizzle-kit` left at ^0.30 (only used by `db:generate`/`db:migrate` CLI, not tests) — verify migration generation if you bump further. `twilio`→`axios` SMS path isn't covered by tests — run `pnpm --filter @ternity/api sms:test` to confirm SMS still sends.

## What's left (suggested order)

1. **Two bugs surfaced by E2E**: fix `aggregateReportData` projectId-vs-name + standardise POST status codes (201 across the board). Flip the related E2E asserts after.
2. **`stats.ts`** — decide whether the filter should be on `time_entries.createdAt` or on the segment start time (the audit flagged it; needs a product call, not just code).
3. **More E2E coverage** beyond happy paths: edge cases (overlap-409 on leave, RBAC denial paths), and at least one full-UI flow (click-through of the leave booking dialog) to verify the React state machine, not just the API.
4. **Mutation testing phase 2**: extend Stryker to more shared files; for api, either `concurrency: 1` or give the harness a per-process DB-URL path so Stryker can parallelize.
5. **Frontend `apps/web` unit tests**: zero tests — Vitest + React Testing Library for hooks/providers, Playwright already covers cross-stack.
6. **More operational hardening**: Sentry (error tracking), structured logs, rate-limiting, graceful shutdown, DB backups + restore drill. `APP_VERSION` env is read by `/health` but not yet injected at build/deploy — wire it.

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
- `lib/error-handler.ts` extracted + `ZodError → 400`; **every mutating route validates its body with Zod** (S4) — entries, timer, admin-projects, admin-users, admin-leave-types, jira exchange, leave.
- New shared schemas: `BulkProjectIdsSchema`, `BulkClientIdsSchema` (admin-projects), `StopTimerSchema` (time-entries). Inline zod schemas added in admin-users, admin-leave-types, jira, leave.
- `admin-leave-types.ts` bulk uses `inArray`; `error-simulation.ts` exported via `fp()`; `toggl/extract.ts` window loop `<=`; `jira.ts` adds exported `escapeJqlString` applied to all JQL string interpolation.
- `leave.ts`: past-date guard on PATCH with admin bypass (only fires when `body.startDate` is present, so note-only edits on past bookings still work); `leave_allowances.usedDays` reconciled transactionally on POST/PATCH/DELETE via the new `applyAllowanceDelta` helper. Lookup of the old + new leave-type's `deducted` flag moved before the transaction so validation 400s stay outside it.
- `drizzle/meta/_journal.json`: entries for `0012_jira_connection_config`, `0013_jira_token_status`, `0015_pg_trgm_fuzzy_search` added; `applyUnjournaledMigrations` deleted from `test/global-setup.ts`.
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
