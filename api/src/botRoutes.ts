import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import { bots, messages, type Bot } from "./db/schema.js";
import { normalize } from "./savings.js";
import { mergeKnowledge } from "./knowledge.js";
import { requireUser } from "./auth.js";
import { getReport } from "./reports.js";
import { parseAppearance, paidOnlyError, type Appearance } from "./appearance.js";
import { getPlanCached, PLAN_LIMITS } from "./billing.js";

// What the dashboard sees. One domain per bot for now.
function toDto(bot: Bot) {
  return {
    id: bot.id,
    name: bot.name,
    greeting: bot.greeting,
    context: bot.context,
    domain: bot.allowedDomains[0] ?? "",
    enabled: bot.enabled,
    collectLeads: bot.collectLeads,
    suggestions: bot.suggestions,
    theme: bot.theme,
    color: bot.color,
    title: bot.title,
    avatar: bot.avatar,
    position: bot.position,
    textColor: bot.textColor,
    tone: bot.tone,
    audience: bot.audience,
    instructions: bot.instructions,
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
  collectLeads?: boolean;
  suggestions?: string[];
  appearance: Partial<Appearance>;
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

  let suggestions: string[] | undefined;
  if (b.suggestions !== undefined) {
    if (!Array.isArray(b.suggestions)) return { error: "Suggested questions must be a list." };
    suggestions = b.suggestions
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
    if (suggestions.length > 4) return { error: "You can add up to 4 suggested questions." };
    if (suggestions.some((q) => q.length > 80)) return { error: "Each suggested question can be up to 80 characters." };
  }

  const appearance = parseAppearance(b);
  if ("error" in appearance) return { error: appearance.error };

  return {
    value: {
      name, greeting, context, domain,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
      collectLeads: typeof b.collectLeads === "boolean" ? b.collectLeads : undefined,
      suggestions,
      appearance: appearance.value,
    },
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
    const maxBots = PLAN_LIMITS[await getPlanCached(userId)].bots;
    if (existing.length >= maxBots) {
      return reply.code(403).send({
        error: `Your plan allows ${maxBots} chatbot${maxBots === 1 ? "" : "s"}. Upgrade in the Plan tab to add more.`,
      });
    }

    const { name, greeting, context, domain, enabled, collectLeads, suggestions, appearance } = parsed.value;
    if ((await getPlanCached(userId)) === "free") {
      const err = paidOnlyError(appearance, { instructions: "" });
      if (err) return reply.code(403).send({ error: err });
    }
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
        ...(collectLeads === undefined ? {} : { collectLeads }),
        ...(suggestions === undefined ? {} : { suggestions }),
        ...appearance,
      })
      .returning();
    return { bot: toDto(row) };
  });

  app.put("/api/bots/:id", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = parseInput(req.body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });

    const { name, greeting, context, domain, enabled, collectLeads, suggestions, appearance } = parsed.value;
    if ((await getPlanCached(req.userId!)) === "free") {
      const [existing] = await db
        .select()
        .from(bots)
        .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
      if (existing) {
        const err = paidOnlyError(appearance, existing);
        if (err) return reply.code(403).send({ error: err });
      }
    }
    const [row] = await db
      .update(bots)
      .set({
        name,
        greeting,
        context,
        allowedDomains: [domain],
        ...(enabled === undefined ? {} : { enabled }),
        ...(collectLeads === undefined ? {} : { collectLeads }),
        ...(suggestions === undefined ? {} : { suggestions }),
        ...appearance,
      })
      .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)))
      .returning();

    if (!row) return reply.code(404).send({ error: "Chatbot not found." });
    return { bot: toDto(row) };
  });

  // Deletes a bot and what it collected. Usage totals stay, so the admin cost numbers remain right.
  app.delete("/api/bots/:id", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!row) return reply.code(404).send({ error: "Chatbot not found." });
    await pool.query("DELETE FROM leads WHERE bot_id = $1", [id]);
    await pool.query("DELETE FROM messages WHERE bot_id = $1", [id]);
    await db.delete(bots).where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    return { ok: true };
  });

  // Owner's report: most asked and unanswered questions (last 30 days).
  app.get("/api/bots/:id/report", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [owned] = await db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!owned) return reply.code(404).send({ error: "Chatbot not found." });
    const d = Number((req.query as { days?: string }).days);
    const report = await getReport(id, d === 7 ? 7 : 30);
    if (PLAN_LIMITS[await getPlanCached(req.userId!)].fullReport) return { ...report, limited: false };
    // Free plan: totals only. The question lists are part of Pro.
    return { ...report, topQuestions: [], unanswered: [], limited: true };
  });

  // Pro: turn an unanswered question into knowledge. Appends "Q/A" to the bot's info.
  app.post("/api/bots/:id/answers", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!PLAN_LIMITS[await getPlanCached(req.userId!)].aiTools) {
      return reply.code(403).send({ error: "Adding answers from your report is part of Pro." });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!question || question.length > 300) return reply.code(400).send({ error: "Question is missing or too long." });
    if (!answer || answer.length > 1000) return reply.code(400).send({ error: "Write an answer of up to 1000 characters." });

    const [bot] = await db.select().from(bots).where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!bot) return reply.code(404).send({ error: "Chatbot not found." });

    const qa = `Q: ${question}\nA: ${answer}`;
    let context = `${bot.context.trimEnd()}\n\n${qa}`;
    try {
      // Fold the answer into the right place instead of just adding it at the end.
      const merged = await mergeKnowledge({ current: bot.context, incoming: qa, source: "owner-answer" });
      if (merged) context = merged;
    } catch (err) {
      req.log.warn({ err }, "merge failed, appended instead");
    }
    if (context.length > 8000) {
      return reply.code(400).send({ error: "Your business info is full (8000 characters). Shorten it in Bot setup first." });
    }
    const [row] = await db.update(bots).set({ context }).where(eq(bots.id, id)).returning();
    // The question is handled now, so it leaves the "needs an answer" list.
    await db
      .update(messages)
      .set({ unanswered: false })
      .where(and(eq(messages.botId, id), eq(messages.questionKey, normalize(question))));
    return { bot: toDto(row) };
  });

  // Owner: hide a question from the report (junk or not worth answering), or bring it back.
  app.post("/api/bots/:id/questions/ignore", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 300) return reply.code(400).send({ error: "Question is missing or too long." });
    const [owned] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!owned) return reply.code(404).send({ error: "Chatbot not found." });
    await db
      .update(messages)
      .set({ ignored: body.undo !== true })
      .where(and(eq(messages.botId, id), eq(messages.questionKey, normalize(question))));
    return { ok: true };
  });
}
