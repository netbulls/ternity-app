import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://ternity:ternity@localhost:5432/ternity',
});

export const db = drizzle(pool, { schema });

/** Accepts both the top-level db instance and a PgTransaction */
export type Database = NodePgDatabase<typeof schema>;
