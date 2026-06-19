import fs from 'node:fs';
import path from 'node:path';

// Per-worker setup: point DATABASE_URL at the Testcontainers Postgres BEFORE any
// test imports src/db/index.ts (which reads DATABASE_URL at module load to build
// its pool). Runs in the worker; reads the URL written by global-setup.ts.
//
// File path is cwd-relative (mirrors global-setup.ts) so it stays scoped to one
// vitest invocation — important when Stryker spawns parallel sandboxes.

const DB_URL_FILE = path.join(process.cwd(), '.ternity-test-db-url');

if (fs.existsSync(DB_URL_FILE)) {
  process.env.DATABASE_URL = fs.readFileSync(DB_URL_FILE, 'utf8').trim();
}
