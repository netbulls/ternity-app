ALTER TABLE "time_entries" ADD COLUMN "jira_issue_key" text;
ALTER TABLE "time_entries" ADD COLUMN "jira_issue_summary" text;
ALTER TABLE "time_entries" ADD COLUMN "jira_connection_id" uuid REFERENCES "jira_connections"("id");
CREATE INDEX "time_entries_jira_issue_idx" ON "time_entries" ("jira_issue_key") WHERE "jira_issue_key" IS NOT NULL;
