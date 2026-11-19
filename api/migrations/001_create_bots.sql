CREATE TABLE IF NOT EXISTS bots (
  id text PRIMARY KEY,
  name text NOT NULL,
  greeting text NOT NULL,
  context text NOT NULL,
  allowed_domains text[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
