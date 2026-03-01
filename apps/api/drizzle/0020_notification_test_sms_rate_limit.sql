-- Migration: Add SMS test send log table for rate limiting
-- This migration:
-- 1. Creates notification_test_sms_logs table
-- 2. Adds index for per-user time-window queries

-- NOTE: drizzle-kit wraps migrations in its own transaction — do not add BEGIN/COMMIT.

CREATE TABLE "notification_test_sms_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "to_phone" text NOT NULL,
  "notification_type" text NOT NULL,
  "sid" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "notification_test_sms_logs_user_created_idx"
  ON "notification_test_sms_logs" ("user_id", "created_at");
