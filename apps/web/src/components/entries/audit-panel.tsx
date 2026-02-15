import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Entry } from '@ternity/shared';

interface Props {
  entry: Entry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Mock timeline event for UI shell — will be replaced with real versioning data */
interface TimelineEvent {
  type: 'created' | 'edited' | 'deleted';
  timestamp: string;
  user: string;
  action: string;
  change?: { field: string; old: string; new: string };
}

function getMockEvents(entry: Entry): TimelineEvent[] {
  return [
    {
      type: 'created',
      timestamp: entry.startedAt,
      user: 'You',
      action: 'Created entry',
    },
    ...(entry.description
      ? [
          {
            type: 'edited' as const,
            timestamp: entry.startedAt,
            user: 'You',
            action: 'Changed description',
            change: { field: 'description', old: '(empty)', new: entry.description },
          },
        ]
      : []),
    ...(entry.projectName
      ? [
          {
            type: 'edited' as const,
            timestamp: entry.startedAt,
            user: 'You',
            action: 'Assigned project',
            change: { field: 'project', old: 'None', new: entry.projectName },
          },
        ]
      : []),
  ];
}

const dotColors: Record<TimelineEvent['type'], string> = {
  created: 'bg-primary',
  edited: 'bg-chart-3',
  deleted: 'bg-destructive',
};

export function AuditPanel({ entry, open, onOpenChange }: Props) {
  if (!entry) return null;

  const events = getMockEvents(entry);
  const timeStr = new Date(entry.startedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = new Date(entry.startedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle
            className="font-brand uppercase text-muted-foreground"
            style={{ fontSize: scaled(10), letterSpacing: '2px' }}
          >
            Entry History
          </SheetTitle>
          <SheetDescription className="sr-only">
            Audit timeline for this entry
          </SheetDescription>
        </SheetHeader>

        {/* Entry summary */}
        <div className="mt-4 rounded-lg bg-muted/30 p-3">
          <div className="text-[13px] font-medium text-foreground">
            {entry.description || 'No description'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {entry.projectName && (
              <>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.projectColor ?? '#00D4AA' }}
                />
                <span>
                  {entry.clientName ? `${entry.clientName} · ` : ''}
                  {entry.projectName}
                </span>
                <span className="opacity-40">·</span>
              </>
            )}
            <span>
              {timeStr} · {dateStr}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative mt-6 pl-6">
          {/* Vertical line */}
          <div
            className="absolute left-[7px] top-1 bottom-1 w-px bg-border"
          />

          {events.map((event, i) => (
            <div key={i} className="relative mb-4 last:mb-0">
              {/* Dot */}
              <div
                className={cn(
                  'absolute -left-[13px] top-1 h-[9px] w-[9px] rounded-full border-2 border-background',
                  dotColors[event.type],
                )}
              />

              {/* Meta */}
              <div className="text-[10px] text-muted-foreground">
                <span>{event.user}</span>
                <span className="ml-1 opacity-60">
                  {new Date(event.timestamp).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Action */}
              <div className="text-[12px] text-foreground">
                {event.action}
              </div>

              {/* Change detail */}
              {event.change && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground/50 line-through">
                    {event.change.old}
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
                  <span className="font-medium text-foreground">
                    {event.change.new}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-8 rounded-md border border-dashed border-border/50 px-3 py-2 text-center text-[10px] text-muted-foreground/60">
          Full version history requires entry versioning (Phase 3)
        </div>
      </SheetContent>
    </Sheet>
  );
}
