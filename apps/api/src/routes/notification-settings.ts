import { FastifyInstance } from 'fastify';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  NotificationTypeSchema,
} from '@ternity/shared';
import { z } from 'zod';
import { db } from '../db/index.js';
import { notificationSettings, notificationTestSmsLogs } from '../db/schema.js';
import { sendEmail } from '../services/email.js';
import { sendSms } from '../services/sms.js';
import {
  renderNotificationEmailTemplate,
  renderNotificationSmsPreview,
} from '../services/notification-content.js';

const NotificationTestRequestSchema = z.object({
  type: NotificationTypeSchema.default('forgotToStart'),
});

const SMS_TEST_LIMIT_PER_HOUR = 5;
const SMS_TEST_WINDOW_MS = 60 * 60 * 1000;

export async function notificationSettingsRoutes(fastify: FastifyInstance) {
  async function getUserSettings(userId: string) {
    const [row] = await db
      .select({ settings: notificationSettings.settings })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1);

    if (!row) return DEFAULT_NOTIFICATION_SETTINGS;
    return NotificationSettingsSchema.parse(row.settings);
  }

  fastify.get('/api/notification-settings', async (request) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    return getUserSettings(userId);
  });

  fastify.put('/api/notification-settings', async (request, reply) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    const parsed = NotificationSettingsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid notification settings',
        details: parsed.error.flatten(),
      });
    }

    const [saved] = await db
      .insert(notificationSettings)
      .values({
        userId,
        settings: parsed.data,
      })
      .onConflictDoUpdate({
        target: notificationSettings.userId,
        set: {
          settings: parsed.data,
          updatedAt: new Date(),
        },
      })
      .returning({ settings: notificationSettings.settings });

    return NotificationSettingsSchema.parse(saved!.settings);
  });

  fastify.post('/api/notification-settings/test-email', async (request, reply) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    const parsed = NotificationTestRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid test email payload',
        details: parsed.error.flatten(),
      });
    }

    const email = request.auth.email;
    if (!email) {
      return reply.code(400).send({ error: 'No email configured for current user' });
    }

    const settings = await getUserSettings(userId);
    const rendered = renderNotificationEmailTemplate({
      type: parsed.data.type,
      userName: request.auth.displayName,
      settings,
      variant: settings.emailTemplateVariant,
      themeMode: settings.emailThemeMode,
    });

    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return {
      ok: true,
      channel: 'email',
      to: email,
      messageId: result.id,
      type: parsed.data.type,
    };
  });

  fastify.post('/api/notification-settings/test-sms', async (request, reply) => {
    const userId = request.auth.realUserId ?? request.auth.userId;
    const parsed = NotificationTestRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid test sms payload',
        details: parsed.error.flatten(),
      });
    }

    const settings = await getUserSettings(userId);
    const phone = settings.phoneOverride?.trim() || request.auth.phone;
    if (!phone) {
      return reply.code(400).send({ error: 'No phone configured for current user' });
    }

    const windowStart = new Date(Date.now() - SMS_TEST_WINDOW_MS);
    const [usage] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationTestSmsLogs)
      .where(
        and(
          eq(notificationTestSmsLogs.userId, userId),
          gte(notificationTestSmsLogs.createdAt, windowStart),
        ),
      );

    const sentLastHour = usage?.count ?? 0;
    if (sentLastHour >= SMS_TEST_LIMIT_PER_HOUR) {
      return reply.code(429).send({
        error: `SMS test limit reached (${SMS_TEST_LIMIT_PER_HOUR} per hour)`,
        sentLastHour,
        retryAfterSeconds: 60,
      });
    }

    const message = renderNotificationSmsPreview({
      type: parsed.data.type,
      settings,
    });

    const result = await sendSms({
      to: phone,
      body: message,
    });

    await db.insert(notificationTestSmsLogs).values({
      userId,
      toPhone: phone,
      notificationType: parsed.data.type,
      sid: result.sid,
    });

    return {
      ok: true,
      channel: 'sms',
      to: phone,
      sid: result.sid,
      status: result.status,
      type: parsed.data.type,
      sentLastHour: sentLastHour + 1,
      limitPerHour: SMS_TEST_LIMIT_PER_HOUR,
    };
  });
}
