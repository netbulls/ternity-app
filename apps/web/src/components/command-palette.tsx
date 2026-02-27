import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Command, ArrowUp, ArrowDown, CornerDownLeft, Hash, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scaled } from '@/lib/scaled';
import { usePalette } from '@/providers/palette-provider';
import { useJiraAssigned, useJiraRecent, useJiraSearch } from '@/hooks/use-jira';
import {
  useTimer,
  useStartOrResumeTimer,
  useStopTimer,
  useElapsedSeconds,
} from '@/hooks/use-timer';
import { getPreference, setPreference } from '@/providers/preferences-provider';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
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
import type { JiraIssue, JiraSearchResult, Entry } from '@ternity/shared';

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: timerState } = useTimer();
  const startOrResume = useStartOrResumeTimer();
  const stopTimer = useStopTimer();

  // Pending action for confirmation dialogs
  const [pendingAction, setPendingAction] = useState<{
    type: 'start' | 'prepare';
    issue: JiraIssue;
    connectionId: string;
    siteUrl: string;
  } | null>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);

  // Detect # prefix for Jira search mode
  const isJiraMode = query.startsWith('#');
  const jiraQuery = isJiraMode ? query.substring(1) : query;

  // Queries
  const assignedQuery = useJiraAssigned();
  const recentQuery = useJiraRecent();
  const searchQuery = useJiraSearch(
    jiraQuery || query,
    isJiraMode || query.length >= 2 ? 'text' : 'assigned', // unused when disabled
  );
  const showSearch = isJiraMode || query.length >= 2;

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (showSearch) {
      return (searchQuery.data ?? []).flatMap((group) =>
        group.issues.map((issue) => ({
          issue,
          connectionId: group.connectionId,
          siteUrl: group.siteUrl,
        })),
      );
    }
    // Default: assigned + recent
    const assigned = (assignedQuery.data ?? []).flatMap((group) =>
      group.issues.map((issue) => ({
        issue,
        connectionId: group.connectionId,
        siteUrl: group.siteUrl,
      })),
    );
    const recent = (recentQuery.data ?? []).flatMap((group) =>
      group.issues.map((issue) => ({
        issue,
        connectionId: group.connectionId,
        siteUrl: group.siteUrl,
      })),
    );
    return [...assigned, ...recent];
  }, [showSearch, searchQuery.data, assignedQuery.data, recentQuery.data]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      // Focus next tick after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp selectedIdx when results change
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

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

  // Execute start-or-resume immediately (no confirmation needed)
  const doStartOrResume = useCallback(
    (issue: JiraIssue, connectionId: string) => {
      startOrResume.mutate({
        description: issue.summary,
        projectId: null,
        labelIds: [],
        jiraIssueKey: issue.key,
        jiraIssueSummary: issue.summary,
        jiraConnectionId: connectionId,
      });
    },
    [startOrResume],
  );

  // Execute prepare immediately (no confirmation needed)
  const doPrepare = useCallback((issue: JiraIssue, connectionId: string, siteUrl: string) => {
    window.dispatchEvent(
      new CustomEvent('ternity-palette-prepare', {
        detail: {
          summary: issue.summary,
          key: issue.key,
          connectionId,
          siteUrl,
        },
      }),
    );
  }, []);

  // Enter: start or resume — may need confirmation if timer is running
  const handleStartOrResume = useCallback(
    (issue: JiraIssue, connectionId: string, siteUrl: string) => {
      setOpen(false); // always dismiss palette first
      if (timerState?.running && getPreference('confirmTimerSwitch')) {
        setPendingAction({ type: 'start', issue, connectionId, siteUrl });
        setSwitchDialogOpen(true);
        return;
      }
      doStartOrResume(issue, connectionId);
    },
    [timerState?.running, doStartOrResume, setOpen],
  );

  // Cmd+Enter: prepare — may need confirmation to stop running timer
  const handlePrepare = useCallback(
    (issue: JiraIssue, connectionId: string, siteUrl: string) => {
      setOpen(false); // always dismiss palette first
      if (timerState?.running) {
        setPendingAction({ type: 'prepare', issue, connectionId, siteUrl });
        setStopDialogOpen(true);
        return;
      }
      doPrepare(issue, connectionId, siteUrl);
    },
    [timerState?.running, doPrepare, setOpen],
  );

  // Switch dialog confirm (Enter with running timer)
  const handleSwitchConfirm = useCallback(
    (dontAskAgain: boolean) => {
      if (dontAskAgain) {
        setPreference('confirmTimerSwitch', false);
      }
      setSwitchDialogOpen(false);
      if (pendingAction?.type === 'start') {
        doStartOrResume(pendingAction.issue, pendingAction.connectionId);
      }
      setPendingAction(null);
    },
    [pendingAction, doStartOrResume],
  );

  // Stop dialog confirm (Cmd+Enter with running timer)
  const handleStopConfirm = useCallback(() => {
    setStopDialogOpen(false);
    if (pendingAction?.type === 'prepare') {
      stopTimer.mutate(undefined, {
        onSuccess: () => {
          doPrepare(pendingAction.issue, pendingAction.connectionId, pendingAction.siteUrl);
        },
      });
    }
    setPendingAction(null);
  }, [pendingAction, stopTimer, doPrepare]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
    const selected = flatResults[selectedIdx];
    if (e.key === 'Enter' && selected) {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        // ⌘Enter / Ctrl+Enter: copy to timer bar (prepare only)
        handlePrepare(selected.issue, selected.connectionId, selected.siteUrl);
      } else {
        // Enter: start or resume timer
        handleStartOrResume(selected.issue, selected.connectionId, selected.siteUrl);
      }
    }
  };

  const isLoading = showSearch
    ? searchQuery.isLoading
    : assignedQuery.isLoading || recentQuery.isLoading;

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
              className="relative w-[600px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Command className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: scaled(14) }}
                  placeholder="Search... (# for Jira issues)"
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
                    className="flex items-center justify-center py-12 text-muted-foreground gap-2"
                    style={{ fontSize: scaled(12) }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {showSearch ? 'Searching...' : 'Loading...'}
                  </div>
                ) : showSearch ? (
                  <SearchResults
                    query={jiraQuery || query}
                    results={searchQuery.data ?? []}
                    selectedIdx={selectedIdx}
                    onSelect={handleStartOrResume}
                  />
                ) : (
                  <BrowseResults
                    assigned={assignedQuery.data ?? []}
                    recent={recentQuery.data ?? []}
                    selectedIdx={selectedIdx}
                    onSelect={handleStartOrResume}
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
                    <CornerDownLeft className="h-3 w-3" /> Start timer
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
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Jira mode
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch timer dialog (Enter while timer is running) */}
      {timerState?.entry && pendingAction?.type === 'start' && (
        <PaletteSwitchDialog
          open={switchDialogOpen}
          onOpenChange={(v) => {
            setSwitchDialogOpen(v);
            if (!v) setPendingAction(null);
          }}
          stoppingEntry={timerState.entry}
          startingIssue={pendingAction.issue}
          onConfirm={handleSwitchConfirm}
        />
      )}

      {/* Stop timer dialog (⌘Enter while timer is running) */}
      {timerState?.entry && pendingAction?.type === 'prepare' && (
        <PaletteStopDialog
          open={stopDialogOpen}
          onOpenChange={(v) => {
            setStopDialogOpen(v);
            if (!v) setPendingAction(null);
          }}
          stoppingEntry={timerState.entry}
          preparingIssue={pendingAction.issue}
          onConfirm={handleStopConfirm}
        />
      )}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SearchResults({
  query,
  results,
  selectedIdx,
  onSelect,
}: {
  query: string;
  results: JiraSearchResult[];
  selectedIdx: number;
  onSelect: (issue: JiraIssue, connectionId: string, siteUrl: string) => void;
}) {
  if (results.length === 0 && query.length >= 2) {
    return (
      <div className="py-12 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
        No results for &ldquo;{query}&rdquo;
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
        Keep typing to search...
      </div>
    );
  }

  let globalIdx = 0;
  return (
    <>
      {results.map((group) => (
        <div key={group.connectionId} className="mb-2">
          <div
            className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
            style={{ fontSize: scaled(9) }}
          >
            {group.siteName}
          </div>
          {group.issues.map((issue) => {
            const idx = globalIdx++;
            return (
              <div key={issue.key} data-selected={idx === selectedIdx}>
                <IssueRow
                  issue={issue}
                  selected={idx === selectedIdx}
                  onSelect={() => onSelect(issue, group.connectionId, group.siteUrl)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ── Confirmation dialogs ────────────────────────────────────────────

/** Switch dialog — shown when pressing Enter while a timer is running */
function PaletteSwitchDialog({
  open,
  onOpenChange,
  stoppingEntry,
  startingIssue,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stoppingEntry: Entry;
  startingIssue: JiraIssue;
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

          {/* Starting card — Jira issue */}
          <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
            <span
              className="font-medium uppercase tracking-wider text-primary/70"
              style={{ fontSize: scaled(9) }}
            >
              Starting
            </span>
            <p className="mt-1 truncate text-foreground" style={{ fontSize: scaled(13) }}>
              {startingIssue.summary}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="font-brand font-semibold text-primary"
                style={{ fontSize: scaled(11) }}
              >
                {startingIssue.key}
              </span>
              {startingIssue.status && (
                <span
                  className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                  style={{ fontSize: scaled(9) }}
                >
                  {startingIssue.status}
                </span>
              )}
            </div>
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

/** Stop dialog — shown when pressing ⌘Enter while a timer is running */
function PaletteStopDialog({
  open,
  onOpenChange,
  stoppingEntry,
  preparingIssue,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stoppingEntry: Entry;
  preparingIssue: JiraIssue;
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
              {preparingIssue.summary}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="font-brand font-semibold text-primary"
                style={{ fontSize: scaled(11) }}
              >
                {preparingIssue.key}
              </span>
              {preparingIssue.status && (
                <span
                  className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                  style={{ fontSize: scaled(9) }}
                >
                  {preparingIssue.status}
                </span>
              )}
              <span className="text-muted-foreground italic" style={{ fontSize: scaled(10) }}>
                Timer won&apos;t start automatically
              </span>
            </div>
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

function BrowseResults({
  assigned,
  recent,
  selectedIdx,
  onSelect,
}: {
  assigned: JiraSearchResult[];
  recent: JiraSearchResult[];
  selectedIdx: number;
  onSelect: (issue: JiraIssue, connectionId: string, siteUrl: string) => void;
}) {
  const assignedItems = assigned.flatMap((g) =>
    g.issues.map((issue) => ({ issue, connectionId: g.connectionId, siteUrl: g.siteUrl })),
  );
  const recentItems = recent.flatMap((g) =>
    g.issues.map((issue) => ({ issue, connectionId: g.connectionId, siteUrl: g.siteUrl })),
  );

  if (assignedItems.length === 0 && recentItems.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground" style={{ fontSize: scaled(12) }}>
        No Jira connections found. Connect Jira in Settings.
      </div>
    );
  }

  let globalIdx = 0;

  return (
    <>
      {/* Assigned to me */}
      <div className="mb-3">
        <div
          className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
          style={{ fontSize: scaled(9) }}
        >
          Jira — Assigned to me
        </div>
        {assignedItems.length > 0 ? (
          assignedItems.map((item) => {
            const idx = globalIdx++;
            return (
              <div key={item.issue.key} data-selected={idx === selectedIdx}>
                <IssueRow
                  issue={item.issue}
                  selected={idx === selectedIdx}
                  onSelect={() => onSelect(item.issue, item.connectionId, item.siteUrl)}
                />
              </div>
            );
          })
        ) : (
          <div className="px-3 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            No assigned issues
          </div>
        )}
      </div>

      {/* Recently viewed */}
      <div>
        <div
          className="px-3 py-1.5 font-brand text-muted-foreground/60 uppercase tracking-wider"
          style={{ fontSize: scaled(9) }}
        >
          Recently viewed
        </div>
        {recentItems.length > 0 ? (
          recentItems.map((item) => {
            const idx = globalIdx++;
            return (
              <div key={item.issue.key} data-selected={idx === selectedIdx}>
                <IssueRow
                  issue={item.issue}
                  selected={idx === selectedIdx}
                  onSelect={() => onSelect(item.issue, item.connectionId, item.siteUrl)}
                />
              </div>
            );
          })
        ) : (
          <div className="px-3 py-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            No recent issues
          </div>
        )}
      </div>
    </>
  );
}
