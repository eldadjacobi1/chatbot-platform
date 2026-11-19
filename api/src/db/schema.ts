import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

// One row per chatbot. Accounts and owners are added in the next step.
export const bots = pgTable("bots", {
  // Public id used in the embed code. Must not contain dots (used in signed tokens).
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  greeting: text("greeting").notNull(),
  // The business information the bot answers from.
  context: text("context").notNull(),
  // Websites allowed to embed this bot. A domain also allows its subdomains.
  allowedDomains: text("allowed_domains").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Bot = typeof bots.$inferSelect;
