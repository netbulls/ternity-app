import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getChangelogForVersion, parseNotes } from './changelog-parser.js';

// Characterization tests for changelog-parser.ts.
// `parseChangelog` is intentionally NOT exported — only `parseNotes` and
// `getChangelogForVersion` are public surface. The internal `parseChangelog`
// behaviour is exercised through `getChangelogForVersion` by injecting
// controlled file content via vi.mock on node:fs/promises.

// `vi.mock` is hoisted regardless of placement; Vitest 4 errors if it appears
// inside a hook. Mock once at the top — individual tests still control behavior
// via `vi.mocked(stat).mockResolvedValue(...)` etc.
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

// ─── helpers ───────────────────────────────────────────────────────────────

const SAMPLE_CHANGELOG = `# Changelog

## [Unreleased]

### Added
- First unreleased feature
- Second unreleased feature

### Fixed
- Unreleased fix

## [1.2.3] - 2026-03-01

### Added
- Some added thing

### Changed
- Some changed thing

## [1.0.0] - 2026-01-01

### Added
- Initial release
`;

// ─── parseNotes ────────────────────────────────────────────────────────────

describe('parseNotes', () => {
  it('returns an empty array for empty input', () => {
    expect(parseNotes('')).toEqual([]);
  });

  it('returns an empty array when there are no ### headings', () => {
    expect(parseNotes('Some random text\n- bullet without heading')).toEqual([]);
  });

  it('parses a single category with entries', () => {
    const md = `### Added\n- Feature A\n- Feature B`;
    expect(parseNotes(md)).toEqual([{ category: 'Added', entries: ['Feature A', 'Feature B'] }]);
  });

  it('parses multiple categories', () => {
    const md = `### Added\n- Feature A\n\n### Fixed\n- Bug fix`;
    expect(parseNotes(md)).toEqual([
      { category: 'Added', entries: ['Feature A'] },
      { category: 'Fixed', entries: ['Bug fix'] },
    ]);
  });

  it('drops a category with no bullet entries', () => {
    // A ### heading with no following - lines should not appear in output
    const md = `### Added\n\n### Fixed\n- Something`;
    expect(parseNotes(md)).toEqual([{ category: 'Fixed', entries: ['Something'] }]);
  });

  it('ignores bullet lines that appear before the first ### heading', () => {
    const md = `- orphan bullet\n### Added\n- Real entry`;
    expect(parseNotes(md)).toEqual([{ category: 'Added', entries: ['Real entry'] }]);
  });

  it('preserves the category name exactly as written', () => {
    const md = `### Security Patches\n- CVE-2026-1234`;
    const result = parseNotes(md);
    expect(result[0]!.category).toBe('Security Patches');
  });

  it('preserves whitespace and special characters in entries', () => {
    const md = `### Added\n- Entry with <html> & special "chars"`;
    expect(parseNotes(md)).toEqual([
      { category: 'Added', entries: ['Entry with <html> & special "chars"'] },
    ]);
  });

  it('does not treat ## version lines as categories', () => {
    // ## lines are version headers — parseNotes should ignore them entirely
    const md = `## [1.0.0] - 2026-01-01\n### Added\n- Feature`;
    expect(parseNotes(md)).toEqual([{ category: 'Added', entries: ['Feature'] }]);
  });
});

// ─── getChangelogForVersion ────────────────────────────────────────────────
// We mock node:fs/promises to supply controlled CHANGELOG content without
// touching the real file on disk.

describe('getChangelogForVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Clear the module-level cache between tests by re-importing fresh.
    // The cache is a module-level variable, so we need to reset modules.
    vi.resetModules();
  });

  async function setupMocks(content: string, mtime = 12345) {
    const { stat, readFile } = await import('node:fs/promises');
    vi.mocked(stat).mockResolvedValue({ mtimeMs: mtime } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(readFile).mockResolvedValue(content as unknown as Awaited<ReturnType<typeof readFile>>);
  }

  it('returns the [Unreleased] section for snapshot versions (has commit hash suffix)', async () => {
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('v1.2.3-7-gabc123f');
    expect(result).toEqual([
      { category: 'Added', entries: ['First unreleased feature', 'Second unreleased feature'] },
      { category: 'Fixed', entries: ['Unreleased fix'] },
    ]);
  });

  it('returns release notes for a tagged version (v-prefixed)', async () => {
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('v1.2.3');
    expect(result).toEqual([
      { category: 'Added', entries: ['Some added thing'] },
      { category: 'Changed', entries: ['Some changed thing'] },
    ]);
  });

  it('strips leading v when matching version sections', async () => {
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    // Both '1.2.3' and 'v1.2.3' should resolve to the same [1.2.3] section
    const withV = await getChangelogForVersion('v1.2.3');
    const withoutV = await getChangelogForVersion('1.2.3');
    expect(withV).toEqual(withoutV);
  });

  it('returns [] for a version that has no section in the changelog', async () => {
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('9.9.9');
    expect(result).toEqual([]);
  });

  it('returns [] when the file cannot be read (e.g. not found)', async () => {
    const { stat } = await import('node:fs/promises');
    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('v1.2.3');
    expect(result).toEqual([]);
  });

  it('[Unreleased] section is keyed as "unreleased" (lowercase)', async () => {
    // Snapshot versions route to the "unreleased" key — verify it is not empty
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('v0.1.0-1-gabcdef0');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns [] for [Unreleased] section if changelog has no Unreleased entries', async () => {
    const noUnreleased = `# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Added\n- Feature\n`;
    await setupMocks(noUnreleased);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    const result = await getChangelogForVersion('v1.0.0-3-g1234abc');
    expect(result).toEqual([]);
  });

  it('handles an empty changelog string gracefully', async () => {
    await setupMocks('');
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    expect(await getChangelogForVersion('v1.0.0')).toEqual([]);
    expect(await getChangelogForVersion('v1.0.0-1-gabc1234')).toEqual([]);
  });

  it('handles a changelog with only the title line', async () => {
    await setupMocks('# Changelog\n');
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    expect(await getChangelogForVersion('v1.0.0')).toEqual([]);
  });

  // NOTE: The snapshot regex is `/\d+-g[0-9a-f]+$/i`. In the version string
  // `v1.2.3-gabc123f`, the digit `3` (the last digit of `1.2.3`) immediately
  // precedes `-g`, so the regex DOES match — it treats this as a snapshot even
  // though there is no explicit commit-count number between the version and `-g`.
  // Pinning this subtle current behavior.
  it('treats v1.2.3-gabc123f as a snapshot (the patch version digit satisfies \\d+)', async () => {
    await setupMocks(SAMPLE_CHANGELOG);
    const { getChangelogForVersion } = await import('./changelog-parser.js');

    // The `3` in `1.2.3` is the `\d+` that satisfies the regex, so this IS
    // treated as a snapshot → returns the [Unreleased] section.
    const result = await getChangelogForVersion('v1.2.3-gabc123f');
    expect(result).toEqual([
      { category: 'Added', entries: ['First unreleased feature', 'Second unreleased feature'] },
      { category: 'Fixed', entries: ['Unreleased fix'] },
    ]);
  });
});
