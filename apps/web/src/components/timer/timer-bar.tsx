import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTimer, useStartTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { useUpdateEntry } from '@/hooks/use-entries';
import { getPreference } from '@/providers/preferences-provider';
import { formatTimer, getTimezoneLabel } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { ProjectSelector } from './project-selector';
import { AnimatedDigit } from '@/components/ui/animated-digit';
import { LiquidEdge, LiquidEdgeKeyframes } from '@/components/ui/liquid-edge';

export function TimerBar() {
  const { data: timerState } = useTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updateEntry = useUpdateEntry();

  const running = timerState?.running ?? false;
  const currentEntry = timerState?.entry ?? null;

  // Local state for the "next timer" description/project/labels
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(() => getPreference('defaultProjectId'));
  const [labelIds, setLabelIds] = useState<string[]>([]);

  // When timer data loads or entry changes, sync local state from running entry
  const [syncedEntryId, setSyncedEntryId] = useState<string | null>(null);
  if (running && currentEntry && syncedEntryId !== currentEntry.id) {
    setDescription(currentEntry.description);
    setProjectId(currentEntry.projectId);
    setLabelIds(currentEntry.labels.map((l) => l.id));
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
        updateEntry.mutate({ id: currentEntry.id, description: descriptionRef.current, source: 'timer_bar' });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [description, running, currentEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute elapsed from segments
  const completedDuration = currentEntry?.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0) ?? 0;
  const runningSegment = currentEntry?.segments.find(
    (s) => s.type === 'clocked' && !s.stoppedAt,
  );
  const elapsed = useElapsedSeconds(
    runningSegment?.startedAt ?? null,
    running,
    completedDuration,
  );

  const display = formatTimer(running ? elapsed : 0);
  const digits = display.split('');

  const handleStart = useCallback(() => {
    startTimer.mutate({
      description,
      projectId,
      labelIds,
    });
  }, [description, projectId, labelIds, startTimer]);

  const handleStop = useCallback(() => {
    stopTimer.mutate(undefined, {
      onSuccess: () => {
        setDescription('');
        setProjectId(getPreference('defaultProjectId'));
        setLabelIds([]);
      },
    });
  }, [stopTimer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !running) {
      handleStart();
    }
  };

  return (
    <div>
      {running && <LiquidEdgeKeyframes />}
      <motion.div
        className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
        animate={{
          borderColor: running
            ? 'hsl(var(--primary) / 0.3)'
            : 'hsl(var(--t-timer-border))',
          backgroundColor: 'hsl(var(--t-timer-bg))',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* F3c Liquid Edge — two fluid blobs along the bottom */}
        {running && <LiquidEdge />}

        <input
          className="relative z-10 flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          style={{ fontSize: scaled(13) }}
          placeholder="What are you working on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
        />

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
          <span className="text-[9px] font-normal tracking-wider text-muted-foreground" style={{ opacity: 0.5 }}>
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
    </div>
  );
}
