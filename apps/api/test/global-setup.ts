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

  // Apply migrations once for the whole suite. The journal lists every .sql file —
  // see `drizzle/meta/_journal.json`. (Historical: 0012/0013/0015 were unjournaled
  // and we ran them out-of-band here; now registered, so drizzle-kit handles them.)
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }

  fs.writeFileSync(DB_URL_FILE, url, 'utf8');
}

export async function teardown() {
  try {
    fs.rmSync(DB_URL_FILE, { force: true });
  } catch {
    // best effort
  }
  await container?.stop();
}
