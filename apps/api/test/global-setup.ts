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
