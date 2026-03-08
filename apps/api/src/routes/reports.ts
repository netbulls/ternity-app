import { FastifyInstance } from 'fastify';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reportTemplates, projectMembers } from '../db/schema.js';
import { ORG_TIMEZONE, GlobalRole } from '@ternity/shared';
import type { ReportData, ReportConfig, SavedReportTemplate } from '@ternity/shared';
import {
  CreateReportTemplateSchema,
  UpdateReportTemplateSchema,
  GeneratePdfRequestSchema,
} from '@ternity/shared';
import { renderReportHtml } from '../pdf-templates/index.js';

const TZ_LITERAL = sql.raw(`'${ORG_TIMEZONE}'`);

// ── Helpers ───────────────────────────────────────────────────────────────

function orgMidnightToUTC(dateStr: string): Date {
  const noon = new Date(dateStr + 'T12:00:00Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    hour12: false,
    timeZoneName: 'longOffset',
  }).formatToParts(noon);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  const match = tzPart?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error('Cannot parse timezone offset for ' + ORG_TIMEZONE);
  const sign = match[1] === '+' ? 1 : -1;
  const offsetMs = sign * (parseInt(match[2]!, 10) * 3600000 + parseInt(match[3]!, 10) * 60000);
  return new Date(new Date(dateStr + 'T00:00:00Z').getTime() - offsetMs);
}

/** Get accessible user IDs based on role */
async function getAccessibleUserIds(
  userId: string,
  globalRole: GlobalRole,
  requestedUserIds: string[],
): Promise<string[] | null> {
  // null = no filter (all users)
  if (globalRole === GlobalRole.Admin) {
    return requestedUserIds.length > 0 ? requestedUserIds : null;
  }

  // Regular users can only see themselves
  // (Future: managers could see project members via org roles)
  return [userId];
}

// Note: when org-role-based scoping is needed, a manager-level query
// can be added that joins project_members to find accessible user IDs.

// ── Row type from the entries query ───────────────────────────────────────

interface EntryRow extends Record<string, unknown> {
  entry_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  client_name: string | null;
  description: string | null;
  jira_issue_key: string | null;
  entry_date: string;
  start_time: string | null;
  duration_seconds: string;
}

