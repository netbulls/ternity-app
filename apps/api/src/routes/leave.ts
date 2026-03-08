import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, or, sql, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  leaveTypes,
  leaveTypeGroups,
  leaveRequests,
  leaveAllowances,
  users,
  projects,
  workingSchedules,
} from '../db/schema.js';
import { DEFAULT_WEEKLY_WORKING_HOURS, ORG_TIMEZONE, type WorkingDayKey } from '@ternity/shared';

// ── Polish Public Holidays ────────────────────────────────────────────────

const POLISH_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': "New Year's Day",
  '2025-01-06': 'Epiphany',
  '2025-04-20': 'Easter Sunday',
  '2025-04-21': 'Easter Monday',
  '2025-05-01': 'Labour Day',
  '2025-05-03': 'Constitution Day',
  '2025-06-08': 'Whit Sunday',
  '2025-06-19': 'Corpus Christi',
  '2025-08-15': 'Assumption',
  '2025-11-01': "All Saints' Day",
  '2025-11-11': 'Independence Day',
  '2025-12-25': 'Christmas Day',
  '2025-12-26': "St. Stephen's Day",
  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-06': 'Epiphany',
  '2026-04-05': 'Easter Sunday',
  '2026-04-06': 'Easter Monday',
  '2026-05-01': 'Labour Day',
  '2026-05-03': 'Constitution Day',
  '2026-05-24': 'Whit Sunday',
  '2026-06-04': 'Corpus Christi',
  '2026-08-15': 'Assumption',
  '2026-11-01': "All Saints' Day",
  '2026-11-11': 'Independence Day',
  '2026-12-25': 'Christmas Day',
  '2026-12-26': "St. Stephen's Day",
  // 2027
  '2027-01-01': "New Year's Day",
  '2027-01-06': 'Epiphany',
  '2027-03-28': 'Easter Sunday',
  '2027-03-29': 'Easter Monday',
  '2027-05-01': 'Labour Day',
  '2027-05-03': 'Constitution Day',
  '2027-05-16': 'Whit Sunday',
  '2027-06-17': 'Corpus Christi',
  '2027-08-15': 'Assumption',
  '2027-11-01': "All Saints' Day",
  '2027-11-11': 'Independence Day',
  '2027-12-25': 'Christmas Day',
  '2027-12-26': "St. Stephen's Day",
};

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr: string): boolean {
  return dateStr in POLISH_HOLIDAYS;
}

function isWorkingDay(dateStr: string): boolean {
  return !isWeekend(dateStr) && !isHoliday(dateStr);
}

