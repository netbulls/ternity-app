import { Eye, X } from 'lucide-react';
import { useImpersonation } from '@/providers/impersonation-provider';
import { scaled } from '@/lib/scaled';

export function ImpersonationBanner() {
  const { targetUserId, targetDisplayName, targetRole, isTransitioning, clearImpersonation } =
    useImpersonation();

  if (!targetUserId || isTransitioning) return null;

  return (
    <div
      className="relative flex shrink-0 items-center justify-between overflow-hidden px-4 py-2 animate-banner-slide-in"
      style={{
        background: 'linear-gradient(90deg, hsl(35 100% 50% / 0.15), hsl(25 100% 45% / 0.08))',
      }}
    >
      {/* Shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0 animate-banner-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent, hsl(35 100% 50% / 0.06), transparent)',
          width: '50%',
          position: 'absolute',
        }}
      />

      {/* Left side: eye + label + name + role */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full animate-eye-pulse"
          style={{ background: 'hsl(35 100% 50% / 0.15)' }}
        >
          <Eye className="h-3.5 w-3.5" style={{ color: 'hsl(35 100% 50%)' }} />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-brand uppercase tracking-widest"
            style={{
              fontSize: scaled(9),
              color: 'hsl(35 100% 50% / 0.7)',
              fontWeight: 400,
            }}
          >
            Impersonating
          </span>
          <span
            className="font-semibold text-foreground"
            style={{ fontSize: scaled(14) }}
          >
            {targetDisplayName}
          </span>
          {targetRole && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{
                fontSize: scaled(10),
                background: 'hsl(35 100% 50% / 0.12)',
                color: 'hsl(35 100% 50%)',
              }}
            >
              {targetRole === 'admin' ? 'Admin' : 'User'}
            </span>
          )}
        </div>
      </div>

      {/* Right side: exit button */}
      <button
        onClick={clearImpersonation}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-foreground/10"
        style={{
          fontSize: scaled(12),
          color: 'hsl(35 100% 50%)',
        }}
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </button>
    </div>
  );
}
