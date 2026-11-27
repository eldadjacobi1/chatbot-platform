-- Business time zone, so the chat can tell visitors whether the business is open right now.
-- Empty means not set: the bot is then given no clock.
ALTER TABLE bots ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT '';
UPDATE bots SET timezone = 'America/New_York' WHERE id = 'bot_chattr_demo';
