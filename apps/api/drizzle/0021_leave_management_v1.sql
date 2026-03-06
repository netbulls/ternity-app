-- Migration: Leave management Phase 1 (contractor flow)
-- This migration:
-- 1. Adds 'autoconfirmed' to leave_status enum
-- 2. Adds 'employment_type' column to users table
-- 3. Makes project_id nullable on leave_requests (contractors don't specify a project)
-- 4. Adds 'hours' column to leave_requests for partial-day bookings

-- NOTE: drizzle-kit wraps migrations in its own transaction — do not add BEGIN/COMMIT.

-- ── Step 1: Add 'autoconfirmed' to leave_status enum ──────────────────────

ALTER TYPE "leave_status" ADD VALUE IF NOT EXISTS 'autoconfirmed';

-- ── Step 2: Add employment_type to users ──────────────────────────────────

-- Default 'contractor' — everyone starts as contractor (Phase 1)
ALTER TABLE "users" ADD COLUMN "employment_type" text NOT NULL DEFAULT 'contractor';

-- ── Step 3: Make project_id nullable on leave_requests ────────────────────

-- Existing synced data has project_id set (the "Leave" placeholder project).
-- Native contractor bookings won't specify a project.
ALTER TABLE "leave_requests" ALTER COLUMN "project_id" DROP NOT NULL;

-- ── Step 4: Add hours column for partial-day bookings ─────────────────────

-- NULL = full-day booking, 1-4 = partial-day hours
ALTER TABLE "leave_requests" ADD COLUMN "hours" integer;
