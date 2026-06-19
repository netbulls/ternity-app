import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { stgTogglUsers, stgTtAbsences, stgTtUsers, users } from '../../db/schema.js';
import { findTargetId } from './mappings.js';
import { matchUsers, nameToLocalPart, stripDiacritics } from './users.js';

// Characterization tests for the user-matching transform — the richest sync logic:
// email-based matching (phase 1) + name-based matching from absences (phase 2),
// each with a dry-run (apply=false) vs apply mode. Real Postgres via test harness.

beforeEach(truncateAll);

const seedTogglUser = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTogglUsers).values({ externalId, rawData: raw });
const seedTtUser = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTtUsers).values({ externalId, rawData: raw });
const seedAbsence = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTtAbsences).values({ externalId, rawData: raw });

async function seedTernityUser(vals: {
  displayName: string;
  email: string;
  togglId?: string;
  timetasticId?: string;
}) {
  const [u] = await db.insert(users).values(vals).returning();
  return u!;
}

const userByEmail = async (email: string) => {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return u ?? null;
};

// ── Pure helpers ─────────────────────────────────────────────────────────

describe('stripDiacritics', () => {
  it('maps Polish lowercase diacritics to ASCII', () => {
    expect(stripDiacritics('ąćęłńóśźż')).toBe('acelnoszz');
  });

  it('maps Polish uppercase diacritics to ASCII', () => {
    expect(stripDiacritics('ĄĆĘŁŃÓŚŹŻ')).toBe('ACELNOSZZ');
  });

  it('leaves non-Polish characters untouched', () => {
    expect(stripDiacritics('John Doe 123')).toBe('John Doe 123');
  });
});

describe('nameToLocalPart', () => {
  it('joins first and last name with a dot, lowercased', () => {
    expect(nameToLocalPart('Jan Kowalski')).toBe('jan.kowalski');
  });

  it('drops middle names (first.last only)', () => {
    expect(nameToLocalPart('Artur Adam Dzadz')).toBe('artur.dzadz');
  });

  it('strips diacritics before building the local part', () => {
    expect(nameToLocalPart('Łukasz Żółć')).toBe('lukasz.zolc');
  });

  it('returns the single token (no dot) for a one-word name', () => {
    expect(nameToLocalPart('Madonna')).toBe('madonna');
  });

  it('collapses repeated internal whitespace', () => {
    expect(nameToLocalPart('Anna   Nowak')).toBe('anna.nowak');
  });

  it('does NOT trim leading/trailing whitespace — yields "." (latent quirk: split(/\\s+/) without trim)', () => {
    // Leading/trailing space adds empty first/last tokens, so first.last becomes ".".
    // Notably "." passes the `.includes('.')` guard in phase 2, so such names are
    // NOT skipped — they would build the email ".@netbulls.io".
    expect(nameToLocalPart('  Anna Nowak  ')).toBe('.');
  });

  it('returns "" for an empty string', () => {
    expect(nameToLocalPart('')).toBe('');
  });
});

// ── Phase 1: email-based matching, dry run (apply=false) ───────────────────

