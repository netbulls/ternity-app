import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Check,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  History,
  ChevronDown,
  Clock,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useUpdateEntry, useDeleteEntry, useRestoreEntry, useMoveBlock } from '@/hooks/use-entries';
import { useTimer, useResumeTimer, useStopTimer, useElapsedSeconds } from '@/hooks/use-timer';
import { useLinkJiraIssue, useJiraConnections, resolveJiraProject } from '@/hooks/use-jira';
import { formatTime, formatDuration } from '@/lib/format';
import { scaled } from '@/lib/scaled';
import { useProjects } from '@/hooks/use-reference-data';
import {
  BreathingGlow,
  SaveFlash,
  breathingBorderAnimation,
  breathingBorderTransition,
} from '@/components/ui/breathing-glow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AuditPanel } from './audit-panel';
import { InlineProjectDropdown } from './inline-project-dropdown';
import { AdjustEntryDialog } from './adjust-entry-dialog';
import { SplitEntryDialog } from './split-entry-dialog';
import { SwitchTimerDialog } from './switch-timer-dialog';
import { TimeBlockDrawer } from './time-block-drawer';
import { JiraChip } from '@/components/jira/jira-chip';
import { JiraIcon } from '@/components/jira/jira-icon';
import { JiraSearchDropdown } from '@/components/jira/jira-search-dropdown';
import { HashAutocomplete } from '@/components/jira/hash-autocomplete';
import { getPreference, setPreference } from '@/providers/preferences-provider';
import type { Entry, JiraIssue } from '@ternity/shared';
import { useActiveEdit } from './active-edit-context';
import { useDraftEntry } from './draft-entry-context';

type EditingField = 'description' | 'project' | null;

/* Pill-pop uses a CSS keyframe animation (globals.css) — runs on compositor thread,
   immune to React Query re-render jitter that breaks framer motion keyframes. */

interface Props {
  entry: Entry;
}

