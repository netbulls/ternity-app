import { Link, useLocation } from 'react-router-dom';
import { THEMES, type ThemeId } from '@ternity/shared';
import { useTheme } from '@/providers/theme-provider';
import { SCALES, useScale } from '@/providers/scale-provider';

export function DevToolbar() {
  const { theme, setTheme } = useTheme();
  const { scale: activeScale, setScale: onScaleChange } = useScale();
  const { pathname } = useLocation();

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <Link
          to="/dev"
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            pathname === '/dev'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          Catalog
        </Link>
        <Link
          to="/dev/lab"
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            pathname === '/dev/lab'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          Lab
        </Link>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-2">
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </span>
        <div className="flex flex-wrap gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ThemeId)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                theme === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-2">
        <span className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Scale
        </span>
        <div className="flex gap-1">
          {SCALES.map((s) => (
            <button
              key={s.label}
              onClick={() => onScaleChange(s.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                activeScale === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {s.label} ({s.value})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Convert a title/label to a URL-friendly slug */
function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  const sectionId = id ?? toSlug(title);
  return (
    <div className="mb-10" id={sectionId}>
      <h2 className="font-brand mb-4 text-lg font-semibold tracking-wide text-foreground">
        {title}
      </h2>
      <div className="rounded-lg border border-border bg-card p-6">{children}</div>
    </div>
  );
}

export function SubSection({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  const sectionId = id ?? toSlug(label);
  return (
    <div className="mb-6 last:mb-0" id={sectionId}>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
