import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jiraConnections, timeEntries } from '../db/schema.js';
import {
  exchangeCode,
  getAtlassianMe,
  getAccessibleResources,
  jiraFetch,
  TokenExpiredError,
} from '../lib/jira-client.js';
import {
  JiraConnectionConfigSchema,
  type JiraIssue,
  type JiraConnectionConfig,
} from '@ternity/shared';

/** Helper: catch TokenExpiredError, mark connection as expired in DB, return 401. */
async function handleJiraFetchError(
  err: unknown,
  connectionId: string,
  request: { log: { error: (obj: unknown, msg: string) => void } },
  reply: { code: (n: number) => { send: (body: unknown) => unknown } },
) {
  if (err instanceof TokenExpiredError) {
    await db
      .update(jiraConnections)
      .set({ tokenStatus: 'expired', updatedAt: new Date() })
      .where(eq(jiraConnections.id, connectionId));
    request.log.error(err, 'Jira token expired');
    return reply
      .code(401)
      .send({ error: 'Jira connection expired — please reconnect', code: 'TOKEN_EXPIRED' });
  }
  throw err; // re-throw non-token errors
}

/** Jira search API response shape */
interface JiraSearchApiResponse {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      issuetype: { name: string; iconUrl?: string };
      priority: { name: string; iconUrl?: string } | null;
      assignee: { displayName: string; avatarUrls?: Record<string, string> } | null;
    };
  }>;
  total: number;
}

/** Map raw Jira API response to our JiraIssue shape */
function mapJiraIssues(data: JiraSearchApiResponse): JiraIssue[] {
  return data.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    type: issue.fields.issuetype.name,
    typeIcon: issue.fields.issuetype.iconUrl ?? null,
    priority: issue.fields.priority?.name ?? null,
    priorityIcon: issue.fields.priority?.iconUrl ?? null,
    assignee: issue.fields.assignee?.displayName ?? null,
  }));
}

/** Build JQL clauses for a text/key search term.
 *  `projects` is the list of selected project keys from the connection config —
 *  used to expand bare numbers (e.g. "2826") into key lookups ("YOS-2826", "DEV-2826"). */
function buildTextJqlParts(text: string, projects: string[] = []): string[] {
  // "YOS-2826" → exact key lookup
  if (/^[A-Z][A-Z0-9]+-\d+$/i.test(text)) {
    return [`key = "${text.toUpperCase()}"`];
  }
  // "YOS-" or "YOS-28" → project filter
  const prefixMatch = /^([A-Z][A-Z0-9]+)-\d*$/i.exec(text);
  if (prefixMatch) {
    return [`project = "${prefixMatch[1]!.toUpperCase()}"`];
  }
  // Pure number like "2826" → expand to key lookup across configured projects
  if (/^\d+$/.test(text) && projects.length > 0) {
    const keys = projects.map((p) => `"${p}-${text}"`).join(', ');
    return [`key IN (${keys})`];
  }
  // Fallback: full-text search
  return [`text ~ "${text}"`];
}

/** Build JQL from connection config + mode-specific clause */
function buildSearchJql(
  config: JiraConnectionConfig,
  mode: 'assigned' | 'recent' | 'text',
  text?: string,
): string {
  const parts: string[] = [];

  // Project filter from config
  if (config.selectedProjects.length > 0) {
    const projectList = config.selectedProjects.map((p) => `"${p}"`).join(', ');
    parts.push(`project IN (${projectList})`);
  }

  // Status exclusion from config
  if (config.excludedStatuses.length > 0) {
    const statusList = config.excludedStatuses.map((s) => `"${s}"`).join(', ');
    parts.push(`status NOT IN (${statusList})`);
  }

  // Mode-specific clause
  if (mode === 'assigned') {
    parts.push('assignee = currentUser()');
  }
  if (mode === 'text' && text) {
    parts.push(...buildTextJqlParts(text, config.selectedProjects));
  }

  const filter = parts.join(' AND ');

  // Order clause
  const order = 'ORDER BY updated DESC';
  return filter ? `${filter} ${order}` : order;
}

