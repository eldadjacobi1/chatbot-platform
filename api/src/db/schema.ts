import { pgTable, text, boolean, timestamp, bigserial } from "drizzle-orm/pg-core";

// One row per chatbot. The table itself is created by the SQL files in api/migrations.
export const bots = pgTable("bots", {
  // Public id used in the embed code. Must not contain dots (used in signed tokens).
  id: text("id").primaryKey(),
  // Clerk user id of the owner. Empty for the built-in demo bot.
  ownerId: text("owner_id"),
  name: text("name").notNull(),
  greeting: text("greeting").notNull(),
  // The business information the bot answers from.
  context: text("context").notNull(),
  // Websites allowed to embed this bot. A domain also allows its subdomains.
  allowedDomains: text("allowed_domains").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // Look and personality (see appearance.ts).
  collectLeads: boolean("collect_leads").notNull().default(true),
  theme: text("theme").notNull().default("clean"),
  color: text("color").notNull().default("#4338ca"),
  title: text("title").notNull().default(""),
  avatar: text("avatar").notNull().default(""),
  position: text("position").notNull().default("right"),
  tone: text("tone").notNull().default("friendly"),
  audience: text("audience").notNull().default("general"),
  instructions: text("instructions").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Bot = typeof bots.$inferSelect;

// One row per question answered by the AI or the cache (canned replies are not logged).
export const messages = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  botId: text("bot_id").notNull(),
  question: text("question").notNull(),
  questionKey: text("question_key").notNull(),
  source: text("source").notNull(),
  unanswered: boolean("unanswered").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
