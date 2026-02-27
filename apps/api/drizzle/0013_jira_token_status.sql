-- Add token_status column to track expired/revoked connections
DO $$ BEGIN
  ALTER TABLE jira_connections
    ADD COLUMN token_status text NOT NULL DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
