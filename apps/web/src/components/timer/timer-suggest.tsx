import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Play, Loader2, CornerDownLeft, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration } from '@/lib/format';
import { useEntrySearch } from '@/hooks/use-entries';
import { useJiraSearch, useJiraConnections } from '@/hooks/use-jira';
import { JiraIcon } from '@/components/jira/jira-icon';
import type { EntrySearchHit, JiraIssue } from '@ternity/shared';

/* ── Flat item types for unified keyboard navigation ─────────────── */

interface EntryItem {
  type: 'entry';
  entry: EntrySearchHit;
}

interface JiraItem {
  type: 'jira';
  issue: JiraIssue;
  connectionId: string;
  siteUrl: string;
}

type SuggestItem = EntryItem | JiraItem;

/* ── Props ───────────────────────────────────────────────────────── */

interface TimerSuggestProps {
  /** Raw description input value */
  query: string;
  /** Called when user selects an entry suggestion */
  onSelectEntry: (entry: EntrySearchHit) => void;
  /** Called when user selects a Jira issue */
  onSelectJira: (issue: JiraIssue, connectionId: string, siteUrl: string) => void;
  onClose: () => void;
  /** Ref to the input element — used to attach keyboard listeners */
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/* ── Status colors for Jira rows (same as issue-row.tsx) ─────────── */

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: 'hsl(217 91% 60% / 0.15)', text: 'hsl(217 91% 60%)' },
  'To Do': { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
  'In Review': { bg: 'hsl(38 92% 50% / 0.15)', text: 'hsl(38 92% 50%)' },
  Done: { bg: 'hsl(142 71% 45% / 0.15)', text: 'hsl(142 71% 45%)' },
};

const TYPE_COLORS: Record<string, string> = {
  Story: 'hsl(142 71% 45%)',
  Bug: 'hsl(0 72% 51%)',
  Task: 'hsl(217 91% 60%)',
  Epic: 'hsl(271 81% 56%)',
  'Sub-task': 'hsl(38 92% 50%)',
};

/**
 * Unified autosuggest dropdown for the timer bar.
 * - Normal text (2+ chars): shows entries + Jira issues in sections
 * - `#` prefix: shows only Jira issues
 */
