import "dotenv/config";
import { db, pool } from "./index.js";
import { bots } from "./schema.js";

// Creates (or updates) the demo bot used by /demo. Safe to run more than once.
const demo = {
  id: "demo-plumbing",
  name: "Big Apple Plumbing",
  greeting: "Hi! Ask me about our hours, services, or emergency repairs.",
  // "localhost" lets the local demo page work.
  allowedDomains: ["localhost"],
  enabled: true,
  context: `
Business: Big Apple Plumbing, a family-owned plumbing company in New York City.
Hours: Monday-Friday 8am-6pm, Saturday 9am-2pm. Closed Sunday.
Emergency service: available 24/7 for burst pipes, major leaks, and sewer backups. Emergency visits start at $250.
Services: drain cleaning, leak repair, water heater installation and repair, toilet and faucet repair, bathroom remodel plumbing.
Service area: Manhattan, Brooklyn, Queens.
Booking: customers can request a visit by sharing their name, phone number, address, and a short description of the problem. A technician calls back within 30 minutes during business hours.
Pricing: standard visit fee is $89, applied toward the repair if the customer proceeds.
Phone: (212) 555-0123.
`.trim(),
};

await db
  .insert(bots)
  .values(demo)
  .onConflictDoUpdate({ target: bots.id, set: demo });

console.log(`Seeded bot "${demo.id}".`);
await pool.end();
