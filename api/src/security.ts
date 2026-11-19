import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Secret used to sign session tokens. Set SESSION_SECRET in production.
// Without it we use a random one that changes on every restart (fine for local dev).
export const usingTemporarySecret = !process.env.SESSION_SECRET;
const secret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours

function sign(data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

// A token proves "this visitor loaded the widget for this bot from an allowed website".
// Format: botId.expiresAt.signature
export function createToken(botId: string): string {
  const payload = `${botId}.${Date.now() + TOKEN_LIFETIME_MS}`;
  return `${payload}.${sign(payload)}`;
}

// Returns the bot id if the token is valid and not expired, otherwise null.
export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [botId, expires, signature] = parts;

  const expected = Buffer.from(sign(`${botId}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  return botId;
}

// "shop.example.com" is allowed if "example.com" is on the list.
export function isAllowedHost(host: string, allowedDomains: string[]): boolean {
  const h = host.toLowerCase();
  return allowedDomains.some((d) => h === d || h.endsWith("." + d));
}

// The website that embeds the widget, taken from the Referer header the browser sends.
export function hostFromReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}

// Tells the browser which websites may put this widget in an iframe.
// This is enforced by the browser itself, so other sites cannot embed the bot.
export function frameAncestorsPolicy(allowedDomains: string[]): string {
  const sources = allowedDomains.flatMap((d) =>
    d === "localhost" ? ["http://localhost:*"] : [`https://${d}`, `https://*.${d}`]
  );
  return `frame-ancestors ${sources.join(" ")}`;
}
