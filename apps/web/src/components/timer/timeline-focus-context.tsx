import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

interface TimelineFocusContextValue {
  /** Entry ID hovered on the timeline (transient — clears on mouse leave) */
  hoveredEntryId: string | null;
  /** Entry ID selected by clicking the timeline or keyboard nav (persistent) */
  selectedEntryId: string | null;
  /** Set the hovered entry (from timeline hover) */
  setHovered: (entryId: string | null) => void;
  /** Select an entry (from timeline click) */
  select: (entryId: string) => void;
  /** Clear selection (Esc or clicking elsewhere) */
  clearSelection: () => void;
  /** Select the first entry in the list (used after day navigation) */
  selectFirst: () => void;
  /** Register the ordered list of entry IDs (called by DayGroup) */
  setEntryIds: (ids: string[]) => void;
  /** Register a callback for Enter key on the selected entry (called by EntryRow) */
  registerEnterHandler: (entryId: string, handler: (() => void) | null) => void;
}

const TimelineFocusContext = createContext<TimelineFocusContextValue>({
  hoveredEntryId: null,
  selectedEntryId: null,
  setHovered: () => {},
  select: () => {},
  clearSelection: () => {},
  selectFirst: () => {},
  setEntryIds: () => {},
  registerEnterHandler: () => {},
});

export function TimelineFocusProvider({ children }: { children: ReactNode }) {
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const entryIdsRef = useRef<string[]>([]);
  const enterHandlersRef = useRef<Map<string, () => void>>(new Map());

  const setHovered = useCallback((entryId: string | null) => {
    setHoveredEntryId(entryId);
  }, []);

  const select = useCallback((entryId: string) => {
    setSelectedEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntryId(null);
  }, []);

  const selectFirst = useCallback(() => {
    const ids = entryIdsRef.current;
    if (ids.length > 0) {
      setSelectedEntryId(ids[0]!);
    }
  }, []);

  const setEntryIds = useCallback((ids: string[]) => {
    entryIdsRef.current = ids;
  }, []);

  const registerEnterHandler = useCallback((entryId: string, handler: (() => void) | null) => {
    if (handler) {
      enterHandlersRef.current.set(entryId, handler);
    } else {
      enterHandlersRef.current.delete(entryId);
    }
  }, []);

  // Keyboard navigation: up/down arrows move selection between entries
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs or when a dialog/overlay is open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (target.closest('[role="dialog"], [role="alertdialog"]')) {
        return;
      }

      const ids = entryIdsRef.current;
      if (ids.length === 0) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Nothing selected (day level) — only ArrowDown enters the list
        if (!selectedEntryId) {
          if (e.key === 'ArrowDown' && ids[0]) {
            setSelectedEntryId(ids[0]);
          }
          return;
        }

        const currentIdx = ids.indexOf(selectedEntryId);
        if (currentIdx === -1) return;

        if (e.key === 'ArrowUp' && currentIdx === 0) {
          // At the top item — go back to day level
          setSelectedEntryId(null);
          return;
        }

        const nextIdx =
          e.key === 'ArrowUp' ? currentIdx - 1 : Math.min(ids.length - 1, currentIdx + 1);

        if (nextIdx !== currentIdx) {
          setSelectedEntryId(ids[nextIdx]!);
        }
      } else if (e.key === 'Enter' && selectedEntryId) {
        e.preventDefault();
        const handler = enterHandlersRef.current.get(selectedEntryId);
        if (handler) handler();
      } else if (e.key === 'Escape') {
        setSelectedEntryId(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntryId]);

  return (
    <TimelineFocusContext.Provider
      value={{
        hoveredEntryId,
        selectedEntryId,
        setHovered,
        select,
        clearSelection,
        selectFirst,
        setEntryIds,
        registerEnterHandler,
      }}
    >
      {children}
    </TimelineFocusContext.Provider>
  );
}

export const useTimelineFocus = () => useContext(TimelineFocusContext);

/** Sentinel ID used to include the timer bar in keyboard navigation */
export const TIMER_BAR_ID = '__timer__';
