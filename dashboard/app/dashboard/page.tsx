"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Bot = {
  id: string;
  name: string;
  greeting: string;
  context: string;
  domain: string;
  enabled: boolean;
};

type Form = Omit<Bot, "id">;

type Tab = "overview" | "reports" | "settings" | "install";

type QuestionCount = { question: string; count: number };
type Report = {
  days: number;
  total: number;
  unansweredCount: number;
  savedByCache: number;
  topQuestions: QuestionCount[];
  unanswered: QuestionCount[];
};

const emptyForm: Form = {
  name: "",
  greeting: "Hi! How can I help you today?",
  context: "",
  domain: "",
  enabled: true,
};

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
          setForm({
            name: first.name,
            greeting: first.greeting,
            context: first.context,
            domain: first.domain,
            enabled: first.enabled,
          });
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isLoaded, call]);

  // Load the report whenever the bot is known.
  const botId = bot?.id;
  const loadReport = useCallback(() => {
    if (!botId) return;
    call(`/api/bots/${botId}/report`).then(setReport).catch(() => setReport(null));
  }, [botId, call]);
  useEffect(loadReport, [loadReport]);

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
    <main className="container">
      <div className="topbar">
        <h1 style={{ margin: 0 }}>Your chatbot</h1>
        <UserButton />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {bot && (
            <nav className="tabs">
              {(["overview", "reports", "settings", "install"] as Tab[]).map((t) => (
                <button key={t} type="button" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
                  {t === "overview" ? "Overview" : t === "reports" ? "Reports" : t === "settings" ? "Settings" : "Install"}
                </button>
              ))}
            </nav>
          )}

          {bot && tab === "overview" && (
            <>
              <div className="card">
                <h2>{bot.name}</h2>
                <p>
                  Status: <b>{bot.enabled ? "On" : "Off"}</b> &middot; Website: <b>{bot.domain}</b>
                </p>
              </div>
              {report && (
                <div className="stats">
                  <div className="card stat"><div className="num">{report.total}</div><div className="hint">questions (last {report.days} days)</div></div>
                  <div className="card stat"><div className="num">{report.unansweredCount}</div><div className="hint">couldn&apos;t answer</div></div>
                  <div className="card stat"><div className="num">{report.savedByCache}</div><div className="hint">answered from cache</div></div>
                </div>
              )}
              {report && report.unansweredCount > 0 && (
                <div className="card">
                  <p style={{ margin: 0 }}>
                    Your chatbot couldn&apos;t answer {report.unansweredCount} question{report.unansweredCount === 1 ? "" : "s"}.{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setTab("reports"); }}>See them in Reports</a>
                  </p>
                </div>
              )}
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
            </div>
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

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn" disabled={saving}>
                  {saving ? "Saving..." : bot ? "Save changes" : "Create chatbot"}
                </button>
              </div>
              {message && <p className="ok">{message}</p>}
              {error && <p className="error">{error}</p>}
            </form>
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
    </main>
  );
}
