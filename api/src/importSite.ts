import type { FastifyInstance } from "fastify";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import OpenAI from "openai";
import { requireUser } from "./auth.js";
import { getPlanCached, PLAN_LIMITS } from "./billing.js";
import { mergeKnowledge } from "./knowledge.js";

const MAX_PAGES = 5;
const MAX_BYTES = 400_000;
const PAGE_CHARS = 3500;
const PER_DAY = 5;
const KEYWORDS = /about|service|contact|pric|menu|hour|faq|location|team|visit|book|product|rates|treatment|practice/i;

// --- Safety: never let this feature fetch our own network or private addresses.
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublic(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Use a web address starting with http or https.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("That address is not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("That address is not allowed.");
  const addrs: { address: string }[] = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address is not allowed.");
}

async function fetchPage(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ChatknockImporter/1.0", Accept: "text/html" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The website answered with an error (${res.status}).`);
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) throw new Error("That address is not a web page.");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("The page was empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    return { url, html: Buffer.concat(chunks).toString("utf8") };
  }
  throw new Error("Too many redirects.");
}

function toText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// Facts that sites hide in tags rather than visible text: phone, email and schema.org data (hours, address).
function structuredInfo(html: string): string {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) out.add(`Phone: ${decodeURIComponent(m[1]).trim()}`);
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) out.add(`Email: ${m[1].trim()}`);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const txt = JSON.stringify(JSON.parse(m[1].trim()));
      out.add(`Business data: ${txt.slice(0, 1500)}`);
    } catch { /* ignore broken JSON */ }
  }
  return [...out].slice(0, 12).join("\n");
}

// Best guess at the site's brand color: theme-color meta tag, then a CSS variable named like
// "primary" or "brand", then the most common vivid color in the page and its style files.
function vivid(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return s > 0.3 && l > 0.2 && l < 0.75;
}

function normHex(h: string): string {
  const x = h.replace("#", "").toLowerCase();
  return "#" + (x.length === 3 ? x.split("").map((c) => c + c).join("") : x);
}

function rgbToHex(r: string, g: string, b: string): string {
  return "#" + [r, g, b].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("");
}

// All colors written in the text, as "#rrggbb", from #hex and rgb()/rgba() forms.
function colorsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) out.push(normHex(m[0]));
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) out.push(rgbToHex(m[1], m[2], m[3]));
  return out;
}

