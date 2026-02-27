-- Add token_status column to track expired/revoked connections
ALTER TABLE jira_connections
  ADD COLUMN token_status text NOT NULL DEFAULT 'active';
