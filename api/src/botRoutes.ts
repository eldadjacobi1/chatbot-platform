import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { bots, type Bot } from "./db/schema.js";
import { requireUser } from "./auth.js";
import { getReport } from "./reports.js";

// Free plan limit. Paid plans will raise this later.
const MAX_BOTS_PER_USER = 1;

// What the dashboard sees. One domain per bot for now.
function toDto(bot: Bot) {
  return {
    id: bot.id,
    name: bot.name,
    greeting: bot.greeting,
    context: bot.context,
    domain: bot.allowedDomains[0] ?? "",
    enabled: bot.enabled,
  };
}

// "https://www.MyShop.com/contact" -> "myshop.com". Returns null if it is not a valid domain.
function normalizeDomain(input: string): string | null {
  const d = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
  if (d === "localhost") return d;
  const valid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
  return valid ? d : null;
}

type BotInput = {
  name: string;
  greeting: string;
  context: string;
  domain: string;
  enabled?: boolean;
};

function parseInput(body: unknown): { value: BotInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = text(b.name);
  const greeting = text(b.greeting);
  const context = text(b.context);
  if (!name || name.length > 80) return { error: "Name is required (max 80 characters)." };
  if (!greeting || greeting.length > 200) return { error: "Greeting is required (max 200 characters)." };
  if (!context || context.length > 8000) {
    return { error: "Business information is required (max 8000 characters)." };
  }

  const domain = typeof b.domain === "string" ? normalizeDomain(b.domain) : null;
  if (!domain) return { error: "Enter a valid website domain, like mybusiness.com." };

  return {
    value: { name, greeting, context, domain, enabled: typeof b.enabled === "boolean" ? b.enabled : undefined },
  };
}

// All routes here require a logged-in owner and only touch that owner's bots.
export async function botRoutes(app: FastifyInstance) {
  app.get("/api/bots", { preHandler: requireUser }, async (req) => {
    const rows = await db.select().from(bots).where(eq(bots.ownerId, req.userId!));
    return { bots: rows.map(toDto) };
  });

  app.post("/api/bots", { preHandler: requireUser }, async (req, reply) => {
    const userId = req.userId!;
    const parsed = parseInput(req.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });

    const existing = await db.select({ id: bots.id }).from(bots).where(eq(bots.ownerId, userId));
    if (existing.length >= MAX_BOTS_PER_USER) {
      return reply.code(403).send({ error: "Your plan allows 1 chatbot." });
    }

    const { name, greeting, context, domain, enabled } = parsed.value;
    const [row] = await db
      .insert(bots)
      .values({
        id: `bot_${randomBytes(8).toString("hex")}`,
        ownerId: userId,
        name,
        greeting,
        context,
        allowedDomains: [domain],
        enabled: enabled ?? true,
      })
      .returning();
    return { bot: toDto(row) };
  });

  app.put("/api/bots/:id", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = parseInput(req.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });

    const { name, greeting, context, domain, enabled } = parsed.value;
    const [row] = await db
      .update(bots)
      .set({
        name,
        greeting,
        context,
        allowedDomains: [domain],
        ...(enabled === undefined ? {} : { enabled }),
      })
      .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)))
      .returning();

    if (!row) return reply.code(404).send({ error: "Chatbot not found." });
    return { bot: toDto(row) };
  });

  // Owner's report: most asked and unanswered questions (last 30 days).
  app.get("/api/bots/:id/report", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [owned] = await db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!owned) return reply.code(404).send({ error: "Chatbot not found." });
    return getReport(id);
  });
}
