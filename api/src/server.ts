import "dotenv/config";
import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { OpenAIProvider, buildSystemPrompt, isUnsure } from "./ai.js";
import { logQuestion } from "./reports.js";
import cors from "@fastify/cors";
import { getBot } from "./bots.js";
import { checkLimits, afterAnswer } from "./limits.js";
import { cannedReply, getCached, setCached, GIBBERISH_REPLY } from "./savings.js";
import { botRoutes } from "./botRoutes.js";
import { styleKey } from "./appearance.js";
import { leadRoutes } from "./leads.js";
import { billingRoutes, getPlanCached, PLAN_LIMITS } from "./billing.js";
import {
  createToken,
  verifyToken,
  isAllowedHost,
  hostFromReferer,
  frameAncestorsPolicy,
  usingTemporarySecret,
} from "./security.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY. Copy .env.example to .env and set it.");
  process.exit(1);
}

const provider = new OpenAIProvider(apiKey, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
const app = Fastify({ logger: true, trustProxy: true });

if (usingTemporarySecret) {
  app.log.warn("SESSION_SECRET not set: using a temporary secret (tokens reset on restart).");
}

// The dashboard is a different website, so it needs permission to call /api/*.
const dashboardOrigins = (process.env.DASHBOARD_ORIGIN ?? "http://localhost:3001")
  .split(",")
  .map((o) => o.trim());
await app.register(cors, {
  origin: dashboardOrigins,
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
await app.register(botRoutes);
await app.register(billingRoutes);
await app.register(leadRoutes);
if (!process.env.CLERK_SECRET_KEY) {
  app.log.warn("CLERK_SECRET_KEY not set: dashboard API requests will be rejected.");
}

const MAX_MESSAGE_LENGTH = 500;
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readLocal = (...parts: string[]) => readFile(join(apiRoot, ...parts), "utf8");

// --- Demo "customer website" with the widget embedded: http://localhost:3000/demo
app.get("/", async (_req, reply) => reply.redirect("/demo"));
app.get("/demo", async (_req, reply) => reply.type("text/html").send(await readLocal("test", "demo.html")));

app.get("/health", async () => ({ ok: true }));

// --- The script customers paste into their website.
app.get("/embed.js", async (_req, reply) => {
  return reply
    .type("application/javascript")
    .header("Cache-Control", "public, max-age=300")
    .send(await readLocal("public", "embed.js"));
});

// --- Tells embed.js whether to show the chat button at all.
// Public, returns only yes/no: the bot must be on AND the page must be on the allowed website.
app.get("/bot-status/:botId", async (req, reply) => {
  const { botId } = req.params as { botId: string };
  const bot = await getBot(botId);
  // Browsers omit Origin on same-site GET requests, so fall back to Referer.
  const host = hostFromReferer((req.headers.origin as string | undefined) ?? req.headers.referer);
  const show = !!bot && bot.enabled && !!host && isAllowedHost(host, bot.allowedDomains);
  return reply
    .header("Access-Control-Allow-Origin", "*")
    .header("Cache-Control", "no-store")
    .send({ show, color: bot?.color, position: bot?.position, theme: bot?.theme });
});

// --- The chat window shown inside the iframe.
// Only served if the embedding website is on the bot's allowed list.
app.get("/widget/:botId", async (req, reply) => {
  const { botId } = req.params as { botId: string };
  const bot = await getBot(botId);
  if (!bot || !bot.enabled) return reply.code(404).send("Bot not found.");

  const host = hostFromReferer(req.headers.referer);
  if (!host || !isAllowedHost(host, bot.allowedDomains)) {
    req.log.warn({ botId, host }, "widget blocked: website not allowed");
    return reply.code(403).send("This chat is not enabled for this website.");
  }

  const template = await readLocal("public", "widget.html");
  // "<" is escaped so the config can never break out of the script tag.
  const config = JSON.stringify({
    botName: bot.name,
    title: bot.title || bot.name,
    avatar: bot.avatar,
    color: bot.color,
    theme: bot.theme,
    suggestions: bot.suggestions,
    greeting: bot.greeting,
    token: createToken(bot.id),
  }).replace(/</g, "\\u003c");

  return reply
    .type("text/html")
    .header("Content-Security-Policy", frameAncestorsPolicy(bot.allowedDomains))
    .header("Cache-Control", "no-store")
    .send(template.replace("__CONFIG__", () => config));
});

// --- POST /chat  { "message": "...", "token": "..." }
// Streams the answer back as server-sent events.
app.post("/chat", async (req, reply) => {
  const body = req.body as { message?: unknown; token?: unknown } | undefined;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const token = typeof body?.token === "string" ? body.token : "";

  const botId = verifyToken(token);
  if (!botId) return reply.code(401).send({ error: "invalid or expired session" });

  const bot = await getBot(botId);
  if (!bot || !bot.enabled) return reply.code(403).send({ error: "bot is not available" });

  if (!message) return reply.code(400).send({ error: "message is required" });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return reply.code(400).send({ error: `message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
  }

  const plan = await getPlanCached(bot.ownerId);
  const limit = checkLimits(req.ip, token, botId, PLAN_LIMITS[plan].messagesPerDay);
  if (!limit.ok) return reply.code(429).send({ error: limit.reason });

  // We write the stream ourselves, so take over the response.
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Tone and instructions are part of the cache key, so changing them clears old answers.
  const cacheContext = bot.context + "\n#style:" + styleKey(bot);

  try {
    // Free answers first: canned replies, then the cache. No AI call.
    const canned = cannedReply(message);
    const cached = canned ? null : getCached(bot.id, bot.name, cacheContext, message);
    const free = canned ?? cached;
    if (free) {
      if (cached) logQuestion(bot.id, message, "cache", isUnsure(cached));
      reply.raw.write(`data: ${JSON.stringify({ text: free })}\n\n`);
      const unhelpful = free === GIBBERISH_REPLY || isUnsure(free);
      const closing = afterAnswer(token, unhelpful, bot.name);
      if (closing) reply.raw.write(`data: ${JSON.stringify({ text: "\n\n" + closing })}\n\n`);
      if (bot.collectLeads && (unhelpful || closing)) reply.raw.write(`data: ${JSON.stringify({ lead: true })}\n\n`);
      reply.raw.write("data: [DONE]\n\n");
      return;
    }

    const systemPrompt = buildSystemPrompt(bot.name, bot.context, bot);
    let answer = "";
    for await (const text of provider.streamAnswer({ systemPrompt, userMessage: message })) {
      answer += text;
      reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    setCached(bot.id, bot.name, cacheContext, message, answer);
    logQuestion(bot.id, message, "ai", isUnsure(answer));
    const closing = afterAnswer(token, isUnsure(answer), bot.name);
    if (closing) reply.raw.write(`data: ${JSON.stringify({ text: "\n\n" + closing })}\n\n`);
    if (bot.collectLeads && (isUnsure(answer) || closing)) reply.raw.write(`data: ${JSON.stringify({ lead: true })}\n\n`);
    reply.raw.write("data: [DONE]\n\n");
  } catch (err) {
    req.log.error(err);
    reply.raw.write(`data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`);
  } finally {
    reply.raw.end();
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
