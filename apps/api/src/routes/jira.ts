import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jiraConnections } from '../db/schema.js';
import {
  exchangeCode,
  getAtlassianMe,
  getAccessibleResources,
  jiraFetch,
} from '../lib/jira-client.js';

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
    const connections: Array<{ id: string; cloudId: string; siteName: string; siteUrl: string; siteAvatarUrl: string | null }> = [];
    for (const site of sites) {
      // Check for existing connection (same user + cloud)
      const [existing] = await db
        .select()
        .from(jiraConnections)
        .where(
          and(
            eq(jiraConnections.userId, userId),
            eq(jiraConnections.cloudId, site.id),
          ),
        )
        .limit(1);

      if (existing) {
        // Update tokens and user info
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
            updatedAt: new Date(),
          })
          .where(eq(jiraConnections.id, existing.id))
          .returning();
        connections.push({ id: updated!.id, cloudId: updated!.cloudId, siteName: updated!.siteName, siteUrl: updated!.siteUrl, siteAvatarUrl: updated!.siteAvatarUrl });
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
        connections.push({ id: created!.id, cloudId: created!.cloudId, siteName: created!.siteName, siteUrl: created!.siteUrl, siteAvatarUrl: created!.siteAvatarUrl });
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
        tokenExpiresAt: jiraConnections.tokenExpiresAt,
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

    const [deleted] = await db
      .delete(jiraConnections)
      .where(
        and(
          eq(jiraConnections.id, id),
          eq(jiraConnections.userId, userId),
        ),
      )
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
      .where(
        and(
          eq(jiraConnections.id, id),
          eq(jiraConnections.userId, userId),
        ),
      )
      .limit(1);

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    const res = await jiraFetch(
      connection,
      `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/project/search`,
    );

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
      .where(
        and(
          eq(jiraConnections.id, id),
          eq(jiraConnections.userId, userId),
        ),
      )
      .limit(1);

    if (!connection) {
      return reply.code(404).send({ error: 'Connection not found' });
    }

    // Build JQL: either raw JQL param, or construct from project + text
    let effectiveJql = jql;
    if (!effectiveJql) {
      const parts: string[] = [];
      if (project) parts.push(`project = "${project}"`);
      if (text) parts.push(`text ~ "${text}"`);
      effectiveJql = parts.join(' AND ') || 'ORDER BY updated DESC';
    }

    const params = new URLSearchParams({
      jql: effectiveJql,
      maxResults: '20',
      fields: 'summary,status,issuetype,priority,assignee',
    });

    const res = await jiraFetch(
      connection,
      `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/search/jql?${params}`,
    );

    if (!res.ok) {
      const body = await res.text();
      request.log.error({ status: res.status, body }, 'Jira search API failed');
      return reply.code(502).send({ error: 'Jira search failed', detail: body });
    }

    const data = (await res.json()) as {
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
    };

    return {
      total: data.total,
      issues: data.issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        type: issue.fields.issuetype.name,
        typeIcon: issue.fields.issuetype.iconUrl,
        priority: issue.fields.priority?.name ?? null,
        priorityIcon: issue.fields.priority?.iconUrl ?? null,
        assignee: issue.fields.assignee?.displayName ?? null,
      })),
    };
  });
}
