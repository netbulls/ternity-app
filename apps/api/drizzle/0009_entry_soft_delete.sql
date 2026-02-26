ALTER TABLE "time_entries" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
CREATE INDEX "time_entries_user_active_idx" ON "time_entries" ("user_id", "is_active");
