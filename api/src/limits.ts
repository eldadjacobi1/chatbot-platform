// Simple in-memory cost controls. Counters reset when the server restarts.
// (Good enough for v1; move to Redis/Postgres when we run multiple servers.)

const IP_PER_MINUTE = Number(process.env.LIMIT_IP_PER_MINUTE ?? 8);
const SESSION_MAX_MESSAGES = Number(process.env.LIMIT_SESSION_MESSAGES ?? 12);
const BOT_PER_DAY = Number(process.env.LIMIT_BOT_PER_DAY ?? 300);
const BLOCK_MS = 10 * 60 * 1000; // block abusive IPs for 10 minutes

const ipHits = new Map<string, number[]>();
const ipBlockedUntil = new Map<string, number>();
const sessionCounts = new Map<string, number>();
const botDaily = new Map<string, { day: string; count: number }>();

export type LimitResult = { ok: true } | { ok: false; reason: string };

export function checkLimits(ip: string, token: string, botId: string): LimitResult {
  const now = Date.now();

  // 1. Blocked IP
  const blocked = ipBlockedUntil.get(ip);
  if (blocked && blocked > now) {
    return { ok: false, reason: "Too many requests. Please try again later." };
  }

  // 2. Per-IP rate limit (bombarding -> temporary block)
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  ipHits.set(ip, hits);
  if (hits.length > IP_PER_MINUTE) {
    ipBlockedUntil.set(ip, now + BLOCK_MS);
    return { ok: false, reason: "Too many requests. Please try again later." };
  }

  // 3. Per-session message cap (keeps conversations short)
  const used = sessionCounts.get(token) ?? 0;
  if (used >= SESSION_MAX_MESSAGES) {
    return {
      ok: false,
      reason: "This chat has reached its limit. Please contact the business directly.",
    };
  }

  // 4. Per-bot daily budget
  const day = new Date().toISOString().slice(0, 10);
  const bot = botDaily.get(botId);
  const count = bot && bot.day === day ? bot.count : 0;
  if (count >= BOT_PER_DAY) {
    return {
      ok: false,
      reason: "The assistant is unavailable right now. Please contact the business directly.",
    };
  }

  // All good: count it.
  sessionCounts.set(token, used + 1);
  botDaily.set(botId, { day, count: count + 1 });
  return { ok: true };
}

// Clean old entries so memory doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of ipBlockedUntil) if (until < now) ipBlockedUntil.delete(ip);
  for (const [ip, hits] of ipHits) {
    if (!hits.some((t) => now - t < 60_000)) ipHits.delete(ip);
  }
  if (sessionCounts.size > 50_000) sessionCounts.clear();
}, 5 * 60 * 1000).unref();
