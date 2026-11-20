import { isVerified } from "./turnstile.js";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import { bots } from "./db/schema.js";
import { requireUser } from "./auth.js";
import { getBot } from "./bots.js";
import { verifyToken } from "./security.js";
import { getPlanCached } from "./billing.js";

// A visitor leaves their contact details when the bot couldn't help.
// No AI is involved, so this costs nothing.

const MAX_LEADS_PER_SESSION = 2;
const FREE_VISIBLE_LEADS = 3;
const sessionLeads = new Map<string, number>();
const ipLeads = new Map<string, number[]>(); // stops someone opening many chats to flood the owner
const MAX_LEADS_PER_IP_PER_HOUR = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d][\d\s().-]{5,18}\d$/;

export async function leadRoutes(app: FastifyInstance) {
  // Public: called by the chat window.
  app.post("/lead", async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof b.token === "string" ? b.token : "";
    const botId = verifyToken(token);
    if (!botId) return reply.code(401).send({ error: "invalid or expired session" });
    if (!isVerified(token)) return reply.code(403).send({ error: "verify" });

    const bot = await getBot(botId);
    if (!bot || !bot.enabled || !bot.collectLeads) return reply.code(403).send({ error: "not available" });

    const contact = typeof b.contact === "string" ? b.contact.trim() : "";
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
    const question = typeof b.question === "string" ? b.question.trim().slice(0, 500) : "";
    if (!EMAIL.test(contact) && !PHONE.test(contact)) {
      return reply.code(400).send({ error: "Please enter a valid email or phone number." });
    }
    if (contact.length > 120) return reply.code(400).send({ error: "That contact is too long." });

    const now = Date.now();
    const recent = (ipLeads.get(req.ip) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_LEADS_PER_IP_PER_HOUR) {
      return reply.code(429).send({ error: "Too many requests. Please try again later." });
    }
    recent.push(now);
    ipLeads.set(req.ip, recent);
    if (ipLeads.size > 20_000) ipLeads.clear();

    const used = sessionLeads.get(token) ?? 0;
    if (used >= MAX_LEADS_PER_SESSION) return reply.code(429).send({ error: "Thanks, we already have your details." });
    sessionLeads.set(token, used + 1);
    if (sessionLeads.size > 50_000) sessionLeads.clear();

    await pool.query("INSERT INTO leads (bot_id, contact, name, question) VALUES ($1, $2, $3, $4)", [
      botId,
      contact,
      name,
      question,
    ]);
    return { ok: true };
  });

  // Owner: list of leads. Free plan sees the latest few.
  app.get("/api/bots/:id/leads", { preHandler: requireUser }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [owned] = await db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, id), eq(bots.ownerId, req.userId!)));
    if (!owned) return reply.code(404).send({ error: "Chatbot not found." });

    const free = (await getPlanCached(req.userId!)) === "free";
    const { rows } = await pool.query(
      "SELECT id, contact, name, question, status, created_at FROM leads WHERE bot_id = $1 ORDER BY created_at DESC LIMIT 500",
      [id],
    );
    const total = rows.length;
    const visible = free ? rows.slice(0, FREE_VISIBLE_LEADS) : rows;
    return {
      total,
      limited: free && total > FREE_VISIBLE_LEADS,
      leads: visible.map((r) => ({
        id: Number(r.id),
        contact: r.contact,
        name: r.name,
        question: r.question,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  });

  async function ownsBot(userId: string, botId: string) {
    const [owned] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, botId), eq(bots.ownerId, userId)));
    return !!owned;
  }

  // Owner: mark a lead New / Contacted / Done.
  app.patch("/api/bots/:id/leads/:leadId", { preHandler: requireUser }, async (req, reply) => {
    const { id, leadId } = req.params as { id: string; leadId: string };
    if (!(await ownsBot(req.userId!, id))) return reply.code(404).send({ error: "Chatbot not found." });
    const status = ((req.body ?? {}) as { status?: unknown }).status;
    if (status !== "new" && status !== "contacted" && status !== "done") {
      return reply.code(400).send({ error: "Unknown status." });
    }
    await pool.query("UPDATE leads SET status = $1 WHERE id = $2 AND bot_id = $3", [status, Number(leadId), id]);
    return { ok: true };
  });

  // Owner: delete a lead (junk or test entries).
  app.delete("/api/bots/:id/leads/:leadId", { preHandler: requireUser }, async (req, reply) => {
    const { id, leadId } = req.params as { id: string; leadId: string };
    if (!(await ownsBot(req.userId!, id))) return reply.code(404).send({ error: "Chatbot not found." });
    await pool.query("DELETE FROM leads WHERE id = $1 AND bot_id = $2", [Number(leadId), id]);
    return { ok: true };
  });
}
