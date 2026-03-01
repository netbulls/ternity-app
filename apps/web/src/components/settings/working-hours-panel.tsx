import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DEFAULT_WEEKLY_WORKING_HOURS,
  type WeeklyWorkingHours,
  type WorkingDayKey,
} from '@ternity/shared';
import { useWorkingHours, useUpdateWorkingHours } from '@/hooks/use-working-hours';
import { scaled } from '@/lib/scaled';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

const DAY_ROWS: Array<{ key: WorkingDayKey; shortLabel: string; label: string }> = [
  { key: 'mon', shortLabel: 'Mon', label: 'Monday' },
  { key: 'tue', shortLabel: 'Tue', label: 'Tuesday' },
  { key: 'wed', shortLabel: 'Wed', label: 'Wednesday' },
  { key: 'thu', shortLabel: 'Thu', label: 'Thursday' },
  { key: 'fri', shortLabel: 'Fri', label: 'Friday' },
  { key: 'sat', shortLabel: 'Sat', label: 'Saturday' },
  { key: 'sun', shortLabel: 'Sun', label: 'Sunday' },
];

const TIMELINE_START = 6;
const TIMELINE_END = 22;
const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

function timeToHour(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours! + minutes! / 60;
}

function hoursToPercent(hours: number): number {
  return ((hours - TIMELINE_START) / TIMELINE_SPAN) * 100;
}

function formatHours(value: number): string {
  const whole = Math.floor(value);
  const remainder = Math.round((value - whole) * 60);
  if (remainder === 0) return `${whole}h`;
  return `${whole}h ${remainder}m`;
}

function getNextDayKey(currentDayKey: WorkingDayKey): WorkingDayKey | null {
  const index = DAY_ROWS.findIndex((day) => day.key === currentDayKey);
  if (index < 0) return null;

  const next = DAY_ROWS[index + 1];
  return next?.key ?? null;
}

