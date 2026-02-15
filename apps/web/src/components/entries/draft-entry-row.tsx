import { useState, useCallback, useEffect, useRef } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { formatDuration } from '@/lib/format';
import { useProjects } from '@/hooks/use-reference-data';
import { BreathingGlow, SaveFlash, breathingBorderAnimation, breathingBorderTransition } from '@/components/ui/breathing-glow';
import { InlineProjectDropdown } from './inline-project-dropdown';
import { useDraftEntry } from './draft-entry-context';

// When saving: fade borders + background to transparent (freeze in place)
const frozenAnimation = { borderColor: 'transparent', backgroundColor: 'transparent' };
const frozenTransition = { duration: 0.2 };

// When editing: breathing border + subtle background
const editingAnimation = { ...breathingBorderAnimation, backgroundColor: 'hsl(var(--muted) / 0.4)' };

export function DraftEntryRow() {
  const { draft, updateDraft, saveDraft, dismissDraft, isSaving, savedEntryId } = useDraftEntry();
  const { data: allProjects } = useProjects();
  const [editingProject, setEditingProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const descRef = useRef<HTMLInputElement>(null);

  // Track whether exit is from save (instant) or dismiss (animated)
  const wasSavedRef = useRef(false);
  if (savedEntryId || isSaving) wasSavedRef.current = true;
  if (draft && !savedEntryId && !isSaving) wasSavedRef.current = false; // reset when a new draft opens

  // Keep a snapshot of draft so the exit animation can render after draft becomes null
  const lastDraftRef = useRef(draft);
  if (draft) lastDraftRef.current = draft;
  const displayDraft = draft ?? lastDraftRef.current;

  // Switch to display mode IMMEDIATELY when save is clicked (isSaving = true),
  // not after POST completes. This matches regular entry save behavior.
  const isDisplayMode = isSaving || !!savedEntryId;

  const isDirty = draft ? (draft.description !== '' || draft.projectId !== null) : false;

  // Global Esc to dismiss draft — works even when focus is elsewhere
  // Disabled during save to prevent interrupting the save flow
  useEffect(() => {
    if (!draft || isDisplayMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissDraft();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [draft, dismissDraft, isDisplayMode]);

  // Blur active input when entering display mode — stops cursor blink
  useEffect(() => {
    if (isDisplayMode) {
      (document.activeElement as HTMLElement)?.blur();
    }
  }, [isDisplayMode]);

  const handleSave = useCallback(() => {
    if (!isDirty || isSaving) return;
    saveDraft();
  }, [isDirty, isSaving, saveDraft]);

  // During exit animation, draft is null but displayDraft has the snapshot
  if (!displayDraft) return null;

  // Compute duration from start/end times
  const [sh = 0, sm = 0] = displayDraft.startTime.split(':').map(Number);
  const [eh = 0, em = 0] = displayDraft.endTime.split(':').map(Number);
  const durationSec = Math.max(0, (eh * 60 + em - sh * 60 - sm) * 60);

  const selectedProject = displayDraft.projectId
    ? allProjects?.find((p) => p.id === displayDraft.projectId)
    : null;

  const handleProjectSelect = (projectId: string | null) => {
    updateDraft({ projectId });
    setEditingProject(false);
    setProjectSearch('');
    setTimeout(() => descRef.current?.focus(), 50);
  };

  const handleCancelProject = () => {
    setEditingProject(false);
    setProjectSearch('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto', overflow: 'visible', transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } }}
      exit={wasSavedRef.current
        ? { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0 } }
        : { opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }
      }
    >
      <motion.div
        className={cn(
          'group/row relative flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0',
          editingProject && !isDisplayMode && 'z-20',
        )}
        animate={{
          backgroundColor: isDisplayMode
            ? 'transparent'
            : 'hsl(var(--muted) / 0.15)',
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Incomplete entry indicator — amber left border */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
          style={{ background: 'hsl(35 100% 60%)' }}
          animate={{ opacity: isDisplayMode ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />

        {/* Breathing glow — fades with AnimatePresence.
             Wrapper must be absolute to stay out of flex flow (gap-3 would offset description). */}
        <AnimatePresence>
          {!isDisplayMode && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <BreathingGlow />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save flash — plays when transitioning to display mode */}
        <AnimatePresence>
          {isDisplayMode && <SaveFlash />}
        </AnimatePresence>

        {/* Description + project */}
        <div className="relative z-10 flex-1 min-w-0">
          {/* Description — always an input, readOnly + borders fade on save. */}
          <div className="flex h-5 items-center">
            <div className="flex w-full items-center gap-2">
              <motion.input
                ref={descRef}
                className={cn(
                  'flex-1 rounded-md px-2 text-[13px] leading-5 text-foreground outline-none',
                  !isDisplayMode && 'placeholder:text-muted-foreground/50',
                )}
                style={{ height: '20px', border: '1px solid hsl(var(--primary) / 0.4)' }}
                animate={isDisplayMode ? frozenAnimation : editingAnimation}
                transition={isDisplayMode ? frozenTransition : breathingBorderTransition}
                value={displayDraft.description}
                onChange={isDisplayMode ? undefined : (e) => updateDraft({ description: e.target.value })}
                readOnly={isDisplayMode}
                tabIndex={isDisplayMode ? -1 : undefined}
                placeholder={isDisplayMode ? undefined : 'What are you working on?'}
                autoFocus={!isDisplayMode}
                onKeyDown={isDisplayMode ? undefined : (e) => {
                  if (e.key === 'Enter' && isDirty) handleSave();
                }}
              />
            </div>
          </div>

          {/* Project line */}
          <div className="relative mt-1 flex h-[18px] items-center gap-1.5">
            {editingProject && !isDisplayMode ? (
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
                    onClick={handleCancelProject}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: selectedProject?.color ?? '#00D4AA' }}
                    />
                    <span className="text-foreground">{selectedProject?.name || 'Select project'}</span>
                    <ChevronDown className="h-3 w-3 rotate-180 text-muted-foreground" />
                  </motion.div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleCancelProject}
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-2.5 w-2.5" />
                  </motion.button>
                </motion.div>

                <AnimatePresence>
                  <InlineProjectDropdown
                    projects={allProjects ?? []}
                    selectedId={displayDraft.projectId}
                    search={projectSearch}
                    onSearchChange={setProjectSearch}
                    onSelect={handleProjectSelect}
                    onCancel={handleCancelProject}
                  />
                </AnimatePresence>
              </>
            ) : selectedProject ? (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground',
                  !isDisplayMode && 'cursor-pointer hover:text-primary',
                )}
                style={{ fontSize: scaled(11), border: '1px solid transparent' }}
                onClick={isDisplayMode ? undefined : () => setEditingProject(true)}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedProject.color ?? '#00D4AA' }}
                />
                <span>
                  {selectedProject.clientName
                    ? `${selectedProject.clientName} · ${selectedProject.name}`
                    : selectedProject.name}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  'flex items-center gap-1 text-amber-500/70',
                  !isDisplayMode && 'cursor-pointer hover:text-amber-400',
                )}
                style={{ fontSize: scaled(11) }}
                onClick={isDisplayMode ? undefined : () => setEditingProject(true)}
              >
                + Add project
              </span>
            )}
          </div>
        </div>

        {/* Time range — always two inputs, readOnly + borders fade on save */}
        <div className="relative z-10 flex h-5 items-center gap-1 text-right shrink-0">
          <motion.input
            className="h-5 w-[48px] rounded-md px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
            style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
            animate={isDisplayMode ? frozenAnimation : editingAnimation}
            transition={isDisplayMode ? frozenTransition : breathingBorderTransition}
            value={displayDraft.startTime}
            onChange={isDisplayMode ? undefined : (e) => updateDraft({ startTime: e.target.value })}
            readOnly={isDisplayMode}
            tabIndex={isDisplayMode ? -1 : undefined}
          />
          <span className="text-[11px] text-muted-foreground">&ndash;</span>
          <motion.input
            className="h-5 w-[48px] rounded-md px-1 text-center text-[11px] tabular-nums text-foreground outline-none"
            style={{ border: '1px solid hsl(var(--primary) / 0.4)' }}
            animate={isDisplayMode ? frozenAnimation : editingAnimation}
            transition={isDisplayMode ? frozenTransition : breathingBorderTransition}
            value={displayDraft.endTime}
            onChange={isDisplayMode ? undefined : (e) => updateDraft({ endTime: e.target.value })}
            readOnly={isDisplayMode}
            tabIndex={isDisplayMode ? -1 : undefined}
            onKeyDown={isDisplayMode ? undefined : (e) => {
              if (e.key === 'Enter' && isDirty) handleSave();
            }}
          />
        </div>

        {/* Duration — always formatDuration (matches EntryRow's format) */}
        <motion.span
          className="relative z-10 font-brand text-sm font-semibold tabular-nums shrink-0"
          animate={{ color: isDisplayMode ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
          transition={{ duration: 0.2 }}
        >
          {formatDuration(durationSec)}
        </motion.span>

        {/* Confirm & dismiss buttons — invisible but space-preserving when in display mode */}
        <motion.button
          whileTap={isDisplayMode ? undefined : { scale: 0.85 }}
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30"
          animate={{ opacity: isDisplayMode ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          style={isDisplayMode ? { pointerEvents: 'none' } : undefined}
        >
          <Check className="h-3 w-3" />
        </motion.button>
        <motion.button
          whileTap={isDisplayMode ? undefined : { scale: 0.85 }}
          onClick={dismissDraft}
          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          animate={{ opacity: isDisplayMode ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          style={isDisplayMode ? { pointerEvents: 'none' } : undefined}
        >
          <X className="h-3.5 w-3.5" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
