import type { FastifyInstance } from "fastify";
import { verifyToken } from "./security.js";

// Cloudflare Turnstile: proves the chat is used from a real browser, not a script.
// Switched on only when both variables are set, so deploying without them changes nothing.
const SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";
export const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY ?? "";
export const turnstileEnabled = !!SECRET && !!turnstileSiteKey;

const verified = new Map<string, number>(); // session token -> time verified

export function isVerified(token: string) {
  return !turnstileEnabled || verified.has(token);
}

export async function turnstileRoutes(app: FastifyInstance) {
  app.post("/verify", async (req, reply) => {
    if (!turnstileEnabled) return { ok: true };
    const b = (req.body ?? {}) as { token?: unknown; cf?: unknown };
    const token = typeof b.token === "string" ? b.token : "";
    const cf = typeof b.cf === "string" ? b.cf : "";
    if (!verifyToken(token) || !cf) return reply.code(400).send({ error: "Bad request." });
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: SECRET, response: cf, remoteip: req.ip }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (!data.success) return reply.code(403).send({ error: "Check failed." });
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: "Check unavailable." });
    }
    if (verified.size > 50_000) verified.clear();
    verified.set(token, Date.now());
    return { ok: true };
  });
}
