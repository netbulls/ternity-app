import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Hash,
  Loader2,
  Play,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scaled } from '@/lib/scaled';
import { usePalette } from '@/providers/palette-provider';
import { useAuth } from '@/providers/auth-provider';
import {
  useJiraAssigned,
  useJiraRecent,
  useJiraSearch,
  useJiraConnections,
  resolveJiraProject,
} from '@/hooks/use-jira';
import { useRecentEntries, useEntrySearch } from '@/hooks/use-entries';
import {
  useTimer,
  useStartOrResumeTimer,
  useResumeTimer,
  useStopTimer,
  useElapsedSeconds,
} from '@/hooks/use-timer';
import { getPreference, setPreference } from '@/providers/preferences-provider';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getAllNavItems, type NavItem } from '@/lib/nav-items';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IssueRow } from '@/components/jira/issue-row';
import { JiraIcon } from '@/components/jira/jira-icon';
import type { JiraIssue, Entry, EntrySearchHit } from '@ternity/shared';

// ── Unified palette item ────────────────────────────────────────────

type PaletteItem =
  | { type: 'entry'; entry: EntrySearchHit }
  | { type: 'jira'; issue: JiraIssue; connectionId: string; siteUrl: string }
  | { type: 'nav'; nav: NavItem };

// ── Section definition ──────────────────────────────────────────────

interface PaletteSection {
  label: string;
  items: PaletteItem[];
}