export function EntryRow({ entry }: Props) {
  const { data: timerState } = useTimer();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const restoreEntry = useRestoreEntry();
  const moveBlock = useMoveBlock();
  const resumeTimer = useResumeTimer();
  const stopTimer = useStopTimer();
  const linkJira = useLinkJiraIssue();
  const { data: jiraConnections } = useJiraConnections();
  const hasJira = (jiraConnections?.length ?? 0) > 0;

  const [editingField, setEditingField] = useState<EditingField>(null);
  const [jiraDropdownOpen, setJiraDropdownOpen] = useState(false);
  const [hashTrigger, setHashTrigger] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pillPop, setPillPop] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [stopAndSplitConfirmOpen, setStopAndSplitConfirmOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blocksExpanded, setBlocksExpanded] = useState(false);
  const [optimisticProject, setOptimisticProject] = useState<{
    name: string;
    color: string;
    clientName: string;
  } | null>(null);
  const { data: allProjects } = useProjects();
  const { activeEntryId, claim, release } = useActiveEdit();
  const { justCreatedId } = useDraftEntry();
  const editingFieldRef = useRef(editingField);
  editingFieldRef.current = editingField;

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
  const isRunning = timerState?.running === true && timerState.entry?.id === entry.id;

  // Compute elapsed from segments
  const completedDuration = entry.segments
    .filter((s) => s.durationSeconds != null)
    .reduce((sum, s) => sum + s.durationSeconds!, 0);
  const runningSegment = entry.segments.find((s) => s.type === 'clocked' && !s.stoppedAt);
  const elapsed = useElapsedSeconds(
    runningSegment?.startedAt ?? null,
    isRunning,
    completedDuration,
  );

  const isDeleted = !entry.isActive;
  const noProject = !entry.projectId;
  const noDesc = !entry.description;

  // Timed segments for time range display (clocked + manual entries with startedAt)
  const timedSegments = entry.segments.filter((s) => s.startedAt != null);
  const firstTimed = timedSegments[0];
  const lastTimed = timedSegments[timedSegments.length - 1];

  const durationStr = isRunning
    ? formatDuration(elapsed)
    : formatDuration(entry.totalDurationSeconds);

  const timeRange = firstTimed
    ? isRunning
      ? `${formatTime(firstTimed.startedAt!)} – now`
      : `${formatTime(firstTimed.startedAt!)} – ${formatTime(lastTimed?.stoppedAt ?? firstTimed.startedAt!)}`
    : '';

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
    if (isDeleted) return;
    claim(entry.id);
    setEditDesc(entry.description);
    setEditingField('description');
  };

  const handleEditProject = () => {
    if (isDeleted) return;
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
      updateEntry.mutate({ id: entry.id, description: editDesc, source: 'inline_edit' });
    }
    triggerSaveFlash();
  }, [editDesc, entry.description, entry.id, updateEntry, release]);

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
        updateEntry.mutate({ id: entry.id, projectId, source: 'inline_edit' });
      }, 500);
    },
    [entry.id, updateEntry, release, allProjects],
  );

  const handlePlay = () => {
    // If another timer is running and user wants confirmation, show dialog
    if (
      timerState?.running &&
      timerState.entry?.id !== entry.id &&
      getPreference('confirmTimerSwitch')
    ) {
      setSwitchDialogOpen(true);
      return;
    }
    resumeTimer.mutate(entry.id);
  };

  const handleSwitchConfirm = (dontAskAgain: boolean) => {
    if (dontAskAgain) {
      setPreference('confirmTimerSwitch', false);
    }
    setSwitchDialogOpen(false);
    resumeTimer.mutate(entry.id);
  };

  const handleStop = () => {
    stopTimer.mutate();
  };

  const handleMoveBlock = (segmentId: string) => {
    moveBlock.mutate(
      { entryId: entry.id, segmentId },
      { onSuccess: () => setBlocksExpanded(false) },
    );
  };

  // Jira handlers
  const handleJiraIssueSelect = useCallback(
    (issue: JiraIssue, connectionId: string, _siteUrl: string) => {
      const resolvedProjectId = resolveJiraProject(
        jiraConnections,
        connectionId,
        issue.key,
        getPreference('defaultProjectId'),
      );
      linkJira.mutate({
        entryId: entry.id,
        jiraIssueKey: issue.key,
        jiraIssueSummary: issue.summary,
        jiraConnectionId: connectionId,
      });
      // Also update the entry's project based on Jira mapping
      if (resolvedProjectId && resolvedProjectId !== entry.projectId) {
        updateEntry.mutate({ id: entry.id, projectId: resolvedProjectId, source: 'jira_link' });
      }
      setJiraDropdownOpen(false);
      setHashTrigger(null);
    },
    [entry.id, entry.projectId, linkJira, updateEntry, jiraConnections],
  );

  const handleJiraUnlink = useCallback(() => {
    linkJira.mutate({
      entryId: entry.id,
      jiraIssueKey: null,
      jiraIssueSummary: null,
      jiraConnectionId: null,
    });
  }, [entry.id, linkJira]);

  // Close jira dropdown/autocomplete on outside click
  const jiraWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jiraDropdownOpen && hashTrigger === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (jiraWrapperRef.current && !jiraWrapperRef.current.contains(e.target as Node)) {
        setJiraDropdownOpen(false);
        setHashTrigger(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [jiraDropdownOpen, hashTrigger]);

  const isEditing = editingField !== null;
  const isEditingProject = editingField === 'project';

  const hasMultipleBlocks = entry.segments.length > 1;

  // Use optimistic project data for display (syncs pill pop with name change)
  const displayProjectName = optimisticProject?.name ?? entry.projectName;
  const displayProjectColor = optimisticProject?.color ?? entry.projectColor;
  const displayClientName = optimisticProject?.clientName ?? entry.clientName;

  return (
    <div className={cn('border-b border-border last:border-b-0', isDeleted && 'opacity-60')}>
      <motion.div
        className={cn(
          'group/row relative flex items-center gap-3 px-4 py-2.5',
          (isEditingProject || jiraDropdownOpen) && 'z-20',
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
        {/* Left border indicator — amber for incomplete, teal for running */}
        <AnimatePresence>
          {(isRunning || noProject || noDesc) && (
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
              style={{
                background: noProject || noDesc ? 'hsl(35 100% 60%)' : 'hsl(var(--primary))',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            />
          )}
        </AnimatePresence>

        {/* E2 Alive — breathing glow on editing row */}
        {isEditing && <BreathingGlow />}

        {/* Save flash — also shown briefly when entry was just created from a draft */}
        <AnimatePresence>
          {(savedFlash || entry.id === justCreatedId) && <SaveFlash />}
        </AnimatePresence>

        {/* Description + project */}
        <div ref={jiraWrapperRef} className="relative z-10 flex-1 min-w-0">
          {/* Description — fixed height */}
          <div className="flex h-5 items-center gap-1.5">
            {editingField === 'description' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative flex w-full items-center gap-2"
              >
                <motion.input
                  className="flex-1 rounded-md bg-muted/40 px-2 text-[13px] leading-5 text-foreground outline-none"
                  style={{ height: '20px', border: '1px solid hsl(var(--primary) / 0.4)' }}
                  animate={breathingBorderAnimation}
                  transition={breathingBorderTransition}
                  value={editDesc}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditDesc(val);
                    // Detect # trigger
                    const hashIdx = val.lastIndexOf('#');
                    if (hashIdx >= 0 && (hashIdx === 0 || val[hashIdx - 1] === ' ')) {
                      const afterHash = val.substring(hashIdx + 1);
                      if (!afterHash.includes(' ')) {
                        setHashTrigger(afterHash);
                        return;
                      }
                    }
                    setHashTrigger(null);
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDescription();
                    if (e.key === 'Escape') {
                      handleCancel();
                      setHashTrigger(null);
                    }
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
                  onClick={() => {
                    handleCancel();
                    setHashTrigger(null);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </motion.button>

                {/* Hash autocomplete overlay */}
                <AnimatePresence>
                  {hashTrigger !== null && (
                    <HashAutocomplete
                      query={hashTrigger}
                      onSelect={(issue, connectionId, siteUrl) => {
                        // Replace #query with issue summary
                        const hashIdx = editDesc.lastIndexOf('#');
                        const newDesc =
                          hashIdx >= 0
                            ? editDesc.substring(0, hashIdx) + issue.summary
                            : issue.summary;
                        setEditDesc(newDesc);
                        setHashTrigger(null);
                        handleJiraIssueSelect(issue, connectionId, siteUrl);
                      }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <>
                {/* Jira chip before description when linked */}
                {entry.jiraIssue && (
                  <JiraChip issue={entry.jiraIssue} onUnlink={handleJiraUnlink} compact />
                )}
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  className={cn(
                    'cursor-pointer truncate text-[13px] leading-5 hover:text-primary',
                    noDesc
                      ? 'italic text-muted-foreground'
                      : isRunning
                        ? 'text-primary'
                        : 'text-foreground',
                  )}
                  onClick={handleEditDescription}
                >
                  {entry.description || 'No description'}
                </motion.span>
                {/* Jira icon button — visible on hover when no issue linked and Jira is connected */}
                {hasJira && !entry.jiraIssue && !isDeleted && (
                  <button
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-primary group-hover/row:opacity-100"
                    onClick={() => setJiraDropdownOpen((v) => !v)}
                    title="Link Jira issue"
                  >
                    <JiraIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Jira search dropdown */}
          <AnimatePresence>
            {jiraDropdownOpen && (
              <JiraSearchDropdown
                onSelect={handleJiraIssueSelect}
                onClose={() => setJiraDropdownOpen(false)}
              />
            )}
          </AnimatePresence>

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

        {/* Block count badge — expand trigger */}
        {hasMultipleBlocks && (
          <button
            onClick={() => setBlocksExpanded(!blocksExpanded)}
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 font-brand tabular-nums transition-all',
              blocksExpanded
                ? 'border-primary/40 bg-primary/8 text-primary'
                : 'border-border/50 text-muted-foreground/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
            )}
            style={{ fontSize: scaled(10) }}
          >
            <Layers className="h-3 w-3" />
            {entry.segments.length}
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                blocksExpanded && 'rotate-180',
              )}
            />
          </button>
        )}

        {/* Time range — read-only display */}
        <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
          <span
            className={cn(
              'text-[11px] tabular-nums',
              isRunning ? 'text-primary/70' : 'text-muted-foreground',
            )}
          >
            {timeRange}
          </span>
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

        {/* Play/Stop button — hidden for deleted entries */}
        {!isDeleted &&
          (isRunning ? (
            <motion.button
              key={`stop-${entry.id}`}
              className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'hsl(var(--destructive) / 0.1)',
                color: 'hsl(var(--destructive))',
              }}
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
          ))}

        {/* More actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/row:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isDeleted ? (
              <>
                <DropdownMenuItem onClick={() => restoreEntry.mutate(entry.id)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAuditOpen(true)}>
                  <History className="mr-2 h-3.5 w-3.5" />
                  View history
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setAdjustOpen(true)}>
                  <Clock className="mr-2 h-3.5 w-3.5" />
                  Add adjustment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (isRunning) {
                      setStopAndSplitConfirmOpen(true);
                    } else {
                      setSplitOpen(true);
                    }
                  }}
                >
                  <Clock className="mr-2 h-3.5 w-3.5" />
                  Split off time
                </DropdownMenuItem>
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
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <AuditPanel entry={entry} open={auditOpen} onOpenChange={setAuditOpen} />
        <AdjustEntryDialog entry={entry} open={adjustOpen} onOpenChange={setAdjustOpen} />
        <SplitEntryDialog entry={entry} open={splitOpen} onOpenChange={setSplitOpen} />
        {timerState?.entry && (
          <SwitchTimerDialog
            open={switchDialogOpen}
            onOpenChange={setSwitchDialogOpen}
            stoppingEntry={timerState.entry}
            startingEntry={entry}
            onConfirm={handleSwitchConfirm}
          />
        )}

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This entry will be moved to the trash. You can restore it later from the Deleted
                filter.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteEntry.mutate({ id: entry.id, source: 'inline_edit' })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={stopAndSplitConfirmOpen} onOpenChange={setStopAndSplitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Stop timer to split?</AlertDialogTitle>
              <AlertDialogDescription>
                This entry is currently running. The timer will be stopped before splitting off
                time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  stopTimer.mutate(undefined, {
                    onSuccess: () => setSplitOpen(true),
                  });
                }}
              >
                Stop &amp; Split
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      {/* Time block drawer — accordion below the entry row */}
      <AnimatePresence>
        {blocksExpanded && <TimeBlockDrawer entry={entry} onMoveBlock={handleMoveBlock} />}
      </AnimatePresence>
    </div>
  );
}
