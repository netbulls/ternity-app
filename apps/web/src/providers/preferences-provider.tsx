import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  THEMES,
  DEFAULT_THEME,
  type ThemeId,
  type ThemeMeta,
  type UserPreferences,
  type UserPreferencesPatch,
} from '@ternity/shared';
import { apiFetch } from '@/lib/api';

export const SCALES = [
  { label: 'Compact', value: 0.9 },
  { label: 'Default', value: 1.1 },
  { label: 'Comfortable', value: 1.2 },
] as const;

export type ScaleMeta = (typeof SCALES)[number];

const STORAGE_KEY = 'ternity-preferences';
const DEFAULT_SCALE = 1.1;

// Old localStorage keys for migration
const OLD_KEYS = {
  theme: 'ternity-theme',
  scale: 'ternity-scale',
  confirmTimerSwitch: 'ternity-confirm-timer-switch',
  defaultProject: 'ternity-default-project',
} as const;

interface PreferencesContextValue {
  theme: ThemeId;
  themeMeta: ThemeMeta;
  setTheme: (theme: ThemeId) => void;
  scale: number;
  scaleMeta: ScaleMeta;
  setScale: (value: number) => void;
  confirmTimerSwitch: boolean;
  setConfirmTimerSwitch: (value: boolean) => void;
  defaultProjectId: string | null;
  setDefaultProject: (id: string | null) => void;
  tagsEnabled: boolean;
  setTagsEnabled: (value: boolean) => void;
  syncFromServer: (prefs: UserPreferences) => void;
  refreshFromServer: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStoredPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserPreferences;
    }
  } catch {
    // corrupt JSON — fall through to migration
  }

  // Migrate from old individual keys
  const migrated: UserPreferences = {
    theme: DEFAULT_THEME,
    scale: DEFAULT_SCALE,
    confirmTimerSwitch: true,
    defaultProjectId: null,
    tagsEnabled: false,
  };

  try {
    const oldTheme = localStorage.getItem(OLD_KEYS.theme);
    if (oldTheme && THEMES.some((t) => t.id === oldTheme)) {
      migrated.theme = oldTheme as ThemeId;
    }

    const oldScale = localStorage.getItem(OLD_KEYS.scale);
    if (oldScale) {
      const parsed = parseFloat(oldScale);
      if (SCALES.some((s) => s.value === parsed)) migrated.scale = parsed;
    }

    const oldConfirm = localStorage.getItem(OLD_KEYS.confirmTimerSwitch);
    if (oldConfirm !== null) {
      migrated.confirmTimerSwitch = oldConfirm === 'true';
    }

    const oldProject = localStorage.getItem(OLD_KEYS.defaultProject);
    if (oldProject) {
      migrated.defaultProjectId = oldProject;
    }

    // Write migrated preferences and clean up old keys
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    for (const key of Object.values(OLD_KEYS)) {
      localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable — use defaults
  }

  return migrated;
}

function writePreferences(prefs: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage full or unavailable
  }
}

function applyThemeCSS(theme: ThemeId, themeMeta: ThemeMeta) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', themeMeta.type === 'dark');
}

function applyScaleCSS(scale: number) {
  document.documentElement.style.setProperty('--t-scale', String(scale));
}

/**
 * Sync setter for non-React contexts (event handlers where hooks can't be called).
 * Writes to localStorage AND dispatches a custom event so the PreferencesProvider
 * picks up the change (updates React state + pushes to server).
 */
export function setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prefs: UserPreferences = raw
      ? (JSON.parse(raw) as UserPreferences)
      : {
          theme: DEFAULT_THEME,
          scale: DEFAULT_SCALE,
          confirmTimerSwitch: true,
          defaultProjectId: null,
          tagsEnabled: false,
        };
    prefs[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('ternity-pref-change', { detail: { key, value } }));
  } catch {
    // storage unavailable
  }
}

/** Sync getter for non-React contexts (event handlers, etc.) */
export function getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const prefs = JSON.parse(raw) as UserPreferences;
      return prefs[key];
    }
  } catch {
    // fall through
  }
  // Defaults
  const defaults: UserPreferences = {
    theme: DEFAULT_THEME,
    scale: DEFAULT_SCALE,
    confirmTimerSwitch: true,
    defaultProjectId: null,
    tagsEnabled: false,
  };
  return defaults[key];
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(readStoredPreferences);
  // Track whether initial server sync has happened — only push changes after that
  const hasSynced = useRef(false);
  // Accumulate pending changes for debounced PATCH
  const pendingPatch = useRef<UserPreferencesPatch>({});
  const patchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const themeMeta = THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0]!;
  const scaleMeta = SCALES.find((s) => s.value === prefs.scale) ?? SCALES[1]!;

  // Apply CSS side effects on every change
  useEffect(() => {
    applyThemeCSS(prefs.theme as ThemeId, themeMeta);
  }, [prefs.theme, themeMeta]);

  useEffect(() => {
    applyScaleCSS(prefs.scale);
  }, [prefs.scale]);

  const patchServer = useCallback((patch: UserPreferencesPatch) => {
    if (!hasSynced.current) return;
    // Merge into pending and debounce — collapses rapid changes into one PATCH
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => {
      const toSend = pendingPatch.current;
      pendingPatch.current = {};
      apiFetch('/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify(toSend),
      }).catch(() => {
        // Silent — local state is already updated
      });
    }, 300);
  }, []);

  const updatePref = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        writePreferences(next);
        return next;
      });
      patchServer({ [key]: value } as UserPreferencesPatch);
    },
    [patchServer],
  );

  // Listen for sync setPreference() calls from non-React contexts
  useEffect(() => {
    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail;
      updatePref(key, value);
    };
    window.addEventListener('ternity-pref-change', handler);
    return () => window.removeEventListener('ternity-pref-change', handler);
  }, [updatePref]);

  const setTheme = useCallback((theme: ThemeId) => updatePref('theme', theme), [updatePref]);
  const setScale = useCallback((value: number) => updatePref('scale', value), [updatePref]);
  const setConfirmTimerSwitch = useCallback(
    (value: boolean) => updatePref('confirmTimerSwitch', value),
    [updatePref],
  );
  const setDefaultProject = useCallback(
    (id: string | null) => updatePref('defaultProjectId', id),
    [updatePref],
  );
  const setTagsEnabled = useCallback(
    (value: boolean) => updatePref('tagsEnabled', value),
    [updatePref],
  );

  const syncFromServer = useCallback((serverPrefs: UserPreferences) => {
    setPrefs(serverPrefs);
    writePreferences(serverPrefs);
    hasSynced.current = true;
  }, []);

  const refreshFromServer = useCallback(() => {
    apiFetch<UserPreferences>('/user/preferences')
      .then(syncFromServer)
      .catch(() => {
        /* silent */
      });
  }, [syncFromServer]);

  return (
    <PreferencesContext.Provider
      value={{
        theme: prefs.theme as ThemeId,
        themeMeta,
        setTheme,
        scale: prefs.scale,
        scaleMeta,
        setScale,
        confirmTimerSwitch: prefs.confirmTimerSwitch,
        setConfirmTimerSwitch,
        defaultProjectId: prefs.defaultProjectId,
        setDefaultProject,
        tagsEnabled: prefs.tagsEnabled,
        setTagsEnabled,
        syncFromServer,
        refreshFromServer,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
