import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL. Add it to .env (see .env.example).");
  process.exit(1);
}

// Hosted databases (Railway) need SSL; a local one does not.
const isLocal = /localhost|127\.0\.0\.1/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