// Makes a color a little deeper so the chat button stays visible on a white page.
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function darken(hex: string, extra = 0.08): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  let l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const toHex = (L: number) => {
    const c = (1 - Math.abs(2 * L - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
    const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [rr, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  };
  l = Math.max(0.2, l - extra);
  let out = toHex(l);
  // Contrast against white must be at least 3:1 (the standard for buttons and icons).
  while (1.05 / (lum(out) + 0.05) < 3 && l > 0.15) { l -= 0.03; out = toHex(l); }
  return out;
}

// For sites with no vivid color (cream, beige, grey-blue): take the most used tinted color and make a
// deeper version of the same hue, so the button matches the site but still stands out.
function softColor(all: string): string | null {
  const counts = new Map<string, number>();
  for (const c of colorsIn(all)) {
    const n = parseInt(c.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 0.04 || max < 0.15) continue; // plain grey, white or black
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null, top = 0;
  for (const [c, n] of counts) if (n > top) { best = c; top = n; }
  if (!best) return null;
  const n = parseInt(best.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const sat = 0.4, L = 0.58;
  const c = (1 - Math.abs(2 * L - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return darken("#" + [rr, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join(""), 0);
}

function detectColor(html: string, css: string): string | null {
  const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["'](#[0-9a-f]{3,6})["']/i)
    ?? html.match(/<meta[^>]+content=["'](#[0-9a-f]{3,6})["'][^>]*name=["']theme-color["']/i);
  if (meta && [4, 7].includes(meta[1].length) && vivid(normHex(meta[1]))) return darken(normHex(meta[1]));

  const all = html + "\n" + css;
  for (const m of all.matchAll(/--[\w-]*(?:primary|brand|accent|main)[\w-]*\s*:\s*([^;}\n]+)/gi)) {
    const c = colorsIn(m[1])[0];
    if (c && vivid(c)) return darken(c);
  }
  const counts = new Map<string, number>();
  for (const c of colorsIn(all)) if (vivid(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: string | null = null, top = 0;
  for (const [c, n] of counts) if (n > top) { best = c; top = n; }
  if (top >= 2 && best) return darken(best);
  return softColor(all);
}

// Up to 3 style files linked from the page, joined. Failures are ignored.
async function fetchStyles(html: string, base: URL): Promise<string> {
  const hrefs: URL[] = [];
  for (const m of html.matchAll(/<link\s[^>]*>/gi)) {
    if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
    const h = m[0].match(/href=["']([^"']+)["']/i);
    if (!h) continue;
    try { hrefs.push(new URL(h[1], base)); } catch { /* ignore */ }
  }
  let css = "";
  for (const u of hrefs.slice(0, 3)) {
    try {
      await assertPublic(u);
      const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "ChatknockImporter/1.0" } });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("css")) continue;
      css += "\n" + (await res.text()).slice(0, 300_000);
    } catch { /* skip */ }
  }
  return css;
}

function pickLinks(html: string, base: URL): URL[] {
  const found = new Map<string, URL>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      if (!KEYWORDS.test(u.pathname) || /\.(pdf|jpg|png|zip)$/i.test(u.pathname)) continue;
      u.hash = "";
      if (u.pathname !== base.pathname) found.set(u.href, u);
    } catch { /* ignore bad links */ }
  }
  return [...found.values()].slice(0, MAX_PAGES - 1);
}

type Used = Map<string, { day: string; n: number }>;
const used: Used = new Map();
const usedColor: Used = new Map();
function allow(userId: string, map: Used = used, max = PER_DAY): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const cur = map.get(userId);
  if (!cur || cur.day !== day) { map.set(userId, { day, n: 1 }); return true; }
  if (cur.n >= max) return false;
  cur.n++;
  return true;
}

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

export async function importRoutes(app: FastifyInstance) {
  // Just the brand color of a website, for the setup guide. No AI, so every plan can use it.
  app.post("/api/site-color", { preHandler: requireUser }, async (req) => {
    const raw = ((req.body ?? {}) as { url?: unknown }).url;
    if (typeof raw !== "string" || !raw.trim() || !allow(req.userId!, usedColor, 30)) return { color: null };
    try {
      const start = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
      const home = await fetchPage(start);
      let html = home.html;
      for (const link of pickLinks(home.html, home.url).slice(0, 2)) {
        try { html += "\n" + (await fetchPage(link)).html; } catch { /* skip */ }
      }
      return { color: detectColor(html, await fetchStyles(home.html, home.url)) };
    } catch {
      return { color: null };
    }
  });

  app.post("/api/import-website", { preHandler: requireUser }, async (req, reply) => {
    if (!PLAN_LIMITS[await getPlanCached(req.userId!)].aiTools) {
      return reply.code(403).send({ error: "Importing from your website is part of Pro." });
    }
    if (!client) return reply.code(500).send({ error: "Import is not configured." });
    const raw = ((req.body ?? {}) as { url?: unknown }).url;
    if (typeof raw !== "string" || !raw.trim()) return reply.code(400).send({ error: "Enter your website address." });
    let start: URL;
    try { start = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); }
    catch { return reply.code(400).send({ error: "That doesn't look like a web address." }); }
    if (!allow(req.userId!)) return reply.code(429).send({ error: `You can import ${PER_DAY} times a day. Try again tomorrow.` });

    try {
      const home = await fetchPage(start);
      const htmls = [home.html];
      const pages = [{ url: home.url, text: (toText(home.html).slice(0, PAGE_CHARS) + "\n" + structuredInfo(home.html)).trim() }];
      for (const link of pickLinks(home.html, home.url)) {
        try {
          const p = await fetchPage(link);
          htmls.push(p.html);
          pages.push({ url: p.url, text: (toText(p.html).slice(0, PAGE_CHARS) + "\n" + structuredInfo(p.html)).trim() });
        } catch { /* skip pages that fail */ }
      }
      const source = pages.map((p) => `--- ${p.url.href}\n${p.text}`).join("\n\n");
      if (source.replace(/---[^\n]*\n/g, "").trim().length < 80) {
        return reply.code(422).send({ error: "I couldn't read enough text on that site. Add your info by hand instead." });
      }

      const current = typeof (req.body as { existing?: unknown }).existing === "string"
        ? ((req.body as { existing: string }).existing).slice(0, 8000)
        : "";
      const text = await mergeKnowledge({ current, incoming: source, source: "website" });
      if (!text) return reply.code(502).send({ error: "Nothing came back. Try again." });
      return { text, pages: pages.length, color: detectColor(htmls.join("\n"), await fetchStyles(home.html, home.url)) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const known = /address|redirect|web page|website answered|empty/i.test(msg);
      req.log.warn({ msg }, "import failed");
      return reply.code(known ? 400 : 502).send({ error: known ? msg : "I couldn't reach that website. Check the address and try again." });
    }
  });
}
