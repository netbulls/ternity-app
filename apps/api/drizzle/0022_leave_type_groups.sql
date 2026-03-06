-- Migration 0022: Leave type groups + leave type admin controls
-- Adds: leave_type_groups table, group_id/active/visibility columns on leave_types

-- Create leave type groups table
CREATE TABLE IF NOT EXISTS "leave_type_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Add new columns to leave_types
ALTER TABLE "leave_types"
  ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "leave_type_groups"("id"),
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'all';

-- visibility values: 'all' | 'contractor' | 'employee'
-- When 'all', both employment types see the leave type
-- When 'contractor' or 'employee', only that employment type sees it

-- Create index on group_id for efficient joins
CREATE INDEX IF NOT EXISTS "leave_types_group_id_idx" ON "leave_types" ("group_id");
