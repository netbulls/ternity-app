import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ternity-default-project';

/** Sync read — use for one-time initialization (timer bar, manual entry, draft). */
export function getDefaultProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Reactive hook — use in Settings page where the UI must reflect changes. */
export function useDefaultProject() {
  const [defaultProjectId, setDefaultProjectIdState] = useState<string | null>(
    getDefaultProjectId,
  );

  const setDefaultProject = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage full or unavailable — update state anyway
    }
    setDefaultProjectIdState(id);
  }, []);

  return { defaultProjectId, setDefaultProject } as const;
}
