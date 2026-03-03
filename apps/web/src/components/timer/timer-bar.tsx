import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Play, Square, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  useTimer,
  useStartTimer,
  useStopTimer,
  useResumeTimer,
  useElapsedSeconds,
} from '@/hooks/use-timer';
import { useUpdateEntry, useOptimisticEntryPatch } from '@/hooks/use-entries';
import { useLinkJiraIssue, useJiraConnections, resolveJiraProject } from '@/hooks/use-jira';
import { usePalette } from '@/providers/palette-provider';
import { getPreference } from '@/providers/preferences-provider';
import { formatTimer, getTimezoneLabel } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { ProjectSelector } from './project-selector';
import { AnimatedDigit } from '@/components/ui/animated-digit';
import { LiquidEdge, LiquidEdgeKeyframes } from '@/components/ui/liquid-edge';
import { JiraChip } from '@/components/jira/jira-chip';
import { JiraIcon } from '@/components/jira/jira-icon';
import { JiraSearchDropdown } from '@/components/jira/jira-search-dropdown';
import { useTimelineFocus, TIMER_BAR_ID } from '@/components/timer/timeline-focus-context';
import { TimerSuggest } from './timer-suggest';
import type { EntrySearchHit, JiraIssue, JiraIssueLink } from '@ternity/shared';

