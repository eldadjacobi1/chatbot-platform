CREATE TABLE IF NOT EXISTS subscriptions (
  user_id text PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',        -- 'free', 'pro' or 'business'
  status text NOT NULL DEFAULT 'none',      -- Stripe subscription status
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (stripe_customer_id);
