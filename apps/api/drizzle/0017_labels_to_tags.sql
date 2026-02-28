-- Migration: Rename labels → tags, make tags per-user, set tagsEnabled preference
-- This migration:
-- 1. Renames tables: labels → tags, entry_labels → entry_tags
-- 2. Renames columns: label_id → tag_id
-- 3. Adds user_id to tags (nullable initially, then populated, then NOT NULL)
-- 4. Duplicates shared tags so each user gets their own copy
-- 5. Sets tagsEnabled = true in preferences for users who have tagged entries
-- 6. Updates sync_mappings target_table from 'labels' to 'tags'
-- 7. Drops orphan tags (no entries, no user)

BEGIN;

-- ── Step 1: Rename tables and columns ────────────────────────────────────

-- Rename entry_labels first (depends on labels)
ALTER TABLE "entry_labels" RENAME TO "entry_tags";
ALTER TABLE "entry_tags" RENAME COLUMN "label_id" TO "tag_id";

-- Rename the unique index on entry_tags
ALTER INDEX "entry_labels_entry_label_idx" RENAME TO "entry_tags_entry_tag_idx";

-- Rename labels table
ALTER TABLE "labels" RENAME TO "tags";

-- ── Step 2: Add user_id column (nullable initially) ──────────────────────

ALTER TABLE "tags" ADD COLUMN "user_id" uuid REFERENCES "users"("id");

-- ── Step 3: Assign user_id to tags ───────────────────────────────────────
-- For each tag, find users who have entries with that tag.
-- If only one user uses a tag, assign it directly.
-- If multiple users use the same tag, we need to duplicate it.

-- First: assign tags used by exactly one user
UPDATE "tags" SET "user_id" = sub.user_id
FROM (
  SELECT et.tag_id, (array_agg(DISTINCT te.user_id))[1] AS user_id
  FROM "entry_tags" et
  JOIN "time_entries" te ON te.id = et.entry_id
  GROUP BY et.tag_id
  HAVING COUNT(DISTINCT te.user_id) = 1
) sub
WHERE "tags".id = sub.tag_id;

-- Second: handle tags used by multiple users — duplicate for each user
-- We use a DO block for procedural logic
DO $$
DECLARE
  shared_tag RECORD;
  user_rec RECORD;
  new_tag_id uuid;
BEGIN
  -- Find tags used by multiple users
  FOR shared_tag IN
    SELECT t.id, t.name, t.color
    FROM "tags" t
    WHERE t.user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM "entry_tags" et
        JOIN "time_entries" te ON te.id = et.entry_id
        WHERE et.tag_id = t.id
      )
      AND (
        SELECT COUNT(DISTINCT te.user_id)
        FROM "entry_tags" et
        JOIN "time_entries" te ON te.id = et.entry_id
        WHERE et.tag_id = t.id
      ) > 1
  LOOP
    -- For each user who uses this tag, create a copy
    FOR user_rec IN
      SELECT DISTINCT te.user_id
      FROM "entry_tags" et
      JOIN "time_entries" te ON te.id = et.entry_id
      WHERE et.tag_id = shared_tag.id
    LOOP
      -- Create user-specific copy
      INSERT INTO "tags" (name, color, user_id)
      VALUES (shared_tag.name, shared_tag.color, user_rec.user_id)
      RETURNING id INTO new_tag_id;

      -- Re-point this user's entry_tags to the new tag
      UPDATE "entry_tags" SET tag_id = new_tag_id
      WHERE tag_id = shared_tag.id
        AND entry_id IN (
          SELECT te.id FROM "time_entries" te
          WHERE te.user_id = user_rec.user_id
        );
    END LOOP;

    -- The original shared tag now has no entry_tags pointing to it — delete it
    DELETE FROM "tags" WHERE id = shared_tag.id;
  END LOOP;
END $$;

-- ── Step 4: Drop orphan tags (no entries, no user_id) ────────────────────

DELETE FROM "tags"
WHERE "user_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "entry_tags" et WHERE et.tag_id = "tags".id
  );

-- ── Step 5: Make user_id NOT NULL ────────────────────────────────────────
-- At this point, every remaining tag should have a user_id assigned.
-- Any tags still without user_id are orphans that somehow slipped through;
-- we'll assign them to the first admin user as a safety measure.

UPDATE "tags" SET "user_id" = (
  SELECT id FROM "users" WHERE global_role = 'admin' ORDER BY created_at LIMIT 1
)
WHERE "user_id" IS NULL;

ALTER TABLE "tags" ALTER COLUMN "user_id" SET NOT NULL;

-- Add index on user_id for per-user queries
CREATE INDEX "tags_user_id_idx" ON "tags" ("user_id");

-- ── Step 6: Set tagsEnabled preference for users with tagged entries ─────

UPDATE "users" SET "preferences" = COALESCE("preferences", '{}'::jsonb) || '{"tagsEnabled": true}'::jsonb
WHERE id IN (
  SELECT DISTINCT te.user_id
  FROM "entry_tags" et
  JOIN "time_entries" te ON te.id = et.entry_id
);

-- ── Step 7: Update sync_mappings ─────────────────────────────────────────

UPDATE "sync_mappings" SET "target_table" = 'tags'
WHERE "target_table" = 'labels';

COMMIT;
