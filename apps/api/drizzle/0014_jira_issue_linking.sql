DO $$ BEGIN
  ALTER TABLE "time_entries" ADD COLUMN "jira_issue_key" text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD COLUMN "jira_issue_summary" text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD COLUMN "jira_connection_id" uuid REFERENCES "jira_connections"("id");
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "time_entries_jira_issue_idx" ON "time_entries" ("jira_issue_key") WHERE "jira_issue_key" IS NOT NULL;
