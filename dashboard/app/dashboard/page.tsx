"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import Logo from "../Logo";
import "./app.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Bot = {
  id: string;
  name: string;
  greeting: string;
  context: string;
  domain: string;
  enabled: boolean;
  collectLeads: boolean;
  suggestions: string[];
  theme: string;
  color: string;
  title: string;
  avatar: string;
  position: "right" | "left";
  tone: string;
  audience: string;
  instructions: string;
};

type Form = Omit<Bot, "id">;

type Tab = "overview" | "reports" | "leads" | "appearance" | "settings" | "install" | "plan";

type Lead = { id: number; contact: string; name: string; question: string; createdAt: string };
type Leads = { total: number; limited: boolean; leads: Lead[] };

type Billing = { plan: "free" | "pro" | "business"; status: string; hasCustomer: boolean };

const PLANS = [
  { id: "free", name: "Free", price: "$0" },
  { id: "pro", name: "Pro", price: "$9.99/month" },
  { id: "business", name: "Business", price: "$49.99/month" },
] as const;

type QuestionCount = { question: string; count: number };
type Report = {
  days: number;
  total: number;
  unansweredCount: number;
  savedByCache: number;
  topQuestions: QuestionCount[];
  unanswered: QuestionCount[];
  limited?: boolean;
};

const emptyForm: Form = {
  name: "",
  greeting: "Hi! How can I help you today?",
  context: "",
  domain: "",
  enabled: true,
  collectLeads: true,
  suggestions: [],
  theme: "clean",
  color: "#4338ca",
  title: "",
  avatar: "",
  position: "right",
  tone: "friendly",
  audience: "general",
  instructions: "",
};

const THEMES = [
  { id: "clean", name: "Clean", text: "White window, rounded corners, round button.", label: "" },
  { id: "bold", name: "Bold", text: "Solid header, squarer corners, \"Chat with us\" button.", label: "Chat with us" },
  { id: "soft", name: "Soft", text: "Tinted background, extra-round bubbles, \"Ask us\" button.", label: "Ask us" },
];
const COLORS = ["#4338ca", "#0f766e", "#be123c", "#c2410c", "#1d4ed8", "#14142b"];
// Free plan: presets only. (Pro unlocks custom color, button position and extra instructions.)
const TONES = [
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["playful", "Playful"],
  ["concise", "Short and to the point"],
];
const AUDIENCES = [
  ["general", "Everyone"],
  ["kids", "Kids"],
  ["seniors", "Seniors"],
  ["professionals", "Professionals"],
];

