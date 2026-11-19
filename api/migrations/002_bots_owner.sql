ALTER TABLE bots ADD COLUMN IF NOT EXISTS owner_id text;
CREATE INDEX IF NOT EXISTS bots_owner_id_idx ON bots (owner_id);
