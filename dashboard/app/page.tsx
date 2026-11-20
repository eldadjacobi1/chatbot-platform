import Link from "next/link";
import NavActions from "./NavActions";
import Examples from "./Examples";
import "./landing.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const DEMO_BOT = "bot_chattr_demo";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    note: "Try it on your own site.",
    features: [
      "1 chatbot",
      "50 messages a day",
      "All 3 designs, your colors and tone",
      "Question totals in your report",
      "Your latest 3 leads",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    per: "per month",
    note: "For a business that gets real traffic.",
    features: [
      "1 chatbot",
      "300 messages a day",
      "Full reports: unanswered and most asked questions",
      "All your leads",
      "Extra instructions for how it talks",
    ],
    cta: "Start with Pro",
    featured: true,
  },
  {
    name: "Business",
    price: "$49.99",
    per: "per month",
    note: "For several sites or locations.",
    features: ["3 chatbots", "1,500 messages a day", "Everything in Pro"],
    cta: "Start with Business",
    featured: false,
  },
];

const FAQ = [
  {
    q: "Will it make things up?",
    a: "It answers only from the business information you write. If the answer isn't there, it says it isn't sure and offers to take the visitor's contact details.",
  },
  {
    q: "How do I add it to my website?",
    a: "Paste one line of code before the closing body tag of your site. It works on any website where you can add code.",
  },
  {
    q: "What stops it from running up costs?",
    a: "Repeated questions are answered instantly at no cost, chats are kept short, and every plan has a daily message limit. A chat that goes nowhere is closed politely.",
  },
  {
    q: "Can someone copy the chat onto another site?",
    a: "No. Each chatbot only works on the website you enter.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing page whenever you like and you drop back to the Free plan.",
  },
  {
    q: "Which languages does it speak?",
    a: "English for now.",
  },
];

export default function Home() {
  return (
    <main className="lp">
      <div className="lp-bar">
      <header className="lp-nav">
        <Link href="/" className="lp-brand">
          <span className="lp-mark" aria-hidden="true" />
          Chattr
        </Link>
        <nav className="lp-links" aria-label="Sections">
          <a href="#examples">Examples</a>
          <a href="#plans">Plans</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-actions">
          <NavActions />
        </div>
      </header>
      </div>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1>Customers ask. Your website answers.</h1>
          <p>
            Chattr puts a chatbot on your site that answers from your own business information,
            collects the leads it can&apos;t help with, and shows you what people really want to know.
          </p>
          <div className="lp-cta">
            <Link className="lp-btn big" href="/sign-up">Start free</Link>
            <a className="lp-btn ghost big" href="#live">Try the live chat</a>
          </div>
          <p className="lp-fine">Free plan. No credit card. Set up in minutes.</p>
        </div>

        <div className="lp-live" id="live">
          <div className="lp-live-bar"><span className="lp-dot" />Live. This is a real Chattr chatbot.</div>
          <iframe
            title="Live chat with Chattr"
            src={`${API}/widget/${DEMO_BOT}`}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        </div>
      </section>

      <section className="lp-section" id="examples">
        <h2>Looks like your business. Talks like your business.</h2>
        <p className="lp-sub">
          Pick a design, your brand color and a tone of voice. These three chatbots run on the same product.
        </p>
        <Examples />
      </section>

      <section className="lp-section" id="how">
        <h2>Live in three steps</h2>
        <ol className="lp-steps">
          <li>
            <b>1</b>
            <h3>Tell it about your business</h3>
            <p>Hours, services, prices, how to book. Write it the way you would tell a new employee.</p>
          </li>
          <li>
            <b>2</b>
            <h3>Paste one line of code</h3>
            <p>Add it to your website once. The chat button appears on every page.</p>
          </li>
          <li>
            <b>3</b>
            <h3>Check in when you want</h3>
            <p>Your dashboard shows the questions, the gaps and the leads.</p>
          </li>
        </ol>
      </section>

      <section className="lp-section lp-product">
        <div className="lp-feature">
          <div>
            <h2>See what customers actually ask</h2>
            <p className="lp-sub">
              Every question is counted. The ones the chatbot couldn&apos;t answer are listed at the top,
              so you know exactly what to add next.
            </p>
          </div>
          <div className="lp-panel" aria-label="Report example">
            <div className="lp-stats">
              <div><b>128</b><span>questions this month</span></div>
              <div><b className="hot">9</b><span>couldn&apos;t answer</span></div>
              <div><b>41</b><span>answered instantly</span></div>
            </div>
            <h4>Unanswered questions</h4>
            <ul>
              <li>Do you deliver to Brooklyn? <i>6x</i></li>
              <li>Do you take reservations? <i>4x</i></li>
              <li>Is there parking nearby? <i>2x</i></li>
            </ul>
          </div>
        </div>

        <div className="lp-feature flip">
          <div>
            <h2>Never lose a customer who wanted an answer</h2>
            <p className="lp-sub">
              When the chatbot doesn&apos;t know, the visitor can leave an email or phone number.
              New leads show up in your dashboard with the question they asked.
            </p>
          </div>
          <div className="lp-panel" aria-label="Leads example">
            <h4>Leads</h4>
            <ul className="lp-leads">
              <li>
                <b>maria@gmail.com</b> <em>New</em>
                <span>Asked: Can you cater a party of 30?</span>
              </li>
              <li>
                <b>(917) 555-0142</b> <em>New</em>
                <span>Asked: Do you deliver to Brooklyn?</span>
              </li>
              <li>
                <b>dan@brightcorp.com</b>
                <span>Asked: Do you have a gluten-free menu?</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="lp-trio">
          <div>
            <h3>Says only what you told it</h3>
            <p>No invented prices or hours. If it&apos;s not in your information, it says so.</p>
          </div>
          <div>
            <h3>Costs stay low</h3>
            <p>Repeat questions are free, chats stay short, and daily limits protect you.</p>
          </div>
          <div>
            <h3>Locked to your website</h3>
            <p>The chat only works on the domain you enter.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" id="plans">
        <h2>Start free. Upgrade when it pays for itself.</h2>
        <div className="lp-plans">
          {PLANS.map((p) => (
            <div key={p.name} className={p.featured ? "lp-plan featured" : "lp-plan"}>
              {p.featured && <span className="lp-badge">Most popular</span>}
              <h3>{p.name}</h3>
              <p className="lp-price"><b>{p.price}</b> {p.per}</p>
              <p className="lp-plan-note">{p.note}</p>
              <ul>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link className={p.featured ? "lp-btn big" : "lp-btn ghost big"} href="/sign-up">{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="faq">
        <h2>Questions</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>Your next customer is asking something right now.</h2>
        <Link className="lp-btn big" href="/sign-up">Start free</Link>
      </section>

      <footer className="lp-footer">
        <span>Chattr</span>
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-up">Get started</Link>
      </footer>
    </main>
  );
}