export function TimerSuggest({
  query,
  onSelectEntry,
  onSelectJira,
  onClose,
  inputRef,
}: TimerSuggestProps) {
  const { data: jiraConnections } = useJiraConnections();
  const hasJira = (jiraConnections?.length ?? 0) > 0;

  // Detect # mode
  const isJiraOnly = query.startsWith('#');
  const jiraQuery = isJiraOnly ? query.substring(1) : query;
  const entryQuery = isJiraOnly ? '' : query;

  // Fetch entries (skip in # mode)
  const { data: entryResults, isLoading: entriesLoading } = useEntrySearch(entryQuery);
  // Fetch Jira (skip when no connections)
  const { data: jiraResults, isLoading: jiraLoading } = useJiraSearch(jiraQuery, 'text');

  const entries = useMemo(
    () => (isJiraOnly ? [] : (entryResults ?? [])),
    [isJiraOnly, entryResults],
  );
  const jiraIssues = useMemo(() => {
    if (!hasJira || !jiraResults) return [];
    return jiraResults.flatMap((r) =>
      r.issues.map((issue) => ({ issue, connectionId: r.connectionId, siteUrl: r.siteUrl })),
    );
  }, [hasJira, jiraResults]);

  // Build flat items list for keyboard nav
  const items = useMemo<SuggestItem[]>(() => {
    const list: SuggestItem[] = [];
    for (const entry of entries) {
      list.push({ type: 'entry', entry });
    }
    for (const j of jiraIssues) {
      list.push({ type: 'jira', issue: j.issue, connectionId: j.connectionId, siteUrl: j.siteUrl });
    }
    return list;
  }, [entries, jiraIssues]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  // Measure available space below the dropdown and cap max-height
  // Target: ~10 visible rows (40px each = 400px), but shrink if viewport is tight
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // Leave 16px padding from viewport bottom
      const available = window.innerHeight - rect.top - 16;
      // Ideal: 10 rows * ~40px = 400px. But at least 160px (4 rows).
      setMaxHeight(Math.max(160, Math.min(400, available)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [items.length]); // re-measure when items change (dropdown may reposition)

  // Reset selection when items change
  useEffect(() => {
    setSelectedIdx(0);
  }, [items.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-suggest-idx="${selectedIdx}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleItemSelect = useCallback(
    (item: SuggestItem) => {
      if (item.type === 'entry') {
        onSelectEntry(item.entry);
      } else {
        onSelectJira(item.issue, item.connectionId, item.siteUrl);
      }
    },
    [onSelectEntry, onSelectJira],
  );

  // Keyboard navigation — attached to the input
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && items.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleItemSelect(items[selectedIdx]!);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    input.addEventListener('keydown', handleKeyDown);
    return () => input.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIdx, handleItemSelect, onClose, inputRef]);

  // Determine effective search query length for the "show" threshold
  const effectiveQuery = isJiraOnly ? jiraQuery : query;
  if (effectiveQuery.length < 2) return null;

  const isLoading = (!isJiraOnly && entriesLoading) || (hasJira && jiraLoading);
  const hasResults = items.length > 0;

  // Loading — no results yet
  if (isLoading && !hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div
          className="flex items-center justify-center gap-2 py-4 text-muted-foreground"
          style={{ fontSize: scaled(11) }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching...
        </div>
      </motion.div>
    );
  }

  // No results at all
  if (!isLoading && !hasResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      >
        <div
          className="flex items-center justify-center gap-2 px-3 py-4 text-muted-foreground"
          style={{ fontSize: scaled(11) }}
        >
          <Search className="h-3.5 w-3.5" />
          No results for &ldquo;{effectiveQuery}&rdquo;
        </div>
      </motion.div>
    );
  }

  // Track flat index for keyboard highlight across sections
  let flatIdx = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: (maxHeight ?? 400) - 28 }}>
        {/* ── Entries section ──────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="p-1">
            <div
              className="px-3 py-1 font-medium uppercase tracking-wider text-muted-foreground/60"
              style={{ fontSize: scaled(9) }}
            >
              Entries
            </div>
            {entries.map((entry) => {
              const idx = flatIdx++;
              return (
                <button
                  key={entry.id}
                  data-suggest-idx={idx}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                    idx === selectedIdx
                      ? 'bg-primary/10 text-foreground'
                      : 'text-foreground/80 hover:bg-muted/50',
                  )}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectEntry(entry);
                  }}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {entry.isRunning ? (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate" style={{ fontSize: scaled(13) }}>
                      {entry.description || 'No description'}
                    </div>
                    <div className="flex items-center gap-1.5" style={{ fontSize: scaled(10) }}>
                      {entry.projectColor && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.projectColor }}
                        />
                      )}
                      <span className="truncate text-muted-foreground">
                        {entry.clientName
                          ? `${entry.clientName} · ${entry.projectName}`
                          : entry.projectName || 'No project'}
                      </span>
                    </div>
                  </div>
                  {entry.jiraIssueKey && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-brand font-semibold text-primary"
                      style={{ fontSize: scaled(9) }}
                    >
                      <JiraIcon className="h-2.5 w-2.5" />
                      {entry.jiraIssueKey}
                    </span>
                  )}
                  <span
                    className="shrink-0 font-brand tabular-nums text-muted-foreground"
                    style={{ fontSize: scaled(11) }}
                  >
                    {formatDuration(entry.totalDurationSeconds)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Jira section ────────────────────────────────────── */}
        {jiraIssues.length > 0 && (
          <div className={cn('p-1', entries.length > 0 && 'border-t border-border')}>
            <div
              className="px-3 py-1 font-medium uppercase tracking-wider text-muted-foreground/60"
              style={{ fontSize: scaled(9) }}
            >
              Jira
            </div>
            {jiraIssues.map((j) => {
              const idx = flatIdx++;
              const sc = STATUS_COLORS[j.issue.status] ?? STATUS_COLORS['To Do']!;
              return (
                <button
                  key={`${j.connectionId}-${j.issue.key}`}
                  data-suggest-idx={idx}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                    idx === selectedIdx
                      ? 'bg-primary/10 text-foreground'
                      : 'text-foreground/80 hover:bg-muted/50',
                  )}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectJira(j.issue, j.connectionId, j.siteUrl);
                  }}
                >
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: TYPE_COLORS[j.issue.type] ?? 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <span
                    className="shrink-0 font-brand font-semibold text-primary"
                    style={{ fontSize: scaled(11) }}
                  >
                    {j.issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: scaled(12) }}>
                    {j.issue.summary}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5"
                    style={{ fontSize: scaled(9), background: sc.bg, color: sc.text }}
                  >
                    {j.issue.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="border-t border-border px-3 py-1.5 text-muted-foreground"
        style={{ fontSize: scaled(9) }}
      >
        <span className="flex items-center gap-1">
          <CornerDownLeft className="inline h-3 w-3" /> to select
          {hasJira && !isJiraOnly && (
            <span className="ml-2 text-muted-foreground/50"># to search Jira only</span>
          )}
        </span>
      </div>
    </motion.div>
  );
}
