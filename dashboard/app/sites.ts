// Static, illustrated mock websites for the landing-page examples.
// Plain HTML strings (no user input), shown behind the chat window.

const nav = (name: string, links: string[], cta: string) =>
  `<div class="site-nav"><b>${name}</b>${links.map((l) => `<span>${l}</span>`).join("")}<em>${cta}</em></div>`;

const card = (art: string, title: string, meta: string) =>
  `<div class="site-card"><div class="site-art">${art}</div><b>${title}</b><span>${meta}</span></div>`;

const slice = (fill: string) =>
  `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M32 46L6 8Q32-4 58 8Z" fill="#f2b84b"/><path d="M32 40L12 11Q32 3 52 11Z" fill="${fill}"/><circle cx="26" cy="16" r="3.6" fill="#b42318"/><circle cx="38" cy="19" r="3.6" fill="#b42318"/><circle cx="32" cy="29" r="3.6" fill="#b42318"/></svg>`;

const pizza = `
${nav("Napoli Slice", ["Menu", "Locations", "Catering"], "Order online")}
<div class="site-hero" style="--bn:linear-gradient(120deg,#ffe3c2,#ffb878)">
  <div class="site-copy"><h4>Pizza that tastes like Naples.</h4><p>Hand-stretched dough, 90 seconds in a wood fire.</p><span class="site-cta">See the menu</span></div>
  <svg class="site-photo" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="92" fill="#d98a3d"/><circle cx="100" cy="100" r="82" fill="#e8a24f"/>
    <circle cx="100" cy="100" r="72" fill="#c8321f"/>
    <g fill="#fff4d6"><circle cx="70" cy="70" r="20"/><circle cx="125" cy="62" r="17"/><circle cx="140" cy="115" r="21"/><circle cx="85" cy="130" r="19"/><circle cx="108" cy="95" r="12"/></g>
    <g fill="#2f7d3b"><path d="M72 66q10-12 18 0q-8 10-18 0Z"/><path d="M128 112q10-12 18 0q-8 10-18 0Z"/><path d="M82 126q10-12 18 0q-8 10-18 0Z"/></g>
    <path d="M100 100L100 28M100 100L168 128M100 100L40 150" stroke="#e8a24f" stroke-width="3" opacity=".7"/>
  </svg>
</div>
<div class="site-cards">${card(slice("#c8321f"), "Margherita slice", "$4.50")}${card(slice("#a32a1a"), "Pepperoni slice", "$5.00")}${card('<svg viewBox="0 0 64 48" aria-hidden="true"><g fill="#f2b84b"><ellipse cx="18" cy="26" rx="11" ry="9"/><ellipse cx="38" cy="20" rx="11" ry="9"/><ellipse cx="46" cy="34" rx="11" ry="9"/></g><g fill="#2f7d3b"><circle cx="18" cy="26" r="2"/><circle cx="38" cy="20" r="2"/><circle cx="46" cy="34" r="2"/></g></svg>', "Garlic knots", "$3.00")}</div>
<div class="site-about"><h5>Open every day until midnight</h5><p>Slices from $4.50. Whole pies for pickup and delivery across Brooklyn.</p></div>`;

const toothIcon = (c: string) =>
  `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M32 8c-8-6-20-1-18 12 1 9 5 11 6 20 1 4 5 4 6-1l2-9q2-2 4 0l2 9c1 5 5 5 6 1 1-9 5-11 6-20 2-13-10-18-18-12Z" fill="#fff" stroke="${c}" stroke-width="3" stroke-linejoin="round"/></svg>`;

