import { z } from 'zod';

const StartStopThresholdSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);
const LongTimerThresholdSchema = z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]);

export const NotificationTemplateVariantSchema = z.literal('v3');
export const NotificationEmailThemeModeSchema = z.union([
  z.literal('light'),
  z.literal('dark'),
  z.literal('auto'),
]);

export type NotificationTemplateVariant = z.infer<typeof NotificationTemplateVariantSchema>;
export type NotificationEmailThemeMode = z.infer<typeof NotificationEmailThemeModeSchema>;

export const NotificationTypeSchema = z.union([
  z.literal('forgotToStart'),
  z.literal('forgotToStop'),
  z.literal('longTimer'),
  z.literal('leaveRequestUpdate'),
  z.literal('teamLeave'),
  z.literal('weeklyReport'),
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationChannelsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
});

export type NotificationChannels = z.infer<typeof NotificationChannelsSchema>;

export const StartStopReminderSchema = z.object({
  enabled: z.boolean(),
  thresholdMinutes: StartStopThresholdSchema,
  channels: NotificationChannelsSchema,
});

export const LongTimerReminderSchema = z.object({
  enabled: z.boolean(),
  thresholdHours: LongTimerThresholdSchema,
  channels: NotificationChannelsSchema,
});

export const LeaveReminderSchema = z.object({
  enabled: z.boolean(),
  channels: NotificationChannelsSchema,
});

export const WeeklyHoursReportSchema = z.object({
  enabled: z.boolean(),
  day: z.union([z.literal('monday'), z.literal('friday')]),
  channels: NotificationChannelsSchema,
});

export const NotificationSettingsSchema = z.object({
  phoneOverride: z.string().nullable().default(null),
  emailTemplateVariant: NotificationTemplateVariantSchema.default('v3'),
  emailThemeMode: NotificationEmailThemeModeSchema.default('auto'),
  timer: z.object({
    enabled: z.boolean(),
    forgotToStart: StartStopReminderSchema,
    forgotToStop: StartStopReminderSchema,
    longTimer: LongTimerReminderSchema,
  }),
  leave: z.object({
    enabled: z.boolean(),
    requestUpdates: LeaveReminderSchema,
    teamLeave: LeaveReminderSchema,
  }),
  weekly: z.object({
    enabled: z.boolean(),
    hoursReport: WeeklyHoursReportSchema,
  }),
});

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  phoneOverride: null,
  emailTemplateVariant: 'v3',
  emailThemeMode: 'auto',
  timer: {
    enabled: true,
    forgotToStart: {
      enabled: true,
      thresholdMinutes: 15,
      channels: { email: true, sms: true },
    },
    forgotToStop: {
      enabled: true,
      thresholdMinutes: 30,
      channels: { email: true, sms: true },
    },
    longTimer: {
      enabled: true,
      thresholdHours: 4,
      channels: { email: true, sms: true },
    },
  },
  leave: {
    enabled: true,
    requestUpdates: {
      enabled: true,
      channels: { email: true, sms: true },
    },
    teamLeave: {
      enabled: true,
      channels: { email: true, sms: false },
    },
  },
  weekly: {
    enabled: true,
    hoursReport: {
      enabled: true,
      day: 'monday',
      channels: { email: true, sms: false },
    },
  },
};
