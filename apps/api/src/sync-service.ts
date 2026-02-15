import { eq, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { syncScheduleState } from './db/schema.js';
import { log } from './sync/logger.js';
import { extractAllToggl } from './sync/toggl/extract.js';
import { extractAllTimetastic } from './sync/timetastic/extract.js';
import { extractTogglTimeEntries } from './sync/toggl/extract.js';
import { extractTtAbsences } from './sync/timetastic/extract.js';
import { matchUsers } from './sync/transform/users.js';
import { transformClients } from './sync/transform/clients.js';
import { transformProjects } from './sync/transform/projects.js';
import { transformLabels } from './sync/transform/labels.js';
import { transformTimeEntries } from './sync/transform/time-entries.js';
import { transformLeaveTypes } from './sync/transform/leave-types.js';
import { transformAbsences } from './sync/transform/absences.js';

// ── Configuration ─────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 60_000; // Check every 60s
const FREQUENT_HOURS = Number(process.env.SYNC_FREQUENT_HOURS ?? 4);
const DAILY_HOUR_UTC = Number(process.env.SYNC_DAILY_HOUR_UTC ?? 3);

let shutdownRequested = false;

// ── Schedule State Management ─────────────────────────────────────────────

async function getOrCreateState() {
  const rows = await db.select().from(syncScheduleState).limit(1);
  if (rows.length > 0) return rows[0]!;

  const [row] = await db
    .insert(syncScheduleState)
    .values({
      schedulerStartedAt: new Date(),
      schedulerHeartbeatAt: new Date(),
    })
    .returning();
  return row!;
}

async function updateHeartbeat(stateId: string) {
  await db
    .update(syncScheduleState)
    .set({ schedulerHeartbeatAt: new Date() })
    .where(eq(syncScheduleState.id, stateId));
}

async function updateScheduleAfterFrequent(stateId: string) {
  const now = new Date();
  const next = new Date(now.getTime() + FREQUENT_HOURS * 3600_000);
  await db
    .update(syncScheduleState)
    .set({
      lastFrequentRunAt: now,
      nextFrequentRunAt: next,
      schedulerHeartbeatAt: now,
    })
    .where(eq(syncScheduleState.id, stateId));
}

async function updateScheduleAfterDaily(stateId: string) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(DAILY_HOUR_UTC, 0, 0, 0);
  await db
    .update(syncScheduleState)
    .set({
      lastDailyRunAt: now,
      nextDailyRunAt: tomorrow,
      schedulerHeartbeatAt: now,
    })
    .where(eq(syncScheduleState.id, stateId));
}

async function setNextRunTimes(stateId: string) {
  const now = new Date();
  const nextFrequent = new Date(now.getTime() + FREQUENT_HOURS * 3600_000);
  const nextDaily = new Date(now);
  nextDaily.setUTCDate(nextDaily.getUTCDate() + (now.getUTCHours() >= DAILY_HOUR_UTC ? 1 : 0));
  nextDaily.setUTCHours(DAILY_HOUR_UTC, 0, 0, 0);
  if (nextDaily <= now) {
    nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
  }

  await db
    .update(syncScheduleState)
    .set({
      nextFrequentRunAt: nextFrequent,
      nextDailyRunAt: nextDaily,
    })
    .where(eq(syncScheduleState.id, stateId));
}

// ── Sync Operations ───────────────────────────────────────────────────────

/** Run a named step, catching errors so the pipeline continues. Returns true if OK. */
async function runStep(name: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    log.error(`  ✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** Frequent sync: time entries + absences + user match + transform all */
async function runFrequentSync() {
  log.info('── Frequent Sync: Start ──');
  const start = Date.now();
  const failures: string[] = [];

  const steps: [string, () => Promise<unknown>][] = [
    ['extract toggl/time_entries', () => extractTogglTimeEntries()],
    ['extract timetastic/absences', () => extractTtAbsences()],
    ['match users', () => matchUsers(true)],
    ['transform clients', () => transformClients()],
    ['transform projects', () => transformProjects()],
    ['transform labels', () => transformLabels()],
    ['transform leave_types', () => transformLeaveTypes()],
    ['transform time_entries', () => transformTimeEntries()],
    ['transform absences', () => transformAbsences()],
  ];

  for (const [name, fn] of steps) {
    if (!(await runStep(name, fn))) failures.push(name);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (failures.length === 0) {
    log.info(`── Frequent Sync: Complete (${elapsed}s) ──`);
  } else {
    log.warn(`── Frequent Sync: Partial (${elapsed}s) — ${failures.length} failed: ${failures.join(', ')} ──`);
  }
}

/** Daily sync: full pipeline — all entities from both sources */
async function runFullSync() {
  log.info('── Full Sync: Start ──');
  const start = Date.now();
  const failures: string[] = [];

  const steps: [string, () => Promise<unknown>][] = [
    ['extract all toggl', () => extractAllToggl()],
    ['extract all timetastic', () => extractAllTimetastic()],
    ['match users', () => matchUsers(true)],
    ['transform clients', () => transformClients()],
    ['transform projects', () => transformProjects()],
    ['transform labels', () => transformLabels()],
    ['transform leave_types', () => transformLeaveTypes()],
    ['transform time_entries', () => transformTimeEntries()],
    ['transform absences', () => transformAbsences()],
  ];

  for (const [name, fn] of steps) {
    if (!(await runStep(name, fn))) failures.push(name);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (failures.length === 0) {
    log.info(`── Full Sync: Complete (${elapsed}s) ──`);
  } else {
    log.warn(`── Full Sync: Partial (${elapsed}s) — ${failures.length} failed: ${failures.join(', ')} ──`);
  }
}

// ── Scheduler Loop ────────────────────────────────────────────────────────

async function main() {
  log.info('Sync service starting...');
  log.info(`  Frequent sync interval: ${FREQUENT_HOURS}h`);
  log.info(`  Daily sync hour (UTC): ${DAILY_HOUR_UTC}:00`);

  const state = await getOrCreateState();
  const stateId = state.id;

  // Run a full sync on startup (catches up after downtime / first run)
  log.info('Running initial full sync...');
  await runFullSync();
  await updateScheduleAfterDaily(stateId);
  await updateScheduleAfterFrequent(stateId);
  await setNextRunTimes(stateId);

  log.info('Entering scheduler loop...');

  while (!shutdownRequested) {
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
    if (shutdownRequested) break;

    await updateHeartbeat(stateId);

    const now = new Date();
    const currentState = await getOrCreateState();

    // Check if daily sync is due
    if (currentState.nextDailyRunAt && now >= currentState.nextDailyRunAt) {
      log.info('Daily sync triggered.');
      await runFullSync();
      await updateScheduleAfterDaily(stateId);
      await updateScheduleAfterFrequent(stateId); // Reset frequent timer too
      continue;
    }

    // Check if frequent sync is due
    if (currentState.nextFrequentRunAt && now >= currentState.nextFrequentRunAt) {
      log.info('Frequent sync triggered.');
      await runFrequentSync();
      await updateScheduleAfterFrequent(stateId);
    }
  }

  log.info('Sync service shutting down gracefully.');
  process.exit(0);
}

// ── Signal Handling ───────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down...');
  shutdownRequested = true;
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down...');
  shutdownRequested = true;
});

main().catch((err) => {
  log.error(`Sync service crashed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
