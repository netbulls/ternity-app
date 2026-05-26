import { describe, expect, it } from 'vitest';
import type { JiraConnectionConfig } from '@ternity/shared';
import { buildSearchJql, buildTextJqlParts, escapeJqlString } from './jira.js';

// Tests for the JQL builders — the logic the audit flagged as S2 (JQL injection).
// Unlike SQL (drizzle parameterizes), JQL is sent to Jira's API as a raw string, so a
// quote in user text / config would break out. The builders now escape quotes and
// backslashes via escapeJqlString; the tests below pin both the safe regex-guarded
// branches and the escaped injection surface. S2 is a REAL finding (contrast with S1,
// which was a false positive).

/** The security property of the escaper: after removing every valid escape sequence
 *  (`\\` or `\"`), no bare double-quote may remain — i.e. the value cannot break out
 *  of its surrounding `"..."` literal. Handles `\\"` correctly (escaped backslash then
 *  delimiter), which a naive one-char lookbehind would miscount. */
function hasNoBareQuote(escaped: string): boolean {
  return !escaped.replace(/\\[\\"]/g, '').includes('"');
}

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

describe('buildTextJqlParts — injection surface (S2, escaped)', () => {
  it('escapes quotes in the free-text fallback so a payload cannot break out', () => {
    // The quote is escaped (\"), so the whole payload stays inside the text literal.
    expect(buildTextJqlParts('foo" OR project = "ADMIN')).toEqual([
      'text ~ "foo\\" OR project = \\"ADMIN"',
    ]);
  });

  it('escapes a quoted payload that reaches the text fallback', () => {
    expect(buildTextJqlParts('YOS-1" OR "1"="1')).toEqual(['text ~ "YOS-1\\" OR \\"1\\"=\\"1"']);
  });

  it('escapes backslashes too (so \\" cannot be smuggled in)', () => {
    expect(buildTextJqlParts('a\\"b')).toEqual(['text ~ "a\\\\\\"b"']);
  });

  it('invariant: no input breaks out of the text literal', () => {
    const payloads = ['plain', 'foo" OR x', '"', '\\', '\\"', 'a"b"c', '" OR "1"="1', 'end\\'];
    for (const p of payloads) {
      const [clause] = buildTextJqlParts(p);
      // Strip the `text ~ "` prefix and trailing `"` delimiter, then the inner payload
      // must contain no bare quote.
      const inner = clause!.replace(/^text ~ "/, '').replace(/"$/, '');
      expect(hasNoBareQuote(inner)).toBe(true);
    }
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

  it('escapes quotes in config-provided project/status values (S2)', () => {
    const jql = buildSearchJql(cfg({ selectedProjects: ['A" OR "1"="1'] }), 'recent');
    expect(jql).toBe('project IN ("A\\" OR \\"1\\"=\\"1") ORDER BY updated DESC');
  });

  it('invariant: a malicious config value cannot break out of its quoted literal', () => {
    const jql = buildSearchJql(
      cfg({ selectedProjects: ['ok', 'evil" OR "1"="1'], excludedStatuses: ['Done\\'] }),
      'text',
      'free" text',
    );
    // Removing the escape sequences and the in-list delimiters (`", "`) leaves a string
    // whose only bare quotes are the outermost literal delimiters — the payloads stayed in.
    expect(jql).not.toContain('OR "1"="1)'); // the payload did not escape its literal
    expect(jql).toContain('"evil\\" OR \\"1\\"=\\"1"');
    expect(jql).toContain('"Done\\\\"');
  });
});

describe('escapeJqlString', () => {
  it('escapes backslashes before quotes (order matters)', () => {
    expect(escapeJqlString('a"b')).toBe('a\\"b');
    expect(escapeJqlString('a\\b')).toBe('a\\\\b');
    expect(escapeJqlString('\\"')).toBe('\\\\\\"');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeJqlString('YOS-2826')).toBe('YOS-2826');
  });
});
