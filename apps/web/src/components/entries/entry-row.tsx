import { useState, useCallback, useEffect } from 'react';
import { Play, Square, Check, X, MoreHorizontal, Pencil, Trash2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useUpdateEntry, useDeleteEntry } from '@/hooks/use-entries';
import { useResumeTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { formatTime, formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { ProjectSelector } from '@/components/timer/project-selector';
import { BreathingGlow, SaveFlash, breathingBorderAnimation, breathingBorderTransition } from '@/components/ui/breathing-glow';
import { pillPopActiveAnimation, pillPopIdleAnimation, pillPopActiveTransition, pillPopIdleTransition } from '@/components/ui/pill-pop';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuditPanel } from './audit-panel';
import type { Entry } from '@ternity/shared';

type EditingField = 'description' | 'time' | 'project' | null;

interface Props {
  entry: Entry;
  autoEdit?: boolean;
  onAutoEditConsumed?: () => void;
}

export function EntryRow({ entry, autoEdit, onAutoEditConsumed }: Props) {
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const resumeTimer = useResumeTimer();
  const stopTimer = useStopTimer();

  const [editingField, setEditingField] = useState<EditingField>(
    autoEdit ? 'description' : null,
  );
  const [editDesc, setEditDesc] = useState(autoEdit ? '' : entry.description);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [pillPop, setPillPop] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  // Signal that autoEdit has been consumed so parent can clear state
  useEffect(() => {
    if (autoEdit && onAutoEditConsumed) onAutoEditConsumed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning = !entry.stoppedAt;
  const elapsed = useElapsedSeconds(entry.startedAt, isRunning);
  const noProject = !entry.projectId;
  const noDesc = !entry.description;

  const durationStr = isRunning
    ? formatDuration(elapsed)
    : formatDuration(entry.durationSeconds ?? 0);

  const timeRange = isRunning
    ? `${formatTime(entry.startedAt)} – now`
    : `${formatTime(entry.startedAt)} – ${formatTime(entry.stoppedAt!)}`;

  // --- Handlers ---

  const triggerSaveFlash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 600);
  };

  const triggerPillPop = () => {
    setPillPop(true);
    setTimeout(() => setPillPop(false), 500);
  };

  const handleEditDescription = () => {
    setEditDesc(entry.description);
    setEditingField('description');
  };

  const handleEditTime = () => {
    setEditStartTime(formatTime(entry.startedAt));
    setEditEndTime(entry.stoppedAt ? formatTime(entry.stoppedAt) : '');
    setEditingField('time');
  };

  const handleEditProject = () => {
    setEditingField('project');
  };

  const handleCancel = () => {
    setEditingField(null);
  };

  const handleSaveDescription = useCallback(() => {
    setEditingField(null);
    if (editDesc !== entry.description) {
      updateEntry.mutate({ id: entry.id, description: editDesc });
    }
    triggerSaveFlash();
  }, [editDesc, entry.description, entry.id, updateEntry]);

  const handleSaveTime = useCallback(() => {
    setEditingField(null);
    // Build ISO dates from time strings (keep same date)
    const dateStr = entry.startedAt.slice(0, 10); // YYYY-MM-DD
    const startISO = `${dateStr}T${editStartTime}:00`;
    const update: { id: string; startedAt?: string; stoppedAt?: string | null } = {
      id: entry.id,
      startedAt: startISO,
    };
    if (editEndTime && !isRunning) {
      update.stoppedAt = `${dateStr}T${editEndTime}:00`;
    }
    updateEntry.mutate(update);
    triggerSaveFlash();
  }, [editStartTime, editEndTime, entry.startedAt, entry.id, isRunning, updateEntry]);

  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      setEditingField(null);
      updateEntry.mutate({ id: entry.id, projectId });
      triggerPillPop();
    },
    [entry.id, updateEntry],
  );

  const handlePlay = () => {
    resumeTimer.mutate(entry.id);
  };

  const handleStop = () => {
    stopTimer.mutate();
  };

  const isEditing = editingField !== null;
  const isEditingProject = editingField === 'project';

  return (
    <motion.div
      className={cn(
        'group/row relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0',
        isEditingProject && 'z-20',
      )}
      animate={{
        backgroundColor: isRunning
          ? 'hsl(var(--primary) / 0.06)'
          : isEditing
            ? 'hsl(var(--muted) / 0.15)'
            : 'transparent',
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Running indicator — teal left border */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
            style={{ background: 'hsl(var(--primary))' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          />
        )}
      </AnimatePresence>

      {/* No-project indicator — amber left border */}
      {!isRunning && noProject && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
          style={{ background: 'hsl(35 100% 60%)' }}
        />
      )}

      {/* E2 Alive — breathing glow on editing row */}
      {isEditing && <BreathingGlow />}

      {/* Save flash */}
      <AnimatePresence>
        {savedFlash && <SaveFlash />}
      </AnimatePresence>

      {/* Description + project */}
      <div className="relative z-10 flex-1 min-w-0">
        {/* Description — fixed height */}
        <div className="flex h-5 items-center">
          <AnimatePresence mode="wait">
            {editingField === 'description' ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex w-full items-center gap-2"
              >
                <motion.input
                  className="flex-1 rounded-md bg-muted/40 px-2 text-[13px] leading-5 text-foreground outline-none"
                  style={{ height: '20px', border: '1px solid hsl(var(--primary) / 0.4)' }}
                  animate={breathingBorderAnimation}
                  transition={breathingBorderTransition}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDescription();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleSaveDescription}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="h-2.5 w-2.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleCancel}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.span
                key="display"
                initial={false}
                className={cn(
                  'cursor-pointer truncate text-[13px] leading-5 hover:text-primary',
                  noDesc ? 'italic text-muted-foreground' : isRunning ? 'text-primary' : 'text-foreground',
                )}
                onClick={handleEditDescription}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.1 }}
              >
                {entry.description || 'No description'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Project line — fixed height */}
        <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
          {isEditingProject ? (
            <ProjectSelector
              value={entry.projectId}
              onChange={handleProjectChange}
              defaultOpen
              onClose={handleCancel}
            />
          ) : entry.projectName ? (
            <motion.span
              className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:text-primary"
              style={{ fontSize: scaled(11), border: '1px solid transparent' }}
              animate={pillPop ? pillPopActiveAnimation : pillPopIdleAnimation}
              transition={pillPop ? pillPopActiveTransition : pillPopIdleTransition}
              onClick={handleEditProject}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
              />
              <AnimatePresence mode="wait">
                <motion.span
                  key={entry.projectName}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {entry.clientName ? `${entry.clientName} · ` : ''}{entry.projectName}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          ) : (
            <span
              className="flex cursor-pointer items-center gap-1 text-amber-500/70 hover:text-amber-400"
              style={{ fontSize: scaled(11) }}
              onClick={handleEditProject}
            >
              + Add project
            </span>
          )}
        </div>
      </div>

      {/* Time range — fixed height */}
      <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
        {editingField === 'time' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1"
          >
            <motion.input
              className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
              style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
              animate={breathingBorderAnimation}
              transition={breathingBorderTransition}
              value={editStartTime}
              onChange={(e) => setEditStartTime(e.target.value)}
              autoFocus
            />
            <span className="text-[11px] text-muted-foreground">–</span>
            <motion.input
              className="h-5 w-[48px] rounded-md bg-muted/40 px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
              style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
              animate={breathingBorderAnimation}
              transition={breathingBorderTransition}
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTime();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleSaveTime}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-2.5 w-2.5" />
            </motion.button>
          </motion.div>
        ) : (
          <span
            className={cn(
              'cursor-pointer text-[11px] tabular-nums hover:text-primary',
              isRunning ? 'text-primary/70' : 'text-muted-foreground',
            )}
            onClick={handleEditTime}
          >
            {timeRange}
          </span>
        )}
      </div>

      {/* Duration */}
      <span
        className={cn(
          'relative z-10 font-brand text-sm font-semibold tabular-nums shrink-0',
          isRunning ? 'text-primary' : 'text-foreground',
        )}
      >
        {durationStr}
      </span>

      {/* Play/Stop button */}
      {isRunning ? (
        <motion.button
          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
          whileHover={{ backgroundColor: 'hsl(var(--destructive) / 0.2)' }}
          whileTap={{ scale: 0.85 }}
          onClick={handleStop}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        >
          <Square className="h-3 w-3 fill-current" />
        </motion.button>
      ) : (
        <motion.button
          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
          whileHover={{
            color: 'hsl(var(--primary))',
            backgroundColor: 'hsl(var(--primary) / 0.1)',
          }}
          whileTap={{ scale: 0.85 }}
          transition={{ duration: 0.15 }}
          onClick={handlePlay}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </motion.button>
      )}

      {/* More actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/row:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEditDescription}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit description
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAuditOpen(true)}>
            <History className="mr-2 h-3.5 w-3.5" />
            View history
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteEntry.mutate(entry.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AuditPanel entry={entry} open={auditOpen} onOpenChange={setAuditOpen} />
    </motion.div>
  );
}
