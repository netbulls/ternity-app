import { describe, expect, it } from 'vitest';
import type { JiraConnectionConfig } from '@ternity/shared';
import { buildSearchJql, buildTextJqlParts } from './jira.js';

// Characterization tests for the JQL builders — the logic the audit flagged as S2
// (JQL injection). These pin the regex-guarded "safe" branches AND document the
// genuinely unescaped branches: unlike SQL (drizzle parameterizes), JQL is sent to
// Jira's API as a raw string, so a quote in user text / config breaks out. S2 is a
// REAL finding here (contrast with S1, which was a false positive).

const cfg = (over: Partial<JiraConnectionConfig> = {}): JiraConnectionConfig => ({
  selectedProjects: [],
  excludedStatuses: [],
  queryMode: 'visual',
  projectMappings: {},
  defaultProjectId: null,
  ...over,
});

describe('buildTextJqlParts — safe (regex-guarded) branches', () => {
  it('treats a full issue key as an exact key lookup, uppercased', () => {
    expect(buildTextJqlParts('yos-2826')).toEqual(['key = "YOS-2826"']);
  });

  it('treats a trailing-dash prefix as a project filter, but a dash+digits as a full key', () => {
    // Only "YOS-" (no digits) reaches the project-prefix branch; "YOS-28" already
    // matches the full-key regex (\d+ matches "28"), so it becomes an exact key lookup.
    expect(buildTextJqlParts('YOS-')).toEqual(['project = "YOS"']);
    expect(buildTextJqlParts('YOS-28')).toEqual(['key = "YOS-28"']);
  });

  it('expands a bare number across configured projects', () => {
    expect(buildTextJqlParts('2826', ['YOS', 'DEV'])).toEqual(['key IN ("YOS-2826", "DEV-2826")']);
  });

  it('falls back to full-text search for a bare number when no projects are configured', () => {
    expect(buildTextJqlParts('2826', [])).toEqual(['text ~ "2826"']);
  });

  it('falls back to full-text search for free text', () => {
    expect(buildTextJqlParts('login bug')).toEqual(['text ~ "login bug"']);
  });
});

describe('buildTextJqlParts — injection surface (S2, unescaped)', () => {
  it('does NOT escape quotes in the free-text fallback — a payload breaks out of the string', () => {
    // Current behavior: the double-quote is interpolated verbatim, producing JQL that
    // closes the `text ~ "..."` string early. A fix would escape/strip the quote.
    expect(buildTextJqlParts('foo" OR project = "ADMIN')).toEqual([
      'text ~ "foo" OR project = "ADMIN"',
    ]);
  });

  it('the key/project regex branches cannot be injected (no quotes can match them)', () => {
    // A payload with a quote never matches the key/prefix regexes, so it can only ever
    // reach the (still-unescaped) text fallback — never the key/project branches.
    expect(buildTextJqlParts('YOS-1" OR "1"="1')).toEqual(['text ~ "YOS-1" OR "1"="1"']);
  });
});

describe('buildSearchJql', () => {
  it('returns just the ORDER BY clause for an empty config in recent mode', () => {
    expect(buildSearchJql(cfg(), 'recent')).toBe('ORDER BY updated DESC');
  });

  it('adds project IN and status NOT IN filters from config', () => {
    const jql = buildSearchJql(cfg({ selectedProjects: ['YOS', 'DEV'], excludedStatuses: ['Done'] }), 'recent');
    expect(jql).toBe('project IN ("YOS", "DEV") AND status NOT IN ("Done") ORDER BY updated DESC');
  });

  it('adds the assignee clause in assigned mode', () => {
    expect(buildSearchJql(cfg(), 'assigned')).toBe('assignee = currentUser() ORDER BY updated DESC');
  });

  it('appends text clauses in text mode', () => {
    expect(buildSearchJql(cfg(), 'text', 'login bug')).toBe('text ~ "login bug" ORDER BY updated DESC');
  });

  it('combines config filters with the mode clause', () => {
    const jql = buildSearchJql(cfg({ selectedProjects: ['YOS'], excludedStatuses: ['Done'] }), 'assigned');
    expect(jql).toBe(
      'project IN ("YOS") AND status NOT IN ("Done") AND assignee = currentUser() ORDER BY updated DESC',
    );
  });

  it('does not escape quotes in config-provided project/status values either (S2)', () => {
    const jql = buildSearchJql(cfg({ selectedProjects: ['A" OR "1"="1'] }), 'recent');
    expect(jql).toBe('project IN ("A" OR "1"="1") ORDER BY updated DESC');
  });
});