/** Count working days between two dates (inclusive), excluding weekends and holidays */
function countWorkingDays(startDate: string, endDate: string): number {
  let count = 0;
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    if (isWorkingDay(dateStr)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Get all dates in a range as YYYY-MM-DD strings */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Parse "HH:MM" to fractional hours (e.g. "09:30" => 9.5) */
function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! + (m ?? 0) / 60;
}

/** Get the day-of-week key for a YYYY-MM-DD string */
function getDayKey(dateStr: string): WorkingDayKey {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  const keys: WorkingDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[day]!;
}

/** Validate that startHour + hours fits within the user's schedule for the given date */
function validatePartialAgainstSchedule(
  startHour: string,
  hours: number,
  schedule: { start: string; end: string; enabled: boolean },
): string | null {
  if (!schedule.enabled) {
    return 'This day is not a working day in your schedule';
  }
  const schedStart = parseTime(schedule.start);
  const schedEnd = parseTime(schedule.end);
  const leaveStart = parseTime(startHour);
  const leaveEnd = leaveStart + hours;

  if (leaveStart < schedStart) {
    return `Start time ${startHour} is before your work start ${schedule.start}`;
  }
  if (leaveEnd > schedEnd) {
    return `Leave would end at ${String(Math.floor(leaveEnd)).padStart(2, '0')}:${String(Math.round((leaveEnd % 1) * 60)).padStart(2, '0')} which is after your work end ${schedule.end}`;
  }
  return null; // valid
}

// ── Routes ────────────────────────────────────────────────────────────────

export async function leaveRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/leave/types
   *
   * Returns leave types visible to the current user based on their employment type.
   * Only active types are returned. Includes group info for legend rendering.
   */
  fastify.get('/api/leave/types', async (request) => {
    // Get current user's employment type
    const userId = request.auth.userId;
    const [user] = await db
      .select({ employmentType: users.employmentType })
      .from(users)
      .where(eq(users.id, userId));
    const empType = user?.employmentType ?? 'contractor';

    const types = await db
      .select({
        id: leaveTypes.id,
        name: leaveTypes.name,
        daysPerYear: leaveTypes.daysPerYear,
        color: leaveTypes.color,
        deducted: leaveTypes.deducted,
        groupId: leaveTypes.groupId,
        active: leaveTypes.active,
        visibility: leaveTypes.visibility,
        isContractorDefault: leaveTypes.isContractorDefault,
        groupName: leaveTypeGroups.name,
        groupColor: leaveTypeGroups.color,
      })
      .from(leaveTypes)
      .leftJoin(leaveTypeGroups, eq(leaveTypes.groupId, leaveTypeGroups.id))
      .where(
        and(
          eq(leaveTypes.active, true),
          or(eq(leaveTypes.visibility, 'all'), eq(leaveTypes.visibility, empType)),
        ),
      )
      .orderBy(leaveTypes.name);

    return { types, employmentType: empType };
  });

  /**
   * GET /api/leave/holidays?year=2026
   *
   * Returns Polish public holidays for the given year (default: current year).
   */
  fastify.get('/api/leave/holidays', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
    const prefix = `${year}-`;

    const holidays: Record<string, string> = {};
    for (const [date, name] of Object.entries(POLISH_HOLIDAYS)) {
      if (date.startsWith(prefix)) {
        holidays[date] = name;
      }
    }
    return holidays;
  });

  /**
   * GET /api/leave/wallchart?from=2026-03-01&to=2026-03-31
   *
   * Returns wallchart data: all active users with their leave bookings
   * in the given date range.
   */
  fastify.get('/api/leave/wallchart', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const from = query.from;
    const to = query.to;

    if (!from || !to) {
      return reply.code(400).send({ error: 'from and to query params required' });
    }

    // 1. All active users (with team info from defaultProjectId)
    const allUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        teamId: users.defaultProjectId,
        teamName: projects.name,
        teamColor: projects.color,
      })
      .from(users)
      .leftJoin(projects, eq(users.defaultProjectId, projects.id))
      .where(eq(users.active, true))
      .orderBy(users.displayName);

    // 2. All leave requests that overlap with [from, to]
    //    A booking overlaps if startDate <= to AND endDate >= from
    const bookings = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        daysCount: leaveRequests.daysCount,
        hours: leaveRequests.hours,
        startHour: leaveRequests.startHour,
        note: leaveRequests.note,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .where(
        and(
          lte(leaveRequests.startDate, to),
          gte(leaveRequests.endDate, from),
          // Only show active bookings (not cancelled)
          sql`${leaveRequests.status} != 'cancelled'`,
        ),
      );

    // 3. All leave types (for color mapping) — include group info
    const types = await db
      .select({
        id: leaveTypes.id,
        name: leaveTypes.name,
        daysPerYear: leaveTypes.daysPerYear,
        color: leaveTypes.color,
        deducted: leaveTypes.deducted,
        groupId: leaveTypes.groupId,
        active: leaveTypes.active,
        visibility: leaveTypes.visibility,
        groupName: leaveTypeGroups.name,
        groupColor: leaveTypeGroups.color,
      })
      .from(leaveTypes)
      .leftJoin(leaveTypeGroups, eq(leaveTypes.groupId, leaveTypeGroups.id));

    // 4. Group bookings by user
    const bookingsByUser = new Map<string, typeof bookings>();
    for (const b of bookings) {
      if (!bookingsByUser.has(b.userId)) {
        bookingsByUser.set(b.userId, []);
      }
      bookingsByUser.get(b.userId)!.push(b);
    }

    return {
      users: allUsers.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        teamId: u.teamId,
        teamName: u.teamName,
        teamColor: u.teamColor,
        bookings: bookingsByUser.get(u.id) ?? [],
      })),
      leaveTypes: types,
    };
  });

  /**
   * GET /api/leave/requests
   *
   * Returns the authenticated user's leave requests (all statuses).
   * Optionally filter by year with ?year=2026.
   */
  fastify.get('/api/leave/requests', async (request) => {
    const userId = request.auth.userId;
    const query = request.query as Record<string, string | undefined>;

    const conditions = [eq(leaveRequests.userId, userId)];

    if (query.year) {
      const year = parseInt(query.year, 10);
      conditions.push(gte(leaveRequests.startDate, `${year}-01-01`));
      conditions.push(lte(leaveRequests.startDate, `${year}-12-31`));
    }

    const requests = await db
      .select({
        id: leaveRequests.id,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        daysCount: leaveRequests.daysCount,
        hours: leaveRequests.hours,
        startHour: leaveRequests.startHour,
        note: leaveRequests.note,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .orderBy(sql`${leaveRequests.startDate} DESC`);

    return requests;
  });

  /**
   * GET /api/leave/allowances?year=2026
   *
   * Returns the authenticated user's leave allowances for the given year.
   */
  fastify.get('/api/leave/allowances', async (request) => {
    const userId = request.auth.userId;
    const query = request.query as Record<string, string | undefined>;
    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();

    const allowances = await db
      .select({
        id: leaveAllowances.id,
        leaveTypeId: leaveAllowances.leaveTypeId,
        year: leaveAllowances.year,
        totalDays: leaveAllowances.totalDays,
        usedDays: leaveAllowances.usedDays,
      })
      .from(leaveAllowances)
      .where(and(eq(leaveAllowances.userId, userId), eq(leaveAllowances.year, year)));

    return allowances;
  });

  /**
   * POST /api/leave/requests
   *
   * Book time off. Contractor flow: immediately autoconfirmed.
   *
   * Body:
   *   leaveTypeId: string
   *   startDate: string (YYYY-MM-DD)
   *   endDate: string (YYYY-MM-DD)
   *   hours?: number (0.5-8 in 0.5 steps for partial day, omit for full day)
   *   startHour?: string (HH:MM, required when hours is set)
   *   note?: string
   */
  fastify.post('/api/leave/requests', async (request, reply) => {
    const userId = request.auth.userId;
    const body = request.body as {
      leaveTypeId?: string;
      startDate: string;
      endDate: string;
      hours?: number;
      startHour?: string;
      note?: string;
    };

    let { leaveTypeId, startDate, endDate, hours, startHour, note } = body;

    // ── Resolve leave type for contractors ──

    // Get user's employment type
    const [currentUser] = await db
      .select({ employmentType: users.employmentType })
      .from(users)
      .where(eq(users.id, userId));
    const empType = currentUser?.employmentType ?? 'contractor';

    if (empType === 'contractor') {
      // Always use the contractor default leave type, ignoring whatever was sent
      const [contractorDefault] = await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(eq(leaveTypes.isContractorDefault, true))
        .limit(1);
      if (!contractorDefault) {
        return reply
          .code(400)
          .send({ error: 'No contractor default leave type configured — contact admin' });
      }
      leaveTypeId = contractorDefault.id;
    }

    // ── Validation ──

    if (!leaveTypeId || !startDate || !endDate) {
      return reply.code(400).send({ error: 'leaveTypeId, startDate, endDate are required' });
    }

    // Validate dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return reply.code(400).send({ error: 'Dates must be YYYY-MM-DD format' });
    }

    if (startDate > endDate) {
      return reply.code(400).send({ error: 'startDate must be <= endDate' });
    }

    // Validate leave type exists
    const [leaveType] = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, leaveTypeId))
      .limit(1);

    if (!leaveType) {
      return reply.code(400).send({ error: 'Invalid leave type' });
    }

    // Partial-day validation
    if (hours !== undefined && hours !== null) {
      if (hours < 0.5 || hours > 8 || (hours * 2) % 1 !== 0) {
        return reply.code(400).send({ error: 'Hours must be between 0.5 and 8 in 0.5 increments' });
      }
      if (startDate !== endDate) {
        return reply.code(400).send({ error: 'Partial-day bookings must be single-date only' });
      }
      if (!startHour || !/^\d{2}:\d{2}$/.test(startHour)) {
        return reply
          .code(400)
          .send({ error: 'startHour is required for partial-day bookings (HH:MM format)' });
      }
      // Validate against user's working schedule
      const [scheduleRow] = await db
        .select({ schedule: workingSchedules.schedule })
        .from(workingSchedules)
        .where(eq(workingSchedules.userId, userId))
        .limit(1);
      const schedule =
        (scheduleRow?.schedule as typeof DEFAULT_WEEKLY_WORKING_HOURS) ??
        DEFAULT_WEEKLY_WORKING_HOURS;
      const dayKey = getDayKey(startDate);
      const daySchedule = schedule[dayKey];
      const scheduleError = validatePartialAgainstSchedule(startHour, hours, daySchedule);
      if (scheduleError) {
        return reply.code(400).send({ error: scheduleError });
      }
    }

    // Check start date is not in the past (using org timezone for "today")
    const today = new Date().toLocaleDateString('en-CA', { timeZone: ORG_TIMEZONE });
    if (startDate < today) {
      return reply.code(400).send({ error: 'Cannot book leave in the past' });
    }

    // ── Overlap check ──

    // Get existing bookings for this user that overlap with the requested dates
    const existingBookings = await db
      .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        hours: leaveRequests.hours,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, userId),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate),
          sql`${leaveRequests.status} != 'cancelled'`,
        ),
      );

    // Check for full-day conflicts
    const requestedDates = getDatesInRange(startDate, endDate).filter(isWorkingDay);

    for (const existing of existingBookings) {
      if (existing.hours === null) {
        // Existing full-day booking — blocks all its dates
        const existingDates = getDatesInRange(existing.startDate, existing.endDate);
        const overlap = requestedDates.filter((d) => existingDates.includes(d));
        if (overlap.length > 0) {
          return reply.code(409).send({
            error: `Already have a full-day booking covering ${overlap[0]}`,
            conflictDates: overlap,
          });
        }
      }
    }

    // If requesting a full-day booking, check for existing partials on any of the requested dates
    if (!hours) {
      for (const dateStr of requestedDates) {
        const partialsOnDate = existingBookings.filter(
          (b) => b.hours !== null && b.startDate <= dateStr && b.endDate >= dateStr,
        );
        if (partialsOnDate.length > 0) {
          return reply.code(409).send({
            error: `Cannot book full day on ${dateStr} — cancel existing partial booking(s) first`,
            conflictDates: [dateStr],
          });
        }
      }
    }

    // If requesting a partial-day booking, check total hours don't exceed 4h on that date
    if (hours) {
      const existingHoursOnDate = existingBookings
        .filter((b) => b.hours !== null && b.startDate <= startDate && b.endDate >= startDate)
        .reduce((sum, b) => sum + (b.hours ?? 0), 0);

      if (existingHoursOnDate + hours > 4) {
        return reply.code(409).send({
          error: `Total partial hours on ${startDate} would be ${existingHoursOnDate + hours}h (max 4h). Cancel existing partials and book a full day instead.`,
          conflictDates: [startDate],
        });
      }
    }

    // ── Calculate days count ──

    let daysCount: number;
    if (hours) {
      // Partial day: fraction of 8-hour day
      daysCount = 1; // partial day = 1 working day; actual hours stored in `hours` column
    } else {
      daysCount = countWorkingDays(startDate, endDate);
    }

    if (daysCount === 0) {
      return reply.code(400).send({
        error: 'No working days in the selected range (all weekends/holidays)',
      });
    }

    // ── Create the booking ──

    // Phase 1: all users are contractors, so status is autoconfirmed
    const [created] = await db
      .insert(leaveRequests)
      .values({
        userId,
        leaveTypeId,
        startDate,
        endDate,
        daysCount,
        hours: hours ?? null,
        startHour: startHour ?? null,
        note: note ?? null,
        status: 'autoconfirmed',
      })
      .returning();

    reply.code(201);
    return created;
  });

  /**
   * PATCH /api/leave/requests/:id
   *
   * Update an existing leave request.
   * Users can only update their own non-cancelled requests.
   * Admins can update anyone's.
   *
   * Body (all optional — only provided fields are updated):
   *   leaveTypeId?: string
   *   startDate?: string (YYYY-MM-DD)
   *   endDate?: string (YYYY-MM-DD)
   *   hours?: number | null (0.5-8 in 0.5 steps for partial, null to clear partial)
   *   startHour?: string | null (HH:MM, required when hours is set)
   *   note?: string | null
   */
  fastify.patch('/api/leave/requests/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };
    const body = request.body as {
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      hours?: number | null;
      startHour?: string | null;
      note?: string | null;
    };

    // Find the booking
    const [booking] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, id))
      .limit(1);

    if (!booking) {
      return reply.code(404).send({ error: 'Leave request not found' });
    }

    // Check ownership (admins can update anyone's)
    if (booking.userId !== userId && request.auth.globalRole !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized to update this request' });
    }

    if (booking.status === 'cancelled') {
      return reply.code(400).send({ error: 'Cannot update a cancelled request' });
    }

    // Merge with existing values
    const startDate = body.startDate ?? booking.startDate;
    const endDate = body.endDate ?? booking.endDate;
    const leaveTypeId = body.leaveTypeId ?? booking.leaveTypeId;
    const hours = body.hours !== undefined ? body.hours : booking.hours;
    const startHour = body.startHour !== undefined ? body.startHour : booking.startHour;
    const note = body.note !== undefined ? body.note : booking.note;

    // ── Validation ──

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return reply.code(400).send({ error: 'Dates must be YYYY-MM-DD format' });
    }

    if (startDate > endDate) {
      return reply.code(400).send({ error: 'startDate must be <= endDate' });
    }

    // Validate leave type exists if changed
    if (body.leaveTypeId) {
      const [lt] = await db
        .select()
        .from(leaveTypes)
        .where(eq(leaveTypes.id, body.leaveTypeId))
        .limit(1);
      if (!lt) {
        return reply.code(400).send({ error: 'Invalid leave type' });
      }
    }

    // Partial-day validation
    if (hours !== undefined && hours !== null) {
      if (hours < 0.5 || hours > 8 || (hours * 2) % 1 !== 0) {
        return reply.code(400).send({ error: 'Hours must be between 0.5 and 8 in 0.5 increments' });
      }
      if (startDate !== endDate) {
        return reply.code(400).send({ error: 'Partial-day bookings must be single-date only' });
      }
      if (!startHour || !/^\d{2}:\d{2}$/.test(startHour)) {
        return reply
          .code(400)
          .send({ error: 'startHour is required for partial-day bookings (HH:MM format)' });
      }
      // Validate against user's working schedule
      const [scheduleRow] = await db
        .select({ schedule: workingSchedules.schedule })
        .from(workingSchedules)
        .where(eq(workingSchedules.userId, booking.userId))
        .limit(1);
      const schedule =
        (scheduleRow?.schedule as typeof DEFAULT_WEEKLY_WORKING_HOURS) ??
        DEFAULT_WEEKLY_WORKING_HOURS;
      const dayKey = getDayKey(startDate);
      const daySchedule = schedule[dayKey];
      const scheduleError = validatePartialAgainstSchedule(startHour, hours, daySchedule);
      if (scheduleError) {
        return reply.code(400).send({ error: scheduleError });
      }
    }

    // ── Overlap check (exclude self) ──

    const existingBookings = await db
      .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        hours: leaveRequests.hours,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, booking.userId),
          ne(leaveRequests.id, id),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate),
          sql`${leaveRequests.status} != 'cancelled'`,
        ),
      );

    const requestedDates = getDatesInRange(startDate, endDate).filter(isWorkingDay);

    for (const existing of existingBookings) {
      if (existing.hours === null) {
        const existingDates = getDatesInRange(existing.startDate, existing.endDate);
        const overlap = requestedDates.filter((d) => existingDates.includes(d));
        if (overlap.length > 0) {
          return reply.code(409).send({
            error: `Already have a full-day booking covering ${overlap[0]}`,
            conflictDates: overlap,
          });
        }
      }
    }

    if (!hours) {
      for (const dateStr of requestedDates) {
        const partialsOnDate = existingBookings.filter(
          (b) => b.hours !== null && b.startDate <= dateStr && b.endDate >= dateStr,
        );
        if (partialsOnDate.length > 0) {
          return reply.code(409).send({
            error: `Cannot book full day on ${dateStr} — cancel existing partial booking(s) first`,
            conflictDates: [dateStr],
          });
        }
      }
    }

    if (hours) {
      const existingHoursOnDate = existingBookings
        .filter((b) => b.hours !== null && b.startDate <= startDate && b.endDate >= startDate)
        .reduce((sum, b) => sum + (b.hours ?? 0), 0);

      if (existingHoursOnDate + hours > 4) {
        return reply.code(409).send({
          error: `Total partial hours on ${startDate} would be ${existingHoursOnDate + hours}h (max 4h).`,
          conflictDates: [startDate],
        });
      }
    }

    // ── Calculate days count ──

    let daysCount: number;
    if (hours) {
      daysCount = 1; // partial day = 1 working day; actual hours stored in `hours` column
    } else {
      daysCount = countWorkingDays(startDate, endDate);
    }

    if (daysCount === 0) {
      return reply.code(400).send({
        error: 'No working days in the selected range (all weekends/holidays)',
      });
    }

    // ── Update ──

    const [updated] = await db
      .update(leaveRequests)
      .set({
        leaveTypeId,
        startDate,
        endDate,
        daysCount,
        hours: hours ?? null,
        startHour: startHour ?? null,
        note: note ?? null,
      })
      .where(eq(leaveRequests.id, id))
      .returning();

    return updated;
  });

  /**
   * DELETE /api/leave/requests/:id
   *
   * Cancel a leave request. Sets status to 'cancelled'.
   * Users can only cancel their own requests.
   */
  fastify.delete('/api/leave/requests/:id', async (request, reply) => {
    const userId = request.auth.userId;
    const { id } = request.params as { id: string };

    // Find the booking
    const [booking] = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, id))
      .limit(1);

    if (!booking) {
      return reply.code(404).send({ error: 'Leave request not found' });
    }

    // Check ownership (admins can cancel anyone's)
    if (booking.userId !== userId && request.auth.globalRole !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized to cancel this request' });
    }

    if (booking.status === 'cancelled') {
      return reply.code(400).send({ error: 'Already cancelled' });
    }

    // Soft cancel
    const [updated] = await db
      .update(leaveRequests)
      .set({ status: 'cancelled' })
      .where(eq(leaveRequests.id, id))
      .returning();

    return updated;
  });
}
