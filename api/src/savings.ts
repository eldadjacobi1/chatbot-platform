import { createHash } from "node:crypto";

// Ways to answer WITHOUT calling the AI (free): canned replies and a cache.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GREETING = /^(hi|hello|hey|hola|yo|good (morning|afternoon|evening)|hi there|hello there)( there)?$/;
const HOW_ARE_YOU = /^(hi |hello |hey )?(how are you|how r u|how are you doing|hows it going|whats up|sup)( today)?$/;
const THANKS = /^(thanks|thank you|thx|ty|thanks a lot|thank you very much|great thanks|ok thanks|okay thanks)$/;
const BYE = /^(bye|goodbye|see you|see ya|have a good day|that is all|thats all|no thanks|nothing else)$/;

function looksLikeGibberish(norm: string): boolean {
  if (norm.length < 2) return true;
  const words = norm.split(" ").filter((w) => w.length >= 3);
  if (words.length === 0) return false;
  const bad = words.filter((w) => {
    const vowels = (w.match(/[aeiouy]/g) ?? []).length;
    return w.length >= 5 && vowels / w.length < 0.2;
  });
  return bad.length === words.length;
}

// Returns a ready-made answer, or null if the AI should answer.
export function cannedReply(message: string): string | null {
  const n = normalize(message);
  if (HOW_ARE_YOU.test(n) || (n.length < 40 && /\bhow are you\b/.test(n))) return "I'm doing well, thanks! How can I help you today?";
  if (GREETING.test(n)) return "Hi! You can ask me about our hours, services, prices or how to book.";
  if (THANKS.test(n)) return "You're welcome! Is there anything else I can help with?";
  if (BYE.test(n)) return "Thanks for stopping by! Have a great day.";
  if (looksLikeGibberish(n)) return "Sorry, I didn't catch that. Could you rephrase your question?";
  return null;
}

// --- Answer cache (in memory, resets on restart) ---
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;
const cache = new Map<string, { answer: string; at: number }>();

// The key includes a hash of the business info, so editing the context
// automatically stops old answers from being reused.
function cacheKey(botId: string, botName: string, context: string, message: string): string {
  const ctx = createHash("sha1").update(botName + "\n" + context).digest("hex").slice(0, 12);
  return `${botId}:${ctx}:${normalize(message)}`;
}

export function getCached(botId: string, botName: string, context: string, message: string): string | null {
  const key = cacheKey(botId, botName, context, message);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.answer;
}

export function setCached(botId: string, botName: string, context: string, message: string, answer: string) {
  if (!answer.trim()) return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey(botId, botName, context, message), { answer, at: Date.now() });
}
