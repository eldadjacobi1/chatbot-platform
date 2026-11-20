CREATE TABLE IF NOT EXISTS usage_daily (
  bot_id text NOT NULL,
  day date NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bot_id, day)
);
