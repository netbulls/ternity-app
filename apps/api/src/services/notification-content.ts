import type {
  NotificationEmailThemeMode,
  NotificationSettings,
  NotificationType,
  NotificationTemplateVariant,
} from '@ternity/shared';

interface NotificationCopy {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  meta: string;
  ctaLabel: string;
  accent: string;
}

interface ThemePalette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  buttonText: string;
}

function buildNotificationCopy(
  type: NotificationType,
  settings: NotificationSettings,
): NotificationCopy {
  switch (type) {
    case 'forgotToStart':
      return {
        subject: '[Ternity] Forgot to start timer',
        preheader: `No timer started after ${settings.timer.forgotToStart.thresholdMinutes} minutes.`,
        heading: 'Forgot to start timer',
        body: `You do not have an active timer, and your schedule start reminder threshold (${settings.timer.forgotToStart.thresholdMinutes}m) has passed.`,
        meta: `Threshold: ${settings.timer.forgotToStart.thresholdMinutes} minutes after schedule start`,
        ctaLabel: 'Start timer in Ternity',
        accent: '#f59e0b',
      };
    case 'forgotToStop':
      return {
        subject: '[Ternity] Forgot to stop timer',
        preheader: `Timer still running ${settings.timer.forgotToStop.thresholdMinutes} minutes after schedule end.`,
        heading: 'Forgot to stop timer',
        body: `Your timer still appears to be running, and the stop reminder threshold (${settings.timer.forgotToStop.thresholdMinutes}m) has passed.`,
        meta: `Threshold: ${settings.timer.forgotToStop.thresholdMinutes} minutes after schedule end`,
        ctaLabel: 'Stop timer in Ternity',
        accent: '#3b82f6',
      };
    case 'longTimer':
      return {
        subject: '[Ternity] Long running timer',
        preheader: `A timer has been running longer than ${settings.timer.longTimer.thresholdHours} hours.`,
        heading: 'Long timer detected',
        body: `One of your timers has been running continuously longer than your long-timer threshold (${settings.timer.longTimer.thresholdHours}h).`,
        meta: `Threshold: ${settings.timer.longTimer.thresholdHours} hours continuous`,
        ctaLabel: 'Review active timer',
        accent: '#8b5cf6',
      };
    case 'leaveRequestUpdate':
      return {
        subject: '[Ternity] Leave request update',
        preheader: 'Your leave request status has changed.',
        heading: 'Leave request updated',
        body: 'Your leave request has been reviewed. Open Ternity to see the latest decision and details.',
        meta: 'Example: Approved for 3-5 Mar 2026',
        ctaLabel: 'View leave request',
        accent: '#3b82f6',
      };
    case 'teamLeave':
      return {
        subject: '[Ternity] Team leave alert',
        preheader: 'Someone on your team booked time off.',
        heading: 'Team leave notification',
        body: 'A teammate has booked leave. Open Ternity to review team availability for upcoming days.',
        meta: 'Example: Anna Kowalska is off tomorrow',
        ctaLabel: 'Check team calendar',
        accent: '#2563eb',
      };
    case 'weeklyReport':
      return {
        subject: '[Ternity] Weekly hours report',
        preheader: `Your weekly summary (${settings.weekly.hoursReport.day === 'monday' ? 'Monday' : 'Friday'} delivery).`,
        heading: 'Weekly summary is ready',
        body: 'Your weekly tracked hours summary is available. Open Ternity for a detailed project and day-by-day breakdown.',
        meta: `Delivery day: ${settings.weekly.hoursReport.day === 'monday' ? 'Monday' : 'Friday'}`,
        ctaLabel: 'Open weekly report',
        accent: '#00d4aa',
      };
  }

  const neverType: never = type;
  throw new Error(`Unsupported notification type: ${String(neverType)}`);
}

function getPalette(mode: Exclude<NotificationEmailThemeMode, 'auto'>): ThemePalette {
  if (mode === 'dark') {
    return {
      bg: '#0b0f14',
      card: '#121821',
      text: '#e5ecf4',
      muted: '#9fb0c3',
      border: '#233042',
      buttonText: '#08131f',
    };
  }

  return {
    bg: '#f4f7fb',
    card: '#ffffff',
    text: '#0f172a',
    muted: '#556379',
    border: '#dce5f0',
    buttonText: '#ffffff',
  };
}

