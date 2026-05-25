import { describe, expect, it } from 'vitest';
import type { NotificationSettings } from '@ternity/shared';
import {
  renderNotificationEmailTemplate,
  renderNotificationSmsPreview,
} from './notification-content.js';

// Characterization tests for apps/api/src/services/notification-content.ts.
// Pure functions — no DB, no services called. We assert on actual rendered
// content to pin output contracts and catch regressions.

// ─── minimal settings fixture ─────────────────────────────────────────────────

const BASE_SETTINGS: NotificationSettings = {
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
    teamLeave: { enabled: true, channels: { email: true, sms: false } },
  },
  weekly: {
    enabled: true,
    hoursReport: { enabled: true, day: 'monday', channels: { email: true, sms: false } },
  },
};

// ─── renderNotificationSmsPreview ─────────────────────────────────────────────

describe('renderNotificationSmsPreview', () => {
  it('forgotToStart: includes threshold from settings', () => {
    const text = renderNotificationSmsPreview({ type: 'forgotToStart', settings: BASE_SETTINGS });
    expect(text).toContain('15m');
    expect(text).toMatch(/Ternity:/);
  });

  it('forgotToStart: threshold reflects non-default value', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.timer.forgotToStart.thresholdMinutes = 60;
    const text = renderNotificationSmsPreview({ type: 'forgotToStart', settings });
    expect(text).toContain('60m');
  });

  it('forgotToStop: includes threshold from settings', () => {
    const text = renderNotificationSmsPreview({ type: 'forgotToStop', settings: BASE_SETTINGS });
    expect(text).toContain('30m');
    expect(text).toMatch(/timer.*running/i);
  });

  it('forgotToStop: threshold reflects non-default value', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.timer.forgotToStop.thresholdMinutes = 45;
    const text = renderNotificationSmsPreview({ type: 'forgotToStop', settings });
    expect(text).toContain('45m');
  });

  it('longTimer: includes threshold in hours', () => {
    const text = renderNotificationSmsPreview({ type: 'longTimer', settings: BASE_SETTINGS });
    expect(text).toContain('4h');
    expect(text).toMatch(/timer.*running/i);
  });

  it('longTimer: threshold reflects non-default value', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.timer.longTimer.thresholdHours = 8;
    const text = renderNotificationSmsPreview({ type: 'longTimer', settings });
    expect(text).toContain('8h');
  });

  it('leaveRequestUpdate: returns a static string (no settings interpolation)', () => {
    const text = renderNotificationSmsPreview({ type: 'leaveRequestUpdate', settings: BASE_SETTINGS });
    expect(text).toContain('leave request');
    expect(text).toMatch(/Ternity:/);
  });

  it('teamLeave: returns a static string', () => {
    const text = renderNotificationSmsPreview({ type: 'teamLeave', settings: BASE_SETTINGS });
    expect(text).toContain('Team leave');
    expect(text).toMatch(/Ternity:/);
  });

  it('weeklyReport: returns a static string', () => {
    const text = renderNotificationSmsPreview({ type: 'weeklyReport', settings: BASE_SETTINGS });
    expect(text).toContain('weekly hours report');
    expect(text).toMatch(/Ternity:/);
  });

  it('all types return a non-empty string', () => {
    const types = [
      'forgotToStart',
      'forgotToStop',
      'longTimer',
      'leaveRequestUpdate',
      'teamLeave',
      'weeklyReport',
    ] as const;
    for (const type of types) {
      const text = renderNotificationSmsPreview({ type, settings: BASE_SETTINGS });
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ─── renderNotificationEmailTemplate — return shape ───────────────────────────

describe('renderNotificationEmailTemplate — return shape', () => {
  const baseInput = {
    type: 'forgotToStart' as const,
    userName: 'Elena Marsh',
    settings: BASE_SETTINGS,
    variant: 'v3' as const,
    themeMode: 'light' as const,
    appUrl: 'https://app.ternity.xyz',
  };

  it('returns { subject, html, text } for all types', () => {
    const types = [
      'forgotToStart',
      'forgotToStop',
      'longTimer',
      'leaveRequestUpdate',
      'teamLeave',
      'weeklyReport',
    ] as const;
    for (const type of types) {
      const result = renderNotificationEmailTemplate({ ...baseInput, type });
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(typeof result.subject).toBe('string');
      expect(typeof result.html).toBe('string');
      expect(typeof result.text).toBe('string');
    }
  });
});

// ─── renderNotificationEmailTemplate — subject lines ─────────────────────────

describe('renderNotificationEmailTemplate — subject lines', () => {
  const base = {
    userName: 'James Oakley',
    settings: BASE_SETTINGS,
    variant: 'v3' as const,
    themeMode: 'light' as const,
    appUrl: 'https://app.ternity.xyz',
  };

  it('forgotToStart: subject is "[Ternity] Forgot to start timer"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'forgotToStart' });
    expect(subject).toBe('[Ternity] Forgot to start timer');
  });

  it('forgotToStop: subject is "[Ternity] Forgot to stop timer"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'forgotToStop' });
    expect(subject).toBe('[Ternity] Forgot to stop timer');
  });

  it('longTimer: subject is "[Ternity] Long running timer"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'longTimer' });
    expect(subject).toBe('[Ternity] Long running timer');
  });

  it('leaveRequestUpdate: subject is "[Ternity] Leave request update"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'leaveRequestUpdate' });
    expect(subject).toBe('[Ternity] Leave request update');
  });

  it('teamLeave: subject is "[Ternity] Team leave alert"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'teamLeave' });
    expect(subject).toBe('[Ternity] Team leave alert');
  });

  it('weeklyReport: subject is "[Ternity] Weekly hours report"', () => {
    const { subject } = renderNotificationEmailTemplate({ ...base, type: 'weeklyReport' });
    expect(subject).toBe('[Ternity] Weekly hours report');
  });
});