/** Aggregate raw entry rows into the ReportData response shape. */
function aggregateReportData(rows: EntryRow[], dateFrom: string, dateTo: string): ReportData {
  const entryMap = new Map<
    string,
    {
      id: string;
      userId: string;
      userName: string;
      userAvatarUrl: string | null;
      projectName: string;
      projectColor: string;
      clientName: string | null;
      description: string;
      jiraIssueKey: string | null;
      date: string;
      startTime: string;
      totalSeconds: number;
    }
  >();

  for (const row of rows) {
    const key = `${row.entry_id}_${row.entry_date}`;
    const existing = entryMap.get(key);
    const seconds = Math.round(Number(row.duration_seconds));

    if (existing) {
      existing.totalSeconds += seconds;
    } else {
      entryMap.set(key, {
        id: row.entry_id,
        userId: row.user_id,
        userName: row.user_name,
        userAvatarUrl: row.user_avatar_url,
        projectName: row.project_name ?? 'No project',
        projectColor: row.project_color ?? '#F59E0B',
        clientName: row.client_name,
        description: row.description ?? '',
        jiraIssueKey: row.jira_issue_key,
        date:
          typeof row.entry_date === 'string'
            ? row.entry_date.slice(0, 10)
            : new Date(row.entry_date).toISOString().slice(0, 10),
        startTime: row.start_time ?? '—',
        totalSeconds: seconds,
      });
    }
  }

  // Group by user
  const userMap = new Map<
    string,
    {
      userId: string;
      userName: string;
      userAvatarUrl: string | null;
      totalSeconds: number;
      entryCount: number;
      dates: Set<string>;
      dayGroups: Map<
        string,
        {
          date: string;
          entries: Array<typeof entryMap extends Map<string, infer V> ? V : never>;
          totalSeconds: number;
        }
      >;
    }
  >();

  for (const entry of entryMap.values()) {
    let user = userMap.get(entry.userId);
    if (!user) {
      user = {
        userId: entry.userId,
        userName: entry.userName,
        userAvatarUrl: entry.userAvatarUrl,
        totalSeconds: 0,
        entryCount: 0,
        dates: new Set(),
        dayGroups: new Map(),
      };
      userMap.set(entry.userId, user);
    }
    user.totalSeconds += entry.totalSeconds;
    user.entryCount += 1;
    user.dates.add(entry.date);

    let dayGroup = user.dayGroups.get(entry.date);
    if (!dayGroup) {
      dayGroup = { date: entry.date, entries: [], totalSeconds: 0 };
      user.dayGroups.set(entry.date, dayGroup);
    }
    dayGroup.entries.push(entry);
    dayGroup.totalSeconds += entry.totalSeconds;
  }

  const grandTotalSeconds = Array.from(userMap.values()).reduce((s, u) => s + u.totalSeconds, 0);
  const totalEntries = Array.from(userMap.values()).reduce((s, u) => s + u.entryCount, 0);

  // Unique projects
  const projectSet = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      clientName: string | null;
      totalSeconds: number;
      entryCount: number;
    }
  >();
  for (const entry of entryMap.values()) {
    const key = entry.projectName;
    const existing = projectSet.get(key);
    if (existing) {
      existing.totalSeconds += entry.totalSeconds;
      existing.entryCount += 1;
    } else {
      projectSet.set(key, {
        id: key,
        name: entry.projectName,
        color: entry.projectColor,
        clientName: entry.clientName,
        totalSeconds: entry.totalSeconds,
        entryCount: 1,
      });
    }
  }

  // Count working days
  let workingDays = 0;
  const cursor = new Date(dateFrom + 'T12:00:00Z');
  const endDate = new Date(dateTo + 'T12:00:00Z');
  while (cursor <= endDate) {
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) workingDays++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    dateFrom,
    dateTo,
    generatedAt: new Date().toISOString(),
    summary: {
      totalSeconds: grandTotalSeconds,
      totalEntries,
      userCount: userMap.size,
      projectCount: projectSet.size,
      workingDays,
    },
    userBreakdown: Array.from(userMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userAvatarUrl: u.userAvatarUrl,
        totalSeconds: u.totalSeconds,
        percentage:
          grandTotalSeconds > 0 ? Math.round((u.totalSeconds / grandTotalSeconds) * 100) : 0,
        entryCount: u.entryCount,
      })),
    userDetails: Array.from(userMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userAvatarUrl: u.userAvatarUrl,
        totalSeconds: u.totalSeconds,
        entryCount: u.entryCount,
        daysActive: u.dates.size,
        dayGroups: Array.from(u.dayGroups.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((dg) => ({
            date: dg.date,
            dayTotalSeconds: dg.totalSeconds,
            entries: dg.entries
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((e) => ({
                id: e.id,
                description: e.description,
                projectName: e.projectName,
                projectColor: e.projectColor,
                clientName: e.clientName,
                jiraIssueKey: e.jiraIssueKey,
                startTime: e.startTime,
                durationSeconds: e.totalSeconds,
              })),
          })),
      })),
    projectBreakdown: Array.from(projectSet.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        clientName: p.clientName,
        totalSeconds: p.totalSeconds,
        percentage:
          grandTotalSeconds > 0 ? Math.round((p.totalSeconds / grandTotalSeconds) * 100) : 0,
        entryCount: p.entryCount,
      })),
  };
}

// ── Shared data-fetch helper ──────────────────────────────────────────────

interface FetchReportDataOpts {
  userId: string;
  globalRole: GlobalRole;
  dateFrom: string;
  dateTo: string;
  projectIds: string[];
  userIds: string[];
  clientIds: string[];
  tagIds: string[];
}

