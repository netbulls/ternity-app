import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock3,
  Mail,
  Smartphone,
} from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationEmailThemeMode,
  DEFAULT_WEEKLY_WORKING_HOURS,
  type NotificationSettings,
  type NotificationType,
  type WeeklyWorkingHours,
  type WorkingDayKey,
} from '@ternity/shared';
import { useAuth } from '@/providers/auth-provider';
import {
  useNotificationSettings,
  useSendTestNotificationEmail,
  useSendTestNotificationSms,
  useUpdateNotificationSettings,
} from '@/hooks/use-notification-settings';
import { ApiError } from '@/lib/api';
import { useWorkingHours } from '@/hooks/use-working-hours';
import { scaled } from '@/lib/scaled';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

type GroupKey = 'timer' | 'leave' | 'weekly';

const DAY_ORDER: WorkingDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const AXIS_START = 7;
const AXIS_END = 19;
const AXIS_SPAN = AXIS_END - AXIS_START;

const TEST_NOTIFICATION_TYPES: Array<{ value: NotificationType; label: string }> = [
  { value: 'forgotToStart', label: 'Forgot to start timer' },
  { value: 'forgotToStop', label: 'Forgot to stop timer' },
  { value: 'longTimer', label: 'Long timer' },
  { value: 'leaveRequestUpdate', label: 'Leave request update' },
  { value: 'teamLeave', label: 'Team leave alert' },
  { value: 'weeklyReport', label: 'Weekly report' },
];

function timeToHour(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours! + minutes! / 60;
}

function toPercent(hours: number): number {
  const raw = ((hours - AXIS_START) / AXIS_SPAN) * 100;
  return Math.max(0, Math.min(100, raw));
}

function findTypicalDay(schedule: WeeklyWorkingHours): { start: string; end: string } {
  for (const dayKey of DAY_ORDER) {
    const day = schedule[dayKey];
    if (day.enabled) return { start: day.start, end: day.end };
  }
  return { start: schedule.mon.start, end: schedule.mon.end };
}

function ChannelButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: 'Email' | 'SMS';
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground',
        disabled && 'opacity-35',
      )}
      style={{ fontSize: scaled(11) }}
    >
      <input
        type="checkbox"
        checked={active}
        disabled={disabled}
        onChange={() => onClick?.()}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      <span>{label}</span>
    </div>
  );
}

function RowTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="shrink-0 font-brand tracking-wide text-foreground"
      style={{ fontSize: scaled(12) }}
    >
      {children}
    </span>
  );
}

function getSmsTestUiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as {
        error?: string;
        sentLastHour?: number;
        limitPerHour?: number;
      };

      if (error.status === 429) {
        const limit = parsed.limitPerHour ?? 5;
        const used = parsed.sentLastHour ?? limit;
        return `SMS test limit reached: ${used}/${limit} sent in the last hour.`;
      }

      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // ignore parse failures
    }
  }

  return 'Failed to send test SMS. Please try again.';
}

