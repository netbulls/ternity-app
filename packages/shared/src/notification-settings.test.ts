import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  LeaveReminderSchema,
  LongTimerReminderSchema,
  NotificationChannelsSchema,
  NotificationEmailThemeModeSchema,
  NotificationSettingsSchema,
  NotificationTemplateVariantSchema,
  NotificationTypeSchema,
  StartStopReminderSchema,
  WeeklyHoursReportSchema,
} from './notification-settings.js';

// Characterization tests — pin the CURRENT notification settings contract: the
// constrained threshold sets, the schema defaults, and the exact shape/values of
// DEFAULT_NOTIFICATION_SETTINGS. A refactor that drifts a default or widens a
// threshold set should make one of these fail.
//
// NOTE on test structure: every parse() call lives inside an it() block, never in
// describe-scope. A parse that throws at describe-time causes Vitest to drop the
// whole block ("file failed") while still counting remaining tests as passed —
// which causes mutation testing to MISS killable mutants. Always parse inside it().

// Build the minimum-required payload on demand inside each test. Reusable, but the
// parse only runs when the test asks for it.
function makeRequiredNested() {
  return {
    timer: DEFAULT_NOTIFICATION_SETTINGS.timer,
    leave: DEFAULT_NOTIFICATION_SETTINGS.leave,
    weekly: DEFAULT_NOTIFICATION_SETTINGS.weekly,
  };
}

describe('DEFAULT_NOTIFICATION_SETTINGS', () => {
  it('is itself valid against NotificationSettingsSchema and round-trips unchanged', () => {
    const parsed = NotificationSettingsSchema.parse(DEFAULT_NOTIFICATION_SETTINGS);
    expect(parsed).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('pins the exact default values, including the sms:false asymmetry', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS).toEqual({
      phoneOverride: null,
      emailTemplateVariant: 'v3',
      emailThemeMode: 'auto',
      timer: {
        enabled: true,
        forgotToStart: { enabled: true, thresholdMinutes: 15, channels: { email: true, sms: true } },
        forgotToStop: { enabled: true, thresholdMinutes: 30, channels: { email: true, sms: true } },
        longTimer: { enabled: true, thresholdHours: 4, channels: { email: true, sms: true } },
      },
      leave: {
        enabled: true,
        requestUpdates: { enabled: true, channels: { email: true, sms: true } },
        // teamLeave deliberately defaults sms to false
        teamLeave: { enabled: true, channels: { email: true, sms: false } },
      },
      weekly: {
        enabled: true,
        // hoursReport defaults to monday and sms false
        hoursReport: { enabled: true, day: 'monday', channels: { email: true, sms: false } },
      },
    });
  });
});

describe('NotificationSettingsSchema defaults', () => {
  it('defaults phoneOverride=null, emailTemplateVariant=v3, emailThemeMode=auto', () => {
    const parsed = NotificationSettingsSchema.parse(makeRequiredNested());
    expect(parsed.phoneOverride).toBeNull();
    expect(parsed.emailTemplateVariant).toBe('v3');
    expect(parsed.emailThemeMode).toBe('auto');
  });

  it('requires timer, leave and weekly (no defaults for the nested groups)', () => {
    expect(NotificationSettingsSchema.safeParse({}).success).toBe(false);
    const { weekly: _w, ...withoutWeekly } = makeRequiredNested();
    expect(NotificationSettingsSchema.safeParse(withoutWeekly).success).toBe(false);
    const { timer: _t, ...withoutTimer } = makeRequiredNested();
    expect(NotificationSettingsSchema.safeParse(withoutTimer).success).toBe(false);
    const { leave: _l, ...withoutLeave } = makeRequiredNested();
    expect(NotificationSettingsSchema.safeParse(withoutLeave).success).toBe(false);
  });
});

describe('threshold constraints (start/stop, long timer)', () => {
  function withStartThreshold(thresholdMinutes: number) {
    const base = makeRequiredNested();
    return {
      ...base,
      timer: {
        ...base.timer,
        forgotToStart: { ...base.timer.forgotToStart, thresholdMinutes },
      },
    };
  }

  function withLongTimerThreshold(thresholdHours: number) {
    const base = makeRequiredNested();
    return {
      ...base,
      timer: {
        ...base.timer,
        longTimer: { ...base.timer.longTimer, thresholdHours },
      },
    };
  }

  it.each([15, 30, 45, 60])('start/stop thresholdMinutes accepts %d', (ok) => {
    expect(NotificationSettingsSchema.safeParse(withStartThreshold(ok)).success).toBe(true);
  });

  it.each([0, 10, 20, 25, 35, 50, 75, 90])('start/stop thresholdMinutes rejects %d', (bad) => {
    expect(NotificationSettingsSchema.safeParse(withStartThreshold(bad)).success).toBe(false);
  });

  it.each([2, 4, 6, 8])('longTimer thresholdHours accepts %d', (ok) => {
    expect(NotificationSettingsSchema.safeParse(withLongTimerThreshold(ok)).success).toBe(true);
  });

  it.each([0, 1, 3, 5, 7, 10])('longTimer thresholdHours rejects %d', (bad) => {
    expect(NotificationSettingsSchema.safeParse(withLongTimerThreshold(bad)).success).toBe(false);
  });
});

