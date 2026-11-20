import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { pool } from "./db/index.js";
import { requireUser } from "./auth.js";

// Stripe is called with plain fetch (no SDK), so there is nothing extra to install.

export type Plan = "free" | "pro" | "business";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICES: Record<"pro" | "business", string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};
const APP_URL = (process.env.APP_URL ?? process.env.DASHBOARD_ORIGIN ?? "http://localhost:3001")
  .split(",")[0]
  .trim();

function planFromPrice(priceId: string | undefined): Plan {
  if (priceId && priceId === PRICES.pro) return "pro";
  if (priceId && priceId === PRICES.business) return "business";
  return "free";
}

async function stripe(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

// The plan a user is on (used by the dashboard and, later, by the limits).
export async function getPlan(userId: string): Promise<{ plan: Plan; status: string; hasCustomer: boolean }> {
  const { rows } = await pool.query(
    "SELECT plan, status, stripe_customer_id FROM subscriptions WHERE user_id = $1",
    [userId],
  );
  const r = rows[0];
  if (!r) return { plan: "free", status: "none", hasCustomer: false };
  return { plan: r.plan as Plan, status: r.status, hasCustomer: !!r.stripe_customer_id };
}

async function saveSubscription(
  userId: string,
  plan: Plan,
  status: string,
  customerId: string | null,
  subscriptionId: string | null,
) {
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       updated_at = now()`,
    [userId, plan, status, customerId, subscriptionId],
  );
}

// Checks Stripe's signature so nobody can fake a payment.
function validSignature(rawBody: Buffer, header: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const sig = parts.v1;
  if (!t || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function billingRoutes(app: FastifyInstance) {
  app.get("/api/billing", { preHandler: requireUser }, async (req) => getPlan(req.userId!));

  // Starts a Stripe Checkout page for the chosen plan.
  app.post("/api/billing/checkout", { preHandler: requireUser }, async (req, reply) => {
    if (!STRIPE_KEY) return reply.code(500).send({ error: "Payments are not configured." });
    const plan = (req.body as any)?.plan;
    if (plan !== "pro" && plan !== "business") return reply.code(400).send({ error: "Unknown plan." });
    const price = PRICES[plan as "pro" | "business"];
    if (!price) return reply.code(500).send({ error: "Payments are not configured." });

    const current = await getPlan(req.userId!);
    if (current.plan !== "free" && current.status === "active") {
      return reply.code(400).send({ error: "You already have a plan. Use Manage billing to change it." });
    }

    try {
      const session = await stripe("/checkout/sessions", {
        mode: "subscription",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        client_reference_id: req.userId!,
        "subscription_data[metadata][user_id]": req.userId!,
        success_url: `${APP_URL}/dashboard?billing=success`,
        cancel_url: `${APP_URL}/dashboard?billing=cancelled`,
      });
      return { url: session.url };
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: "Could not start checkout. Please try again." });
    }
  });

  // Opens Stripe's page where the customer can change card, switch plan or cancel.
  app.post("/api/billing/portal", { preHandler: requireUser }, async (req, reply) => {
    if (!STRIPE_KEY) return reply.code(500).send({ error: "Payments are not configured." });
    const { rows } = await pool.query("SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1", [
      req.userId,
    ]);
    const customer = rows[0]?.stripe_customer_id;
    if (!customer) return reply.code(400).send({ error: "No subscription yet." });
    try {
      const portal = await stripe("/billing_portal/sessions", {
        customer,
        return_url: `${APP_URL}/dashboard`,
      });
      return { url: portal.url };
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: "Could not open billing. Please try again." });
    }
  });

  // Stripe tells us here when someone pays, changes plan or cancels.
  // Kept in its own scope so it can read the raw request body (needed for the signature).
  await app.register(async (hooks) => {
    hooks.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

    hooks.post("/stripe/webhook", async (req, reply) => {
      const raw = req.body as Buffer;
      if (!validSignature(raw, req.headers["stripe-signature"] as string | undefined)) {
        return reply.code(400).send({ error: "Bad signature." });
      }
      const event = JSON.parse(raw.toString("utf8"));
      const obj = event.data?.object ?? {};

      try {
        if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
          const userId = obj.client_reference_id;
          if (userId) {
            // The subscription event below sets the real plan; this saves the customer link early.
            const sub = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
              headers: { Authorization: `Bearer ${STRIPE_KEY}` },
            }).then((r) => r.json() as Promise<any>);
            const plan = planFromPrice(sub?.items?.data?.[0]?.price?.id);
            await saveSubscription(userId, plan, sub?.status ?? "active", obj.customer, obj.subscription);
          }
        } else if (
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          const userId = obj.metadata?.user_id;
          if (userId) {
            const ended = event.type === "customer.subscription.deleted" || obj.status === "canceled";
            const plan = ended ? "free" : planFromPrice(obj.items?.data?.[0]?.price?.id);
            const active = obj.status === "active" || obj.status === "trialing";
            await saveSubscription(userId, active ? plan : "free", obj.status, obj.customer, obj.id);
          }
        }
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({ error: "Webhook failed." });
      }
      return { received: true };
    });
  });
}