const NAV: [Tab, string, string][] = [
  ["overview", "Home", "home"],
  ["reports", "Chats", "chat"],
  ["leads", "Leads", "leads"],
  ["appearance", "Design", "design"],
  ["settings", "Setup", "setup"],
  ["install", "Install", "code"],
];

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z",
  leads: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 4-6 8-6s8 2 8 6",
  design: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z",
  setup: "M4 6h16M4 12h16M4 18h10",
  code: "M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14",
  plan: "M3 7h18v12H3zM3 11h18",
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function DashboardPage() {
  const { getToken, isLoaded } = useAuth();
  const [bot, setBot] = useState<Bot | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [leads, setLeads] = useState<Leads | null>(null);
  // Leads newer than this are "new". Remembered per bot in this browser.
  const [seenAt, setSeenAt] = useState<string>("");
  const isFree = (billing?.plan ?? "free") === "free";
  const [hideSteps, setHideSteps] = useState(false);
  useEffect(() => {
    try { setHideSteps(localStorage.getItem("chattr-steps-done") === "1"); } catch {}
  }, []);
  function dismissSteps() {
    setHideSteps(true);
    try { localStorage.setItem("chattr-steps-done", "1"); } catch {}
  }

  // Calls the API with the logged-in user's token.
  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken();
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      return data;
    },
    [getToken]
  );

  // Load the owner's bot (if they have one) when the page opens.
  useEffect(() => {
    if (!isLoaded) return;
    call("/api/bots")
      .then((data) => {
        const first: Bot | undefined = data.bots[0];
        if (first) {
          setBot(first);
          const { id: _id, ...rest } = first;
          setForm(rest);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoaded, call]);

  // Load the report whenever the bot is known.
  const botId = bot?.id;
  const loadBilling = useCallback(() => {
    if (!isLoaded) return;
    call("/api/billing").then(setBilling).catch(() => {});
  }, [call, isLoaded]);
  useEffect(loadBilling, [loadBilling]);

  // After paying, Stripe sends us back here. Open the Plan tab and refresh
  // a few times, because the payment confirmation can take a moment to arrive.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("billing") !== "success") return;
    setTab("plan");
    // Clean the URL so a refresh doesn't jump back to the Plan tab.
    window.history.replaceState(null, "", "/dashboard");
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(loadBilling, ms));
    return () => timers.forEach(clearTimeout);
  }, [loadBilling]);

  // Coming back from Stripe with the Back button restores the page as it was,
  // including a "busy" button. Reset it whenever the page is shown again.
  useEffect(() => {
    const reset = () => setBillingBusy(false);
    window.addEventListener("pageshow", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);

  async function openBilling(kind: "checkout" | "portal", plan?: string) {
    setBillingBusy(true);
    setError("");
    try {
      const data = await call(`/api/billing/${kind}`, { method: "POST", body: JSON.stringify({ plan }) });
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBillingBusy(false);
    }
  }

  const loadReport = useCallback(() => {
    if (!botId) return;
    call(`/api/bots/${botId}/report`).then(setReport).catch(() => setReport(null));
  }, [botId, call]);
  useEffect(loadReport, [loadReport]);

  const loadLeads = useCallback(() => {
    if (!botId) return;
    call(`/api/bots/${botId}/leads`).then(setLeads).catch(() => setLeads(null));
  }, [botId, call]);
  useEffect(loadLeads, [loadLeads]);

  // Check for new leads every minute while the dashboard is open.
  useEffect(() => {
    if (!botId) return;
    const timer = setInterval(loadLeads, 60_000);
    return () => clearInterval(timer);
  }, [botId, loadLeads]);

  // Remember when the owner last looked at the Leads tab.
  useEffect(() => {
    if (!botId) return;
    try {
      setSeenAt(localStorage.getItem(`leadsSeen:${botId}`) ?? "");
    } catch {
      setSeenAt("");
    }
  }, [botId]);
  // New leads stay highlighted while the Leads tab is open; leaving the tab marks them as seen.
  useEffect(() => {
    if (tab !== "leads" || !botId) return;
    return () => {
      const now = new Date().toISOString();
      try { localStorage.setItem(`leadsSeen:${botId}`, now); } catch {}
      setSeenAt(now);
    };
  }, [tab, botId]);

  const isNewLead = (l: Lead) => !seenAt || new Date(l.createdAt).getTime() > new Date(seenAt).getTime();
  const newLeads = leads ? leads.leads.filter(isNewLead).length : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = bot
        ? await call(`/api/bots/${bot.id}`, { method: "PUT", body: JSON.stringify(form) })
        : await call("/api/bots", { method: "POST", body: JSON.stringify(form) });
      const wasNew = !bot;
      setBot(data.bot);
      setMessage(wasNew ? "" : "Saved.");
      if (wasNew) setTab("install");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const snippet = bot ? `<script src="${API}/embed.js" data-bot="${bot.id}"></script>` : "";

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const update = (field: keyof Form, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="app">
      <aside className="app-side">
        <div className="app-brand"><Logo size={28} />Chattr</div>
        {bot && (
          <nav className="app-nav" aria-label="Main">
            {NAV.map(([id, label, icon]) => (
              <button key={id} type="button" className={tab === id ? "nav-item on" : "nav-item"} onClick={() => setTab(id)}>
                <Icon name={icon} />
                <span>{label}</span>
                {id === "leads" && newLeads > 0 && tab !== "leads" && <em className="nav-count">{newLeads}</em>}
              </button>
            ))}
          </nav>
        )}
        <div className="app-side-foot">
          {bot && (
            <button type="button" className={tab === "plan" ? "nav-item on" : "nav-item"} onClick={() => setTab("plan")}>
              <Icon name="plan" />
              <span>Plan</span>
              <em className="nav-plan">{PLANS.find((p) => p.id === (billing?.plan ?? "free"))?.name}</em>
            </button>
          )}
          <div className="app-user"><UserButton /></div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-inner">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {bot && tab === "overview" && (
            <>
              <header className="app-head">
                <div>
                  <h1>{bot.name}</h1>
                  <p className="hint"><span className={bot.enabled ? "dot on" : "dot"} />{bot.enabled ? "Online" : "Off"} on {bot.domain}</p>
                </div>
              </header>

              {!hideSteps && (
                <div className="card steps">
                  <div className="steps-top">
                    <h2>Get your chatbot live</h2>
                    <button type="button" className="link" onClick={dismissSteps}>Hide</button>
                  </div>
                  <ol>
                    <li className={bot.context.trim().length > 20 ? "done" : ""}>
                      <span className="tick" /><button type="button" className="link" onClick={() => setTab("settings")}>Tell it about your business</button>
                    </li>
                    <li><span className="tick" /><button type="button" className="link" onClick={() => setTab("appearance")}>Make it look like your brand</button></li>
                    <li><span className="tick" /><button type="button" className="link" onClick={() => setTab("install")}>Add it to your website</button></li>
                  </ol>
                </div>
              )}

              <div className="home-grid">
                <div>
                  {report && (
                    <div className="stats">
                      <div className="card stat"><div className="num">{report.total}</div><div className="hint">questions, last {report.days} days</div></div>
                      <div className="card stat"><div className="num">{newLeads}</div><div className="hint">new {newLeads === 1 ? "lead" : "leads"}</div></div>
                      <div className="card stat"><div className="num">{report.unansweredCount}</div><div className="hint">couldn&apos;t answer</div></div>
                    </div>
                  )}
                  {newLeads > 0 && (
                    <button type="button" className="note" onClick={() => setTab("leads")}>
                      <b>{newLeads} new {newLeads === 1 ? "lead" : "leads"}</b> waiting for you <span aria-hidden="true">&rarr;</span>
                    </button>
                  )}
                  {report && report.unansweredCount > 0 && (
                    <button type="button" className="note" onClick={() => setTab("reports")}>
                      <b>{report.unansweredCount} {report.unansweredCount === 1 ? "question" : "questions"}</b> it couldn&apos;t answer. Add the answers to your info <span aria-hidden="true">&rarr;</span>
                    </button>
                  )}
                </div>
                <div className={`preview theme-${bot.theme}`} aria-label="Your chatbot" style={{ "--pv": bot.color } as React.CSSProperties}>
                  <div className="pv-window">
                    <div className="pv-head">{bot.title || bot.name}</div>
                    <div className="pv-body">
                      <div className="pv-bot">{bot.greeting}</div>
                      {bot.suggestions.filter((q) => q.trim()).length > 0 && (
                        <div className="pv-chips">
                          {bot.suggestions.filter((q) => q.trim()).map((q, i) => (
                            <span key={i} style={{ color: bot.color, borderColor: bot.color }}>{q}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pv-input"><span>Type your question...</span><b style={{ background: bot.color }}>Send</b></div>
                  </div>
                  <p className="hint" style={{ textAlign: "center", marginTop: 12 }}>
                    <button type="button" className="link" onClick={() => setTab("appearance")}>Change design</button>
                  </p>
                </div>
              </div>
            </>
          )}

          {bot && tab === "reports" && report && (
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Report (last {report.days} days)</h2>
                <button className="btn secondary" type="button" onClick={loadReport}>Refresh</button>
              </div>
              <p>
                <b>{report.total}</b> questions &middot; <b>{report.unansweredCount}</b> the bot couldn&apos;t answer
              </p>

              {report.limited ? (
                <p className="hint">
                  See which questions your bot couldn&apos;t answer, and the most asked ones, with{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); setTab("plan"); }}>Pro</a>.
                </p>
              ) : (
                <>
              <h3>Unanswered questions</h3>
              {report.unanswered.length === 0 ? (
                <p className="hint">None yet. Nice!</p>
              ) : (
                <>
                  <ul>
                    {report.unanswered.map((q) => (
                      <li key={q.question}>{q.question} <span className="hint">({q.count}x)</span></li>
                    ))}
                  </ul>
                  <p className="hint">
                    Tip: add the answers to these in{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setTab("settings"); }}>Settings &rarr; Business information</a>
                    , so the bot can answer next time.
                  </p>
                </>
              )}

              <h3>Most asked questions</h3>
              {report.topQuestions.length === 0 ? (
                <p className="hint">No questions yet.</p>
              ) : (
                <ul>
                  {report.topQuestions.map((q) => (
                    <li key={q.question}>{q.question} <span className="hint">({q.count}x)</span></li>
                  ))}
                </ul>
              )}
                </>
              )}
            </div>
          )}

          {bot && tab === "leads" && (
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Leads</h2>
                <button className="btn secondary" type="button" onClick={loadLeads}>Refresh</button>
              </div>
              {!form.collectLeads && (
                <p className="hint">Collecting contact details is off. Turn it on in Settings.</p>
              )}
              {!leads || leads.total === 0 ? (
                <p className="hint">No leads yet. When the bot can&apos;t answer, visitors can leave their email or phone and it shows up here.</p>
              ) : (
                <>
                  <p><b>{leads.total}</b> {leads.total === 1 ? "lead" : "leads"}</p>
                  <ul>
                    {leads.leads.map((l) => (
                      <li key={l.id}>
                        <b>{l.contact}</b>{l.name ? ` (${l.name})` : ""}{isNewLead(l) && <span className="pro">New</span>}
                        {l.question && <><br /><span className="hint">Asked: {l.question}</span></>}
                        <br /><span className="hint">{new Date(l.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {leads.limited && (
                    <p className="hint">
                      You have more leads than shown. <a href="#" onClick={(e) => { e.preventDefault(); setTab("plan"); }}>Upgrade to Pro</a> to see all of them.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {bot && tab === "appearance" && (
            <form className="card" onSubmit={save}>
              <h2>Appearance</h2>
              <div className="appearance">
                <div>
                  <label>Design</label>
                  <div className="themes">
                    {THEMES.map((t) => {
                      return (
                        <button key={t.id} type="button" className={form.theme === t.id ? "theme on" : "theme"}
                          onClick={() => update("theme", t.id)}>
                          <b>{t.name}</b>
                          <span>{t.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  <label>Color</label>
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <button key={c} type="button" aria-label={`Use color ${c}`}
                        className={form.color === c ? "swatch on" : "swatch"} style={{ background: c }}
                        onClick={() => update("color", c)} />
                    ))}
                    <input type="color" aria-label="Custom color" value={form.color}
                      onChange={(e) => update("color", e.target.value)} />
                  </div>

                  <label htmlFor="title">Chat title</label>
                  <input id="title" type="text" value={form.title} maxLength={40}
                    placeholder={form.name || "Your business name"}
                    onChange={(e) => update("title", e.target.value)} />

                  <label htmlFor="position">Button position</label>
                  <select id="position" value={form.position} onChange={(e) => update("position", e.target.value)}>
                    <option value="right">Bottom right</option>
                    <option value="left">Bottom left</option>
                  </select>

                  <h3>Personality</h3>
                  <label htmlFor="tone">How it talks</label>
                  <select id="tone" value={form.tone} onChange={(e) => update("tone", e.target.value)}>
                    {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>

                  <label htmlFor="audience">Who it talks to</label>
                  <select id="audience" value={form.audience} onChange={(e) => update("audience", e.target.value)}>
                    {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>

                  <label htmlFor="instructions">Extra instructions (optional){isFree && <span className="pro">Pro</span>}</label>
                  <textarea id="instructions" value={form.instructions} maxLength={500} style={{ minHeight: 90 }} disabled={isFree}
                    placeholder="For example: mention our weekend sale when it fits."
                    onChange={(e) => update("instructions", e.target.value)} />
                  <p className="hint">
                    {isFree ? (
                      <>Extra instructions are part of <a href="#" onClick={(e) => { e.preventDefault(); setTab("plan"); }}>Pro</a>.</>
                    ) : (
                      <>{form.instructions.length}/500. This changes how the bot speaks, not what it knows.</>
                    )}
                  </p>

                  <div className="row" style={{ marginTop: 16 }}>
                    <button className="btn" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
                  </div>
                  {message && <p className="ok">{message}</p>}
                  {error && <p className="error">{error}</p>}
                </div>

                <div className={`preview theme-${form.theme}`} aria-label="Preview" style={{ "--pv": form.color } as React.CSSProperties}>
                  <div className="pv-window">
                    <div className="pv-head">{form.title || form.name || "Your business"}</div>
                    <div className="pv-body">
                      <div className="pv-bot">{form.greeting}</div>
                      {form.suggestions.filter((q) => q.trim()).length > 0 && (
                        <div className="pv-chips">
                          {form.suggestions.filter((q) => q.trim()).map((q, i) => (
                            <span key={i} style={{ color: form.color, borderColor: form.color }}>{q}</span>
                          ))}
                        </div>
                      )}
                      <div className="pv-you" style={{ background: form.color }}>What are your hours?</div>
                    </div>
                    <div className="pv-input"><span>Type your question...</span><b style={{ background: form.color }}>Send</b></div>
                  </div>
                  <div className={form.position === "left" ? "pv-launch left" : "pv-launch"} style={{ background: form.color }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z" />
                    </svg>
                    {THEMES.find((t) => t.id === form.theme)?.label && (
                      <span>{THEMES.find((t) => t.id === form.theme)?.label}</span>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}

          {(!bot || tab === "settings") && (
            <form className="card" onSubmit={save}>
              <h2>{bot ? "Settings" : "Create your chatbot"}</h2>

              <label htmlFor="name">Business name</label>
              <input id="name" type="text" value={form.name} maxLength={80} required
                onChange={(e) => update("name", e.target.value)} />

              <label htmlFor="domain">Your website</label>
              <input id="domain" type="text" value={form.domain} placeholder="mybusiness.com" required
                onChange={(e) => update("domain", e.target.value)} />
              <p className="hint">The chat only works on this website (and its subdomains).</p>

              <label htmlFor="greeting">First message</label>
              <input id="greeting" type="text" value={form.greeting} maxLength={200} required
                onChange={(e) => update("greeting", e.target.value)} />

              <label htmlFor="suggestions">Suggested questions (optional)</label>
              <textarea id="suggestions" style={{ minHeight: 110 }} value={form.suggestions.join("\n")}
                placeholder={"What are your opening hours?\nHow much does it cost?"}
                onChange={(e) => setForm((f) => ({ ...f, suggestions: e.target.value.split("\n").slice(0, 4) }))} />
              <p className="hint">One per line, up to 4. Visitors see them as buttons in the chat.</p>

              <label htmlFor="context">Business information</label>
              <textarea id="context" value={form.context} maxLength={8000} required
                placeholder="Hours, services, prices, service area, how to book, phone number..."
                onChange={(e) => update("context", e.target.value)} />
              <p className="hint">The chatbot answers only from this. The more specific, the better.</p>

              <label className="check">
                <input type="checkbox" checked={form.enabled}
                  onChange={(e) => update("enabled", e.target.checked)} />
                Chatbot is on
              </label>

              <label className="check">
                <input type="checkbox" checked={form.collectLeads}
                  onChange={(e) => update("collectLeads", e.target.checked)} />
                Ask visitors for their email or phone when the bot can&apos;t help
              </label>

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn" disabled={saving}>
                  {saving ? "Saving..." : bot ? "Save changes" : "Create chatbot"}
                </button>
              </div>
              {message && <p className="ok">{message}</p>}
              {error && <p className="error">{error}</p>}
            </form>
          )}

          {bot && tab === "plan" && (
            <div className="card">
              <h2>Your plan</h2>
              {error && <p className="error">{error}</p>}
              <div className="plans">
                {PLANS.map((p) => {
                  const current = (billing?.plan ?? "free") === p.id;
                  const onFree = (billing?.plan ?? "free") === "free";
                  return (
                    <div key={p.id} className={current ? "plan current" : "plan"}>
                      {current && <span className="badge">Current plan</span>}
                      <h3>{p.name}</h3>
                      <p className="price">{p.price}</p>
                      {!current && p.id !== "free" && onFree && (
                        <button className="btn" type="button" disabled={billingBusy} onClick={() => openBilling("checkout", p.id)}>
                          Choose {p.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {billing?.hasCustomer && (
                <>
                  <p className="hint">To switch plan, update your card or cancel, use Manage billing.</p>
                  <button className="btn secondary" type="button" disabled={billingBusy} onClick={() => openBilling("portal")}>
                    Manage billing
                  </button>
                </>
              )}
            </div>
          )}

          {bot && tab === "install" && (
            <div className="card">
              <h2>Add it to your website</h2>
              <p>Paste this line just before the closing &lt;/body&gt; tag of your site.</p>
              <pre>{snippet}</pre>
              <button className="btn secondary" onClick={copySnippet}>
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>
          )}
        </>
      )}
        </div>
      </main>
    </div>
  );
}
