import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

export { db };

/**
 * Truncate every table in the public schema (RESTART IDENTITY CASCADE) for a clean
 * slate between tests. The Drizzle migrations bookkeeping lives in the `drizzle`
 * schema, so it is untouched and migrations don't have to be re-applied per test.
 */
export async function truncateAll(): Promise<void> {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tables = result.rows
    .map((r) => r.tablename)
    .filter((t) => t !== '__drizzle_migrations');
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}
