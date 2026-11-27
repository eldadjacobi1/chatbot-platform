import { asc, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { bots, type Bot } from "./db/schema.js";
import { getPlanCached, PLAN_LIMITS } from "./billing.js";

export type { Bot };

// The bots an owner may run: the oldest ones, up to what the plan allows. Any others are paused.
export async function allowedBotIds(ownerId: string): Promise<Set<string>> {
  const limit = PLAN_LIMITS[await getPlanCached(ownerId)].bots;
  const rows = await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.ownerId, ownerId))
    .orderBy(asc(bots.createdAt), asc(bots.id))
    .limit(limit);
  return new Set(rows.map((r) => r.id));
}

// Short cache, because public chat requests come in often.
const allowedCache = new Map<string, { ids: Set<string>; at: number }>();
async function allowedCached(ownerId: string): Promise<Set<string>> {
  const hit = allowedCache.get(ownerId);
  if (hit && Date.now() - hit.at < 30_000) return hit.ids;
  const ids = await allowedBotIds(ownerId);
  allowedCache.set(ownerId, { ids, at: Date.now() });
  return ids;
}

// Looks up a bot by its public id. Returns undefined if it does not exist.
// A bot paused by the owner's plan limit comes back with enabled = false, so visitors see nothing.
export async function getBot(id: string): Promise<Bot | undefined> {
  const rows = await db.select().from(bots).where(eq(bots.id, id)).limit(1);
  const bot = rows[0];
  if (bot && bot.ownerId && !(await allowedCached(bot.ownerId)).has(bot.id)) return { ...bot, enabled: false };
  return bot;
}
