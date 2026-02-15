import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Square, Check, X, MoreHorizontal, Pencil, Trash2, History, Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useUpdateEntry, useDeleteEntry } from '@/hooks/use-entries';
import { useTimer, useResumeTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { formatTime, formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { useProjects } from '@/hooks/use-reference-data';
import type { ProjectOption } from '@ternity/shared';
import { BreathingGlow, SaveFlash, breathingBorderAnimation, breathingBorderTransition } from '@/components/ui/breathing-glow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuditPanel } from './audit-panel';
import type { Entry } from '@ternity/shared';
import { useActiveEdit } from './active-edit-context';

type EditingField = 'description' | 'time' | 'project' | null;

/* Pill-pop uses a CSS keyframe animation (globals.css) — runs on compositor thread,
   immune to React Query re-render jitter that breaks framer motion keyframes. */

interface Props {
  entry: Entry;
  autoEdit?: boolean;
  onAutoEditConsumed?: () => void;
}

export function EntryRow({ entry, autoEdit, onAutoEditConsumed }: Props) {
  const { data: timerState } = useTimer();
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
  const [projectSearch, setProjectSearch] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);
  const [optimisticProject, setOptimisticProject] = useState<{
    name: string;
    color: string;
    clientName: string;
  } | null>(null);
  const { data: allProjects } = useProjects();
  const { activeEntryId, claim, release } = useActiveEdit();
  const editingFieldRef = useRef(editingField);
  editingFieldRef.current = editingField;

  // Signal that autoEdit has been consumed so parent can clear state
  useEffect(() => {
    if (autoEdit && onAutoEditConsumed) onAutoEditConsumed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cancel when another entry claims the active edit
  useEffect(() => {
    if (activeEntryId !== null && activeEntryId !== entry.id && editingFieldRef.current !== null) {
      setEditingField(null);
      setProjectSearch('');
    }
  }, [activeEntryId, entry.id]);

  // Clear optimistic project when server data catches up
  useEffect(() => {
    if (optimisticProject) setOptimisticProject(null);
  }, [entry.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive running state from timer query (single source of truth)
  // rather than entry.stoppedAt which can be stale during query refetch
  const isRunning = timerState?.running === true && timerState.entry?.id === entry.id;
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
    claim(entry.id);
    setEditDesc(entry.description);
    setEditingField('description');
  };

  const handleEditTime = () => {
    claim(entry.id);
    setEditStartTime(formatTime(entry.startedAt));
    setEditEndTime(entry.stoppedAt ? formatTime(entry.stoppedAt) : '');
    setEditingField('time');
  };

  const handleEditProject = () => {
    claim(entry.id);
    setEditingField('project');
  };

  const handleCancel = () => {
    release(entry.id);
    setEditingField(null);
    setProjectSearch('');
  };

  const handleSaveDescription = useCallback(() => {
    release(entry.id);
    setEditingField(null);
    if (editDesc !== entry.description) {
      updateEntry.mutate({ id: entry.id, description: editDesc });
    }
    triggerSaveFlash();
  }, [editDesc, entry.description, entry.id, updateEntry, release]);

  const handleSaveTime = useCallback(() => {
    release(entry.id);
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
  }, [editStartTime, editEndTime, entry.startedAt, entry.id, isRunning, updateEntry, release]);

  const handleProjectChange = useCallback(
    (projectId: string | null) => {
      release(entry.id);
      setEditingField(null);
      setProjectSearch('');
      // Optimistic display: show new project name immediately (like flair)
      if (projectId) {
        const selected = allProjects?.find((p) => p.id === projectId);
        if (selected) {
          setOptimisticProject({
            name: selected.name,
            color: selected.color ?? '#00D4AA',
            clientName: selected.clientName ?? '',
          });
        }
      } else {
        setOptimisticProject(null);
      }
      triggerPillPop();
      // Delay mutation until after pill-pop animation completes.
      // Prevents React Query refetch from re-rendering all rows mid-animation.
      setTimeout(() => {
        updateEntry.mutate({ id: entry.id, projectId });
      }, 500);
    },
    [entry.id, updateEntry, release, allProjects],
  );

  const handlePlay = () => {
    resumeTimer.mutate(entry.id);
  };

  const handleStop = () => {
    stopTimer.mutate();
  };

  const isEditing = editingField !== null;
  const isEditingProject = editingField === 'project';

  // Use optimistic project data for display (syncs pill pop with name change)
  const displayProjectName = optimisticProject?.name ?? entry.projectName;
  const displayProjectColor = optimisticProject?.color ?? entry.projectColor;
  const displayClientName = optimisticProject?.clientName ?? entry.clientName;

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
          {editingField === 'description' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className={cn(
                'cursor-pointer truncate text-[13px] leading-5 hover:text-primary',
                noDesc ? 'italic text-muted-foreground' : isRunning ? 'text-primary' : 'text-foreground',
              )}
              onClick={handleEditDescription}
            >
              {entry.description || 'No description'}
            </motion.span>
          )}
        </div>

        {/* Project line — fixed height */}
        <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
          {isEditingProject ? (
            /* ---- Editing state: breathing pill + X + dropdown ---- */
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5"
              >
                <motion.div
                  className="flex h-[18px] cursor-pointer items-center gap-1.5 rounded-full bg-muted/40 px-2.5"
                  style={{ border: '1px solid hsl(var(--primary) / 0.4)', fontSize: scaled(11) }}
                  animate={{
                    borderColor: [
                      'hsl(var(--primary) / 0.3)',
                      'hsl(var(--primary) / 0.6)',
                      'hsl(var(--primary) / 0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  onClick={handleCancel}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
                  />
                  <span className="text-foreground">{entry.projectName || 'Select project'}</span>
                  <ChevronDown className="h-3 w-3 rotate-180 text-muted-foreground" />
                </motion.div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleCancel}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </motion.button>
              </motion.div>

              <AnimatePresence>
                <InlineProjectDropdown
                  projects={allProjects ?? []}
                  selectedId={entry.projectId}
                  search={projectSearch}
                  onSearchChange={setProjectSearch}
                  onSelect={handleProjectChange}
                  onCancel={handleCancel}
                />
              </AnimatePresence>
            </>
          ) : displayProjectName ? (
            /* ---- Display state: client · project with CSS pill-pop on confirm ---- */
            <span
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:text-primary',
                pillPop && 'pill-pop',
              )}
              style={{ fontSize: scaled(11), border: '1px solid transparent' }}
              onClick={handleEditProject}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: displayProjectColor ?? '#00D4AA' }}
              />
              <motion.span
                key={displayProjectName}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {displayClientName
                  ? `${displayClientName} · ${displayProjectName}`
                  : displayProjectName}
              </motion.span>
            </span>
          ) : (
            /* ---- No project state ---- */
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

      {/* Play/Stop button — key forces fresh DOM node so inline styles don't leak */}
      {isRunning ? (
        <motion.button
          key={`stop-${entry.id}`}
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
          key={`play-${entry.id}`}
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

/* ─── Inline project dropdown (flair-style) ─── */

function groupByClient(projects: ProjectOption[]) {
  const map = new Map<string, ProjectOption[]>();
  for (const p of projects) {
    const client = p.clientName ?? 'No Client';
    if (!map.has(client)) map.set(client, []);
    map.get(client)!.push(p);
  }
  return Array.from(map.entries()).map(([client, projectList]) => ({
    client,
    projects: projectList,
  }));
}

interface InlineProjectDropdownProps {
  projects: ProjectOption[];
  selectedId: string | null;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (projectId: string | null) => void;
  onCancel: () => void;
}

function InlineProjectDropdown({
  projects,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  onCancel,
}: InlineProjectDropdownProps) {
  const grouped = groupByClient(projects);
  const filtered = search
    ? grouped
        .map((g) => ({
          ...g,
          projects: g.projects.filter(
            (p) =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              g.client.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((g) => g.projects.length > 0)
    : grouped;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="absolute left-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-lg border border-border shadow-lg"
      style={{ background: 'hsl(var(--popover))' }}
    >
      {/* Search input */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <motion.input
            className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-[12px] text-foreground outline-none"
            style={{ border: '1px solid hsl(var(--border))' }}
            whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Project list */}
      <div className="max-h-[220px] overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
            No projects match &ldquo;{search}&rdquo;
          </div>
        ) : (
          filtered.map((group, gi) => (
            <div key={group.client}>
              <div
                className="px-2.5 pb-1 pt-2.5 font-brand text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
                style={{ letterSpacing: '1.5px', opacity: 0.6 }}
              >
                {group.client}
              </div>
              {group.projects.map((p, pi) => {
                const isSelected = p.id === selectedId;
                return (
                  <motion.button
                    key={p.id}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
                      isSelected
                        ? 'bg-primary/8 text-foreground'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                    )}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.05 + pi * 0.03, duration: 0.15 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(p.id)}
                  >
                    <motion.span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color ?? '#00D4AA' }}
                      animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                        >
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* No project option */}
      <div className="border-t border-border p-1">
        <motion.button
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(null)}
        >
          <X className="h-3 w-3" />
          <span>No project</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
