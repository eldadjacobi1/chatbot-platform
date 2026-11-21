import type { FastifyInstance } from "fastify";
import { pool } from "./db/index.js";
import { requireUser } from "./auth.js";

// Admin = Clerk user ids listed (comma separated) in the ADMIN_USER_IDS variable.
const admins = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean));

// gpt-4o-mini list prices, USD per 1M tokens.
const PRICE_IN = 0.15;
const PRICE_OUT = 0.6;

const isAdmin = (req: { userId?: string; role?: string }) => req.role === "admin" || admins.has(req.userId ?? "");

export async function adminRoutes(app: FastifyInstance) {
  // Tells the dashboard whether to show the admin page. A non-admin also learns their own id, so
  // the first admin can copy it into ADMIN_USER_IDS.
  app.get("/api/admin/me", { preHandler: requireUser }, async (req) => {
    const admin = isAdmin(req);
    return admin ? { admin } : { admin, userId: req.userId };
  });

  app.patch("/api/admin/feedback/:id", { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: "Not found." });
    const id = Number((req.params as { id: string }).id);
    const archived = (req.body as { archived?: unknown } | undefined)?.archived === true;
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "Bad id." });
    await pool.query("UPDATE feedback SET archived = $1 WHERE id = $2", [archived, id]);
    return { ok: true };
  });

  app.delete("/api/admin/feedback/:id", { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: "Not found." });
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "Bad id." });
    await pool.query("DELETE FROM feedback WHERE id = $1", [id]);
    return { ok: true };
  });

  app.get("/api/admin/overview", { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: "Not found." });

    const [feedback, usage, totals] = await Promise.all([
      pool.query("SELECT id, email, page, message, created_at, archived FROM feedback ORDER BY id DESC LIMIT 200"),
      pool.query(`
        SELECT u.bot_id, b.name,
               sum(u.requests)::int AS requests,
               sum(u.prompt_tokens)::int AS prompt_tokens,
               sum(u.completion_tokens)::int AS completion_tokens
        FROM usage_daily u LEFT JOIN bots b ON b.id = u.bot_id
        WHERE u.day >= date_trunc('month', now() at time zone 'UTC')::date
        GROUP BY u.bot_id, b.name
        ORDER BY sum(u.prompt_tokens) + sum(u.completion_tokens) DESC`),
      pool.query(`SELECT
        (SELECT count(*)::int FROM bots WHERE owner_id IS NOT NULL) AS bots,
        (SELECT count(DISTINCT owner_id)::int FROM bots WHERE owner_id IS NOT NULL) AS owners,
        (SELECT count(*)::int FROM leads) AS leads`),
    ]);

    const bots = usage.rows.map((r) => ({
      botId: r.bot_id,
      name: r.name ?? "(deleted)",
      requests: r.requests,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      estimatedCostUsd: Number(((r.prompt_tokens * PRICE_IN + r.completion_tokens * PRICE_OUT) / 1_000_000).toFixed(4)),
    }));
    return {
      month: new Date().toISOString().slice(0, 7),
      totals: totals.rows[0],
      totalCostUsd: Number(bots.reduce((s, b) => s + b.estimatedCostUsd, 0).toFixed(4)),
      bots,
      feedback: feedback.rows.map((r) => ({ id: r.id, email: r.email, page: r.page, message: r.message, createdAt: r.created_at, archived: r.archived })),
    };
  });
}