export function NotificationsPanel() {
  const { user } = useAuth();
  const { data: scheduleData } = useWorkingHours();
  const { data, isLoading } = useNotificationSettings();
  const updateNotificationSettings = useUpdateNotificationSettings();
  const sendTestEmail = useSendTestNotificationEmail();
  const sendTestSms = useSendTestNotificationSms();

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [testType, setTestType] = useState<NotificationType>('forgotToStart');
  const [smsTestFeedback, setSmsTestFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>({
    timer: false,
    leave: false,
    weekly: false,
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
      setPhoneDraft(data.phoneOverride ?? '');
    }
  }, [data]);

  const saveSettings = (next: NotificationSettings) => {
    setSettings(next);
    updateNotificationSettings.mutate(next);
  };

  const schedule = scheduleData ?? DEFAULT_WEEKLY_WORKING_HOURS;
  const typicalDay = findTypicalDay(schedule);
  const startHour = timeToHour(typicalDay.start);
  const endHour = timeToHour(typicalDay.end);

  const markers = useMemo(() => {
    return {
      start: startHour + settings.timer.forgotToStart.thresholdMinutes / 60,
      stop: endHour + settings.timer.forgotToStop.thresholdMinutes / 60,
      long: startHour + settings.timer.longTimer.thresholdHours,
    };
  }, [endHour, settings, startHour]);

  const effectivePhone = settings.phoneOverride?.trim() || user?.phone || 'No phone configured';

  const toggleGroupOpen = (group: GroupKey) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const commitPhoneOverride = () => {
    const normalized = phoneDraft.trim();
    const nextValue = normalized ? normalized : null;
    if (nextValue === settings.phoneOverride) return;
    saveSettings({ ...settings, phoneOverride: nextValue });
  };

  const setEmailThemeMode = (mode: NotificationEmailThemeMode) => {
    if (mode === settings.emailThemeMode) return;
    saveSettings({ ...settings, emailThemeMode: mode });
  };

  return (
    <div>
      <h2
        className="font-brand font-semibold tracking-wide text-foreground"
        style={{ fontSize: scaled(14) }}
      >
        Notifications
      </h2>
      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: scaled(11) }}>
        Configure reminders and delivery channels.
      </p>

      <div className="mt-3 rounded-lg border border-border bg-muted/20 px-4 py-4">
        <div
          className="mb-2 flex items-center gap-1.5 font-brand uppercase tracking-[1.5px] text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Your Typical Day
        </div>

        <div className="relative pt-5 pb-12">
          <div className="relative h-2 rounded bg-border/60">
            <div
              className="absolute top-0 h-2 rounded border border-primary/25 bg-primary/20"
              style={{
                left: `${toPercent(startHour)}%`,
                width: `${Math.max(0, toPercent(endHour) - toPercent(startHour))}%`,
              }}
            >
              <span
                className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-brand text-primary/75"
                style={{ fontSize: scaled(9) }}
              >
                {typicalDay.start} - {typicalDay.end}
              </span>
            </div>

            <div
              className={cn(
                'absolute -top-[2px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border',
                settings.timer.enabled && settings.timer.forgotToStart.enabled
                  ? 'border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]'
                  : 'border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))] opacity-20',
              )}
              style={{ left: `${toPercent(markers.start)}%` }}
            />
            <div
              className={cn(
                'absolute -top-[2px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border',
                settings.timer.enabled && settings.timer.forgotToStop.enabled
                  ? 'border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))]'
                  : 'border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))] opacity-20',
              )}
              style={{ left: `${toPercent(markers.stop)}%` }}
            />
            <div
              className={cn(
                'absolute -top-[2px] h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border',
                settings.timer.enabled && settings.timer.longTimer.enabled
                  ? 'border-[hsl(var(--chart-5))] bg-[hsl(var(--chart-5))]'
                  : 'border-[hsl(var(--chart-5))] bg-[hsl(var(--chart-5))] opacity-20',
              )}
              style={{ left: `${toPercent(markers.long)}%` }}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-7 flex justify-between">
            {Array.from({ length: AXIS_SPAN + 1 }, (_, idx) => AXIS_START + idx).map((h) => (
              <span
                key={h}
                className="w-0 text-muted-foreground/55"
                style={{ fontSize: scaled(9) }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-11">
            <div
              className="absolute -translate-x-1/2"
              style={{ left: `${toPercent(markers.start)}%` }}
            >
              <div className="text-[hsl(var(--chart-4))]" style={{ fontSize: scaled(9) }}>
                +{settings.timer.forgotToStart.thresholdMinutes}m
              </div>
            </div>
            <div
              className="absolute -translate-x-1/2"
              style={{ left: `${toPercent(markers.stop)}%` }}
            >
              <div className="text-[hsl(var(--chart-3))]" style={{ fontSize: scaled(9) }}>
                +{settings.timer.forgotToStop.thresholdMinutes}m
              </div>
            </div>
            <div
              className="absolute -translate-x-1/2"
              style={{ left: `${toPercent(markers.long)}%` }}
            >
              <div className="text-[hsl(var(--chart-5))]" style={{ fontSize: scaled(9) }}>
                +{settings.timer.longTimer.thresholdHours}h
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            style={{ fontSize: scaled(11) }}
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="text-foreground">{user?.email ?? 'No email configured'}</span>
          </div>
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            style={{ fontSize: scaled(11) }}
            title="Effective SMS destination"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="text-foreground">{effectivePhone}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="tel"
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            onBlur={commitPhoneOverride}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder={user?.phone ?? '+48...'}
            className="w-[220px] rounded-md border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
            style={{ fontSize: scaled(12) }}
          />
          <button
            type="button"
            onClick={() => {
              setPhoneDraft('');
              if (settings.phoneOverride !== null) {
                saveSettings({ ...settings, phoneOverride: null });
              }
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            style={{ fontSize: scaled(11) }}
          >
            Use login phone
          </button>
          <span className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
            Leave empty to fall back to Logto phone.
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <span className="text-muted-foreground" style={{ fontSize: scaled(11) }}>
            Email template
          </span>
          <span
            className="rounded-md border border-border bg-background px-2 py-1 font-brand tracking-wide text-foreground"
            style={{ fontSize: scaled(11) }}
          >
            {settings.emailTemplateVariant.toUpperCase()}
          </span>

          <span className="ml-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            Theme
          </span>
          <select
            value={settings.emailThemeMode}
            onChange={(e) => setEmailThemeMode(e.target.value as NotificationEmailThemeMode)}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
            style={{ fontSize: scaled(11) }}
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          <span className="ml-2 text-muted-foreground" style={{ fontSize: scaled(11) }}>
            Test type
          </span>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value as NotificationType)}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground focus:border-primary focus:outline-none"
            style={{ fontSize: scaled(11) }}
          >
            {TEST_NOTIFICATION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => sendTestEmail.mutate(testType)}
            disabled={sendTestEmail.isPending}
            className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontSize: scaled(11) }}
          >
            Send test email
          </button>
          <button
            type="button"
            onClick={() => {
              setSmsTestFeedback(null);
              sendTestSms.mutate(testType, {
                onSuccess: (data) => {
                  setSmsTestFeedback({
                    tone: 'success',
                    text: `SMS sent (${data.sentLastHour}/${data.limitPerHour} this hour).`,
                  });
                },
                onError: (error) => {
                  setSmsTestFeedback({
                    tone: 'error',
                    text: getSmsTestUiMessage(error),
                  });
                },
              });
            }}
            disabled={sendTestSms.isPending}
            className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontSize: scaled(11) }}
          >
            Send test SMS
          </button>
        </div>

        {smsTestFeedback && (
          <div
            className={cn(
              'mt-2',
              smsTestFeedback.tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
            style={{ fontSize: scaled(11) }}
          >
            {smsTestFeedback.text}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 text-muted-foreground" style={{ fontSize: scaled(12) }}>
          Loading notifications...
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div
          className="overflow-hidden rounded-lg border border-border border-l-[3px] bg-muted/10"
          style={{ borderLeftColor: 'hsl(var(--chart-4))' }}
        >
          <button
            type="button"
            onClick={() => toggleGroupOpen('timer')}
            className="flex w-full items-center gap-2 bg-muted/20 px-3 py-2 text-left"
          >
            <div className="rounded-md bg-[hsl(var(--chart-4))/0.12] p-1.5 text-[hsl(var(--chart-4))]">
              <Clock3 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-brand tracking-wide text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Timer Reminders
              </div>
              <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                Start {settings.timer.forgotToStart.thresholdMinutes}m, stop{' '}
                {settings.timer.forgotToStop.thresholdMinutes}m, long{' '}
                {settings.timer.longTimer.thresholdHours}h
              </div>
            </div>
            <Switch
              checked={settings.timer.enabled}
              onCheckedChange={(checked) =>
                saveSettings({ ...settings, timer: { ...settings.timer, enabled: checked } })
              }
              onClick={(e) => e.stopPropagation()}
            />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                openGroups.timer && 'rotate-180',
              )}
            />
          </button>

          {openGroups.timer && (
            <div className={cn('space-y-0 px-3 pb-2', !settings.timer.enabled && 'opacity-40')}>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.timer.forgotToStart.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStart: { ...settings.timer.forgotToStart, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.timer.enabled}
                />
                <RowTitle>Forgot to start</RowTitle>
                <span className="ml-auto" />
                {[15, 30, 45, 60].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        timer: {
                          ...settings.timer,
                          forgotToStart: {
                            ...settings.timer.forgotToStart,
                            thresholdMinutes: option as 15 | 30 | 45 | 60,
                          },
                        },
                      })
                    }
                    disabled={!settings.timer.enabled || !settings.timer.forgotToStart.enabled}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-brand transition-colors',
                      settings.timer.forgotToStart.thresholdMinutes === option
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                    style={{ fontSize: scaled(10) }}
                  >
                    {option >= 60 ? '1h' : `${option}m`}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <ChannelButton
                  label="Email"
                  active={settings.timer.forgotToStart.channels.email}
                  disabled={!settings.timer.enabled || !settings.timer.forgotToStart.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStart: {
                          ...settings.timer.forgotToStart,
                          channels: {
                            ...settings.timer.forgotToStart.channels,
                            email: !settings.timer.forgotToStart.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.timer.forgotToStart.channels.sms}
                  disabled={!settings.timer.enabled || !settings.timer.forgotToStart.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStart: {
                          ...settings.timer.forgotToStart,
                          channels: {
                            ...settings.timer.forgotToStart.channels,
                            sms: !settings.timer.forgotToStart.channels.sms,
                          },
                        },
                      },
                    })
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.timer.forgotToStop.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStop: { ...settings.timer.forgotToStop, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.timer.enabled}
                />
                <RowTitle>Forgot to stop</RowTitle>
                <span className="ml-auto" />
                {[15, 30, 45, 60].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        timer: {
                          ...settings.timer,
                          forgotToStop: {
                            ...settings.timer.forgotToStop,
                            thresholdMinutes: option as 15 | 30 | 45 | 60,
                          },
                        },
                      })
                    }
                    disabled={!settings.timer.enabled || !settings.timer.forgotToStop.enabled}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-brand transition-colors',
                      settings.timer.forgotToStop.thresholdMinutes === option
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                    style={{ fontSize: scaled(10) }}
                  >
                    {option >= 60 ? '1h' : `${option}m`}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <ChannelButton
                  label="Email"
                  active={settings.timer.forgotToStop.channels.email}
                  disabled={!settings.timer.enabled || !settings.timer.forgotToStop.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStop: {
                          ...settings.timer.forgotToStop,
                          channels: {
                            ...settings.timer.forgotToStop.channels,
                            email: !settings.timer.forgotToStop.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.timer.forgotToStop.channels.sms}
                  disabled={!settings.timer.enabled || !settings.timer.forgotToStop.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        forgotToStop: {
                          ...settings.timer.forgotToStop,
                          channels: {
                            ...settings.timer.forgotToStop.channels,
                            sms: !settings.timer.forgotToStop.channels.sms,
                          },
                        },
                      },
                    })
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.timer.longTimer.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        longTimer: { ...settings.timer.longTimer, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.timer.enabled}
                />
                <RowTitle>Long timer</RowTitle>
                <span className="ml-auto" />
                {[2, 4, 6, 8].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        timer: {
                          ...settings.timer,
                          longTimer: {
                            ...settings.timer.longTimer,
                            thresholdHours: option as 2 | 4 | 6 | 8,
                          },
                        },
                      })
                    }
                    disabled={!settings.timer.enabled || !settings.timer.longTimer.enabled}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-brand transition-colors',
                      settings.timer.longTimer.thresholdHours === option
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                    style={{ fontSize: scaled(10) }}
                  >
                    {option}h
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <ChannelButton
                  label="Email"
                  active={settings.timer.longTimer.channels.email}
                  disabled={!settings.timer.enabled || !settings.timer.longTimer.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        longTimer: {
                          ...settings.timer.longTimer,
                          channels: {
                            ...settings.timer.longTimer.channels,
                            email: !settings.timer.longTimer.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.timer.longTimer.channels.sms}
                  disabled={!settings.timer.enabled || !settings.timer.longTimer.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      timer: {
                        ...settings.timer,
                        longTimer: {
                          ...settings.timer.longTimer,
                          channels: {
                            ...settings.timer.longTimer.channels,
                            sms: !settings.timer.longTimer.channels.sms,
                          },
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div
          className="overflow-hidden rounded-lg border border-border border-l-[3px] bg-muted/10"
          style={{ borderLeftColor: 'hsl(var(--chart-3))' }}
        >
          <button
            type="button"
            onClick={() => toggleGroupOpen('leave')}
            className="flex w-full items-center gap-2 bg-muted/20 px-3 py-2 text-left"
          >
            <div className="rounded-md bg-[hsl(var(--chart-3))/0.12] p-1.5 text-[hsl(var(--chart-3))]">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-brand tracking-wide text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Leave &amp; Absence
              </div>
              <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                Request updates and team leave alerts.
              </div>
            </div>
            <Switch
              checked={settings.leave.enabled}
              onCheckedChange={(checked) =>
                saveSettings({ ...settings, leave: { ...settings.leave, enabled: checked } })
              }
              onClick={(e) => e.stopPropagation()}
            />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                openGroups.leave && 'rotate-180',
              )}
            />
          </button>

          {openGroups.leave && (
            <div className={cn('space-y-0 px-3 pb-2', !settings.leave.enabled && 'opacity-40')}>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.leave.requestUpdates.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      leave: {
                        ...settings.leave,
                        requestUpdates: { ...settings.leave.requestUpdates, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.leave.enabled}
                />
                <RowTitle>Leave request updates</RowTitle>
                <span className="ml-auto" />
                <ChannelButton
                  label="Email"
                  active={settings.leave.requestUpdates.channels.email}
                  disabled={!settings.leave.enabled || !settings.leave.requestUpdates.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      leave: {
                        ...settings.leave,
                        requestUpdates: {
                          ...settings.leave.requestUpdates,
                          channels: {
                            ...settings.leave.requestUpdates.channels,
                            email: !settings.leave.requestUpdates.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.leave.requestUpdates.channels.sms}
                  disabled={!settings.leave.enabled || !settings.leave.requestUpdates.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      leave: {
                        ...settings.leave,
                        requestUpdates: {
                          ...settings.leave.requestUpdates,
                          channels: {
                            ...settings.leave.requestUpdates.channels,
                            sms: !settings.leave.requestUpdates.channels.sms,
                          },
                        },
                      },
                    })
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.leave.teamLeave.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      leave: {
                        ...settings.leave,
                        teamLeave: { ...settings.leave.teamLeave, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.leave.enabled}
                />
                <RowTitle>Team leave</RowTitle>
                <span className="ml-auto" />
                <ChannelButton
                  label="Email"
                  active={settings.leave.teamLeave.channels.email}
                  disabled={!settings.leave.enabled || !settings.leave.teamLeave.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      leave: {
                        ...settings.leave,
                        teamLeave: {
                          ...settings.leave.teamLeave,
                          channels: {
                            ...settings.leave.teamLeave.channels,
                            email: !settings.leave.teamLeave.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.leave.teamLeave.channels.sms}
                  disabled
                />
              </div>
            </div>
          )}
        </div>

        <div
          className="overflow-hidden rounded-lg border border-border border-l-[3px] bg-muted/10"
          style={{ borderLeftColor: 'hsl(var(--primary))' }}
        >
          <button
            type="button"
            onClick={() => toggleGroupOpen('weekly')}
            className="flex w-full items-center gap-2 bg-muted/20 px-3 py-2 text-left"
          >
            <div className="rounded-md bg-primary/12 p-1.5 text-primary">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-brand tracking-wide text-foreground"
                style={{ fontSize: scaled(12) }}
              >
                Weekly Summary
              </div>
              <div className="text-muted-foreground" style={{ fontSize: scaled(10) }}>
                Hours report every{' '}
                {settings.weekly.hoursReport.day === 'monday' ? 'Monday' : 'Friday'}.
              </div>
            </div>
            <Switch
              checked={settings.weekly.enabled}
              onCheckedChange={(checked) =>
                saveSettings({ ...settings, weekly: { ...settings.weekly, enabled: checked } })
              }
              onClick={(e) => e.stopPropagation()}
            />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                openGroups.weekly && 'rotate-180',
              )}
            />
          </button>

          {openGroups.weekly && (
            <div className={cn('space-y-0 px-3 pb-2', !settings.weekly.enabled && 'opacity-40')}>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 py-2">
                <Switch
                  checked={settings.weekly.hoursReport.enabled}
                  onCheckedChange={(checked) =>
                    saveSettings({
                      ...settings,
                      weekly: {
                        ...settings.weekly,
                        hoursReport: { ...settings.weekly.hoursReport, enabled: checked },
                      },
                    })
                  }
                  disabled={!settings.weekly.enabled}
                />
                <RowTitle>Weekly hours report</RowTitle>
                <span className="ml-auto" />
                {(['monday', 'friday'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      saveSettings({
                        ...settings,
                        weekly: {
                          ...settings.weekly,
                          hoursReport: { ...settings.weekly.hoursReport, day: option },
                        },
                      })
                    }
                    disabled={!settings.weekly.enabled || !settings.weekly.hoursReport.enabled}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-brand transition-colors',
                      settings.weekly.hoursReport.day === option
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                    style={{ fontSize: scaled(10) }}
                  >
                    {option === 'monday' ? 'Monday' : 'Friday'}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <ChannelButton
                  label="Email"
                  active={settings.weekly.hoursReport.channels.email}
                  disabled={!settings.weekly.enabled || !settings.weekly.hoursReport.enabled}
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      weekly: {
                        ...settings.weekly,
                        hoursReport: {
                          ...settings.weekly.hoursReport,
                          channels: {
                            ...settings.weekly.hoursReport.channels,
                            email: !settings.weekly.hoursReport.channels.email,
                          },
                        },
                      },
                    })
                  }
                />
                <ChannelButton
                  label="SMS"
                  active={settings.weekly.hoursReport.channels.sms}
                  disabled
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {updateNotificationSettings.isPending && (
        <div
          className="mt-2 flex items-center gap-1 text-muted-foreground"
          style={{ fontSize: scaled(10) }}
        >
          <Bell className="h-3 w-3" />
          Saving changes...
        </div>
      )}
    </div>
  );
}
