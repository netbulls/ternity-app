import { THEMES, type ThemeId } from '@ternity/shared';
import { useTheme } from '@/providers/theme-provider';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Settings</h1>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Theme</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ThemeId)}
              className={cn(
                'rounded-lg border px-3.5 py-1.5 text-[12px] transition-all',
                theme === t.id
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {t.name}
              {t.badge ? ` (${t.badge})` : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
