-- Executed in a transaction by db.Migrate.
ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS support_preference TEXT NOT NULL DEFAULT ''
    CHECK (support_preference IN ('', 'listen', 'advice', 'reach_out', 'no_discussion'));
