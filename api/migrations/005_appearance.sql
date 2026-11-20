ALTER TABLE bots ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#4338ca';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';        -- empty = use the business name
ALTER TABLE bots ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT '';       -- an emoji or letter, empty = none
ALTER TABLE bots ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT 'right';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'friendly';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'general';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '';
