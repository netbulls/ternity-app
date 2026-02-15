import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateEntry } from '@/hooks/use-entries';
import { useActiveEdit } from './active-edit-context';

const DRAFT_SENTINEL = '__draft__';

interface DraftState {
  date: string;          // YYYY-MM-DD
  description: string;
  projectId: string | null;
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
}

interface DraftEntryContextValue {
  draft: DraftState | null;
  openDraft: (date: string) => void;
  dismissDraft: () => void;
  updateDraft: (fields: Partial<DraftState>) => void;
  saveDraft: () => void;
  isSaving: boolean;
  /** ID of the entry being saved — used to prevent double-row during refetch */
  savedEntryId: string | null;
  /** ID of entry that was just created — EntryRow uses this to show a brief glow */
  justCreatedId: string | null;
}

const DraftEntryContext = createContext<DraftEntryContextValue>({
  draft: null,
  openDraft: () => {},
  dismissDraft: () => {},
  updateDraft: () => {},
  saveDraft: () => {},
  isSaving: false,
  savedEntryId: null,
  justCreatedId: null,
});

function nowHHMM(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function DraftEntryProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const justCreatedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { activeEntryId, claim, release } = useActiveEdit();
  const createEntry = useCreateEntry();
  const queryClient = useQueryClient();

  const openDraft = useCallback(
    (date: string) => {
      // If any editor is open (draft or real entry), do nothing
      if (activeEntryId !== null) return;

      setSavedEntryId(null);
      const time = nowHHMM();
      setDraft({ date, description: '', projectId: null, startTime: time, endTime: time });
      claim(DRAFT_SENTINEL);
    },
    [activeEntryId, claim],
  );

  const dismissDraft = useCallback(() => {
    setDraft(null);
    release(DRAFT_SENTINEL);
  }, [release]);

  const updateDraft = useCallback((fields: Partial<DraftState>) => {
    setDraft((prev) => (prev ? { ...prev, ...fields } : null));
  }, []);

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    const startISO = `${draft.date}T${draft.startTime}:00`;
    const endISO = `${draft.date}T${draft.endTime}:00`;
    try {
      // Create entry and get back the new ID
      const newEntry = await createEntry.mutateAsync({
        description: draft.description,
        projectId: draft.projectId,
        labelIds: [],
        startedAt: startISO,
        stoppedAt: endISO,
      });
      // Mark as saved — DraftEntryRow switches to display mode + SaveFlash,
      // and DayGroup filters this ID from group.entries to prevent double-row
      setSavedEntryId(newEntry.id);
      // Hook's onSuccess already called invalidateQueries — wait for refetch
      // so the new EntryRow data is in the cache before we remove the draft
      await queryClient.refetchQueries({ queryKey: ['entries'] });
      // Now clear everything — the real EntryRow is ready in the cache
      setDraft(null);
      setSavedEntryId(null);
      release(DRAFT_SENTINEL);
      // Set justCreatedId so EntryRow can show a brief glow on mount
      clearTimeout(justCreatedTimerRef.current);
      setJustCreatedId(newEntry.id);
      justCreatedTimerRef.current = setTimeout(() => setJustCreatedId(null), 800);
    } catch {
      // mutation failed — keep draft open, user can retry
    }
  }, [draft, createEntry, release, queryClient]);

  const value = useMemo(
    () => ({ draft, openDraft, dismissDraft, updateDraft, saveDraft, isSaving: createEntry.isPending, savedEntryId, justCreatedId }),
    [draft, openDraft, dismissDraft, updateDraft, saveDraft, createEntry.isPending, savedEntryId, justCreatedId],
  );

  return (
    <DraftEntryContext.Provider value={value}>
      {children}
    </DraftEntryContext.Provider>
  );
}

export const useDraftEntry = () => useContext(DraftEntryContext);
export { DRAFT_SENTINEL };