// ─── renderNotificationEmailTemplate — text field ─────────────────────────────

describe('renderNotificationEmailTemplate — plain text output', () => {
  const base = {
    settings: BASE_SETTINGS,
    variant: 'v3' as const,
    themeMode: 'light' as const,
    appUrl: 'https://example.ternity.test',
  };

  it('includes the user name in the greeting', () => {
    const { text } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      userName: 'Alex Morgan',
    });
    expect(text).toContain('Alex Morgan');
  });

  it('includes the appUrl as the CTA link', () => {
    const { text } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      userName: 'X',
    });
    expect(text).toContain('https://example.ternity.test');
  });

  it('forgotToStart: text contains threshold minutes', () => {
    const { text } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      userName: 'X',
    });
    expect(text).toContain('15');
  });

  it('forgotToStop: text contains threshold minutes', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.timer.forgotToStop.thresholdMinutes = 45;
    const { text } = renderNotificationEmailTemplate({
      ...base,
      settings,
      type: 'forgotToStop',
      userName: 'X',
    });
    expect(text).toContain('45');
  });

  it('longTimer: text contains threshold hours', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.timer.longTimer.thresholdHours = 6;
    const { text } = renderNotificationEmailTemplate({
      ...base,
      settings,
      type: 'longTimer',
      userName: 'X',
    });
    expect(text).toContain('6');
  });

  it('weeklyReport/monday: text mentions Monday delivery', () => {
    const { text } = renderNotificationEmailTemplate({
      ...base,
      type: 'weeklyReport',
      userName: 'X',
    });
    expect(text.toLowerCase()).toContain('monday');
  });

  it('weeklyReport/friday: text mentions Friday delivery', () => {
    const settings = structuredClone(BASE_SETTINGS);
    settings.weekly.hoursReport.day = 'friday';
    const { text } = renderNotificationEmailTemplate({
      ...base,
      settings,
      type: 'weeklyReport',
      userName: 'X',
    });
    expect(text.toLowerCase()).toContain('friday');
  });
});

// ─── renderNotificationEmailTemplate — HTML field ────────────────────────────

describe('renderNotificationEmailTemplate — HTML structure', () => {
  const base = {
    userName: 'Elena Marsh',
    settings: BASE_SETTINGS,
    variant: 'v3' as const,
    appUrl: 'https://app.ternity.xyz',
  };

  it('HTML is a full document starting with <!doctype html>', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('includes the user name in the HTML body', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    expect(html).toContain('Elena Marsh');
  });

  it('includes the appUrl as an anchor href', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    expect(html).toContain('https://app.ternity.xyz');
  });

  it('includes the variant label uppercased in HTML', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    expect(html).toContain('V3 template');
  });

  it('light mode: uses light palette background color', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    // Light palette bg is #f4f7fb (per getPalette in source)
    expect(html).toContain('#f4f7fb');
  });

  it('dark mode: uses dark palette background color', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'dark',
    });
    // Dark palette bg is #0b0f14 (per getPalette in source)
    expect(html).toContain('#0b0f14');
  });

  it('auto mode: injects @media prefers-color-scheme style block', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'auto',
    });
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('light/dark modes: do NOT inject @media block', () => {
    for (const themeMode of ['light', 'dark'] as const) {
      const { html } = renderNotificationEmailTemplate({ ...base, type: 'forgotToStart', themeMode });
      expect(html).not.toContain('prefers-color-scheme');
    }
  });

  it('forgotToStart: accent color #f59e0b appears in HTML', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStart',
      themeMode: 'light',
    });
    expect(html).toContain('#f59e0b');
  });

  it('forgotToStop: accent color #3b82f6 appears in HTML', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'forgotToStop',
      themeMode: 'light',
    });
    expect(html).toContain('#3b82f6');
  });

  it('longTimer: accent color #8b5cf6 appears in HTML', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'longTimer',
      themeMode: 'light',
    });
    expect(html).toContain('#8b5cf6');
  });

  it('weeklyReport: accent color #00d4aa appears in HTML', () => {
    const { html } = renderNotificationEmailTemplate({
      ...base,
      type: 'weeklyReport',
      themeMode: 'light',
    });
    expect(html).toContain('#00d4aa');
  });

  it('falls back to process.env.APP_URL when appUrl is not provided', () => {
    // The function uses: input.appUrl ?? process.env.APP_URL ?? 'http://localhost:5173'
    // Without appUrl, it falls back to APP_URL env var or the localhost default.
    const { html, text } = renderNotificationEmailTemplate({
      type: 'forgotToStart',
      userName: 'X',
      settings: BASE_SETTINGS,
      variant: 'v3',
      themeMode: 'light',
      // appUrl deliberately omitted
    });
    const fallback = process.env.APP_URL ?? 'http://localhost:5173';
    expect(html).toContain(fallback);
    expect(text).toContain(fallback);
  });
});
