export interface SyncConfig {
  togglApiToken: string;
  togglWorkspaceId: string;
  togglOrganizationId: string;
  timetasticApiToken: string;
  databaseUrl: string;
}

let cached: SyncConfig | null = null;

export function getSyncConfig(): SyncConfig {
  if (cached) return cached;

  const togglApiToken = process.env.TOGGL_API_TOKEN;
  const togglWorkspaceId = process.env.TOGGL_WORKSPACE_ID;
  const togglOrganizationId = process.env.TOGGL_ORGANIZATION_ID;
  const timetasticApiToken = process.env.TIMETASTIC_API_TOKEN;
  const databaseUrl = process.env.DATABASE_URL;

  const missing: string[] = [];
  if (!togglApiToken) missing.push('TOGGL_API_TOKEN');
  if (!togglWorkspaceId) missing.push('TOGGL_WORKSPACE_ID');
  if (!togglOrganizationId) missing.push('TOGGL_ORGANIZATION_ID');
  if (!timetasticApiToken) missing.push('TIMETASTIC_API_TOKEN');
  if (!databaseUrl) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  cached = {
    togglApiToken: togglApiToken!,
    togglWorkspaceId: togglWorkspaceId!,
    togglOrganizationId: togglOrganizationId!,
    timetasticApiToken: timetasticApiToken!,
    databaseUrl: databaseUrl!,
  };

  return cached;
}

/** Get only Toggl config (allows running Toggl sync without Timetastic token) */
export function getTogglConfig() {
  const togglApiToken = process.env.TOGGL_API_TOKEN;
  const togglWorkspaceId = process.env.TOGGL_WORKSPACE_ID;
  const togglOrganizationId = process.env.TOGGL_ORGANIZATION_ID;
  const databaseUrl = process.env.DATABASE_URL;

  const missing: string[] = [];
  if (!togglApiToken) missing.push('TOGGL_API_TOKEN');
  if (!togglWorkspaceId) missing.push('TOGGL_WORKSPACE_ID');
  if (!togglOrganizationId) missing.push('TOGGL_ORGANIZATION_ID');
  if (!databaseUrl) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required env vars for Toggl: ${missing.join(', ')}`);
  }

  return {
    togglApiToken: togglApiToken!,
    togglWorkspaceId: togglWorkspaceId!,
    togglOrganizationId: togglOrganizationId!,
    databaseUrl: databaseUrl!,
  };
}

/** Get only Timetastic config */
export function getTimetasticConfig() {
  const timetasticApiToken = process.env.TIMETASTIC_API_TOKEN;
  const databaseUrl = process.env.DATABASE_URL;

  const missing: string[] = [];
  if (!timetasticApiToken) missing.push('TIMETASTIC_API_TOKEN');
  if (!databaseUrl) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required env vars for Timetastic: ${missing.join(', ')}`);
  }

  return {
    timetasticApiToken: timetasticApiToken!,
    databaseUrl: databaseUrl!,
  };
}
