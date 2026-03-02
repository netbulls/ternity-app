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
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const ids = entryIdsRef.current;
      if (ids.length === 0) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        // Nothing selected yet — pick first (ArrowDown) or last (ArrowUp)
        if (!selectedEntryId) {
          const initial = e.key === 'ArrowDown' ? ids[0] : ids[ids.length - 1];
          if (initial) setSelectedEntryId(initial);
          return;
        }

        const currentIdx = ids.indexOf(selectedEntryId);
        if (currentIdx === -1) return;

        const nextIdx =
          e.key === 'ArrowUp'
            ? Math.max(0, currentIdx - 1)
            : Math.min(ids.length - 1, currentIdx + 1);

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
