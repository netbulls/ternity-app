import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ActiveEditContextValue {
  activeEntryId: string | null;
  claim: (entryId: string) => void;
  release: (entryId: string) => void;
}

const ActiveEditContext = createContext<ActiveEditContextValue>({
  activeEntryId: null,
  claim: () => {},
  release: () => {},
});

export function ActiveEditProvider({ children }: { children: ReactNode }) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  const claim = useCallback((entryId: string) => {
    setActiveEntryId(entryId);
  }, []);

  const release = useCallback((entryId: string) => {
    setActiveEntryId((prev) => (prev === entryId ? null : prev));
  }, []);

  return (
    <ActiveEditContext.Provider value={{ activeEntryId, claim, release }}>
      {children}
    </ActiveEditContext.Provider>
  );
}

export const useActiveEdit = () => useContext(ActiveEditContext);
