import { verifyToken } from "@clerk/backend";
import type { FastifyReply, FastifyRequest } from "fastify";

const secretKey = process.env.CLERK_SECRET_KEY;

declare module "fastify" {
  interface FastifyRequest {
    // Set by requireUser: the Clerk id of the logged-in owner.
    userId?: string;
  }
}

// Use as a route preHandler. Checks the login token the dashboard sends
// in the Authorization header and stores the user id on the request.
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  if (!secretKey) {
    return reply.code(500).send({ error: "Server login is not configured." });
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return reply.code(401).send({ error: "Please log in." });

  try {
    const payload = await verifyToken(token, { secretKey });
    req.userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Your login expired. Please sign in again." });
  }
}
