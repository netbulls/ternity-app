-- Migration 0026: Contractor default leave type
-- Adds is_contractor_default column to leave_types.
-- Exactly one leave type should be marked as the contractor default.
-- That type is auto-assigned to contractors (they never pick a leave type).
-- The contractor default leave type cannot be deleted.

ALTER TABLE "leave_types"
  ADD COLUMN IF NOT EXISTS "is_contractor_default" boolean NOT NULL DEFAULT false;

-- Ensure at most one contractor default via a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_contractor_default_unique"
  ON "leave_types" ("is_contractor_default")
  WHERE "is_contractor_default" = true;

-- Seed: set "Przerwa w świadczeniu usług" as the contractor default if it exists
UPDATE "leave_types"
  SET "is_contractor_default" = true
  WHERE "id" = (
    SELECT "id" FROM "leave_types"
    WHERE "name" ILIKE 'Przerwa w %wiadczeniu us%ug%'
      AND "visibility" IN ('contractor', 'all')
    LIMIT 1
  );
