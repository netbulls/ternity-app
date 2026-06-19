// E2E seed: runs migrations against $DATABASE_URL and inserts the minimum
// fixtures the Playwright happy-path specs need (admin + contractor + client
// + project + contractor-default leave type + an allowance row to verify
// usedDays accounting end-to-end). The orchestrator (`scripts/test-instance/
// orchestrate.mjs`) reads the JSON we print on the last stdout line and
// stashes it in `meta.json` so specs can reference IDs without UUIDs hard-
// coded anywhere.
//
// Kept intentionally minimal — anything spec-specific (extra users, extra
// projects, leave bookings) should be created by the spec itself, via the
// API, so each test is self-describing.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { clients, leaveAllowances, leaveTypes, projects, users } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('seed-e2e: DATABASE_URL is required');
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../drizzle');

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

const [admin] = await db
  .insert(users)
  .values({
    displayName: 'E2E Admin',
    email: 'admin@e2e.test',
    globalRole: 'admin',
    employmentType: 'contractor',
    active: true,
  })
  .returning();

const [contractor] = await db
  .insert(users)
  .values({
    displayName: 'E2E Contractor',
    email: 'contractor@e2e.test',
    globalRole: 'user',
    employmentType: 'contractor',
    active: true,
  })
  .returning();

const [client] = await db
  .insert(clients)
  .values({ name: 'E2E Client' })
  .returning();

const [project] = await db
  .insert(projects)
  .values({ name: 'E2E Project', clientId: client!.id, color: '#00D4AA' })
  .returning();

const [leaveType] = await db
  .insert(leaveTypes)
  .values({
    name: 'E2E Annual Leave',
    daysPerYear: 20,
    deducted: true,
    isContractorDefault: true,
    visibility: 'all',
  })
  .returning();

const year = new Date().getFullYear();
await db.insert(leaveAllowances).values({
  userId: contractor!.id,
  leaveTypeId: leaveType!.id,
  year,
  totalDays: 20,
  usedDays: 0,
});

await pool.end();

// LAST line on stdout — the orchestrator picks this up. Anything emitted
// earlier (e.g. drizzle migrator logs) is fine and gets ignored.
process.stdout.write(
  JSON.stringify({
    adminUserId: admin!.id,
    contractorUserId: contractor!.id,
    clientId: client!.id,
    projectId: project!.id,
    leaveTypeId: leaveType!.id,
    allowanceYear: year,
  }) + '\n',
);