// ── Main component ──────────────────────────────────────────────────

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const isAdmin = user?.globalRole === 'admin';

  const { data: timerState } = useTimer();
  const startOrResume = useStartOrResumeTimer();
  const resumeTimer = useResumeTimer();
  const stopTimer = useStopTimer();
  const { data: jiraConnections } = useJiraConnections();
  const hasJira = (jiraConnections?.length ?? 0) > 0;

  // Navigation items — derived from shared nav definition
  const allNavItems = useMemo(() => getAllNavItems(isAdmin), [isAdmin]);

  // Pending action for confirmation dialogs
  const [pendingAction, setPendingAction] = useState<{
    type: 'start' | 'prepare';
    issue: JiraIssue;
    connectionId: string;
    siteUrl: string;
  } | null>(null);
  const [pendingEntryAction, setPendingEntryAction] = useState<{
    type: 'resume';
    entry: EntrySearchHit;
  } | null>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);

  // Detect # prefix for Jira-only search mode
  const isJiraMode = query.startsWith('#');
  const jiraQuery = isJiraMode ? query.substring(1) : query;
  const showSearch = isJiraMode || query.length >= 2;

  // Data sources
  const recentEntriesQuery = useRecentEntries();
  const entrySearchQuery = useEntrySearch(showSearch && !isJiraMode ? query : '');
  const assignedQuery = useJiraAssigned();
  const recentQuery = useJiraRecent();
  const jiraSearchQuery = useJiraSearch(
    jiraQuery || query,
    isJiraMode || query.length >= 2 ? 'text' : 'assigned',
  );

  // Filter nav items by query (matches label, parent, and keywords)
  const matchNavItems = useCallback(
    (q: string): PaletteItem[] => {
      if (!q) return [];
      const lower = q.toLowerCase();
      return allNavItems
        .filter((item) => {
          const haystack = [item.label, item.parent, ...(item.keywords ?? [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(lower);
        })
        .filter((item) => {
          // Don't show the page we're already on
          const current = location.pathname;
          if (item.to === '/' && current === '/') return false;
          if (item.to !== '/' && current.startsWith(item.to)) return false;
          return true;
        })
        .map((nav) => ({ type: 'nav' as const, nav }));
    },
    [allNavItems, location.pathname],
  );

  // Helpers to map data into PaletteItems
  const toEntryItems = (entries: EntrySearchHit[]): PaletteItem[] =>
    entries.map((e) => ({ type: 'entry', entry: e }));

  const toJiraItems = (groups: typeof assignedQuery.data): PaletteItem[] =>
    (groups ?? []).flatMap((g) =>
      g.issues.map((issue) => ({
        type: 'jira' as const,
        issue,
        connectionId: g.connectionId,
        siteUrl: g.siteUrl,
      })),
    );

  // Build sections and flat item list
  const { sections, flatItems } = useMemo(() => {
    const secs: PaletteSection[] = [];

    if (showSearch && isJiraMode) {
      // # mode: only Jira results (uncapped — user explicitly asked for Jira)
      const jiraItems = toJiraItems(jiraSearchQuery.data);
      if (jiraItems.length > 0) secs.push({ label: 'Jira results', items: jiraItems });
    } else if (showSearch) {
      // Text search: nav first, then entries (capped), then Jira (capped)
      const navItems = matchNavItems(query);
      const entryItems = toEntryItems(entrySearchQuery.data ?? []).slice(0, 5);
      const jiraItems = toJiraItems(jiraSearchQuery.data).slice(0, 5);
      if (navItems.length > 0) secs.push({ label: 'Go to', items: navItems });
      if (entryItems.length > 0) secs.push({ label: 'Entries', items: entryItems });
      if (jiraItems.length > 0) secs.push({ label: 'Jira', items: jiraItems });
    } else {
      // Default browse: recent entries (capped) + Jira assigned + Jira recent
      const entryItems = toEntryItems(recentEntriesQuery.data ?? []).slice(0, 5);
      const assignedItems = toJiraItems(assignedQuery.data).slice(0, 5);
      const recentJiraItems = toJiraItems(recentQuery.data).slice(0, 5);
      if (entryItems.length > 0) secs.push({ label: 'Recent entries', items: entryItems });
      if (assignedItems.length > 0)
        secs.push({ label: 'Jira — Assigned to me', items: assignedItems });
      if (recentJiraItems.length > 0)
        secs.push({ label: 'Jira — Recently viewed', items: recentJiraItems });
    }

    // Filter out Jira sections if no connections
    const filtered = hasJira ? secs : secs.filter((s) => !s.label.startsWith('Jira'));
    const flat = filtered.flatMap((s) => s.items);
    return { sections: filtered, flatItems: flat };
  }, [
    showSearch,
    isJiraMode,
    hasJira,
    query,
    matchNavItems,
    entrySearchQuery.data,
    jiraSearchQuery.data,
    recentEntriesQuery.data,
    assignedQuery.data,
    recentQuery.data,
  ]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp selectedIdx when results change
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // ── Action handlers ──────────────────────────────────────────────

  // Jira: start-or-resume
  const doJiraStart = useCallback(
    (issue: JiraIssue, connectionId: string) => {
      const userDefault = getPreference('defaultProjectId');
      const projectId = resolveJiraProject(jiraConnections, connectionId, issue.key, userDefault);
      startOrResume.mutate({
        description: issue.summary,
        projectId,
        labelIds: [],
        jiraIssueKey: issue.key,
        jiraIssueSummary: issue.summary,
        jiraConnectionId: connectionId,
      });
    },
    [startOrResume, jiraConnections],
  );

  // Jira: prepare
  const doJiraPrepare = useCallback(
    (issue: JiraIssue, connectionId: string, siteUrl: string) => {
      const userDefault = getPreference('defaultProjectId');
      const projectId = resolveJiraProject(jiraConnections, connectionId, issue.key, userDefault);
      window.dispatchEvent(
        new CustomEvent('ternity-palette-prepare', {
          detail: { summary: issue.summary, key: issue.key, connectionId, siteUrl, projectId },
        }),
      );
    },
    [jiraConnections],
  );

  // Entry: resume
  const doEntryResume = useCallback(
    (entry: EntrySearchHit) => {
      resumeTimer.mutate(entry.id);
    },
    [resumeTimer],
  );

  // Entry: prepare (fill timer bar without starting)
  const doEntryPrepare = useCallback(
    (entry: EntrySearchHit) => {
      // Look up Jira connection for siteUrl if the entry has a linked issue
      const connection = entry.jiraConnectionId
        ? jiraConnections?.find((c) => c.id === entry.jiraConnectionId)
        : undefined;

      window.dispatchEvent(
        new CustomEvent('ternity-palette-prepare', {
          detail: {
            summary: entry.description,
            projectId: entry.projectId ?? getPreference('defaultProjectId'),
            ...(entry.jiraIssueKey && connection
              ? {
                  key: entry.jiraIssueKey,
                  connectionId: connection.id,
                  siteUrl: connection.siteUrl,
                }
              : {}),
          },
        }),
      );
    },
    [jiraConnections],
  );

  // Enter handler: dispatch based on item type
  const handleEnter = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      if (item.type === 'nav') {
        navigate(item.nav.to);
        return;
      }
      if (item.type === 'entry') {
        if (timerState?.running && getPreference('confirmTimerSwitch')) {
          setPendingEntryAction({ type: 'resume', entry: item.entry });
          setSwitchDialogOpen(true);
          return;
        }
        doEntryResume(item.entry);
      } else {
        if (timerState?.running && getPreference('confirmTimerSwitch')) {
          setPendingAction({
            type: 'start',
            issue: item.issue,
            connectionId: item.connectionId,
            siteUrl: item.siteUrl,
          });
          setSwitchDialogOpen(true);
          return;
        }
        doJiraStart(item.issue, item.connectionId);
      }
    },
    [timerState?.running, doEntryResume, doJiraStart, setOpen, navigate],
  );

  // Cmd+Enter handler
  const handleCmdEnter = useCallback(
    (item: PaletteItem) => {
      // Nav items use Enter only — Cmd+Enter is meaningless for navigation
      if (item.type === 'nav') {
        setOpen(false);
        navigate(item.nav.to);
        return;
      }
      setOpen(false);
      if (item.type === 'entry') {
        if (timerState?.running) {
          setPendingEntryAction({ type: 'resume', entry: item.entry });
          setStopDialogOpen(true);
          return;
        }
        doEntryPrepare(item.entry);
      } else {
        if (timerState?.running) {
          setPendingAction({
            type: 'prepare',
            issue: item.issue,
            connectionId: item.connectionId,
            siteUrl: item.siteUrl,
          });
          setStopDialogOpen(true);
          return;
        }
        doJiraPrepare(item.issue, item.connectionId, item.siteUrl);
      }
    },
    [timerState?.running, doEntryPrepare, doJiraPrepare, setOpen, navigate],
  );

  // Switch dialog confirm
  const handleSwitchConfirm = useCallback(
    (dontAskAgain: boolean) => {
      if (dontAskAgain) setPreference('confirmTimerSwitch', false);
      setSwitchDialogOpen(false);
      if (pendingEntryAction?.type === 'resume') {
        doEntryResume(pendingEntryAction.entry);
      } else if (pendingAction?.type === 'start') {
        doJiraStart(pendingAction.issue, pendingAction.connectionId);
      }
      setPendingAction(null);
      setPendingEntryAction(null);
    },
    [pendingAction, pendingEntryAction, doEntryResume, doJiraStart],
  );

  // Stop dialog confirm
  const handleStopConfirm = useCallback(() => {
    setStopDialogOpen(false);
    if (pendingEntryAction) {
      stopTimer.mutate(undefined, {
        onSuccess: () => doEntryPrepare(pendingEntryAction.entry),
      });
    } else if (pendingAction?.type === 'prepare') {
      stopTimer.mutate(undefined, {
        onSuccess: () =>
          doJiraPrepare(pendingAction.issue, pendingAction.connectionId, pendingAction.siteUrl),
      });
    }
    setPendingAction(null);
    setPendingEntryAction(null);
  }, [pendingAction, pendingEntryAction, stopTimer, doEntryPrepare, doJiraPrepare]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
    const selected = flatItems[selectedIdx];
    if (e.key === 'Enter' && selected) {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        handleCmdEnter(selected);
      } else {
        handleEnter(selected);
      }
    }
  };

  const isLoading = showSearch
    ? isJiraMode
      ? jiraSearchQuery.isLoading
      : entrySearchQuery.isLoading || jiraSearchQuery.isLoading
    : recentEntriesQuery.isLoading || assignedQuery.isLoading || recentQuery.isLoading;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

            {/* Palette */}
            <motion.div
              className="relative w-[600px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Command className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: scaled(14) }}
                  placeholder={
                    hasJira ? 'Search entries & Jira... (# for Jira only)' : 'Search entries...'
                  }
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIdx(0);
                  }}
                  onKeyDown={handleKeyDown}
                />
                <kbd
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground"
                  style={{ fontSize: scaled(9) }}
                >
                  esc
                </kbd>
              </div>

              {/* Jira mode indicator */}
              {isJiraMode && (
                <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-1.5">
                  <Hash className="h-3 w-3 text-primary" />
                  <span className="text-primary" style={{ fontSize: scaled(10) }}>
                    Jira search mode — searching issues across all connections
                  </span>
                </div>
              )}

              {/* Results */}
              <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2">
                {isLoading ? (
                  <div
                    className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
                    style={{ fontSize: scaled(12) }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {showSearch ? 'Searching...' : 'Loading...'}
                  </div>
                ) : flatItems.length === 0 ? (
                  <div
                    className="py-12 text-center text-muted-foreground"
                    style={{ fontSize: scaled(12) }}
                  >
                    {showSearch && query.length >= 2 ? (
                      <>No results for &ldquo;{query}&rdquo;</>
                    ) : (
                      'No entries yet. Start tracking to see results here.'
                    )}
                  </div>
                ) : (
                  <PaletteSections
                    sections={sections}
                    selectedIdx={selectedIdx}
                    onSelect={handleEnter}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2.5">
                <div
                  className="flex items-center gap-4 text-muted-foreground"
                  style={{ fontSize: scaled(9) }}
                >
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    <ArrowDown className="h-3 w-3" /> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="h-3 w-3" /> Resume / Start
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd
                      className="rounded border border-border px-1 py-0.5 font-mono"
                      style={{ fontSize: scaled(8) }}
                    >
                      ⌘↵
                    </kbd>{' '}
                    Prepare entry
                  </span>
                  {hasJira && (
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Jira only
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch timer dialog (Enter while timer is running) */}
      {timerState?.entry &&
        switchDialogOpen &&
        (pendingAction?.type === 'start' || pendingEntryAction) && (
          <PaletteSwitchDialog
            open={switchDialogOpen}
            onOpenChange={(v) => {
              setSwitchDialogOpen(v);
              if (!v) {
                setPendingAction(null);
                setPendingEntryAction(null);
              }
            }}
            stoppingEntry={timerState.entry}
            startingLabel={
              pendingEntryAction
                ? pendingEntryAction.entry.description || 'No description'
                : (pendingAction?.issue.summary ?? '')
            }
            startingDetail={
              pendingEntryAction
                ? (pendingEntryAction.entry.projectName ?? undefined)
                : pendingAction?.issue.key
            }
            onConfirm={handleSwitchConfirm}
          />
        )}

      {/* Stop timer dialog (⌘Enter while timer is running) */}
      {timerState?.entry &&
        stopDialogOpen &&
        (pendingAction?.type === 'prepare' || pendingEntryAction) && (
          <PaletteStopDialog
            open={stopDialogOpen}
            onOpenChange={(v) => {
              setStopDialogOpen(v);
              if (!v) {
                setPendingAction(null);
                setPendingEntryAction(null);
              }
            }}
            stoppingEntry={timerState.entry}
            preparingLabel={
              pendingEntryAction
                ? pendingEntryAction.entry.description || 'No description'
                : (pendingAction?.issue.summary ?? '')
            }
            preparingDetail={
              pendingEntryAction
                ? (pendingEntryAction.entry.projectName ?? undefined)
                : pendingAction?.issue.key
            }
            onConfirm={handleStopConfirm}
          />
        )}
    </>
  );
}

// ── Sections renderer ───────────────────────────────────────────────

function PaletteSections({
  sections,
  selectedIdx,
  onSelect,
}: {
  sections: PaletteSection[];
  selectedIdx: number;
  onSelect: (item: PaletteItem) => void;
}) {
  let globalIdx = 0;

  return (
    <>
      {sections.map((section) => (
        <div key={section.label} className="mb-2">
          <div
            className="px-3 py-1.5 font-brand uppercase tracking-wider text-muted-foreground/60"
            style={{ fontSize: scaled(9) }}
          >
            {section.label}
          </div>
          {section.items.map((item) => {
            const idx = globalIdx++;
            const isSelected = idx === selectedIdx;
            return (
              <div key={itemKey(item)} data-selected={isSelected}>
                {item.type === 'nav' ? (
                  <NavResultRow
                    nav={item.nav}
                    selected={isSelected}
                    onSelect={() => onSelect(item)}
                  />
                ) : item.type === 'entry' ? (
                  <EntryResultRow
                    entry={item.entry}
                    selected={isSelected}
                    onSelect={() => onSelect(item)}
                  />
                ) : (
                  <IssueRow
                    issue={item.issue}
                    selected={isSelected}
                    onSelect={() => onSelect(item)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function itemKey(item: PaletteItem): string {
  if (item.type === 'entry') return `entry-${item.entry.id}`;
  if (item.type === 'jira') return `jira-${item.issue.key}`;
  return `nav-${item.nav.to}`;
}

// ── Nav result row ──────────────────────────────────────────────────

function NavResultRow({
  nav,
  selected,
  onSelect,
}: {
  nav: NavItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = nav.icon;
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        selected ? 'bg-primary/10 text-foreground' : 'text-foreground/80 hover:bg-muted/50',
      )}
      onClick={onSelect}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <span style={{ fontSize: scaled(13) }}>
          {nav.parent && (
            <span className="text-muted-foreground">
              {nav.parent} <ArrowRight className="mb-0.5 inline h-3 w-3" />{' '}
            </span>
          )}
          {nav.label}
        </span>
      </div>
      <span
        className="shrink-0 font-brand text-muted-foreground/50"
        style={{ fontSize: scaled(10) }}
      >
        {nav.to}
      </span>
    </button>
  );
}

// ── Entry result row ────────────────────────────────────────────────

function EntryResultRow({
  entry,
  selected,
  onSelect,
}: {
  entry: EntrySearchHit;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        selected ? 'bg-primary/10 text-foreground' : 'text-foreground/80 hover:bg-muted/50',
      )}
      onClick={onSelect}
    >
      {/* Play icon or running indicator */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {entry.isRunning ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        ) : (
          <Play className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>

      {/* Description + project */}
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

      {/* Jira key badge */}
      {entry.jiraIssueKey && (
        <span
          className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-brand font-semibold text-primary"
          style={{ fontSize: scaled(9) }}
        >
          <JiraIcon className="h-2.5 w-2.5" />
          {entry.jiraIssueKey}
        </span>
      )}

      {/* Duration */}
      <span
        className="shrink-0 font-brand tabular-nums text-muted-foreground"
        style={{ fontSize: scaled(11) }}
      >
        {formatDuration(entry.totalDurationSeconds)}
      </span>
    </button>
  );
}

// ── Confirmation dialogs ────────────────────────────────────────────

function PaletteSwitchDialog({
  open,
  onOpenChange,
  stoppingEntry,
  startingLabel,
  startingDetail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stoppingEntry: Entry;
  startingLabel: string;
  startingDetail?: string;
  onConfirm: (dontAskAgain: boolean) => void;
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const completedDuration = stoppingEntry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const runningSegment = stoppingEntry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const elapsed = useElapsedSeconds(runningSegment?.startedAt ?? null, open, completedDuration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch timer</DialogTitle>
          <DialogDescription>Another timer is running. Switch to the new entry?</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 overflow-hidden py-1">
          {/* Stopping card */}
          <div className="w-full rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
            <span
              className="font-medium uppercase tracking-wider text-destructive/70"
              style={{ fontSize: scaled(9) }}
            >
              Stopping
            </span>
            <p
              className={cn(
                'mt-1 truncate text-foreground',
                !stoppingEntry.description && 'italic text-muted-foreground',
              )}
              style={{ fontSize: scaled(13) }}
            >
              {stoppingEntry.description || 'No description'}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {stoppingEntry.projectColor && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stoppingEntry.projectColor }}
                  />
                )}
                <span className="truncate text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {stoppingEntry.clientName
                    ? `${stoppingEntry.clientName} · ${stoppingEntry.projectName}`
                    : stoppingEntry.projectName || 'No project'}
                </span>
              </div>
              <span
                className="shrink-0 font-brand font-semibold tabular-nums text-destructive"
                style={{ fontSize: scaled(13) }}
              >
                {formatDuration(elapsed)}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50">
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Starting card */}
          <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
            <span
              className="font-medium uppercase tracking-wider text-primary/70"
              style={{ fontSize: scaled(9) }}
            >
              Starting
            </span>
            <p className="mt-1 truncate text-foreground" style={{ fontSize: scaled(13) }}>
              {startingLabel}
            </p>
            {startingDetail && (
              <span className="mt-1 font-brand text-primary" style={{ fontSize: scaled(11) }}>
                {startingDetail}
              </span>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <span className="text-[12px] text-muted-foreground">Don&apos;t ask again</span>
        </label>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setDontAskAgain(false);
            }}
          >
            Cancel
          </Button>
          <Button
            autoFocus
            onClick={() => {
              onConfirm(dontAskAgain);
              setDontAskAgain(false);
            }}
          >
            Switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaletteStopDialog({
  open,
  onOpenChange,
  stoppingEntry,
  preparingLabel,
  preparingDetail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stoppingEntry: Entry;
  preparingLabel: string;
  preparingDetail?: string;
  onConfirm: () => void;
}) {
  const completedDuration = stoppingEntry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const runningSegment = stoppingEntry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const elapsed = useElapsedSeconds(runningSegment?.startedAt ?? null, open, completedDuration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop current timer?</DialogTitle>
          <DialogDescription>
            This will stop the running timer so you can prepare a new entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 overflow-hidden py-1">
          {/* Stopping card */}
          <div className="w-full rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
            <span
              className="font-medium uppercase tracking-wider text-destructive/70"
              style={{ fontSize: scaled(9) }}
            >
              Stopping
            </span>
            <p
              className={cn(
                'mt-1 truncate text-foreground',
                !stoppingEntry.description && 'italic text-muted-foreground',
              )}
              style={{ fontSize: scaled(13) }}
            >
              {stoppingEntry.description || 'No description'}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {stoppingEntry.projectColor && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stoppingEntry.projectColor }}
                  />
                )}
                <span className="truncate text-muted-foreground" style={{ fontSize: scaled(11) }}>
                  {stoppingEntry.clientName
                    ? `${stoppingEntry.clientName} · ${stoppingEntry.projectName}`
                    : stoppingEntry.projectName || 'No project'}
                </span>
              </div>
              <span
                className="shrink-0 font-brand font-semibold tabular-nums text-destructive"
                style={{ fontSize: scaled(13) }}
              >
                {formatDuration(elapsed)}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50">
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Preparing card */}
          <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
            <span
              className="font-medium uppercase tracking-wider text-primary/70"
              style={{ fontSize: scaled(9) }}
            >
              Preparing
            </span>
            <p className="mt-1 truncate text-foreground" style={{ fontSize: scaled(13) }}>
              {preparingLabel}
            </p>
            {preparingDetail && (
              <span className="mt-1 font-brand text-primary" style={{ fontSize: scaled(11) }}>
                {preparingDetail}
              </span>
            )}
            <p className="mt-1 text-muted-foreground italic" style={{ fontSize: scaled(10) }}>
              Timer won&apos;t start automatically
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button autoFocus onClick={onConfirm}>
            Stop &amp; prepare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
