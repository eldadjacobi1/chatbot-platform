import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "./db/index.js";

export type Usage = { promptTokens: number; completionTokens: number };

// gpt-4o-mini list prices, USD per 1M tokens.
const PRICE_IN = 0.15;
const PRICE_OUT = 0.6;

// Adds one AI call to today's totals for the bot. Never blocks or breaks the chat.
export function recordUsage(botId: string, u: Usage) {
  db.execute(sql`
    INSERT INTO usage_daily (bot_id, day, requests, prompt_tokens, completion_tokens)
    VALUES (${botId}, (now() at time zone 'UTC')::date, 1, ${u.promptTokens}, ${u.completionTokens})
    ON CONFLICT (bot_id, day) DO UPDATE SET
      requests = usage_daily.requests + 1,
      prompt_tokens = usage_daily.prompt_tokens + EXCLUDED.prompt_tokens,
      completion_tokens = usage_daily.completion_tokens + EXCLUDED.completion_tokens
  `).catch((err) => console.error("could not record usage", err));
}

// Admin view: this month's AI cost per bot. Protected by the ADMIN_KEY variable.
export async function usageRoutes(app: FastifyInstance) {
  app.get("/api/admin/usage", async (req, reply) => {
    const key = process.env.ADMIN_KEY;
    if (!key || req.headers["x-admin-key"] !== key) return reply.code(404).send({ error: "Not found." });
    const rows = await db.execute(sql`
      SELECT u.bot_id, b.name, b.owner_id,
             sum(u.requests)::int AS requests,
             sum(u.prompt_tokens)::int AS prompt_tokens,
             sum(u.completion_tokens)::int AS completion_tokens
      FROM usage_daily u LEFT JOIN bots b ON b.id = u.bot_id
      WHERE u.day >= date_trunc('month', now() at time zone 'UTC')::date
      GROUP BY u.bot_id, b.name, b.owner_id
      ORDER BY sum(u.prompt_tokens) + sum(u.completion_tokens) DESC
    `);
    const list = (rows as unknown as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]);
    return {
      month: new Date().toISOString().slice(0, 7),
      bots: list.map((r) => ({
        ...r,
        estimatedCostUsd: Number(((Number(r.prompt_tokens) * PRICE_IN + Number(r.completion_tokens) * PRICE_OUT) / 1_000_000).toFixed(4)),
      })),
    };
  });
}