export async function jiraRoutes(fastify: FastifyInstance) {
  // ── POST /api/jira/exchange — Token exchange + store connections ────────
  fastify.post('/api/jira/exchange', async (request, reply) => {
    const { code } = request.body as { code: string };
    if (!code) {
      return reply.code(400).send({ error: 'Missing authorization code' });
    }

    const userId = request.auth.userId;

    // 1. Exchange code for tokens
    let tokenData;
    try {
      tokenData = await exchangeCode(code);
    } catch (err) {
      request.log.error(err, 'Jira token exchange failed');
      return reply.code(502).send({ error: 'Token exchange failed', detail: String(err) });
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // 2. Get Atlassian user identity
    let atlassianUser;
    try {
      atlassianUser = await getAtlassianMe(access_token);
    } catch (err) {
      request.log.error(err, 'Failed to get Atlassian user');
      return reply.code(502).send({ error: 'Failed to get Atlassian user' });
    }

    // 3. Get accessible Jira sites
    let sites;
    try {
      sites = await getAccessibleResources(access_token);
    } catch (err) {
      request.log.error(err, 'Failed to get Jira sites');
      return reply.code(502).send({ error: 'Failed to get accessible sites' });
    }

    if (sites.length === 0) {
      return reply.code(400).send({ error: 'No Jira sites found for this account' });
    }

    // 4. Upsert a connection row per site
    const connections: Array<{
      id: string;
      cloudId: string;
      siteName: string;
      siteUrl: string;
      siteAvatarUrl: string | null;
    }> = [];
    for (const site of sites) {
      // Check for existing connection (same user + cloud)
      const [existing] = await db
        .select()
        .from(jiraConnections)
        .where(and(eq(jiraConnections.userId, userId), eq(jiraConnections.cloudId, site.id)))
        .limit(1);

      if (existing) {
        // Update tokens and user info (also resets tokenStatus on reconnect)
        const [updated] = await db
          .update(jiraConnections)
          .set({
            atlassianAccountId: atlassianUser.account_id,
            atlassianDisplayName: atlassianUser.name,
            atlassianEmail: atlassianUser.email,
            atlassianAvatarUrl: atlassianUser.picture,
            siteName: site.name,
            siteUrl: site.url,
            siteAvatarUrl: site.avatarUrl,
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiresAt,
            tokenStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(jiraConnections.id, existing.id))
          .returning();
        connections.push({
          id: updated!.id,
          cloudId: updated!.cloudId,
          siteName: updated!.siteName,
          siteUrl: updated!.siteUrl,
          siteAvatarUrl: updated!.siteAvatarUrl,
        });
      } else {
        // Create new connection
        const [created] = await db
          .insert(jiraConnections)
          .values({
            userId,
            atlassianAccountId: atlassianUser.account_id,
            atlassianDisplayName: atlassianUser.name,
            atlassianEmail: atlassianUser.email,
            atlassianAvatarUrl: atlassianUser.picture,
            cloudId: site.id,
            siteName: site.name,
            siteUrl: site.url,
            siteAvatarUrl: site.avatarUrl,
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiresAt,
          })
          .returning();
        connections.push({
          id: created!.id,
          cloudId: created!.cloudId,
          siteName: created!.siteName,
          siteUrl: created!.siteUrl,
          siteAvatarUrl: created!.siteAvatarUrl,
        });
      }
    }

    return {
      atlassianUser: {
        accountId: atlassianUser.account_id,
        name: atlassianUser.name,
        email: atlassianUser.email,
        picture: atlassianUser.picture,
      },
      sites: connections,
    };
  });

  // ── GET /api/jira/connections — List user's Jira connections ───────────
  fastify.get('/api/jira/connections', async (request) => {
    const userId = request.auth.userId;

    const rows = await db
      .select({
        id: jiraConnections.id,
        cloudId: jiraConnections.cloudId,
        siteName: jiraConnections.siteName,
        siteUrl: jiraConnections.siteUrl,
        siteAvatarUrl: jiraConnections.siteAvatarUrl,
        atlassianDisplayName: jiraConnections.atlassianDisplayName,
        atlassianEmail: jiraConnections.atlassianEmail,
        atlassianAvatarUrl: jiraConnections.atlassianAvatarUrl,
        config: jiraConnections.config,
        tokenStatus: jiraConnections.tokenStatus,
        lastSyncedAt: jiraConnections.lastSyncedAt,
        createdAt: jiraConnections.createdAt,
      })
      .from(jiraConnections)
      .where(eq(jiraConnections.userId, userId));

    return rows;
  });

  // ── DELETE /api/jira/connections/:id — Remove a connection ─────────────
  fastify.delete('/api/jira/connections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth.userId;

    // Nullify FK references on time entries before deleting the connection
    await db
      .update(timeEntries)
      .set({ jiraConnectionId: null })
      .where(eq(timeEntries.jiraConnectionId, id));

    const [deleted] = await db
      .delete(jiraConnections)
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .returning({ id: jiraConnections.id });

    if (!deleted) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    return { ok: true };
  });

  // ── GET /api/jira/connections/:id/projects — List Jira projects ───────
  fastify.get('/api/jira/connections/:id/projects', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth.userId;

    const [connection] = await db
      .select()
      .from(jiraConnections)
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .limit(1);

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    let res: Response;
    try {
      res = await jiraFetch(
        connection,
        `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/project/search`,
      );
    } catch (err) {
      return handleJiraFetchError(err, connection.id, request, reply);
    }

    if (!res.ok) {
      const body = await res.text();
      request.log.error({ status: res.status, body }, 'Jira projects API failed');
      return reply.code(502).send({ error: 'Failed to fetch Jira projects', detail: body });
    }

    const data = (await res.json()) as { values: unknown[] };
    return data.values;
  });

  // ── GET /api/jira/connections/:id/search — Search Jira issues ─────────
  fastify.get('/api/jira/connections/:id/search', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { jql, project, text } = request.query as {
      jql?: string;
      project?: string;
      text?: string;
    };
    const userId = request.auth.userId;

    const [connection] = await db
      .select()
      .from(jiraConnections)
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .limit(1);

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    // Build JQL: either raw JQL param, or construct from project + text
    let effectiveJql = jql;
    if (!effectiveJql) {
      const config = JiraConnectionConfigSchema.parse(connection.config);
      const parts: string[] = [];
      if (project) parts.push(`project = "${project}"`);
      if (text) parts.push(...buildTextJqlParts(text, config.selectedProjects));
      effectiveJql = parts.join(' AND ') || 'ORDER BY updated DESC';
    }

    const params = new URLSearchParams({
      jql: effectiveJql,
      maxResults: '20',
      fields: 'summary,status,issuetype,priority,assignee',
    });

    let res: Response;
    try {
      res = await jiraFetch(
        connection,
        `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/search/jql?${params}`,
      );
    } catch (err) {
      return handleJiraFetchError(err, connection.id, request, reply);
    }

    if (!res.ok) {
      const body = await res.text();
      request.log.error({ status: res.status, body }, 'Jira search API failed');
      return reply.code(502).send({ error: 'Jira search failed', detail: body });
    }

    const data = (await res.json()) as JiraSearchApiResponse;

    return {
      total: data.total,
      issues: mapJiraIssues(data),
    };
  });

  // ── GET /api/jira/search — Aggregated search across all connections ──
  fastify.get('/api/jira/search', async (request) => {
    const userId = request.auth.userId;
    const { text, mode } = request.query as {
      text?: string;
      mode?: 'assigned' | 'recent' | 'text';
    };
    const searchMode = mode ?? 'recent';

    // Fetch all active connections
    const connections = await db
      .select()
      .from(jiraConnections)
      .where(and(eq(jiraConnections.userId, userId), eq(jiraConnections.tokenStatus, 'active')));

    if (connections.length === 0) return [];

    // Search each connection in parallel
    const results = await Promise.allSettled(
      connections.map(async (connection) => {
        const config = JiraConnectionConfigSchema.parse(connection.config);
        const jql = buildSearchJql(config, searchMode, text);

        const params = new URLSearchParams({
          jql,
          maxResults: '10',
          fields: 'summary,status,issuetype,priority,assignee',
        });

        const res = await jiraFetch(
          connection,
          `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/search/jql?${params}`,
        );

        if (!res.ok) {
          throw new Error(`Jira search failed for ${connection.siteName}: ${res.status}`);
        }

        const data = (await res.json()) as JiraSearchApiResponse;

        return {
          connectionId: connection.id,
          siteName: connection.siteName,
          siteUrl: connection.siteUrl,
          issues: mapJiraIssues(data),
        };
      }),
    );

    // Return only successful results (ignore failed connections)
    return results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          connectionId: string;
          siteName: string;
          siteUrl: string;
          issues: JiraIssue[];
        }> => r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((r) => r.issues.length > 0);
  });

  // ── GET /api/jira/connections/:id/statuses — Fetch Jira statuses ─────
  fastify.get('/api/jira/connections/:id/statuses', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth.userId;

    const [connection] = await db
      .select()
      .from(jiraConnections)
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .limit(1);

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    // Use /rest/api/3/status (works with read:jira-work scope)
    let res: Response;
    try {
      res = await jiraFetch(
        connection,
        `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/status`,
      );
    } catch (err) {
      return handleJiraFetchError(err, connection.id, request, reply);
    }

    if (!res.ok) {
      const body = await res.text();
      request.log.error({ status: res.status, body }, 'Jira statuses API failed');
      return reply.code(502).send({ error: 'Failed to fetch Jira statuses', detail: body });
    }

    const data = (await res.json()) as Array<{
      id: string;
      name: string;
      statusCategory: { id: number; key: string; name: string };
    }>;

    // Deduplicate by name (Jira returns per-project statuses)
    const seen = new Map<string, (typeof data)[0]>();
    for (const status of data) {
      if (!seen.has(status.name)) {
        seen.set(status.name, status);
      }
    }

    return [...seen.values()].map((s) => ({
      id: s.id,
      name: s.name,
      statusCategory: { key: s.statusCategory.key, name: s.statusCategory.name },
    }));
  });

  // ── PATCH /api/jira/connections/:id/config — Update connection config ─
  fastify.patch('/api/jira/connections/:id/config', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth.userId;

    const parsed = JiraConnectionConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid config', detail: parsed.error.flatten() });
    }

    const [updated] = await db
      .update(jiraConnections)
      .set({
        config: parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .returning({ id: jiraConnections.id });

    if (!updated) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    return { ok: true };
  });

  // ── POST /api/jira/connections/:id/sync — Trigger sync (stub) ────────
  fastify.post('/api/jira/connections/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth.userId;

    const [updated] = await db
      .update(jiraConnections)
      .set({
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(jiraConnections.id, id), eq(jiraConnections.userId, userId)))
      .returning({ id: jiraConnections.id, lastSyncedAt: jiraConnections.lastSyncedAt });

    if (!updated) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    return { ok: true, lastSyncedAt: updated.lastSyncedAt };
  });
}
