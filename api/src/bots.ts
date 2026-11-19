// Hardcoded bots for now. Later this comes from the database, created in the dashboard.
// Bot ids must not contain dots (they are used inside signed tokens).
export interface Bot {
  id: string;
  name: string;
  greeting: string;
  context: string;
  // Websites allowed to embed this bot. A domain also allows its subdomains.
  allowedDomains: string[];
  enabled: boolean;
}

const bots: Bot[] = [
  {
    id: "demo-plumbing",
    name: "Big Apple Plumbing",
    greeting: "Hi! Ask me about our hours, services, or emergency repairs.",
    // "localhost" lets the local demo page work. Real customers will list their own site.
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
  },
];

export function getBot(id: string): Bot | undefined {
  return bots.find((b) => b.id === id);
}
