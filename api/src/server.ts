import "dotenv/config";
import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { OpenAIProvider, buildSystemPrompt } from "./ai.js";
import { sampleBusiness } from "./sampleBusiness.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY. Copy .env.example to .env and set it.");
  process.exit(1);
}

const provider = new OpenAIProvider(apiKey, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
const app = Fastify({ logger: true });

const MAX_MESSAGE_LENGTH = 500;

// Test page so you can chat in the browser: http://localhost:3000
app.get("/", async (_req, reply) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = await readFile(join(here, "..", "test", "chat.html"), "utf8");
  return reply.type("text/html").send(html);
});

app.get("/health", async () => ({ ok: true }));

// POST /chat  { "message": "What are your hours?" }
// Streams the answer back as server-sent events.
app.post("/chat", async (req, reply) => {
  const body = req.body as { message?: unknown } | undefined;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return reply.code(400).send({ error: "message is required" });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return reply.code(400).send({ error: `message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
  }

  // We write the stream ourselves, so take over the response.
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Open for now. Domain locking per business comes in a later step.
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const systemPrompt = buildSystemPrompt(sampleBusiness.name, sampleBusiness.context);
    for await (const text of provider.streamAnswer({ systemPrompt, userMessage: message })) {
      reply.raw.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
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
