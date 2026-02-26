ALTER TABLE "jira_connections" ADD COLUMN "config" jsonb DEFAULT '{}' NOT NULL;
ALTER TABLE "jira_connections" ADD COLUMN "last_synced_at" timestamp with time zone;
