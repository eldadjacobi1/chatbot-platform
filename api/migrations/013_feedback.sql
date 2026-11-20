CREATE TABLE IF NOT EXISTS feedback (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  email text NOT NULL DEFAULT '',
  page text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
