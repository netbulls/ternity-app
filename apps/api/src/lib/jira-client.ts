/**
 * Jira OAuth 2.0 client helper.
 * Handles authenticated API calls with automatic token refresh.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jiraConnections } from '../db/schema.js';

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

type JiraConnection = typeof jiraConnections.$inferSelect;

/** Thrown when token refresh fails due to revoked/invalid refresh token. */
export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function refreshTokens(connection: JiraConnection): Promise<JiraConnection> {
  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: connection.refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Detect revoked/invalid refresh tokens specifically
    if (body.includes('refresh_token is invalid') || body.includes('unauthorized_client')) {
      throw new TokenExpiredError(`Token refresh failed (${res.status}): ${body}`);
    }
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as TokenResponse;
  const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  const [updated] = await db
    .update(jiraConnections)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(jiraConnections.id, connection.id))
    .returning();

  return updated!;
}

/**
 * Make an authenticated request to the Atlassian/Jira API.
 * Auto-refreshes the token if it's within 5 minutes of expiry.
 */
export async function jiraFetch(
  connection: JiraConnection,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let conn = connection;

  // Refresh if token is expired or about to expire
  if (conn.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
    conn = await refreshTokens(conn);
  }

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: 'application/json',
      ...init?.headers,
    },
  });
}

/**
 * Exchange an authorization code for tokens.
 * Returns the raw token response.
 */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: process.env.JIRA_CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<TokenResponse>;
}

/**
 * Get the current Atlassian user's profile.
 */
export async function getAtlassianMe(accessToken: string) {
  const res = await fetch('https://api.atlassian.com/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Atlassian user (${res.status})`);
  }

  return res.json() as Promise<{
    account_id: string;
    name: string;
    email: string;
    picture: string;
  }>;
}

/**
 * Get accessible Jira sites (cloud resources) for the token.
 */
export async function getAccessibleResources(accessToken: string) {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get accessible resources (${res.status})`);
  }

  return res.json() as Promise<
    Array<{
      id: string;
      name: string;
      url: string;
      scopes: string[];
      avatarUrl: string;
    }>
  >;
}
