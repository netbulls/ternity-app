import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Vitest globalSetup: stand up an ephemeral Postgres (Testcontainers, random port —
// no conflict with whatever squats on 5432), run all Drizzle migrations against it,
// and hand the connection string to the test workers. Tears the container down after.
//
// The URL is passed to workers via a file (see test/setup-db.ts) rather than
// process.env, because globalSetup runs in a separate process from the workers.
//
// The file lives in `process.cwd()`, NOT in a fixed /tmp path, so concurrent vitest
// invocations don't fight over the same file. Stryker runs each mutant in its own
// sandbox with its own cwd → automatic isolation, no extra Stryker-specific logic.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../drizzle');
const IMAGE = process.env.TEST_POSTGRES_IMAGE ?? 'postgres:16-alpine';

/** Per-cwd path so setup-db.ts in the same vitest invocation finds the right URL,
 *  and parallel Stryker sandboxes don't clobber each other's URL. */
export const DB_URL_FILE = path.join(process.cwd(), '.ternity-test-db-url');

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  // Throw durability away for speed: the container is ephemeral, every test wipes
  // the DB anyway, so a crash midway means nothing. fsync/synchronous_commit/full_page_writes
  // are off → writes don't wait on disk; PGDATA on tmpfs → all DB state stays in RAM.
  // Big win for the I/O-heavy tests (truncateAll + many INSERTs per test).
  container = await new PostgreSqlContainer(IMAGE)
    .withCommand([
      'postgres',
      '-c',
      'fsync=off',
      '-c',
      'synchronous_commit=off',
      '-c',
      'full_page_writes=off',
    ])
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .start();
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
