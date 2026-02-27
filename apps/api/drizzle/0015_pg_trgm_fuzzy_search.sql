-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on entry descriptions for fast fuzzy search
CREATE INDEX IF NOT EXISTS time_entries_description_trgm_idx
  ON time_entries USING gin (description gin_trgm_ops);
