import { THEMES, type ThemeId } from '@ternity/shared';
import { useTheme } from '@/providers/theme-provider';
import { SCALES, useScale } from '@/providers/scale-provider';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { scale, setScale } = useScale();

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

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Scale</h2>
        <div className="flex flex-wrap gap-2">
          {SCALES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScale(s.value)}
              className={cn(
                'rounded-lg border px-3.5 py-1.5 text-[12px] transition-all',
                scale === s.value
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-brand text-[calc(18px*var(--t-scale,1.1)/1.1)] font-semibold text-foreground">
            Timer &amp; Entries
          </p>
          <p className="font-brand mt-1 text-[calc(22px*var(--t-scale,1.1)/1.1)] font-bold text-foreground">
            14h 52m
          </p>
          <p className="mt-1 text-[calc(13px*var(--t-scale,1.1)/1.1)] text-muted-foreground">
            Weekly summary across all projects and labels.
          </p>
          <p className="font-brand mt-1 text-[calc(10px*var(--t-scale,1.1)/1.1)] font-normal uppercase tracking-wider text-muted-foreground">
            This week
          </p>
        </div>
      </div>
    </div>
  );
}