describe('matchUsers — phase 1 dry run (apply=false)', () => {
  it('returns an empty report when there is no staging data', async () => {
    expect(await matchUsers(false)).toEqual({ matched: [], created: [], unmatched: [] });
  });

  it('reports an existing user as matched without writing to the DB', async () => {
    const u = await seedTernityUser({ displayName: 'Jan', email: 'jan@netbulls.io' });
    await seedTogglUser('t1', { email: 'jan@netbulls.io', user_id: 555 });

    const report = await matchUsers(false);

    expect(report.matched).toEqual([
      expect.objectContaining({ email: 'jan@netbulls.io', userId: u.id, togglId: '555' }),
    ]);
    expect(report.created).toHaveLength(0);
    // no write happened
    expect((await userByEmail('jan@netbulls.io'))!.togglId).toBeNull();
    expect(await findTargetId('toggl', 'users', '555')).toBeNull();
  });

  it('reports a user with no Ternity match as unmatched', async () => {
    await seedTogglUser('t1', { email: 'ghost@netbulls.io', user_id: 1 });

    const report = await matchUsers(false);

    expect(report.unmatched).toEqual([{ email: 'ghost@netbulls.io', source: 'toggl' }]);
    expect(report.created).toHaveLength(0);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('lowercases emails from staging before matching', async () => {
    const u = await seedTernityUser({ displayName: 'Mix', email: 'mixed@case.io' });
    await seedTogglUser('t1', { email: 'Mixed@Case.IO', user_id: 1 });

    const report = await matchUsers(false);
    expect(report.matched[0]?.userId).toBe(u.id);
  });

  it('skips staging rows that have no email', async () => {
    await seedTogglUser('t1', { user_id: 1 }); // no email
    expect(await matchUsers(false)).toEqual({ matched: [], created: [], unmatched: [] });
  });

  it('skips the known ignored email entirely', async () => {
    await seedTogglUser('t1', { email: 'bartosz.klak@netbulls.lio', user_id: 1 });
    const report = await matchUsers(false);
    expect(report.matched).toHaveLength(0);
    expect(report.unmatched).toHaveLength(0);
    expect(report.created).toHaveLength(0);
  });

  it('marks a merged toggl+timetastic email with combined source', async () => {
    await seedTogglUser('t1', { email: 'dup@netbulls.io', user_id: 1 });
    await seedTtUser('tt1', { email: 'dup@netbulls.io', id: 'TT1' });

    const report = await matchUsers(false);
    expect(report.unmatched).toEqual([{ email: 'dup@netbulls.io', source: 'toggl+timetastic' }]);
  });
});

// ── Phase 1: email-based matching, apply ───────────────────────────────────

describe('matchUsers — phase 1 apply', () => {
  it('links toggl/timetastic ids onto an existing user and records mappings', async () => {
    const u = await seedTernityUser({ displayName: 'Jan', email: 'jan@netbulls.io' });
    await seedTogglUser('t1', { email: 'jan@netbulls.io', user_id: 555 });
    await seedTtUser('tt1', { email: 'jan@netbulls.io', id: 'TT9' });

    const report = await matchUsers(true);

    const after = (await userByEmail('jan@netbulls.io'))!;
    expect(after.togglId).toBe('555');
    expect(after.timetasticId).toBe('TT9');
    expect(await findTargetId('toggl', 'users', '555')).toBe(u.id);
    expect(await findTargetId('timetastic', 'users', 'TT9')).toBe(u.id);
    expect(report.matched).toHaveLength(1);
  });

  it('does not overwrite an existing togglId, but still records the staging mapping', async () => {
    const u = await seedTernityUser({ displayName: 'Jan', email: 'jan@netbulls.io', togglId: '999' });
    await seedTogglUser('t1', { email: 'jan@netbulls.io', user_id: 555 });

    await matchUsers(true);

    expect((await userByEmail('jan@netbulls.io'))!.togglId).toBe('999'); // unchanged
    expect(await findTargetId('toggl', 'users', '555')).toBe(u.id); // mapping still written
  });

  it('creates a new user with a display name derived from the email', async () => {
    await seedTogglUser('t1', { email: 'anna.kowalska@netbulls.io', user_id: 777 });

    const report = await matchUsers(true);

    const created = (await userByEmail('anna.kowalska@netbulls.io'))!;
    expect(created.displayName).toBe('Anna Kowalska');
    expect(created.togglId).toBe('777');
    expect(report.created).toEqual([
      expect.objectContaining({ email: 'anna.kowalska@netbulls.io', source: 'toggl' }),
    ]);
    expect(await findTargetId('toggl', 'users', '777')).toBe(created.id);
  });

  it('uses the bare local part as display name when the email has no dot', async () => {
    await seedTogglUser('t1', { email: 'admin@netbulls.io', user_id: 1 });
    await matchUsers(true);
    expect((await userByEmail('admin@netbulls.io'))!.displayName).toBe('admin');
  });

  it('prefers user_id over id over Id for the toggl id', async () => {
    await seedTogglUser('t1', { email: 'a@netbulls.io', user_id: 111, id: 222, Id: 333 });
    await seedTogglUser('t2', { email: 'b@netbulls.io', id: 222, Id: 333 });
    await seedTogglUser('t3', { email: 'c@netbulls.io', Id: 333 });

    await matchUsers(true);

    expect((await userByEmail('a@netbulls.io'))!.togglId).toBe('111');
    expect((await userByEmail('b@netbulls.io'))!.togglId).toBe('222');
    expect((await userByEmail('c@netbulls.io'))!.togglId).toBe('333');
  });

  it('reads the timetastic email from the capitalised "Email" key', async () => {
    await seedTtUser('tt1', { Email: 'tomek@netbulls.io', id: 'TT3' });

    const report = await matchUsers(true);

    const created = (await userByEmail('tomek@netbulls.io'))!;
    expect(created.timetasticId).toBe('TT3');
    expect(report.created[0]?.source).toBe('timetastic');
  });

  it('creates one merged user with combined source for a shared toggl+tt email', async () => {
    await seedTogglUser('t1', { email: 'x@netbulls.io', user_id: 1 });
    await seedTtUser('tt1', { email: 'x@netbulls.io', id: 'T1' });

    const report = await matchUsers(true);

    const created = (await userByEmail('x@netbulls.io'))!;
    expect(created.togglId).toBe('1');
    expect(created.timetasticId).toBe('T1');
    expect(report.created).toEqual([
      expect.objectContaining({ email: 'x@netbulls.io', source: 'toggl+timetastic' }),
    ]);
  });
});

// ── Phase 2: name-based matching from absences ─────────────────────────────

describe('matchUsers — phase 2 name matching from absences', () => {
  it('links a timetasticId onto a user matched by name-derived email (apply)', async () => {
    const u = await seedTernityUser({ displayName: 'Anna Nowak', email: 'anna.nowak@netbulls.io' });
    await seedAbsence('a1', { userId: 'TT5', userName: 'Anna Nowak' });

    await matchUsers(true);

    expect((await userByEmail('anna.nowak@netbulls.io'))!.timetasticId).toBe('TT5');
    expect(await findTargetId('timetastic', 'users', 'TT5')).toBe(u.id);
  });

  it('creates a user from an unmatched absence name, preserving diacritics in the display name', async () => {
    await seedAbsence('a1', { userId: 'TT6', userName: 'Łukasz Żółć' });

    await matchUsers(true);

    const created = (await userByEmail('lukasz.zolc@netbulls.io'))!;
    expect(created).not.toBeNull();
    expect(created.displayName).toBe('Łukasz Żółć');
    expect(created.timetasticId).toBe('TT6');
    expect(await findTargetId('timetastic', 'users', 'TT6')).toBe(created.id);
  });

  it('falls back to the second email domain when no user exists under the first', async () => {
    const u = await seedTernityUser({ displayName: 'Piotr Zen', email: 'piotr.zen@yosensi.io' });
    await seedAbsence('a1', { userId: 'TT10', userName: 'Piotr Zen' });

    await matchUsers(true);

    // matched against the *second* domain (the first, netbulls.io, has no such user)
    expect(await userByEmail('piotr.zen@netbulls.io')).toBeNull();
    expect((await userByEmail('piotr.zen@yosensi.io'))!.timetasticId).toBe('TT10');
    expect(await findTargetId('timetastic', 'users', 'TT10')).toBe(u.id);
  });

  it('skips ignored TT test-account names (no user created)', async () => {
    await seedAbsence('a1', { userId: 'TT7', userName: 'Test User' });
    await matchUsers(true);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('skips single-word names that cannot form a first.last email', async () => {
    await seedAbsence('a1', { userId: 'TT8', userName: 'Madonna' });
    await matchUsers(true);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('skips an absence whose TT id is already mapped to a user', async () => {
    await seedTernityUser({
      displayName: 'Ola Bug',
      email: 'ola.bug@netbulls.io',
      timetasticId: 'TT5',
    });
    await seedAbsence('a1', { userId: 'TT5', userName: 'Someone Else' });

    await matchUsers(true);

    // no second user created for "Someone Else"
    expect(await userByEmail('someone.else@netbulls.io')).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('does not overwrite a user that already carries a different timetasticId', async () => {
    await seedTernityUser({
      displayName: 'Anna Nowak',
      email: 'anna.nowak@netbulls.io',
      timetasticId: 'OLD',
    });
    await seedAbsence('a1', { userId: 'TT5', userName: 'Anna Nowak' });

    await matchUsers(true);

    expect((await userByEmail('anna.nowak@netbulls.io'))!.timetasticId).toBe('OLD');
    expect(await findTargetId('timetastic', 'users', 'TT5')).toBeNull();
  });

  it('does not write in dry-run mode even when an absence name matches', async () => {
    await seedTernityUser({ displayName: 'Anna Nowak', email: 'anna.nowak@netbulls.io' });
    await seedAbsence('a1', { userId: 'TT5', userName: 'Anna Nowak' });

    await matchUsers(false);

    expect((await userByEmail('anna.nowak@netbulls.io'))!.timetasticId).toBeNull();
  });

  it('deduplicates repeated (userId, userName) absence rows into one user', async () => {
    await seedAbsence('a1', { userId: 'TT6', userName: 'Łukasz Żółć' });
    await seedAbsence('a2', { userId: 'TT6', userName: 'Łukasz Żółć' });

    await matchUsers(true);

    expect(await db.select().from(users)).toHaveLength(1);
  });
});
