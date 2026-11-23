import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

export type Usage = { promptTokens: number; completionTokens: number };


// Adds one AI call to today's totals for the bot. Never blocks or breaks the chat.
export function recordUsage(botId: string, u: Usage) {
  db.execute(sql`
    INSERT INTO usage_daily (bot_id, day, requests, prompt_tokens, completion_tokens)
    VALUES (${botId}, (now() at time zone 'UTC')::date, 1, ${u.promptTokens}, ${u.completionTokens})
    ON CONFLICT (bot_id, day) DO UPDATE SET
      requests = usage_daily.requests + 1,
      prompt_tokens = usage_daily.prompt_tokens + EXCLUDED.prompt_tokens,
      completion_tokens = usage_daily.completion_tokens + EXCLUDED.completion_tokens
  `).catch((err) => console.error("could not record usage", err));
}