export function WorkingHoursPanel() {
  const { data, isLoading } = useWorkingHours();
  const updateWorkingHours = useUpdateWorkingHours();
  const [expandedDay, setExpandedDay] = useState<WorkingDayKey | null>(null);
  const [schedule, setSchedule] = useState<WeeklyWorkingHours>(DEFAULT_WEEKLY_WORKING_HOURS);
  const [draftTimes, setDraftTimes] = useState<
    Partial<Record<WorkingDayKey, { start: string; end: string }>>
  >({});
  const inputRefs = useRef<
    Partial<Record<`${WorkingDayKey}:start` | `${WorkingDayKey}:end`, HTMLInputElement | null>>
  >({});

  useEffect(() => {
    if (data) {
      setSchedule(data);
      setDraftTimes({});
    }
  }, [data]);

  const weeklySummary = useMemo(() => {
    let totalHours = 0;
    let activeDays = 0;

    for (const day of DAY_ROWS) {
      const current = schedule[day.key];
      if (!current.enabled) continue;
      const dayHours = Math.max(0, timeToHour(current.end) - timeToHour(current.start));
      totalHours += dayHours;
      activeDays += 1;
    }

    return { totalHours, activeDays };
  }, [schedule]);

  const saveSchedule = (next: WeeklyWorkingHours) => {
    setSchedule(next);
    updateWorkingHours.mutate(next);
  };

  const updateDay = (dayKey: WorkingDayKey, patch: Partial<WeeklyWorkingHours[WorkingDayKey]>) => {
    const next: WeeklyWorkingHours = {
      ...schedule,
      [dayKey]: {
        ...schedule[dayKey],
        ...patch,
      },
    };
    saveSchedule(next);
  };

  const setDraftTime = (dayKey: WorkingDayKey, field: 'start' | 'end', value: string) => {
    setDraftTimes((prev) => {
      const current = prev[dayKey] ?? {
        start: schedule[dayKey].start,
        end: schedule[dayKey].end,
      };

      return {
        ...prev,
        [dayKey]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const commitDraftTime = (dayKey: WorkingDayKey) => {
    const current = schedule[dayKey];
    if (!current.enabled) return;

    const startRef = inputRefs.current[`${dayKey}:start`];
    const endRef = inputRefs.current[`${dayKey}:end`];
    const draft = draftTimes[dayKey];

    const start = startRef?.value ?? draft?.start ?? current.start;
    const end = endRef?.value ?? draft?.end ?? current.end;

    if (start >= end) {
      return;
    }

    if (start === current.start && end === current.end) {
      setDraftTimes((prev) => {
        const next = { ...prev };
        delete next[dayKey];
        return next;
      });
      return;
    }

    updateDay(dayKey, { start, end });
    setDraftTimes((prev) => {
      const next = { ...prev };
      delete next[dayKey];
      return next;
    });
  };

  const focusInput = (dayKey: WorkingDayKey, field: 'start' | 'end') => {
    const target = inputRefs.current[`${dayKey}:${field}`];
    if (!target || target.disabled) return;
    target.focus();
  };

  const focusNextDayStart = (dayKey: WorkingDayKey) => {
    let nextDay = getNextDayKey(dayKey);

    while (nextDay) {
      if (schedule[nextDay].enabled) {
        focusInput(nextDay, 'start');
        return;
      }
      nextDay = getNextDayKey(nextDay);
    }
  };

  return (
    <div>
      <h2 className="font-semibold text-foreground" style={{ fontSize: scaled(14) }}>
        Weekly Schedule
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Click a day to expand and edit.
      </p>

      <div className="mt-3 ml-11 mr-16 hidden h-4 md:block">
        <div className="relative h-full">
          {Array.from({ length: 9 }, (_, idx) => TIMELINE_START + idx * 2).map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 font-brand text-muted-foreground/55"
              style={{ left: `${hoursToPercent(hour)}%`, fontSize: scaled(10) }}
            >
              {hour}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {isLoading && (
          <div className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
            Loading working hours...
          </div>
        )}

        {DAY_ROWS.map((dayMeta) => {
          const day = schedule[dayMeta.key];
          const draft = draftTimes[dayMeta.key];
          const draftStart = draft?.start ?? day.start;
          const draftEnd = draft?.end ?? day.end;
          const isDraftInvalid = draftStart >= draftEnd;
          const draftHours = Math.max(0, timeToHour(draftEnd) - timeToHour(draftStart));
          const dayHours = Math.max(0, timeToHour(day.end) - timeToHour(day.start));
          const left = Math.max(0, hoursToPercent(timeToHour(day.start)));
          const right = Math.min(100, hoursToPercent(timeToHour(day.end)));
          const width = Math.max(0, right - left);
          const isExpanded = expandedDay === dayMeta.key;

          return (
            <div
              key={dayMeta.key}
              className={cn(
                'overflow-hidden rounded-lg border border-border bg-muted/20 transition-colors',
                isExpanded && 'border-primary/40 bg-muted/35',
              )}
            >
              <button
                onClick={() => setExpandedDay(isExpanded ? null : dayMeta.key)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span
                  className={cn(
                    'w-8 shrink-0 font-brand uppercase tracking-wide text-foreground',
                    !day.enabled && 'text-muted-foreground/70',
                  )}
                  style={{ fontSize: scaled(12) }}
                  title={dayMeta.label}
                >
                  {dayMeta.shortLabel}
                </span>

                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/40">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to right, hsl(var(--border) / 0.45) 0px, hsl(var(--border) / 0.45) 1px, transparent 1px, transparent calc(100% / 8))',
                    }}
                  />

                  {day.enabled ? (
                    <div
                      className="absolute top-[3px] bottom-[3px] flex items-center justify-center rounded-sm border border-primary/35 bg-primary/15 px-1.5"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      <span className="font-brand text-primary" style={{ fontSize: scaled(10) }}>
                        {day.start} - {day.end}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-x-1.5 top-[3px] bottom-[3px] flex items-center justify-center rounded-sm border border-dashed border-border/80">
                      <span className="text-muted-foreground/65" style={{ fontSize: scaled(10) }}>
                        Day off
                      </span>
                    </div>
                  )}
                </div>

                <span
                  className={cn(
                    'w-14 shrink-0 whitespace-nowrap text-right font-brand text-primary',
                    !day.enabled && 'text-muted-foreground/60',
                  )}
                  style={{ fontSize: scaled(11) }}
                >
                  {day.enabled ? formatHours(dayHours) : '-'}
                </span>

                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-180 text-primary',
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(element) => {
                        inputRefs.current[`${dayMeta.key}:start`] = element;
                      }}
                      type="time"
                      value={draftStart}
                      onChange={(e) => setDraftTime(dayMeta.key, 'start', e.target.value)}
                      onBlur={() => commitDraftTime(dayMeta.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitDraftTime(dayMeta.key);
                          focusInput(dayMeta.key, 'end');
                        }
                      }}
                      disabled={!day.enabled}
                      className={cn(
                        'w-[110px] rounded-md border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        isDraftInvalid && day.enabled && 'border-destructive text-destructive',
                      )}
                      style={{ fontSize: scaled(12) }}
                    />
                    <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
                      -&gt;
                    </span>
                    <input
                      ref={(element) => {
                        inputRefs.current[`${dayMeta.key}:end`] = element;
                      }}
                      type="time"
                      value={draftEnd}
                      onChange={(e) => setDraftTime(dayMeta.key, 'end', e.target.value)}
                      onBlur={() => commitDraftTime(dayMeta.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitDraftTime(dayMeta.key);
                          focusNextDayStart(dayMeta.key);
                        }
                      }}
                      disabled={!day.enabled}
                      className={cn(
                        'w-[110px] rounded-md border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        isDraftInvalid && day.enabled && 'border-destructive text-destructive',
                      )}
                      style={{ fontSize: scaled(12) }}
                    />
                    <span className="text-muted-foreground" style={{ fontSize: scaled(12) }}>
                      =
                    </span>
                    <span
                      className={cn(
                        'font-brand',
                        !day.enabled
                          ? 'text-muted-foreground'
                          : isDraftInvalid
                            ? 'text-destructive'
                            : 'text-primary',
                      )}
                      style={{ fontSize: scaled(12) }}
                    >
                      {day.enabled ? (isDraftInvalid ? 'Invalid' : formatHours(draftHours)) : '-'}
                    </span>
                    <span
                      className="ml-auto text-muted-foreground"
                      style={{ fontSize: scaled(11) }}
                    >
                      Working day
                    </span>
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(checked) => updateDay(dayMeta.key, { enabled: checked })}
                      disabled={updateWorkingHours.isPending}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div>
          <div
            className="font-brand uppercase tracking-wider text-muted-foreground"
            style={{ fontSize: scaled(10) }}
          >
            Weekly Total
          </div>
          <div className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            {weeklySummary.activeDays} working day{weeklySummary.activeDays === 1 ? '' : 's'}
          </div>
        </div>
        <div
          className="whitespace-nowrap font-brand font-semibold text-primary"
          style={{ fontSize: scaled(20) }}
        >
          {formatHours(weeklySummary.totalHours)}
        </div>
      </div>
    </div>
  );
}
