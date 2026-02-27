import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTimer, useStartTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { useUpdateEntry } from '@/hooks/use-entries';
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
import { HashAutocomplete } from '@/components/jira/hash-autocomplete';
import type { JiraIssue, JiraIssueLink } from '@ternity/shared';

export function TimerBar() {
  const { data: timerState } = useTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updateEntry = useUpdateEntry();
  const linkJira = useLinkJiraIssue();
  const { data: jiraConnections } = useJiraConnections();
  const hasJira = (jiraConnections?.length ?? 0) > 0;

  const running = timerState?.running ?? false;
  const currentEntry = timerState?.entry ?? null;

  // Local state for the "next timer" description/project/labels
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(() =>
    getPreference('defaultProjectId'),
  );
  const [labelIds, setLabelIds] = useState<string[]>([]);

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
  const [hashTrigger, setHashTrigger] = useState<string | null>(null);
  const [pendingJira, setPendingJira] = useState<{
    key: string;
    summary: string;
    connectionId: string;
    siteUrl: string;
  } | null>(null);

  // When timer data loads or entry changes, sync local state from running entry
  const [syncedEntryId, setSyncedEntryId] = useState<string | null>(null);
  if (running && currentEntry && syncedEntryId !== currentEntry.id) {
    setDescription(currentEntry.description);
    setProjectId(currentEntry.projectId);
    setLabelIds(currentEntry.labels.map((l) => l.id));
    setPendingJira(null); // linked issue comes from entry, not local state
    setSyncedEntryId(currentEntry.id);
  }
  if (!running && syncedEntryId !== null) {
    setSyncedEntryId(null);
  }

  // Debounced description save while running (800ms after typing stops)
  const descriptionRef = useRef(description);
  descriptionRef.current = description;
  useEffect(() => {
    if (!running || !currentEntry) return;
    const timer = setTimeout(() => {
      if (descriptionRef.current !== currentEntry.description) {
        updateEntry.mutate({
          id: currentEntry.id,
          description: descriptionRef.current,
          source: 'timer_bar',
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [description, running, currentEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute elapsed from segments
  const completedDuration =
    currentEntry?.segments
      .filter((s) => s.durationSeconds != null)
      .reduce((sum, s) => sum + s.durationSeconds!, 0) ?? 0;
  const runningSegment = currentEntry?.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const elapsed = useElapsedSeconds(runningSegment?.startedAt ?? null, running, completedDuration);

  const display = formatTimer(running ? elapsed : 0);
  const digits = display.split('');

  // Jira issue linked to current entry (from server) or pending (local, not yet started)
  const linkedJiraIssue: JiraIssueLink | null = running
    ? (currentEntry?.jiraIssue ?? null)
    : pendingJira;

  const handleStart = useCallback(() => {
    startTimer.mutate({
      description,
      projectId,
      labelIds,
      ...(pendingJira
        ? {
            jiraIssueKey: pendingJira.key,
            jiraIssueSummary: pendingJira.summary,
            jiraConnectionId: pendingJira.connectionId,
          }
        : {}),
    });
  }, [description, projectId, labelIds, pendingJira, startTimer]);

  const handleStop = useCallback(() => {
    stopTimer.mutate(undefined, {
      onSuccess: () => {
        setDescription('');
        setProjectId(getPreference('defaultProjectId'));
        setLabelIds([]);
        setPendingJira(null);
      },
    });
  }, [stopTimer]);

  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !running) {
      // Ignore Enter events that leak from the command palette closing
      if (Date.now() - paletteClosedAtRef.current < 200) return;
      handleStart();
    }
    if (e.key === 'Escape') {
      if (hashTrigger !== null || jiraDropdownOpen) {
        // First Esc: close dropdowns
        setHashTrigger(null);
        setJiraDropdownOpen(false);
      } else if (!running) {
        // Second Esc (or no dropdown open): reset to vanilla state
        setDescription('');
        setProjectId(getPreference('defaultProjectId'));
        setLabelIds([]);
        setPendingJira(null);
        descriptionInputRef.current?.blur();
      }
    }
  };

  // Detect # trigger in description
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDescription(val);

    const hashIdx = val.lastIndexOf('#');
    if (hashIdx >= 0 && (hashIdx === 0 || val[hashIdx - 1] === ' ')) {
      const afterHash = val.substring(hashIdx + 1);
      if (!afterHash.includes(' ')) {
        setHashTrigger(afterHash);
        return;
      }
    }
    setHashTrigger(null);
  };

  // Issue select handler — used by both dropdown and hash autocomplete
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
      setHashTrigger(null);
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

  // Close dropdown/autocomplete on click outside
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jiraDropdownOpen && hashTrigger === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setJiraDropdownOpen(false);
        setHashTrigger(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [jiraDropdownOpen, hashTrigger]);

  return (
    <div ref={wrapperRef} className="relative z-50">
      {running && <LiquidEdgeKeyframes />}
      <motion.div
        className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
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

        <div className="relative z-10 flex-1">
          <input
            ref={descriptionInputRef}
            className="w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            style={{ fontSize: scaled(13) }}
            placeholder="What are you working on?"
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="relative z-10">
          <ProjectSelector
            value={projectId}
            onChange={(id) => {
              setProjectId(id);
              if (running && currentEntry) {
                updateEntry.mutate({ id: currentEntry.id, projectId: id, source: 'timer_bar' });
              }
            }}
          />
        </div>

        {/* Animated digits when running, static when idle */}
        <div className="relative z-10 flex flex-col items-end font-brand tabular-nums">
          <div className="text-xl font-semibold tracking-wider text-primary">
            {running ? (
              <span className="inline-flex">
                {digits.map((d, i) => (
                  <AnimatedDigit key={i} char={d} />
                ))}
              </span>
            ) : (
              <span style={{ opacity: 0.4 }}>0:00:00</span>
            )}
          </div>
          <span
            className="text-[9px] font-normal tracking-wider text-muted-foreground"
            style={{ opacity: 0.5 }}
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

      {/* Hash autocomplete */}
      <AnimatePresence>
        {hasJira && hashTrigger !== null && !jiraDropdownOpen && (
          <HashAutocomplete
            query={hashTrigger}
            onSelect={(issue, connectionId, siteUrl) => {
              // Replace the #query part with the issue summary
              const hashIdx = description.lastIndexOf('#');
              const newDesc =
                hashIdx >= 0 ? description.substring(0, hashIdx) + issue.summary : issue.summary;
              setDescription(newDesc);
              handleIssueSelect(issue, connectionId, siteUrl);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
