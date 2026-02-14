import { useState, useCallback } from 'react';
import { Play, Square } from 'lucide-react';
import { useTimer, useStartTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { formatTimer } from '@/lib/format';
import { ProjectSelector } from './project-selector';
import { LabelSelector } from './label-selector';

export function TimerBar() {
  const { data: timerState } = useTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const running = timerState?.running ?? false;
  const currentEntry = timerState?.entry ?? null;

  // Local state for the "next timer" description/project/labels
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  // When timer data loads, sync local state from running entry
  const syncedRef = useState(false);
  if (running && currentEntry && !syncedRef[0]) {
    setDescription(currentEntry.description);
    setProjectId(currentEntry.projectId);
    setLabelIds(currentEntry.labels.map((l) => l.id));
    syncedRef[1](true);
  }
  if (!running && syncedRef[0]) {
    syncedRef[1](false);
  }

  const elapsed = useElapsedSeconds(
    currentEntry?.startedAt ?? null,
    running,
  );

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
        setProjectId(null);
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
    <div
      className={`mb-5 flex items-center gap-3 rounded-lg border px-4 py-3 ${
        running
          ? 'border-primary/50 bg-[hsl(var(--t-timer-bg))]'
          : 'border-[hsl(var(--t-timer-border))] bg-[hsl(var(--t-timer-bg))]'
      }`}
    >
      <input
        className="flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="What are you working on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <ProjectSelector
        value={projectId}
        onChange={(id) => setProjectId(id)}
      />

      <LabelSelector value={labelIds} onChange={setLabelIds} />

      <span className="font-brand text-xl font-semibold tracking-wider text-primary tabular-nums">
        {formatTimer(running ? elapsed : 0)}
      </span>

      {running ? (
        <button
          onClick={handleStop}
          disabled={stopTimer.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--t-stop))] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          title="Stop timer"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={startTimer.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          title="Start timer"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>
      )}
    </div>
  );
}
