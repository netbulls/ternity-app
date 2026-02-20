import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

interface ReleaseNote {
  category: string;
  entries: string[];
}

/** Cached parse result with mtime for invalidation */
let cache: { mtime: number; data: Map<string, ReleaseNote[]> } | null = null;

const CHANGELOG_PATH = resolve(import.meta.dirname, '../../../../CHANGELOG.md');

/**
 * Parse a CHANGELOG.md string (Keep a Changelog format) into a map of
 * version → release notes. The `[Unreleased]` section is keyed as `"unreleased"`.
 */
function parseChangelog(markdown: string): Map<string, ReleaseNote[]> {
  const result = new Map<string, ReleaseNote[]>();
  let currentVersion: string | null = null;
  let currentCategory: string | null = null;
  let currentEntries: string[] = [];
  let notes: ReleaseNote[] = [];

  const flushCategory = () => {
    if (currentCategory && currentEntries.length > 0) {
      notes.push({ category: currentCategory, entries: currentEntries });
    }
    currentCategory = null;
    currentEntries = [];
  };

  const flushVersion = () => {
    flushCategory();
    if (currentVersion !== null && notes.length > 0) {
      result.set(currentVersion, notes);
    }
    notes = [];
  };

  for (const line of markdown.split('\n')) {
    // ## [Unreleased] or ## [0.2.1] - 2026-02-15
    const versionMatch = line.match(/^## \[([^\]]+)\]/);
    if (versionMatch) {
      flushVersion();
      const raw = versionMatch[1]!;
      currentVersion = raw.toLowerCase() === 'unreleased' ? 'unreleased' : raw.replace(/^v/, '');
      continue;
    }

    // ### Added, ### Fixed, etc.
    const categoryMatch = line.match(/^### (.+)/);
    if (categoryMatch) {
      flushCategory();
      currentCategory = categoryMatch[1]!;
      continue;
    }

    // - Bullet entry
    const entryMatch = line.match(/^- (.+)/);
    if (entryMatch && currentCategory) {
      currentEntries.push(entryMatch[1]!);
    }
  }

  flushVersion();
  return result;
}

/**
 * Parse a markdown snippet (without version headers) into ReleaseNote[].
 * Expects `### Category` + `- entry` lines.
 */
export function parseNotes(markdown: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  let currentCategory: string | null = null;
  let currentEntries: string[] = [];

  const flush = () => {
    if (currentCategory && currentEntries.length > 0) {
      notes.push({ category: currentCategory, entries: currentEntries });
    }
    currentCategory = null;
    currentEntries = [];
  };

  for (const line of markdown.split('\n')) {
    const categoryMatch = line.match(/^### (.+)/);
    if (categoryMatch) {
      flush();
      currentCategory = categoryMatch[1]!;
      continue;
    }
    const entryMatch = line.match(/^- (.+)/);
    if (entryMatch && currentCategory) {
      currentEntries.push(entryMatch[1]!);
    }
  }
  flush();
  return notes;
}

/**
 * Get release notes for a version string. Reads and caches CHANGELOG.md,
 * invalidating when the file's mtime changes.
 *
 * - Tagged versions (e.g. `v0.1.0`, `0.1.0`) → match `## [0.1.0]` section
 * - Snapshot versions (e.g. `v0.1.0-7-gabc123f`) → return `[Unreleased]` section
 * - Not found → return `[]`
 */
export async function getChangelogForVersion(version: string): Promise<ReleaseNote[]> {
  try {
    const fileStat = await stat(CHANGELOG_PATH);
    const mtime = fileStat.mtimeMs;

    if (!cache || cache.mtime !== mtime) {
      const content = await readFile(CHANGELOG_PATH, 'utf-8');
      cache = { mtime, data: parseChangelog(content) };
    }

    // Snapshot version (v0.1.0-7-gabc123f) → unreleased
    const isSnapshot = /\d+-g[0-9a-f]+$/i.test(version);
    if (isSnapshot) {
      return cache.data.get('unreleased') ?? [];
    }

    // Normalize: strip leading v
    const normalized = version.replace(/^v/, '');
    return cache.data.get(normalized) ?? [];
  } catch {
    // File not found or unreadable — not fatal
    return [];
  }
}
