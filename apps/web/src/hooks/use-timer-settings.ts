import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ternity-confirm-timer-switch';

/** Sync read — use in event handlers (entry-row click) where a hook can't be called. */
export function getConfirmTimerSwitch(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default is true (confirm enabled) when no preference stored
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

/** Reactive hook — use in Settings page where the UI must reflect changes. */
export function useTimerSettings() {
  const [confirmSwitch, setConfirmSwitchState] = useState<boolean>(getConfirmTimerSwitch);

  const setConfirmSwitch = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // storage full or unavailable — update state anyway
    }
    setConfirmSwitchState(value);
  }, []);

  return { confirmSwitch, setConfirmSwitch } as const;
}
