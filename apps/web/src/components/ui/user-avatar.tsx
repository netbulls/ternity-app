import { scaled } from '@/lib/scaled';
import { getInitials } from '@/lib/user';
import { cn } from '@/lib/utils';

/**
 * Standard avatar sizes:
 *   sm  = 22px — compact rows (wallchart, inline mentions)
 *   md  = 32px — table rows, team board, cards
 *   lg  = 40px — profile sections, drilldown headers
 */

const SIZES = {
  sm: { px: 22, font: scaled(8) },
  md: { px: 32, font: scaled(11) },
  lg: { px: 40, font: scaled(14) },
} as const;

export type AvatarSize = keyof typeof SIZES;

interface UserAvatarProps {
  user: {
    displayName: string;
    avatarUrl?: string | null;
  };
  size?: AvatarSize;
  className?: string;
}

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const { px, font } = SIZES[size];

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={{ width: px, height: px }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--t-avatar-bg))] font-semibold text-[hsl(var(--t-avatar-text))]',
        className,
      )}
      style={{ width: px, height: px, fontSize: font }}
    >
      {getInitials(user.displayName)}
    </div>
  );
}
