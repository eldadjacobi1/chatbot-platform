import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { bots, type Bot } from "./db/schema.js";

export type { Bot };

// Looks up a bot by its public id. Returns undefined if it does not exist.
export async function getBot(id: string): Promise<Bot | undefined> {
  const rows = await db.select().from(bots).where(eq(bots.id, id)).limit(1);
  return rows[0];
}
