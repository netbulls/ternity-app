import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, truncateAll } from '../../../test/db.js';
import { leaveTypes, stgTtLeaveTypes } from '../../db/schema.js';
import { findTargetId } from './mappings.js';
import { transformLeaveTypes } from './leave-types.js';

// Characterization tests for the leave-types transform: name/color/deducted/allowance
// fallbacks (incl. PascalCase variants), Boolean(deducted) coercion, and the
// "allowance must be a number or it falls back to 0" rule. Real Postgres via harness.

beforeEach(truncateAll);

const seedLeaveType = (externalId: string, raw: Record<string, unknown>) =>
  db.insert(stgTtLeaveTypes).values({ externalId, rawData: raw });

const onlyLeaveType = async () => {
  const [lt] = await db.select().from(leaveTypes);
  return lt!;
};

describe('transformLeaveTypes', () => {
  it('returns all-zero counts when staging is empty', async () => {
    expect(await transformLeaveTypes()).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(await db.select().from(leaveTypes)).toHaveLength(0);
  });

  it('creates a leave type with all fields and records a mapping', async () => {
    await seedLeaveType('LT1', { name: 'Holiday', color: '#abc', deducted: true, allowance: 26 });

    const counts = await transformLeaveTypes();
    expect(counts).toEqual({ created: 1, updated: 0, skipped: 0 });

    const lt = await onlyLeaveType();
    expect(lt.name).toBe('Holiday');
    expect(lt.color).toBe('#abc');
    expect(lt.deducted).toBe(true);
    expect(lt.daysPerYear).toBe(26);
    expect(await findTargetId('timetastic', 'leave_types', 'LT1')).toBe(lt.id);
  });

  it('reads PascalCase field variants (Name/Color/Deducted/Allowance)', async () => {
    await seedLeaveType('LT1', { Name: 'Sick', Color: '#def', Deducted: false, Allowance: 10 });

    await transformLeaveTypes();
    const lt = await onlyLeaveType();
    expect(lt.name).toBe('Sick');
    expect(lt.color).toBe('#def');
    expect(lt.deducted).toBe(false);
    expect(lt.daysPerYear).toBe(10);
  });

  it('falls back: name → "Unknown Leave Type", color → null, deducted → true', async () => {
    await seedLeaveType('LT1', {});
    await transformLeaveTypes();
    const lt = await onlyLeaveType();
    expect(lt.name).toBe('Unknown Leave Type');
    expect(lt.color).toBeNull();
    expect(lt.deducted).toBe(true);
  });

  it('coerces deducted with Boolean(): falsy values become false', async () => {
    await seedLeaveType('LT1', { name: 'X', deducted: 0 });
    await transformLeaveTypes();
    expect((await onlyLeaveType()).deducted).toBe(false);
  });

  it('uses allowance as daysPerYear only when it is a number, else 0', async () => {
    await seedLeaveType('LT1', { name: 'Numeric', allowance: 15 });
    await seedLeaveType('LT2', { name: 'StringAllowance', allowance: '15' });
    await seedLeaveType('LT3', { name: 'NoAllowance' });

    await transformLeaveTypes();

    const byName = Object.fromEntries(
      (await db.select().from(leaveTypes)).map((lt) => [lt.name, lt.daysPerYear]),
    );
    expect(byName['Numeric']).toBe(15);
    expect(byName['StringAllowance']).toBe(0); // non-number → 0
    expect(byName['NoAllowance']).toBe(0);
  });

  it('is idempotent: a second run updates in place, no duplicate', async () => {
    await seedLeaveType('LT1', { name: 'Holiday', allowance: 26 });

    const first = await transformLeaveTypes();
    const second = await transformLeaveTypes();

    expect(first).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(second).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(await db.select().from(leaveTypes)).toHaveLength(1);
  });

  it('updates fields when the staging row changes', async () => {
    await seedLeaveType('LT1', { name: 'Holiday', allowance: 26, deducted: true });
    await transformLeaveTypes();
    const before = await onlyLeaveType();

    await db
      .update(stgTtLeaveTypes)
      .set({ rawData: { name: 'Annual Leave', allowance: 30, deducted: false } })
      .where(eq(stgTtLeaveTypes.externalId, 'LT1'));
    await transformLeaveTypes();

    const after = await onlyLeaveType();
    expect(after.id).toBe(before.id);
    expect(after.name).toBe('Annual Leave');
    expect(after.daysPerYear).toBe(30);
    expect(after.deducted).toBe(false);
  });
});
