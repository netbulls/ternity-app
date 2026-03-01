-- Migration: Add per-user notification settings
-- This migration:
-- 1. Creates notification_settings table (one row per user)
-- 2. Seeds default settings for all existing users

-- NOTE: drizzle-kit wraps migrations in its own transaction — do not add BEGIN/COMMIT.

-- ── Step 1: Create settings table ─────────────────────────────────────────

CREATE TABLE "notification_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "settings" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "notification_settings_user_id_idx" ON "notification_settings" ("user_id");

-- ── Step 2: Seed defaults for all current users ───────────────────────────

INSERT INTO "notification_settings" ("user_id", "settings")
SELECT
  u.id,
  '{
    "phoneOverride": null,
    "emailTemplateVariant": "v3",
    "emailThemeMode": "auto",
    "timer": {
      "enabled": true,
      "forgotToStart": {
        "enabled": true,
        "thresholdMinutes": 15,
        "channels": {"email": true, "sms": true}
      },
      "forgotToStop": {
        "enabled": true,
        "thresholdMinutes": 30,
        "channels": {"email": true, "sms": true}
      },
      "longTimer": {
        "enabled": true,
        "thresholdHours": 4,
        "channels": {"email": true, "sms": true}
      }
    },
    "leave": {
      "enabled": true,
      "requestUpdates": {
        "enabled": true,
        "channels": {"email": true, "sms": true}
      },
      "teamLeave": {
        "enabled": true,
        "channels": {"email": true, "sms": false}
      }
    },
    "weekly": {
      "enabled": true,
      "hoursReport": {
        "enabled": true,
        "day": "monday",
        "channels": {"email": true, "sms": false}
      }
    }
  }'::jsonb
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_settings" ns WHERE ns.user_id = u.id
);
