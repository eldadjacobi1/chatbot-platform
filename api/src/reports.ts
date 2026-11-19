import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { messages } from "./db/schema.js";
import { normalize } from "./savings.js";

// Saves one question for the owner's report. Never blocks or breaks the chat.
export function logQuestion(botId: string, question: string, source: "ai" | "cache", unanswered: boolean) {
  db.insert(messages)
    .values({ botId, question, questionKey: normalize(question), source, unanswered })
    .catch((err) => console.error("could not log question", err));
}

type Row = { question: string; count: number; unanswered: boolean };

export async function getReport(botId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = and(eq(messages.botId, botId), gte(messages.createdAt, since));

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unanswered: sql<number>`count(*) filter (where ${messages.unanswered})::int`,
      fromCache: sql<number>`count(*) filter (where ${messages.source} = 'cache')::int`,
    })
    .from(messages)
    .where(where);

  const rows: Row[] = await db
    .select({
      question: sql<string>`min(${messages.question})`,
      count: sql<number>`count(*)::int`,
      unanswered: sql<boolean>`bool_or(${messages.unanswered})`,
    })
    .from(messages)
    .where(where)
    .groupBy(messages.questionKey)
    .orderBy(sql`count(*) desc`)
    .limit(200);

  return {
    days,
    total: totals?.total ?? 0,
    unansweredCount: totals?.unanswered ?? 0,
    savedByCache: totals?.fromCache ?? 0,
    topQuestions: rows.slice(0, 10).map(({ question, count }) => ({ question, count })),
    unanswered: rows
      .filter((r) => r.unanswered)
      .slice(0, 10)
      .map(({ question, count }) => ({ question, count })),
  };
}