describe('enum-like literal unions', () => {
  it.each(['v3'])('emailTemplateVariant accepts %s', (v) => {
    expect(NotificationTemplateVariantSchema.safeParse(v).success).toBe(true);
  });

  it.each(['v1', 'v2', 'v4', ''])('emailTemplateVariant rejects %s', (v) => {
    expect(NotificationTemplateVariantSchema.safeParse(v).success).toBe(false);
  });

  it.each(['light', 'dark', 'auto'])('emailThemeMode accepts %s', (mode) => {
    expect(NotificationEmailThemeModeSchema.safeParse(mode).success).toBe(true);
  });

  it.each(['system', 'sepia', ''])('emailThemeMode rejects %s', (mode) => {
    expect(NotificationEmailThemeModeSchema.safeParse(mode).success).toBe(false);
  });

  it.each([
    'forgotToStart',
    'forgotToStop',
    'longTimer',
    'leaveRequestUpdate',
    'teamLeave',
    'weeklyReport',
  ])('NotificationTypeSchema accepts %s', (t) => {
    expect(NotificationTypeSchema.safeParse(t).success).toBe(true);
  });

  it.each(['dailyReport', 'monthlyReport', ''])('NotificationTypeSchema rejects %s', (t) => {
    expect(NotificationTypeSchema.safeParse(t).success).toBe(false);
  });
});

describe('NotificationChannelsSchema', () => {
  it('accepts both email and sms booleans (no defaults)', () => {
    expect(NotificationChannelsSchema.safeParse({ email: true, sms: false }).success).toBe(true);
    expect(NotificationChannelsSchema.safeParse({ email: false, sms: true }).success).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(NotificationChannelsSchema.safeParse({}).success).toBe(false);
    expect(NotificationChannelsSchema.safeParse({ email: true }).success).toBe(false);
    expect(NotificationChannelsSchema.safeParse({ sms: true }).success).toBe(false);
  });

  it('rejects wrong-type fields', () => {
    expect(NotificationChannelsSchema.safeParse({ email: 'yes', sms: true }).success).toBe(false);
    expect(NotificationChannelsSchema.safeParse({ email: true, sms: 1 }).success).toBe(false);
  });
});

// Direct accept/reject tests for the nested schemas — each is referenced as a value
// at module-eval time, so without these direct exercises a mutant that strips a
// schema's required fields can slip past tests that only check composition.

describe('StartStopReminderSchema', () => {
  const valid = { enabled: true, thresholdMinutes: 15, channels: { email: true, sms: false } };

  it('accepts a fully-formed reminder', () => {
    expect(StartStopReminderSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    expect(StartStopReminderSchema.safeParse({}).success).toBe(false);
    const { enabled: _e, ...noEnabled } = valid;
    expect(StartStopReminderSchema.safeParse(noEnabled).success).toBe(false);
    const { channels: _c, ...noChannels } = valid;
    expect(StartStopReminderSchema.safeParse(noChannels).success).toBe(false);
  });

  it('rejects thresholdMinutes outside the allowed set', () => {
    expect(StartStopReminderSchema.safeParse({ ...valid, thresholdMinutes: 17 }).success).toBe(false);
  });
});

describe('LongTimerReminderSchema', () => {
  const valid = { enabled: true, thresholdHours: 4, channels: { email: true, sms: false } };

  it('accepts a fully-formed reminder', () => {
    expect(LongTimerReminderSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    expect(LongTimerReminderSchema.safeParse({}).success).toBe(false);
  });

  it('rejects thresholdHours outside the allowed set', () => {
    expect(LongTimerReminderSchema.safeParse({ ...valid, thresholdHours: 3 }).success).toBe(false);
  });
});

describe('LeaveReminderSchema', () => {
  it('accepts enabled + channels', () => {
    expect(
      LeaveReminderSchema.safeParse({ enabled: true, channels: { email: true, sms: false } }).success,
    ).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    expect(LeaveReminderSchema.safeParse({}).success).toBe(false);
    expect(LeaveReminderSchema.safeParse({ enabled: true }).success).toBe(false);
  });
});

describe('WeeklyHoursReportSchema', () => {
  const valid = { enabled: true, day: 'monday', channels: { email: true, sms: false } };

  it('accepts a fully-formed weekly report', () => {
    expect(WeeklyHoursReportSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    expect(WeeklyHoursReportSchema.safeParse({}).success).toBe(false);
  });

  it.each(['monday', 'friday'])('day accepts %s', (day) => {
    expect(WeeklyHoursReportSchema.safeParse({ ...valid, day }).success).toBe(true);
  });

  it.each(['tuesday', 'wednesday', 'thursday', 'saturday', 'sunday', ''])('day rejects %s', (day) => {
    expect(WeeklyHoursReportSchema.safeParse({ ...valid, day }).success).toBe(false);
  });
});
