CREATE TABLE IF NOT EXISTS messages (
  id bigserial PRIMARY KEY,
  bot_id text NOT NULL,
  question text NOT NULL,
  question_key text NOT NULL,
  source text NOT NULL,            -- 'ai' or 'cache'
  unanswered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_bot_created_idx ON messages (bot_id, created_at);