const dental = `
${nav("Bright Smile Dental", ["Services", "Our team", "Insurance"], "Book a visit")}
<div class="site-hero" style="--bn:linear-gradient(120deg,#dff5f1,#a9e0d8)">
  <div class="site-copy"><h4>Family dentistry in Brooklyn.</h4><p>Gentle care for kids, parents and grandparents. Now accepting new patients.</p><span class="site-cta">Book a visit</span></div>
  <svg class="site-photo" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="104" r="86" fill="#fff" opacity=".55"/>
    <path d="M100 38c-26-20-66-4-60 40 3 30 16 36 20 64 3 14 17 14 20-3l6-28q7-7 14 0l6 28c3 17 17 17 20 3 4-28 17-34 20-64 6-44-34-60-60-40Z" fill="#fff" stroke="#0f766e" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="82" cy="84" r="6" fill="#0f766e"/><circle cx="118" cy="84" r="6" fill="#0f766e"/>
    <path d="M80 108q20 20 40 0" fill="none" stroke="#0f766e" stroke-width="6" stroke-linecap="round"/>
    <g fill="#fff" stroke="#0f766e" stroke-width="3"><path d="M160 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/><path d="M36 150l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g>
  </svg>
</div>
<div class="site-cards">${card(toothIcon("#0f766e"), "Cleanings and checkups", "From $95")}${card(toothIcon("#0ea5a0"), "Teeth whitening", "From $249")}${card(toothIcon("#0f766e"), "Kids' dentistry", "Ages 2 and up")}</div>
<div class="site-about"><h5>New patients welcome</h5><p>Same-week appointments, evening hours and most insurance plans accepted.</p></div>`;

const bldg = (x: number, w: number, h: number, shade: string) => {
  const y = 140 - h;
  let win = "";
  for (let r = 0; r < Math.floor((h - 10) / 14); r++)
    for (let c = 0; c < Math.floor((w - 6) / 10); c++)
      win += `<rect x="${x + 5 + c * 10}" y="${y + 8 + r * 14}" width="5" height="7" fill="#f6d77a" opacity="${(r + c) % 3 ? 0.35 : 0.85}"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${shade}"/>${win}`;
};

const scale = `<svg viewBox="0 0 64 48" aria-hidden="true"><g fill="none" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round"><path d="M32 6v34M18 40h28M12 14h40"/><path d="M12 14l-7 14h14ZM52 14l-7 14h14Z"/></g></svg>`;
const doc = `<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="18" y="4" width="28" height="38" rx="3" fill="#fff" stroke="#1e3a8a" stroke-width="3"/><path d="M24 15h16M24 23h16M24 31h10" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round"/></svg>`;
const handshake = `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 20l14-8 12 6 12-6 14 8-10 16-8-4-8 8-8-8-8 4Z" fill="#fff" stroke="#1e3a8a" stroke-width="3" stroke-linejoin="round"/></svg>`;

const law = `
${nav("Hart &amp; Lowell LLP", ["Practice areas", "Attorneys", "Results"], "Free consultation")}
<div class="site-hero dark" style="--bn:linear-gradient(120deg,#16275e,#1e3a8a)">
  <div class="site-copy"><h4>Employment law for New Yorkers.</h4><p>Wage disputes, discrimination and severance. 25 years, 1,200 cases.</p><span class="site-cta">Talk to an attorney</span></div>
  <svg class="site-photo" viewBox="0 0 200 150" aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
    <rect width="200" height="150" fill="none"/>
    ${bldg(6, 34, 70, "#2b4590")}${bldg(44, 28, 100, "#22387a")}${bldg(76, 40, 120, "#2f4ba0")}${bldg(120, 30, 82, "#22387a")}${bldg(154, 38, 104, "#2b4590")}
    <rect y="140" width="200" height="10" fill="#0f1c47"/>
  </svg>
</div>
<div class="site-cards">${card(scale, "Wage disputes", "Unpaid overtime")}${card(doc, "Severance review", "Before you sign")}${card(handshake, "Discrimination", "Know your rights")}</div>
<div class="site-about"><h5>Why clients choose us</h5><p>Free first consultation. You pay nothing unless we win your case.</p></div>`;

export const SITES: Record<string, string> = { pizza, law, dental };
