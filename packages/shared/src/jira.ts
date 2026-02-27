import { z } from 'zod';

// ── Config schema (stored as JSONB in jira_connections.config) ──────────

export const JiraConnectionConfigSchema = z.object({
  selectedProjects: z.array(z.string()).default([]),
  excludedStatuses: z.array(z.string()).default([]),
  queryMode: z.enum(['visual', 'custom']).default('visual'),
  customJql: z.string().optional(),
  projectMappings: z.record(z.string(), z.string()).default({}),
  defaultProjectId: z.string().nullable().default(null),
});

export type JiraConnectionConfig = z.infer<typeof JiraConnectionConfigSchema>;

// ── View types (what the API returns — no secrets) ──────────────────────

export interface JiraConnectionView {
  id: string;
  cloudId: string;
  siteName: string;
  siteUrl: string;
  siteAvatarUrl: string | null;
  atlassianDisplayName: string;
  atlassianEmail: string | null;
  atlassianAvatarUrl: string | null;
  config: JiraConnectionConfig;
  tokenStatus: 'active' | 'expired';
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    key: string;
    name: string;
  };
}

// ── Issue types (search results + linking) ──────────────────────────

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  type: string;
  typeIcon: string | null;
  priority: string | null;
  priorityIcon: string | null;
  assignee: string | null;
}

export interface JiraIssueLink {
  key: string;
  summary: string;
  connectionId: string;
  siteUrl: string;
}

export interface JiraSearchResult {
  connectionId: string;
  siteName: string;
  siteUrl: string;
  issues: JiraIssue[];
}
