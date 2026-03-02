# Notifications Implementation Plan

Date: 2026-02-28
Status: Ready for implementation after service setup checks

## Confirmed Product Decisions

- Include all notification types from the approved exploration set.
- Always show both channels (Email + SMS); if unsupported/unavailable, show disabled state instead of hiding.
- Phone number source:
  - default to Logto login phone (`primaryPhone` synced to local `users.phone`)
  - allow per-user override for notifications
  - if override is removed, fallback to Logto phone
- SMS provider: Twilio (reuse credentials already used in `netbulls.ternity.auth`).
- Email provider: Resend (pattern reused from `erace.weather`).
- Email templates are a dedicated follow-up discussion (structure/content to be finalized separately).

## Scope (v1)

- Add per-user notification settings storage.
- Add Settings tab/panel implementing approved V6 UX.
- Implement provider service wrappers for email (Resend) and SMS (Twilio).
- Keep actual rule execution/delivery scheduler as a subsequent step if needed.

## Notification Types (v1)

- Timer reminders
  - Forgot to start (threshold: 15/30/45/60m)
  - Forgot to stop (threshold: 15/30/45/60m)
  - Long timer (threshold: 2/4/6/8h)
- Leave & absence
  - Leave request updates
  - Team leave
- Weekly summary
  - Weekly hours report (day: Monday/Friday)

## Data Model

- New table: `notification_settings`
  - `id uuid pk`
  - `user_id uuid not null unique` (FK to `users.id`)
  - `settings jsonb not null` (`NotificationSettings` shape)
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- Phone override storage (recommended):
  - add nullable column `users.notification_phone`
  - effective phone: `users.notification_phone ?? users.phone`

## Shared Types

- New file: `packages/shared/src/notification-settings.ts`
  - channel schema (`email`, `sms` booleans)
  - group + item schemas
  - `NotificationSettingsSchema`
  - `DEFAULT_NOTIFICATION_SETTINGS`
  - exported TS types
- Export from `packages/shared/src/index.ts`.

## Migration

- New migration: `apps/api/drizzle/0019_notification_settings.sql`
  - create table
  - seed defaults for all existing users
  - (optional in same migration) add `users.notification_phone`
- Journal update: `apps/api/drizzle/meta/_journal.json` (next idx after working-hours).

## API

- New route file: `apps/api/src/routes/notification-settings.ts`
  - `GET /api/notification-settings`
    - return row if exists
    - fallback to defaults
  - `PUT /api/notification-settings`
    - validate and upsert by `user_id`

- Phone sync/backfill:
  - extend `/api/me` Logto refresh to sync `primaryPhone` into `users.phone`
  - add one-time backfill command for existing users (Logto Management API)

- Register route in `apps/api/src/app.ts`.

## Provider Services

- Email service: `apps/api/src/services/email.ts`
  - `resend.emails.send({ from, to, subject, html })`
  - env: `RESEND_API_KEY`
  - sender: `Ternity <noreply@ternity.xyz>` (after domain verification)

- SMS service: `apps/api/src/services/sms.ts`
  - Twilio SDK with Messaging Service SID
  - env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`

## Frontend

- New hook file: `apps/web/src/hooks/use-notification-settings.ts`
  - `useNotificationSettings()` query
  - `useUpdateNotificationSettings()` mutation

- Settings integration:
  - add Notifications tab in `apps/web/src/pages/settings.tsx`
  - new panel component `apps/web/src/components/settings/notifications-panel.tsx`
  - implement approved V6 behavior:
    - top timeline preview with marker colors (`chart-4`, `chart-3`, `chart-5`)
    - compact one-line rows in accordion groups
    - channels always visible with disabled states where applicable
    - contact row showing effective email + effective phone

## Delivery Engine (Deferred Follow-up)

- Job/scheduler that evaluates reminder conditions and sends messages.
- Event hooks for leave status changes.
- Weekly summary generation and dispatch.
- Final email template set.

## Implementation Sequence

1. Shared schemas/types + exports
2. DB schema + migration + journal
3. API settings route + registration
4. Phone sync/backfill support
5. Provider wrappers (Resend/Twilio)
6. Frontend hooks + settings panel
7. Build/test pass