async function fetchReportData(opts: FetchReportDataOpts): Promise<ReportData> {
  const accessibleUserIds = await getAccessibleUserIds(opts.userId, opts.globalRole, opts.userIds);

  const startUTC = orgMidnightToUTC(opts.dateFrom);
  const endDateStr = new Date(new Date(opts.dateTo + 'T12:00:00Z').getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  const endUTC = new Date(orgMidnightToUTC(endDateStr).getTime() - 1);

  const conditions: string[] = [
    `te.is_active = true`,
    `COALESCE(es.started_at, es.created_at) >= '${startUTC.toISOString()}'`,
    `COALESCE(es.started_at, es.created_at) <= '${endUTC.toISOString()}'`,
  ];

  if (accessibleUserIds !== null) {
    const ids = accessibleUserIds.map((id) => `'${id}'`).join(',');
    conditions.push(`te.user_id IN (${ids})`);
  }
  if (opts.projectIds.length > 0) {
    const ids = opts.projectIds.map((id) => `'${id}'`).join(',');
    conditions.push(`te.project_id IN (${ids})`);
  }
  if (opts.clientIds.length > 0) {
    const ids = opts.clientIds.map((id) => `'${id}'`).join(',');
    conditions.push(`p.client_id IN (${ids})`);
  }

  const whereClause = conditions.join(' AND ');
  const tagJoin =
    opts.tagIds.length > 0
      ? `INNER JOIN entry_tags et ON et.entry_id = te.id AND et.tag_id IN (${opts.tagIds.map((id) => `'${id}'`).join(',')})`
      : '';

  const entriesResult = await db.execute<EntryRow>(
    sql.raw(`
    SELECT
      te.id AS entry_id, te.user_id,
      u.display_name AS user_name, u.avatar_url AS user_avatar_url,
      te.project_id, p.name AS project_name, p.color AS project_color,
      c.name AS client_name, te.description, te.jira_issue_key,
      DATE(COALESCE(es.started_at, es.created_at) AT TIME ZONE '${ORG_TIMEZONE}') AS entry_date,
      TO_CHAR(es.started_at AT TIME ZONE '${ORG_TIMEZONE}', 'HH24:MI') AS start_time,
      COALESCE(
        CASE WHEN es.stopped_at IS NULL AND es.type = 'clocked'
          THEN EXTRACT(EPOCH FROM NOW() - es.started_at)
          ELSE es.duration_seconds END, 0
      )::text AS duration_seconds
    FROM time_entries te
    INNER JOIN entry_segments es ON es.entry_id = te.id
    INNER JOIN users u ON u.id = te.user_id
    LEFT JOIN projects p ON p.id = te.project_id
    LEFT JOIN clients c ON c.id = p.client_id
    ${tagJoin}
    WHERE ${whereClause}
    ORDER BY u.display_name, entry_date, es.started_at
  `),
  );

  return aggregateReportData(entriesResult.rows, opts.dateFrom, opts.dateTo);
}

// ── Routes ────────────────────────────────────────────────────────────────

export async function reportsRoutes(fastify: FastifyInstance) {
  // ── GET /api/reports/data ─────────────────────────────────────────────
  fastify.get('/api/reports/data', async (request) => {
    const query = request.query as Record<string, string>;
    const dateFrom = query.dateFrom;
    const dateTo = query.dateTo;
    if (!dateFrom || !dateTo) {
      throw Object.assign(new Error('dateFrom and dateTo are required'), { statusCode: 400 });
    }

    return fetchReportData({
      userId: request.auth.userId,
      globalRole: request.auth.globalRole,
      dateFrom,
      dateTo,
      projectIds: query.projectIds ? query.projectIds.split(',') : [],
      userIds: query.userIds ? query.userIds.split(',') : [],
      clientIds: query.clientIds ? query.clientIds.split(',') : [],
      tagIds: query.tagIds ? query.tagIds.split(',') : [],
    });
  });

  // ── POST /api/reports/preview ─────────────────────────────────────────
  // Returns the rendered HTML for in-app preview (no Gotenberg round-trip)
  fastify.post('/api/reports/preview', async (request, reply) => {
    const body = GeneratePdfRequestSchema.parse(request.body);
    const config = body.config;

    const reportData = await fetchReportData({
      userId: request.auth.userId,
      globalRole: request.auth.globalRole,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      projectIds: config.projectIds,
      userIds: config.userIds,
      clientIds: config.clientIds,
      tagIds: config.tagIds,
    });

    const html = renderReportHtml(body.template, reportData, {
      showStartTime: config.showStartTime,
    });
    reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  // ── POST /api/reports/pdf ─────────────────────────────────────────────
  fastify.post('/api/reports/pdf', async (request, reply) => {
    const body = GeneratePdfRequestSchema.parse(request.body);
    const config = body.config;

    const reportData = await fetchReportData({
      userId: request.auth.userId,
      globalRole: request.auth.globalRole,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      projectIds: config.projectIds,
      userIds: config.userIds,
      clientIds: config.clientIds,
      tagIds: config.tagIds,
    });

    const html = renderReportHtml(body.template, reportData, {
      showStartTime: config.showStartTime,
    });

    // ── Send to Gotenberg ─────────────────────────────────────────
    const gotenbergUrl = process.env.GOTENBERG_URL ?? 'http://localhost:3030';
    const formData = new FormData();
    const htmlBlob = new Blob([html], { type: 'text/html' });
    formData.append('files', htmlBlob, 'index.html');
    // A4 page settings
    formData.append('paperWidth', '8.27');
    formData.append('paperHeight', '11.7');
    formData.append('marginTop', '0');
    formData.append('marginBottom', '0');
    formData.append('marginLeft', '0');
    formData.append('marginRight', '0');
    formData.append('preferCssPageSize', 'true');
    // Render background colors/images (required for dark templates, cards, etc.)
    formData.append('printBackground', 'true');
    // Wait for fonts to load
    formData.append('waitDelay', '2s');

    const gotenbergRes = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: formData,
    });

    if (!gotenbergRes.ok) {
      const errText = await gotenbergRes.text();
      fastify.log.error(`Gotenberg error ${gotenbergRes.status}: ${errText}`);
      throw Object.assign(new Error('PDF generation failed'), { statusCode: 502 });
    }

    const pdfBuffer = Buffer.from(await gotenbergRes.arrayBuffer());
    const filename = `ternity-report-${config.dateFrom}-${config.dateTo}.pdf`;

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', pdfBuffer.length)
      .send(pdfBuffer);
  });

  // ── GET /api/reports/templates ────────────────────────────────────────
  fastify.get('/api/reports/templates', async (request) => {
    const userId = request.auth.userId;

    const rows = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.userId, userId))
      .orderBy(reportTemplates.updatedAt);

    return rows.map(
      (r): SavedReportTemplate => ({
        id: r.id,
        name: r.name,
        config: r.config as ReportConfig,
        isFavorite: r.isFavorite,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }),
    );
  });

  // ── POST /api/reports/templates ───────────────────────────────────────
  fastify.post('/api/reports/templates', async (request) => {
    const userId = request.auth.userId;
    const body = CreateReportTemplateSchema.parse(request.body);

    const [row] = await db
      .insert(reportTemplates)
      .values({
        name: body.name,
        userId,
        config: body.config as Record<string, unknown>,
        isFavorite: body.isFavorite,
      })
      .returning();

    const r = row!;
    return {
      id: r.id,
      name: r.name,
      config: r.config as ReportConfig,
      isFavorite: r.isFavorite,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    } satisfies SavedReportTemplate;
  });

  // ── PATCH /api/reports/templates/:id ──────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/api/reports/templates/:id', async (request) => {
    const userId = request.auth.userId;
    const { id } = request.params;
    const body = UpdateReportTemplateSchema.parse(request.body);

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.config !== undefined) updates.config = body.config;
    if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite;

    const [row] = await db
      .update(reportTemplates)
      .set(updates)
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Template not found'), { statusCode: 404 });
    }

    return {
      id: row.id,
      name: row.name,
      config: row.config as ReportConfig,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } satisfies SavedReportTemplate;
  });

  // ── DELETE /api/reports/templates/:id ─────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/api/reports/templates/:id',
    async (request, reply) => {
      const userId = request.auth.userId;
      const { id } = request.params;

      const result = await db
        .delete(reportTemplates)
        .where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)));

      reply.code(204).send();
    },
  );
}
