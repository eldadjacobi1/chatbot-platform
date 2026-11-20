ALTER TABLE bots ADD COLUMN IF NOT EXISTS collect_leads boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS leads (
  id bigserial PRIMARY KEY,
  bot_id text NOT NULL,
  contact text NOT NULL,
  name text NOT NULL DEFAULT '',
  question text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_bot_created_idx ON leads (bot_id, created_at DESC);
