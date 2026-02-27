DO $$ BEGIN
  ALTER TABLE "jira_connections" ADD COLUMN "config" jsonb DEFAULT '{}' NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "jira_connections" ADD COLUMN "last_synced_at" timestamp with time zone;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
