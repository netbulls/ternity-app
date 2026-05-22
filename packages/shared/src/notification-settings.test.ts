import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationChannelsSchema,
  NotificationEmailThemeModeSchema,
  NotificationSettingsSchema,
  NotificationTemplateVariantSchema,
  NotificationTypeSchema,
} from './notification-settings.js';

// Characterization tests — pin the CURRENT notification settings contract: the
// constrained threshold sets, the schema defaults, and the exact shape/values of
// DEFAULT_NOTIFICATION_SETTINGS. A refactor that drifts a default or widens a
// threshold set should make one of these fail.

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
  // Minimal payload: only the required nested objects, omitting the three
  // top-level optional fields so their defaults are exercised.
  const requiredNested = {
    timer: DEFAULT_NOTIFICATION_SETTINGS.timer,
    leave: DEFAULT_NOTIFICATION_SETTINGS.leave,
    weekly: DEFAULT_NOTIFICATION_SETTINGS.weekly,
  };

  it('defaults phoneOverride=null, emailTemplateVariant=v3, emailThemeMode=auto', () => {
    const parsed = NotificationSettingsSchema.parse(requiredNested);
    expect(parsed).toMatchObject({
      phoneOverride: null,
      emailTemplateVariant: 'v3',
      emailThemeMode: 'auto',
    });
  });

  it('requires timer, leave and weekly (no defaults for the nested groups)', () => {
    expect(NotificationSettingsSchema.safeParse({}).success).toBe(false);
    const { weekly, ...withoutWeekly } = requiredNested;
    void weekly;
    expect(NotificationSettingsSchema.safeParse(withoutWeekly).success).toBe(false);
  });
});

describe('threshold constraints', () => {
  const baseSettings = NotificationSettingsSchema.parse({
    timer: DEFAULT_NOTIFICATION_SETTINGS.timer,
    leave: DEFAULT_NOTIFICATION_SETTINGS.leave,
    weekly: DEFAULT_NOTIFICATION_SETTINGS.weekly,
  });

  const withStartThreshold = (thresholdMinutes: number) => ({
    ...baseSettings,
    timer: {
      ...baseSettings.timer,
      forgotToStart: { ...baseSettings.timer.forgotToStart, thresholdMinutes },
    },
  });

  const withLongTimerThreshold = (thresholdHours: number) => ({
    ...baseSettings,
    timer: {
      ...baseSettings.timer,
      longTimer: { ...baseSettings.timer.longTimer, thresholdHours },
    },
  });

  it('start/stop thresholdMinutes accepts only 15, 30, 45, 60', () => {
    for (const ok of [15, 30, 45, 60]) {
      expect(NotificationSettingsSchema.safeParse(withStartThreshold(ok)).success).toBe(true);
    }
    for (const bad of [0, 10, 20, 90]) {
      expect(NotificationSettingsSchema.safeParse(withStartThreshold(bad)).success).toBe(false);
    }
  });

  it('longTimer thresholdHours accepts only 2, 4, 6, 8', () => {
    for (const ok of [2, 4, 6, 8]) {
      expect(NotificationSettingsSchema.safeParse(withLongTimerThreshold(ok)).success).toBe(true);
    }
    for (const bad of [1, 3, 5, 10]) {
      expect(NotificationSettingsSchema.safeParse(withLongTimerThreshold(bad)).success).toBe(false);
    }
  });
});

describe('enum-like literal unions', () => {
  it('emailTemplateVariant is only v3 (v1/v2 rejected)', () => {
    expect(NotificationTemplateVariantSchema.safeParse('v3').success).toBe(true);
    expect(NotificationTemplateVariantSchema.safeParse('v2').success).toBe(false);
    expect(NotificationTemplateVariantSchema.safeParse('v1').success).toBe(false);
  });

  it('emailThemeMode accepts light/dark/auto only', () => {
    for (const ok of ['light', 'dark', 'auto']) {
      expect(NotificationEmailThemeModeSchema.safeParse(ok).success).toBe(true);
    }
    expect(NotificationEmailThemeModeSchema.safeParse('system').success).toBe(false);
  });

  it('pins the exact set of notification types', () => {
    const types = [
      'forgotToStart',
      'forgotToStop',
      'longTimer',
      'leaveRequestUpdate',
      'teamLeave',
      'weeklyReport',
    ];
    for (const t of types) {
      expect(NotificationTypeSchema.safeParse(t).success).toBe(true);
    }
    expect(NotificationTypeSchema.safeParse('dailyReport').success).toBe(false);
  });
});

describe('NotificationChannelsSchema', () => {
  it('requires both email and sms booleans (no defaults)', () => {
    expect(NotificationChannelsSchema.safeParse({ email: true, sms: false }).success).toBe(true);
    expect(NotificationChannelsSchema.safeParse({ email: true }).success).toBe(false);
    expect(NotificationChannelsSchema.safeParse({}).success).toBe(false);
  });
});