export function renderNotificationEmailTemplate(input: {
  type: NotificationType;
  userName: string;
  settings: NotificationSettings;
  variant: NotificationTemplateVariant;
  themeMode: NotificationEmailThemeMode;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const copy = buildNotificationCopy(input.type, input.settings);
  const appUrl = input.appUrl ?? process.env.APP_URL ?? 'http://localhost:5173';
  const light = getPalette('light');
  const dark = getPalette('dark');
  const selected = input.themeMode === 'dark' ? dark : light;

  const autoStyles =
    input.themeMode === 'auto'
      ? `
        <style>
          @media (prefers-color-scheme: dark) {
            .tn-bg { background: ${dark.bg} !important; }
            .tn-card { background: ${dark.card} !important; border-color: ${dark.border} !important; }
            .tn-text { color: ${dark.text} !important; }
            .tn-muted { color: ${dark.muted} !important; }
          }
        </style>
      `
      : '';

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${autoStyles}
  </head>
  <body class="tn-bg" style="margin:0;padding:0;background:${selected.bg};font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table class="tn-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${selected.card};border:1px solid ${selected.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:18px 22px;border-bottom:1px solid ${selected.border};">
                <div style="font-family:Oxanium,Inter,Arial,sans-serif;font-weight:700;letter-spacing:1px;font-size:14px;color:${selected.text};">TERNITY</div>
                <div class="tn-muted" style="font-size:12px;color:${selected.muted};margin-top:4px;">${copy.preheader}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px;">
                <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${copy.accent}1a;color:${copy.accent};font-size:11px;font-weight:600;letter-spacing:0.3px;">
                  ${input.variant.toUpperCase()} template
                </div>
                <h1 class="tn-text" style="margin:12px 0 8px;font-family:Oxanium,Inter,Arial,sans-serif;font-size:22px;line-height:1.3;color:${selected.text};">${copy.heading}</h1>
                <p class="tn-text" style="margin:0;font-size:14px;line-height:1.55;color:${selected.text};">Hi ${input.userName}, ${copy.body}</p>

                <div style="margin-top:14px;padding:10px 12px;border:1px solid ${selected.border};border-radius:8px;">
                  <span class="tn-muted" style="font-size:12px;color:${selected.muted};">${copy.meta}</span>
                </div>

                <div style="margin-top:18px;">
                  <a href="${appUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:${copy.accent};color:${selected.buttonText};font-size:13px;font-weight:600;text-decoration:none;">
                    ${copy.ctaLabel}
                  </a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 22px;border-top:1px solid ${selected.border};">
                <p class="tn-muted" style="margin:0;font-size:11px;line-height:1.5;color:${selected.muted};">
                  You receive this because notifications are enabled in your Ternity settings.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const text = `${copy.heading}\n\nHi ${input.userName}, ${copy.body}\n\n${copy.meta}\n\n${copy.ctaLabel}: ${appUrl}`;

  return {
    subject: copy.subject,
    html,
    text,
  };
}

export function renderNotificationSmsPreview(input: {
  type: NotificationType;
  settings: NotificationSettings;
}): string {
  switch (input.type) {
    case 'forgotToStart':
      return `Ternity: No active timer after ${input.settings.timer.forgotToStart.thresholdMinutes}m from your planned start.`;
    case 'forgotToStop':
      return `Ternity: Your timer is still running ${input.settings.timer.forgotToStop.thresholdMinutes}m after planned end.`;
    case 'longTimer':
      return `Ternity: Timer has been running longer than ${input.settings.timer.longTimer.thresholdHours}h.`;
    case 'leaveRequestUpdate':
      return 'Ternity: Your leave request status was updated. Open the app for details.';
    case 'teamLeave':
      return 'Ternity: Team leave update. Open calendar to review availability.';
    case 'weeklyReport':
      return 'Ternity: Your weekly hours report is ready.';
  }

  const neverType: never = input.type;
  throw new Error(`Unsupported notification type: ${String(neverType)}`);
}
