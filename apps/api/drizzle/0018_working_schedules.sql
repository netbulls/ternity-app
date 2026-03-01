-- Migration: Add per-user weekly working schedules
-- This migration:
-- 1. Creates working_schedules table (one row per user)
-- 2. Seeds default schedule for all existing users

-- NOTE: drizzle-kit wraps migrations in its own transaction — do not add BEGIN/COMMIT.

-- ── Step 1: Create table ──────────────────────────────────────────────────

CREATE TABLE "working_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "schedule" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "working_schedules_user_id_idx" ON "working_schedules" ("user_id");

-- ── Step 2: Seed defaults for all current users ───────────────────────────

INSERT INTO "working_schedules" ("user_id", "schedule")
SELECT
  u.id,
  '{
    "mon": {"enabled": true,  "start": "08:30", "end": "16:30"},
    "tue": {"enabled": true,  "start": "08:30", "end": "16:30"},
    "wed": {"enabled": true,  "start": "08:30", "end": "16:30"},
    "thu": {"enabled": true,  "start": "08:30", "end": "16:30"},
    "fri": {"enabled": true,  "start": "08:30", "end": "16:30"},
    "sat": {"enabled": false, "start": "08:30", "end": "16:30"},
    "sun": {"enabled": false, "start": "08:30", "end": "16:30"}
  }'::jsonb
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "working_schedules" ws WHERE ws.user_id = u.id
);
