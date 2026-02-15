import { Eye } from 'lucide-react';
import { useImpersonation } from '@/providers/impersonation-provider';
import { scaled } from '@/lib/scaled';

export function IdentityShift() {
  const { isTransitioning, targetDisplayName, targetRole } = useImpersonation();

  if (!isTransitioning) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-identity-shift"
    >
      {/* Scan line */}
      <div
        className="pointer-events-none absolute left-0 right-0 h-[2px] animate-scan-line"
        style={{ background: 'hsl(35 100% 50% / 0.4)' }}
      />

      {/* Center content */}
      <div className="flex flex-col items-center gap-4 animate-identity-content">
        {/* Eye icon circle */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full animate-shift-pulse"
          style={{ background: 'hsl(35 100% 50% / 0.12)' }}
        >
          <Eye className="h-7 w-7" style={{ color: 'hsl(35 100% 50%)' }} />
        </div>

        {/* Label */}
        <span
          className="font-brand uppercase tracking-[0.2em]"
          style={{
            fontSize: scaled(10),
            color: 'hsl(35 100% 50% / 0.6)',
            fontWeight: 400,
          }}
        >
          Switching identity
        </span>

        {/* User name */}
        <span
          className="font-brand font-bold text-foreground"
          style={{ fontSize: scaled(24) }}
        >
          {targetDisplayName}
        </span>

        {/* Role subtitle */}
        {targetRole && (
          <span
            className="font-medium text-muted-foreground"
            style={{ fontSize: scaled(12) }}
          >
            {targetRole === 'admin' ? 'Admin' : 'User'}
          </span>
        )}
      </div>
    </div>
  );
}
