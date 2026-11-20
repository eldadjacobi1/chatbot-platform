import type { FastifyInstance } from "fastify";
import { pool } from "./db/index.js";
import { requireUser } from "./auth.js";

const MAX_PER_DAY = 5;

export async function feedbackRoutes(app: FastifyInstance) {
  // Owner sends feedback from the dashboard.
  app.post("/api/feedback", { preHandler: requireUser }, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const message = typeof b.message === "string" ? b.message.trim() : "";
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 200) : "";
    const page = typeof b.page === "string" ? b.page.trim().slice(0, 40) : "";
    if (!message) return reply.code(400).send({ error: "Write a message first." });
    if (message.length > 2000) return reply.code(400).send({ error: "Please keep it under 2000 characters." });

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM feedback WHERE user_id = $1 AND created_at > now() - interval '1 day'",
      [req.userId],
    );
    if (rows[0].n >= MAX_PER_DAY) return reply.code(429).send({ error: "Thanks! You have sent a lot today. Please try again tomorrow." });

    await pool.query("INSERT INTO feedback (user_id, email, page, message) VALUES ($1, $2, $3, $4)", [req.userId, email, page, message]);
    return { ok: true };
  });

  // Admin: read the latest feedback. Protected by the ADMIN_KEY variable.
  app.get("/api/admin/feedback", async (req, reply) => {
    const key = process.env.ADMIN_KEY;
    if (!key || req.headers["x-admin-key"] !== key) return reply.code(404).send({ error: "Not found." });
    const { rows } = await pool.query("SELECT id, email, page, message, created_at FROM feedback ORDER BY id DESC LIMIT 100");
    return { feedback: rows };
  });
}
