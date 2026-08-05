-- Add token_version column to users table for multi-device session/token invalidation.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;
