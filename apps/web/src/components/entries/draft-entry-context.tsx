import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateEntry } from '@/hooks/use-entries';
import { getDefaultProjectId } from '@/hooks/use-default-project';
import { ORG_TIMEZONE } from '@ternity/shared';
import { orgTimeToISO } from '@/lib/format';
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
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
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
      setDraft({ date, description: '', projectId: getDefaultProjectId(), startTime: time, endTime: time });
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
    const dateParts = draft.date.split('-').map(Number);
    const year = dateParts[0] ?? 2026;
    const month = (dateParts[1] ?? 1) - 1;
    const day = dateParts[2] ?? 1;
    const sp = draft.startTime.split(':').map(Number);
    const ep = draft.endTime.split(':').map(Number);
    const startISO = orgTimeToISO(year, month, day, sp[0] ?? 0, sp[1] ?? 0);
    // Cross-midnight: if end time < start time, end is next day
    const endDay = draft.endTime < draft.startTime ? day + 1 : day;
    const endISO = orgTimeToISO(year, month, endDay, ep[0] ?? 0, ep[1] ?? 0);
    try {
      // Create entry and get back the new ID
      const newEntry = await createEntry.mutateAsync({
        description: draft.description,
        projectId: draft.projectId,
        labelIds: [],
        startedAt: startISO,
        stoppedAt: endISO,
        note: 'Manual entry',
        source: 'draft',
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
