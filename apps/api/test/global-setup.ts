import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Vitest globalSetup: stand up an ephemeral Postgres (Testcontainers, random port —
// no conflict with whatever squats on 5432), run all Drizzle migrations against it,
// and hand the connection string to the test workers. Tears the container down after.
//
// The URL is passed to workers via a temp file (see test/setup-db.ts) rather than
// process.env, because globalSetup runs in a separate process from the workers.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../drizzle');
const IMAGE = process.env.TEST_POSTGRES_IMAGE ?? 'postgres:16-alpine';

/** Fixed path so setup-db.ts can read the URL the container ended up on. */
export const DB_URL_FILE = path.join(os.tmpdir(), 'ternity-test-db-url');

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  container = await new PostgreSqlContainer(IMAGE).start();
  const url = container.getConnectionUri();

  // Apply migrations once for the whole suite.
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
    await applyUnjournaledMigrations(pool);
  } finally {
    await pool.end();
  }

  fs.writeFileSync(DB_URL_FILE, url, 'utf8');
}

/**
 * The drizzle journal (meta/_journal.json) has drifted from the migration files:
 * 0012/0013 (jira columns) and 0015 (pg_trgm extension + index) exist as .sql but
 * are NOT registered, so `drizzle-kit migrate` skips them — a fresh migrate does not
 * reproduce the production schema (notably the pg_trgm extension that /api/entries/
 * search relies on). Apply those unjournaled, idempotent files here so the test DB
 * matches prod. (See ternity-test-db-harness memory.)
 */
async function applyUnjournaledMigrations(pool: pg.Pool) {
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { tag: string }[] };
  const journaled = new Set(journal.entries.map((e) => e.tag));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (journaled.has(file.replace(/\.sql$/, ''))) continue;
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').trim();
    if (!content) continue; // e.g. the empty 0007_entry_segments.sql
    await pool.query(content);
  }
}

export async function teardown() {
  try {
    fs.rmSync(DB_URL_FILE, { force: true });
  } catch {
    // best effort
  }
  await container?.stop();
}