export function TimerBar() {
  const { data: timerState } = useTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const resumeTimer = useResumeTimer();
  const updateEntry = useUpdateEntry();
  const patchEntry = useOptimisticEntryPatch();
  const linkJira = useLinkJiraIssue();
  const { data: jiraConnections } = useJiraConnections();
  const hasJira = (jiraConnections?.length ?? 0) > 0;

  const running = timerState?.running ?? false;
  const currentEntry = timerState?.entry ?? null;
  const { selectedEntryId, select, registerEnterHandler } = useTimelineFocus();
  const isHighlighted = selectedEntryId === TIMER_BAR_ID;
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const lastStoppedEntryIdRef = useRef<string | null>(null);

  // Local state for the "next timer" description/project/tags
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(() =>
    getPreference('defaultProjectId'),
  );
  const [tagIds, setTagIds] = useState<string[]>([]);

  // Auto-scroll into view when highlighted via keyboard
  useEffect(() => {
    if (isHighlighted && timerBarRef.current) {
      timerBarRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  // Track palette state to ignore leaked Enter keydown after palette closes
  const { open: paletteOpen } = usePalette();
  const paletteClosedAtRef = useRef(0);
  useEffect(() => {
    if (!paletteOpen) {
      paletteClosedAtRef.current = Date.now();
    }
  }, [paletteOpen]);

  // Jira state
  const [jiraDropdownOpen, setJiraDropdownOpen] = useState(false);
  const [pendingJira, setPendingJira] = useState<{
    key: string;
    summary: string;
    connectionId: string;
    siteUrl: string;
  } | null>(null);

  // Track the last description value confirmed saved to the server.
  // We compare against this — NOT currentEntry.description which gets
  // optimistically patched and would make the debounce think "already saved".
  const savedDescriptionRef = useRef<string | null>(null);
  const descriptionRef = useRef(description);
  descriptionRef.current = description;

  // When timer data loads or entry changes, sync local state from running entry.
  // We track a fingerprint (id + projectId) so that edits made from the entries
  // list (which refetch the timer query) are picked up here.
  // NOTE: description is NOT in the fingerprint — it's tracked separately via
  // savedDescriptionRef to avoid the optimistic cache patch creating false syncs.
  const [syncedFingerprint, setSyncedFingerprint] = useState<string | null>(null);
  const currentFingerprint =
    running && currentEntry ? `${currentEntry.id}::${currentEntry.projectId ?? ''}` : null;
  if (currentFingerprint && syncedFingerprint !== currentFingerprint) {
    setDescription(currentEntry!.description);
    setProjectId(currentEntry!.projectId);
    setTagIds(currentEntry!.tags.map((t) => t.id));
    savedDescriptionRef.current = currentEntry!.description;
    if (syncedFingerprint === null) {
      // First sync for this entry — clear pending Jira (linked issue comes from entry)
      setPendingJira(null);
    }
    setSyncedFingerprint(currentFingerprint);
    // Timer is confirmed running — clear the stopped ref
    lastStoppedEntryIdRef.current = null;
  }
  if (!running && syncedFingerprint !== null) {
    setSyncedFingerprint(null);
  }

  // Reset savedDescriptionRef when entry changes (new timer started / resumed)
  const currentEntryId = currentEntry?.id ?? null;
  useEffect(() => {
    if (currentEntryId && currentEntry) {
      savedDescriptionRef.current = currentEntry.description;
    } else {
      savedDescriptionRef.current = null;
    }
  }, [currentEntryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced description save while running (800ms after typing stops)
  useEffect(() => {
    if (!running || !currentEntry) return;
    const timer = setTimeout(() => {
      if (descriptionRef.current !== savedDescriptionRef.current) {
        const valueToSave = descriptionRef.current;
        updateEntry.mutate(
          {
            id: currentEntry.id,
            description: valueToSave,
            source: 'timer_bar',
          },
          {
            onSuccess: () => {
              savedDescriptionRef.current = valueToSave;
            },
          },
        );
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [description, running, currentEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute today-only elapsed from segments (clamp to today's boundaries)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayStartMs = useMemo(() => new Date(todayStr + 'T00:00:00').getTime(), [todayStr]);
  const todayEndMs = useMemo(() => todayStartMs + 24 * 60 * 60 * 1000, [todayStartMs]);
  const runningSegment = currentEntry?.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);

  // Sum completed segments clamped to today
  const todayCompletedOffset = useMemo(() => {
    if (!currentEntry) return 0;
    let total = 0;
    for (const seg of currentEntry.segments) {
      if (seg === runningSegment) continue; // skip running — handled by useElapsedSeconds
      if (seg.startedAt) {
        const segStartMs = new Date(seg.startedAt).getTime();
        const segEndMs = seg.stoppedAt ? new Date(seg.stoppedAt).getTime() : Date.now();
        const clampedStart = Math.max(segStartMs, todayStartMs);
        const clampedEnd = Math.min(segEndMs, todayEndMs);
        if (clampedEnd > clampedStart) {
          total += Math.round((clampedEnd - clampedStart) / 1000);
        }
      } else if (seg.durationSeconds != null) {
        const createdMs = new Date(seg.createdAt).getTime();
        if (createdMs >= todayStartMs && createdMs < todayEndMs) {
          total += seg.durationSeconds;
        }
      }
    }
    return total;
  }, [currentEntry, runningSegment, todayStartMs, todayEndMs]);

  // Clamp running segment's start to today's start
  const runningStartClamped =
    running && runningSegment?.startedAt
      ? new Date(Math.max(new Date(runningSegment.startedAt).getTime(), todayStartMs)).toISOString()
      : null;

  // While resuming, the server hasn't returned segments yet — use the last known
  // elapsed value as offset so the timer doesn't briefly flash 0:00:00.
  const lastElapsedRef = useRef(0);
  const isResumingWithoutData = running && !runningSegment;
  const effectiveOffset = isResumingWithoutData ? lastElapsedRef.current : todayCompletedOffset;
  const elapsed = useElapsedSeconds(runningStartClamped, running, effectiveOffset);

  // Track last elapsed for continuity across stop/resume
  if (running && runningSegment) {
    lastElapsedRef.current = elapsed;
  }

  // Show ticking elapsed when running, remembered total when just stopped, 0 otherwise
  const displayElapsed = running
    ? elapsed
    : lastStoppedEntryIdRef.current
      ? lastElapsedRef.current
      : 0;
  const display = formatTimer(displayElapsed);
  const digits = display.split('');

  // Jira issue linked to current entry (from server) or pending (local, not yet started)
  const linkedJiraIssue: JiraIssueLink | null = running
    ? (currentEntry?.jiraIssue ?? null)
    : pendingJira;

  const handleStart = useCallback(() => {
    // If we just stopped an entry and nothing was changed, resume it (new segment)
    if (lastStoppedEntryIdRef.current) {
      resumeTimer.mutate(lastStoppedEntryIdRef.current);
      // Don't clear lastStoppedEntryIdRef here — keep it so the display shows the
      // accumulated time until the server confirms the resume. It gets cleared once
      // the timer query returns running=true and the sync fingerprint updates.
      return;
    }
    startTimer.mutate({
      description,
      projectId,
      tagIds,
      ...(pendingJira
        ? {
            jiraIssueKey: pendingJira.key,
            jiraIssueSummary: pendingJira.summary,
            jiraConnectionId: pendingJira.connectionId,
          }
        : {}),
    });
  }, [description, projectId, tagIds, pendingJira, startTimer, resumeTimer]);

  const handleStop = useCallback(() => {
    // Remember which entry we're stopping so Enter can resume it
    if (currentEntry) {
      lastStoppedEntryIdRef.current = currentEntry.id;
    }

    // Send pending description with the stop request — saved atomically
    // in the same transaction, so the entries refetch always gets the right value.
    const pendingDescription = descriptionRef.current;
    const needsFlush = currentEntry && pendingDescription !== currentEntry.description;

    stopTimer.mutate(needsFlush ? { description: pendingDescription } : undefined);
  }, [stopTimer, currentEntry]);

  // Register Enter handler for keyboard navigation — toggle start/stop
  const handleToggleRef = useRef<() => void>(() => {});
  handleToggleRef.current = running ? handleStop : handleStart;
  useEffect(() => {
    if (isHighlighted) {
      registerEnterHandler(TIMER_BAR_ID, () => handleToggleRef.current());
      return () => registerEnterHandler(TIMER_BAR_ID, null);
    }
  }, [isHighlighted, registerEnterHandler]);

  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When suggest dropdown is open, it handles Enter/Arrow/Escape via its own keydown listener
    if (suggestOpen && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      return; // let TimerSuggest handle it
    }
    if (e.key === 'Enter' && !running) {
      // Ignore Enter events that leak from the command palette closing
      if (Date.now() - paletteClosedAtRef.current < 200) return;
      handleStart();
    }
    if (e.key === 'Escape') {
      if (suggestOpen) {
        setSuggestOpen(false);
      } else if (jiraDropdownOpen) {
        setJiraDropdownOpen(false);
      } else if (!running) {
        // Second Esc (or no dropdown open): reset to vanilla state
        setDescription('');
        setProjectId(getPreference('defaultProjectId'));
        setTagIds([]);
        setPendingJira(null);
        lastStoppedEntryIdRef.current = null;
        descriptionInputRef.current?.blur();
      }
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDescription(val);
    // User changed the description — don't resume the old entry, create new on next start
    lastStoppedEntryIdRef.current = null;

    // Optimistically patch the cache so the entry list updates in real-time
    if (running && currentEntry) {
      patchEntry(currentEntry.id, { description: val });
    }

    // Open suggest dropdown when 2+ effective chars typed and timer not running
    // For # mode: need # + 2 chars (e.g. "#ab"). For normal: 2+ chars.
    const isHash = val.startsWith('#');
    const effectiveLen = isHash ? val.length - 1 : val.length;
    setSuggestOpen(!running && effectiveLen >= 2);
  };

  // Handle suggestion selection — resume the existing entry (add new segment)
  const handleSuggestSelect = useCallback(
    (entry: EntrySearchHit) => {
      setSuggestOpen(false);
      resumeTimer.mutate(entry.id);
    },
    [resumeTimer],
  );

  // Issue select handler — used by Jira dropdown and suggest
  const handleIssueSelect = useCallback(
    (issue: JiraIssue, connectionId: string, siteUrl: string) => {
      const jiraLink = {
        key: issue.key,
        summary: issue.summary,
        connectionId,
        siteUrl,
      };
      const resolvedProjectId = resolveJiraProject(
        jiraConnections,
        connectionId,
        issue.key,
        getPreference('defaultProjectId'),
      );

      if (running && currentEntry) {
        // Running timer: update description + link issue + set project
        setDescription(issue.summary);
        updateEntry.mutate({
          id: currentEntry.id,
          description: issue.summary,
          ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
          source: 'timer_bar',
        });
        linkJira.mutate({
          entryId: currentEntry.id,
          jiraIssueKey: issue.key,
          jiraIssueSummary: issue.summary,
          jiraConnectionId: connectionId,
        });
      } else {
        // Not running: prepare for next start
        setDescription(issue.summary);
        setPendingJira(jiraLink);
        if (resolvedProjectId) setProjectId(resolvedProjectId);
      }

      setJiraDropdownOpen(false);
      setSuggestOpen(false);
    },
    [running, currentEntry, updateEntry, linkJira, jiraConnections],
  );

  const handleUnlink = useCallback(() => {
    if (running && currentEntry) {
      linkJira.mutate({
        entryId: currentEntry.id,
        jiraIssueKey: null,
        jiraIssueSummary: null,
        jiraConnectionId: null,
      });
    } else {
      setPendingJira(null);
    }
  }, [running, currentEntry, linkJira]);

  // Handle Jira issue selected from the unified suggest dropdown
  const handleSuggestJiraSelect = useCallback(
    (issue: JiraIssue, connectionId: string, siteUrl: string) => {
      lastStoppedEntryIdRef.current = null;
      handleIssueSelect(issue, connectionId, siteUrl);
    },
    [handleIssueSelect],
  );

  // Listen for command palette "prepare" event (⌘Enter — fill details without starting)
  useEffect(() => {
    const handler = (e: Event) => {
      const { summary, key, connectionId, siteUrl, projectId } = (e as CustomEvent).detail;
      if (!running) {
        setDescription(summary);
        // Only set pendingJira if we have a valid Jira key + connection
        if (key && connectionId && siteUrl) {
          setPendingJira({ key, summary, connectionId, siteUrl });
        } else {
          setPendingJira(null);
        }
        if (projectId) setProjectId(projectId);
        // Focus the description input so user can edit before starting
        requestAnimationFrame(() => descriptionInputRef.current?.focus());
      }
    };
    window.addEventListener('ternity-palette-prepare', handler);
    return () => window.removeEventListener('ternity-palette-prepare', handler);
  }, [running]);

  // Close dropdown on click outside
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jiraDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setJiraDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [jiraDropdownOpen]);

  return (
    <div ref={wrapperRef} className="relative z-50">
      {running && <LiquidEdgeKeyframes />}
      <motion.div
        ref={timerBarRef}
        className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, [role="menuitem"], [data-radix-collection-item]'))
            return;
          select(TIMER_BAR_ID);
        }}
        animate={{
          borderColor: isHighlighted
            ? isInputFocused
              ? 'hsl(var(--primary) / 0.5)'
              : 'hsl(var(--primary) / 0.6)'
            : isInputFocused
              ? running
                ? 'hsl(var(--primary) / 0.4)'
                : 'hsl(var(--primary) / 0.35)'
              : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
          boxShadow: isInputFocused
            ? '0 0 12px hsl(var(--primary) / 0.15), 0 0 4px hsl(var(--primary) / 0.1)'
            : '0 0 0px transparent',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Left border indicator — primary green when focused */}
        <AnimatePresence>
          {isHighlighted && (
            <motion.div
              className="absolute left-0 top-0 bottom-0 rounded-l"
              style={{
                width: isInputFocused ? '3px' : '5px',
                background: isInputFocused ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--primary))',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            />
          )}
        </AnimatePresence>

        {/* F3c Liquid Edge — two fluid blobs along the bottom */}
        {running && <LiquidEdge />}

        {/* Jira chip or icon — only show when connections exist or issue already linked */}
        {(hasJira || linkedJiraIssue) && (
          <div className="relative z-10 flex-shrink-0">
            {linkedJiraIssue ? (
              <JiraChip issue={linkedJiraIssue} onUnlink={handleUnlink} />
            ) : (
              <button
                className={cn(
                  'flex items-center justify-center rounded-md border p-1.5 transition-colors',
                  jiraDropdownOpen
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/20 hover:text-primary',
                )}
                onClick={() => setJiraDropdownOpen((v) => !v)}
                title="Link Jira issue"
              >
                <JiraIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="relative z-10 flex flex-1 items-center gap-1">
          <input
            ref={descriptionInputRef}
            className="w-full border-none bg-transparent text-foreground outline-none placeholder:italic placeholder:text-muted-foreground/50"
            style={{ fontSize: scaled(13) }}
            placeholder="What are you working on?"
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsInputFocused(true);
              if (!isHighlighted) select(TIMER_BAR_ID);
            }}
            onBlur={() => {
              setIsInputFocused(false);
              setSuggestOpen(false);
            }}
          />
          {/* Clear button — resets to empty state */}
          {!running && description && (
            <button
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted/40 text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/15 hover:text-destructive"
              onClick={() => {
                setDescription('');
                setProjectId(getPreference('defaultProjectId'));
                setTagIds([]);
                setPendingJira(null);
                lastStoppedEntryIdRef.current = null;
                descriptionInputRef.current?.focus();
              }}
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative z-10">
          <ProjectSelector
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              lastStoppedEntryIdRef.current = null; // project changed, don't resume old entry
              if (running && currentEntry) {
                updateEntry.mutate({ id: currentEntry.id, projectId: id, source: 'timer_bar' });
              }
            }}
          />
        </div>

        {/* Animated digits when running, accumulated when paused, dim when idle */}
        <div className="relative z-10 flex flex-col items-end font-brand tabular-nums">
          <div
            className="font-semibold tracking-wider text-primary"
            style={{ fontSize: scaled(20) }}
          >
            {running ? (
              <span className="inline-flex">
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </span>
            ) : displayElapsed > 0 ? (
              <span style={{ opacity: 0.6 }}>{display}</span>
            ) : (
              <span style={{ opacity: 0.4 }}>0:00:00</span>
            )}
          </div>
          <span
            className="font-normal tracking-wider text-muted-foreground"
            style={{ opacity: 0.5, fontSize: scaled(9) }}
          >
            {getTimezoneLabel()}
          </span>
        </div>

        {/* Start/Stop button with spring transitions */}
        <AnimatePresence mode="wait">
          {running ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleStop}
              disabled={stopTimer.isPending}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white disabled:opacity-50"
              title="Stop timer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="start"
              initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleStart}
              disabled={startTimer.isPending}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              title="Start timer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Jira search dropdown */}
      <AnimatePresence>
        {jiraDropdownOpen && (
          <JiraSearchDropdown
            onSelect={handleIssueSelect}
            onClose={() => setJiraDropdownOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Unified autosuggest — entries + Jira, # limits to Jira only */}
      <AnimatePresence>
        {suggestOpen && !jiraDropdownOpen && (
          <TimerSuggest
            query={description}
            onSelectEntry={handleSuggestSelect}
            onSelectJira={handleSuggestJiraSelect}
            onClose={() => setSuggestOpen(false)}
            inputRef={descriptionInputRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
