import type { FastifyInstance } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { pool } from "./db/index.js";
import { requireUser } from "./auth.js";

// Admin = Clerk user ids listed (comma separated) in the ADMIN_USER_IDS variable.
const admins = new Set((process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean));

// gpt-4o-mini list prices, USD per 1M tokens.
const PRICE_IN = 0.15;
const PRICE_OUT = 0.6;

const clerk = process.env.CLERK_SECRET_KEY ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }) : null;

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

  // Everyone who signed up (from Clerk) plus what they have (from our database).
  app.get("/api/admin/users", { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: "Not found." });

    const [botsQ, msgsQ, leadsQ, costQ, subsQ] = await Promise.all([
      pool.query("SELECT owner_id, count(*)::int AS n FROM bots WHERE owner_id IS NOT NULL GROUP BY owner_id"),
      pool.query(`SELECT b.owner_id, count(*)::int AS n FROM messages m JOIN bots b ON b.id = m.bot_id
                  WHERE b.owner_id IS NOT NULL AND m.created_at > now() - interval '30 days' GROUP BY b.owner_id`),
      pool.query("SELECT b.owner_id, count(*)::int AS n FROM leads l JOIN bots b ON b.id = l.bot_id WHERE b.owner_id IS NOT NULL GROUP BY b.owner_id"),
      pool.query(`SELECT b.owner_id, sum(u.prompt_tokens)::bigint AS p, sum(u.completion_tokens)::bigint AS c
                  FROM usage_daily u JOIN bots b ON b.id = u.bot_id
                  WHERE b.owner_id IS NOT NULL AND u.day >= date_trunc('month', now() at time zone 'UTC')::date GROUP BY b.owner_id`),
      pool.query("SELECT user_id, plan, status FROM subscriptions"),
    ]);
    const byOwner = (q: { rows: any[] }) => new Map(q.rows.map((r) => [r.owner_id as string, r]));
    const bots = byOwner(botsQ), msgs = byOwner(msgsQ), leads = byOwner(leadsQ), cost = byOwner(costQ);
    const subs = new Map(subsQ.rows.map((r) => [r.user_id as string, r]));

    // Clerk knows the email and sign-up time. If it can't be reached we still list owners from our database.
    let people: { id: string; email: string; createdAt: number | null; lastActiveAt: number | null }[] = [];
    try {
      const r: any = await clerk?.users.getUserList({ limit: 100, orderBy: "-created_at" });
      const list: any[] = Array.isArray(r) ? r : (r?.data ?? []);
      people = list.map((u) => ({
        id: u.id,
        email: (u.emailAddresses ?? []).find((e: any) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? "",
        createdAt: u.createdAt ?? null,
        lastActiveAt: u.lastActiveAt ?? u.lastSignInAt ?? null,
      }));
    } catch (err) {
      req.log.warn({ err }, "clerk user list failed");
    }
    const seen = new Set(people.map((p) => p.id));
    for (const id of bots.keys()) if (!seen.has(id)) people.push({ id, email: "", createdAt: null, lastActiveAt: null });

    const users = people.map((p) => {
      const sub = subs.get(p.id);
      const plan = sub && (sub.status === "active" || sub.status === "trialing") ? sub.plan : "free";
      const c = cost.get(p.id);
      const usd = c ? (Number(c.p) * PRICE_IN + Number(c.c) * PRICE_OUT) / 1_000_000 : 0;
      return {
        id: p.id,
        email: p.email,
        plan,
        bots: bots.get(p.id)?.n ?? 0,
        questions30d: msgs.get(p.id)?.n ?? 0,
        leads: leads.get(p.id)?.n ?? 0,
        costUsd: Number(usd.toFixed(4)),
        signedUp: p.createdAt,
        lastActive: p.lastActiveAt,
      };
    });
    return { users };
  });

  // One user's bots and latest questions (visitors' contact details are not shown here).
  app.get("/api/admin/users/:id", { preHandler: requireUser }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(404).send({ error: "Not found." });
    const id = (req.params as { id: string }).id;
    const [b, q] = await Promise.all([
      pool.query(
        `SELECT b.id, b.name, b.enabled, b.allowed_domains,
                (SELECT count(*)::int FROM leads l WHERE l.bot_id = b.id) AS leads
         FROM bots b WHERE b.owner_id = $1 ORDER BY b.created_at`, [id]),
      pool.query(
        `SELECT m.question, m.unanswered, m.created_at FROM messages m JOIN bots b ON b.id = m.bot_id
         WHERE b.owner_id = $1 ORDER BY m.created_at DESC LIMIT 15`, [id]),
    ]);
    return {
      bots: b.rows.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled, website: r.allowed_domains?.[0] ?? "", leads: r.leads })),
      questions: q.rows.map((r) => ({ question: r.question, unanswered: r.unanswered, createdAt: r.created_at })),
    };
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
