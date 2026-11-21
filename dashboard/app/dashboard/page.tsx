"use client";

import Link from "next/link";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
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

type Lead = { id: number; contact: string; name: string; question: string; status?: string; createdAt: string };
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
  daily?: { day: string; count: number }[];
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
  ["settings", "Bot setup", "setup"],
  ["appearance", "Design", "design"],
  ["install", "Add to website", "code"],
  ["reports", "Reports", "chat"],
  ["leads", "Leads", "leads"],
];

const PLAN_DETAILS = [
  { id: "free", name: "Free", price: "$0", tag: "Try it on your site.", popular: false,
    features: ["1 chatbot", "50 messages a day", "Latest 3 leads", "Report totals", "All designs and colors"] },
  { id: "pro", name: "Pro", price: "$9.99", tag: "For a business that gets real visitors.", popular: true,
    features: ["1 chatbot", "300 messages a day", "All leads", "Full reports", "Extra instructions for your bot"] },
  { id: "business", name: "Business", price: "$49.99", tag: "For several sites or brands.", popular: false,
    features: ["3 chatbots", "1,500 messages a day", "Everything in Pro"] },
] as const;

const NAV_COLORS: Record<string, string> = {
  overview: "#4338ca", reports: "#0ea5e9", leads: "#16a34a", appearance: "#db2777", settings: "#d97706", install: "#7c3aed", plan: "#0f766e",
};

function timeAgo(iso: string): string {
  const t = new Date(iso);
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  return t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const HEADS: Record<string, [string, string]> = {
  reports: ["Reports", "The questions your visitors asked, and the ones your bot couldn't answer."],
  leads: ["Leads", "Visitors who asked to be contacted. Reach out, then mark each lead as Contacted or Done."],
  appearance: ["Design", "Choose how your chat looks and sounds. The preview updates as you change things."],
  settings: ["Bot setup", "What your bot knows about your business. It answers only from this."],
  install: ["Add to website", "Test your bot, then add it to your website."],
  plan: ["Plan", "Your current plan and what each one includes."],
};

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
  const { user } = useUser();
  const [bot, setBot] = useState<Bot | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [answerSaved, setAnswerSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [fbText, setFbText] = useState("");
  const [fbBusy, setFbBusy] = useState(false);
  const [fbMsg, setFbMsg] = useState("");
  const [ignoredQ, setIgnoredQ] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [repFilter, setRepFilter] = useState<"all" | "needs" | "answered">("all");
  const [repAll, setRepAll] = useState(false);
  const [repDays, setRepDays] = useState<7 | 30>(30);
  const [tab, setTab] = useState<Tab>("overview");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [leads, setLeads] = useState<Leads | null>(null);
  // Leads newer than this are "new". Remembered per bot in this browser.
  const [seenAt, setSeenAt] = useState<string>("");
  const isFree = (billing?.plan ?? "free") === "free";
  const weekDelta = (() => {
    const d = report?.daily;
    if (!d || d.length < 14) return null;
    const sum = (xs: { count: number }[]) => xs.reduce((n, x) => n + x.count, 0);
    return sum(d.slice(7)) - sum(d.slice(0, 7));
  })();
  const customized = !!bot && (bot.theme !== "clean" || bot.color !== "#4338ca" || !!bot.title || bot.tone !== "friendly" || bot.audience !== "general" || bot.suggestions.length > 0);
  const [hideSteps, setHideSteps] = useState(false);
  const [wizStep, setWizStep] = useState(1);
  const [flags, setFlags] = useState<{ tested: boolean; installed: boolean }>({ tested: false, installed: false });
  useEffect(() => {
    try {
      setHideSteps(localStorage.getItem("chattr-steps-done") === "1");
      setFlags({ tested: localStorage.getItem("chattr-tested") === "1", installed: localStorage.getItem("chattr-installed") === "1" });
    } catch {}
  }, []);
  function setFlag(k: "tested" | "installed") {
    setFlags((f) => ({ ...f, [k]: true }));
    try { localStorage.setItem(k === "tested" ? "chattr-tested" : "chattr-installed", "1"); } catch {}
  }
  // A "Saved." or error message belongs to the page it appeared on.
  useEffect(() => {
    setMessage("");
    setError("");
  }, [tab]);

  // Opening Install shows the test chat, which counts as testing the bot.
  useEffect(() => {
    if (tab === "install" && bot) setFlag("tested");
  }, [tab, bot]);
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
          ...(init.body ? { "Content-Type": "application/json" } : {}),
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

  useEffect(() => {
    if (!isLoaded) return;
    call("/api/admin/me").then((d) => setIsAdmin(!!d.admin)).catch(() => setIsAdmin(false));
  }, [isLoaded, call]);

  const loadReport = useCallback(() => {
    if (!botId) return;
    call(`/api/bots/${botId}/report?days=${repDays}`).then(setReport).catch(() => setReport(null));
  }, [botId, call, repDays]);
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

  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerErr, setAnswerErr] = useState("");

  async function submitAnswer(question: string) {
    if (!bot) return;
    setAnswerBusy(true);
    setAnswerErr("");
    try {
      const data = await call(`/api/bots/${bot.id}/answers`, {
        method: "POST",
        body: JSON.stringify({ question, answer: answerText }),
      });
      setBot(data.bot);
      setForm((f) => ({ ...f, context: data.bot.context }));
      setAnswering(null);
      setAnswerText("");
      setAnswerSaved(true);
      loadReport();
    } catch (err) {
      setAnswerErr((err as Error).message);
    } finally {
      setAnswerBusy(false);
    }
  }

  async function sendFeedback() {
    setFbBusy(true);
    setFbMsg("");
    try {
      await call("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ message: fbText, page: tab, email: user?.primaryEmailAddress?.emailAddress ?? "" }),
      });
      setFbText("");
      setFbMsg("Thank you! We read every message.");
    } catch (err) {
      setFbMsg((err as Error).message);
    } finally {
      setFbBusy(false);
    }
  }

  async function ignoreQuestion(question: string, undo = false) {
    if (!bot) return;
    try {
      await call(`/api/bots/${bot.id}/questions/ignore`, { method: "POST", body: JSON.stringify({ question, undo }) });
      setIgnoredQ(undo ? null : question);
      loadReport();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  async function importFromWebsite() {
    setImportBusy(true);
    setImportErr("");
    setImportMsg("");
    try {
      const data = await call("/api/import-website", { method: "POST", body: JSON.stringify({ url: importUrl || form.domain, existing: form.context }) });
      setForm((f) => ({ ...f, context: data.text }));
      setImportMsg(`Done. We read ${data.pages} page${data.pages === 1 ? "" : "s"} and combined them with what you wrote. Review it below, then save.`);
    } catch (err) {
      setImportErr((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  }

  async function setLeadStatus(l: Lead, status: string) {
    if (!bot) return;
    setLeads((cur) => cur && { ...cur, leads: cur.leads.map((x) => (x.id === l.id ? { ...x, status } : x)) });
    try {
      await call(`/api/bots/${bot.id}/leads/${l.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch (err) {
      setError((err as Error).message);
      loadLeads();
    }
  }

  async function deleteLead(l: Lead) {
    if (!bot || !window.confirm(`Delete the lead from ${l.name || l.contact}?`)) return;
    try {
      await call(`/api/bots/${bot.id}/leads/${l.id}`, { method: "DELETE" });
      setLeads((cur) => cur && { ...cur, total: cur.total - 1, leads: cur.leads.filter((x) => x.id !== l.id) });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const newLeadCount = leads ? leads.leads.filter((l) => (l.status ?? "new") === "new").length : 0;
  const leadsHint = newLeadCount > 0
    ? `${newLeadCount} new ${newLeadCount === 1 ? "lead is" : "leads are"} waiting. Reach out, then mark each one Contacted or Done.`
    : "You're all caught up. New leads appear here when visitors leave their details.";
  const NEXT: Record<string, [string, string]> = { new: ["Mark contacted", "contacted"], contacted: ["Mark done", "done"], done: ["Reopen", "new"] };
  const STATUS_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", done: "Done" };
  const [leadFilter, setLeadFilter] = useState<"all" | "new" | "contacted" | "done">("all");
  const [copiedLead, setCopiedLead] = useState<number | null>(null);
  async function copyContact(l: Lead) {
    try { await navigator.clipboard.writeText(l.contact); setCopiedLead(l.id); setTimeout(() => setCopiedLead(null), 1500); } catch {}
  }

  const renderUnanswered = (q: QuestionCount) => (
    <li key={q.question}>
      <div className="un-row">
        <span className="un-q">{q.question} <em>{q.count}x</em></span>
        <button type="button" className="btn ghost small"
          onClick={() => { setAnswering(answering === q.question ? null : q.question); setAnswerText(""); setAnswerErr(""); }}>
          {answering === q.question ? "Cancel" : "Add answer"}
        </button>
        <button type="button" className="btn ghost small ignore" onClick={() => ignoreQuestion(q.question)}>Ignore</button>
      </div>
      {answering === q.question && (
        <div className="un-form">
          <textarea autoFocus maxLength={1000} value={answerText} placeholder="Type the answer your bot should give..."
            onChange={(e) => setAnswerText(e.target.value)} />
          <div className="row">
            <button type="button" className="btn small" disabled={answerBusy || !answerText.trim()} onClick={() => submitAnswer(q.question)}>
              {answerBusy ? "Saving..." : "Save answer"}
            </button>
            {answerErr && <span className="error" style={{ margin: 0 }}>{answerErr}</span>}
          </div>
        </div>
      )}
    </li>
  );

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  const update = (field: keyof Form, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="app">
      <aside className="app-side">
        <button type="button" className="app-brand" onClick={() => setTab("overview")} aria-label="Chattr home"><Logo size={28} />Chattr</button>
        {bot && (
          <nav className="app-nav" aria-label="Main">
            {NAV.map(([id, label, icon]) => (
              <button key={id} type="button" className={tab === id ? "nav-item on" : "nav-item"} style={{ "--ic": NAV_COLORS[id] } as React.CSSProperties} onClick={() => setTab(id)}>
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
          <button type="button" className="side-link" onClick={() => { setFbOpen(true); setFbMsg(""); }}>Send feedback</button>
          {isAdmin && <Link className="side-link" href="/dashboard/admin">Admin</Link>}
          <span className="side-legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></span>
          <div className="app-user"><UserButton /></div>
        </div>
      </aside>

      {fbOpen && (
        <div className="fb-back" onClick={() => setFbOpen(false)}>
          <div className="fb-box" role="dialog" aria-label="Send feedback" onClick={(e) => e.stopPropagation()}>
            <h2>Send feedback</h2>
            <p className="hint">Tell us what is confusing, what is missing, or what you like. We read every message.</p>
            <textarea autoFocus maxLength={2000} value={fbText} placeholder="Type your message..." onChange={(e) => setFbText(e.target.value)} />
            <div className="row">
              <button type="button" className="btn small" disabled={fbBusy || !fbText.trim()} onClick={sendFeedback}>{fbBusy ? "Sending..." : "Send"}</button>
              <button type="button" className="btn ghost small" onClick={() => setFbOpen(false)}>Close</button>
              {fbMsg && <span className="hint" style={{ margin: 0 }}>{fbMsg}</span>}
            </div>
          </div>
        </div>
      )}
      <main className="app-main">
        <div className="app-inner">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {bot && tab === "overview" && (
            <>
              <header className="banner">
                <div>
                  <p className="banner-kicker">Dashboard</p>
                  <h1>{user?.firstName ? `Welcome back, ${user.firstName}` : "Welcome back"}</h1>
                  <p className="banner-sub"><span className={bot.enabled ? "dot on" : "dot"} />{bot.name} is {bot.enabled ? "online" : "off"} and answering visitors 24/7</p>
                </div>
                <div className="row">
                  <button type="button" className="btn light" onClick={copySnippet}>{copied ? "Copied!" : "Copy install code"}</button>
                  <button type="button" className="btn ghost-light" onClick={() => setTab("reports")}>View reports</button>
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
                    <li className={customized ? "done" : ""}>
                      <span className="tick" /><button type="button" className="link" onClick={() => setTab("appearance")}>Make it look like your brand</button>
                    </li>
                    <li className={flags.tested ? "done" : ""}>
                      <span className="tick" /><button type="button" className="link" onClick={() => setTab("install")}>Test your chatbot</button>
                    </li>
                    <li className={flags.installed ? "done" : ""}>
                      <span className="tick" /><button type="button" className="link" onClick={() => setTab("install")}>Add it to your website</button>
                    </li>
                  </ol>
                </div>
              )}

              <div className="home-grid">
                <div>
                  {report && (
                    <div className="stats">
                      <button type="button" className="stat-card c-indigo" onClick={() => setTab("reports")}>
                        <span className="stat-ico"><Icon name="chat" /></span>
                        <span className="num">{report.total}</span>
                        <span className="stat-label">Questions, {report.days} days</span>
                        {weekDelta !== null && <span className="stat-trend">{weekDelta >= 0 ? "+" : ""}{weekDelta} vs last week</span>}
                      </button>
                      <button type="button" className="stat-card c-green" onClick={() => setTab("leads")}>
                        <span className="stat-ico"><Icon name="leads" /></span>
                        <span className="num">{newLeads}</span>
                        <span className="stat-label">New {newLeads === 1 ? "lead" : "leads"}</span>
                        <span className="stat-trend">View leads &rarr;</span>
                      </button>
                      <button type="button" className="stat-card c-amber" onClick={() => setTab("reports")}>
                        <span className="stat-ico"><Icon name="setup" /></span>
                        <span className="num">{report.unansweredCount}</span>
                        <span className="stat-label">Couldn&apos;t answer</span>
                        <span className="stat-trend">Fix them &rarr;</span>
                      </button>
                    </div>
                  )}
                  {newLeads > 0 && (
                    <button type="button" className="note" onClick={() => setTab("leads")}>
                      <b>{newLeads} new {newLeads === 1 ? "lead" : "leads"}</b> waiting for you <span aria-hidden="true">&rarr;</span>
                    </button>
                  )}
                  {report?.daily && (
                    <div className="card">
                      <h2 style={{ marginBottom: 4 }}>Questions per day</h2>
                      <p className="hint" style={{ marginTop: 0 }}>Last 14 days</p>
                      <div className="bars" role="img" aria-label="Questions per day for the last 14 days">
                        {report.daily.map((d) => {
                          const max = Math.max(1, ...report.daily!.map((x) => x.count));
                          return <div key={d.day} className="bar" title={`${d.day}: ${d.count}`}><i style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / max) * 100)}%` }} /></div>;
                        })}
                      </div>
                      <div className="bar-axis"><span>{report.daily[0].day.slice(5)}</span><span>Today</span></div>
                    </div>
                  )}
                  {report && report.unansweredCount > 0 && (
                    <div className="card">
                      <h2>Questions it couldn&apos;t answer</h2>
                      {report.limited ? (
                        <p className="hint">Your bot couldn&apos;t answer {report.unansweredCount} {report.unansweredCount === 1 ? "question" : "questions"}. <button type="button" className="link" onClick={() => setTab("plan")}>See which ones with Pro</button></p>
                      ) : (
                        <>
                          <ul className="unans">
                            {report.unanswered.slice(0, 5).map((q) => (
                              renderUnanswered(q)
                            ))}
                          </ul>
                          <p className="hint">Type the answer and your bot will use it from the next message.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="side-title">Your chatbot</h2>
                  <div className="test-frame">
                    <iframe title="Your chatbot" src={`${API}/widget/${bot.id}`} sandbox="allow-scripts allow-same-origin" />
                  </div>
                  <p className="hint" style={{ textAlign: "center", marginTop: 12 }}>
                    This is your real chatbot. <button type="button" className="link" onClick={() => setTab("appearance")}>Change design</button>
                  </p>
                </div>
              </div>
            </>
          )}

          {bot && tab !== "overview" && HEADS[tab] && (
            <header className="app-head">
              <div>
                <h1>{HEADS[tab][0]}</h1>
                <p className="hint">{tab === "leads" && leads && leads.total > 0 ? leadsHint : HEADS[tab][1]}</p>
              </div>
              {(tab === "appearance" || tab === "settings") && (
                <div className="head-save">
                  {message && <span className="ok">{message}</span>}
                  {error && <span className="error">{error}</span>}
                  <button className="btn" type="submit" form={tab === "appearance" ? "design-form" : "setup-form"} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </header>
          )}

          {bot && tab === "reports" && report && (
            <div className="note static">
              <b>What is this page?</b> It shows what visitors asked your chatbot and how well it answered. Use it to find questions your bot couldn&apos;t answer, add the answers, and make it better over time.
            </div>
          )}

          {bot && tab === "reports" && report && report.total === 0 && (
            <div className="card empty">
              <h2>No questions yet</h2>
              <p>When visitors start asking your bot questions, you&apos;ll see them here, including the ones it couldn&apos;t answer.</p>
              <button type="button" className="btn" onClick={() => setTab("install")}>Add it to your website</button>
            </div>
          )}

          {bot && tab === "reports" && report && report.total > 0 && (
            <>
              <div className="rep-top">
                <div className="card rate">
                  <div className="rate-head">
                    <h2>Answer rate</h2>
                    <div className="rate-tools">
                      <div className="seg small" role="tablist" aria-label="Time range">
                        {([7, 30] as const).map((d) => (
                          <button key={d} type="button" role="tab" aria-selected={repDays === d} className={repDays === d ? "seg-btn on" : "seg-btn"} onClick={() => setRepDays(d)}>{d} days</button>
                        ))}
                      </div>
                      <button className="btn ghost small" type="button" onClick={loadReport}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
                        Refresh
                      </button>
                    </div>
                  </div>
                  <p className="hint">Out of everything visitors asked your bot, this is how much it could answer using your business info. The closer to 100%, the better.</p>
                  <div className="rate-line">
                    <span className="rate-num">{Math.round(((report.total - report.unansweredCount) / report.total) * 100)}%</span>
                    <p className="hint">{report.total - report.unansweredCount} of {report.total} questions answered in the last {report.days} days.{report.unansweredCount > 0 && <> <b>{report.unansweredCount} {report.unansweredCount === 1 ? "needs" : "need"} an answer.</b></>}</p>
                  </div>
                  <div className="rate-bar"><i style={{ width: `${Math.round(((report.total - report.unansweredCount) / report.total) * 100)}%` }} /></div>
                </div>
              </div>

              {report.limited ? (
                <div className="card upsell">
                  <h2>See what visitors are asking</h2>
                  <p>Your bot couldn&apos;t answer {report.unansweredCount} {report.unansweredCount === 1 ? "question" : "questions"}. Upgrade to Pro to see which ones, and the questions asked most often.</p>
                  <button type="button" className="btn" onClick={() => setTab("plan")}>See Pro</button>
                </div>
              ) : (
                <div className="card qlist">
                  <h2>Questions visitors asked</h2>
                  <p className="hint">The number next to each question is how many times it was asked. If your bot couldn&apos;t answer one, click <b>Add answer</b> and it will know next time. If it&apos;s not a real question (spam or a test), click <b>Ignore</b>.</p>
                  {ignoredQ && (
                    <div className="note static">
                      Ignored &ldquo;{ignoredQ}&rdquo;. It no longer counts in your answer rate.
                      <button type="button" className="link" onClick={() => ignoreQuestion(ignoredQ, true)}> Undo</button>
                    </div>
                  )}
                  {answerSaved && (
                    <div className="note static">
                      Saved. The answer was added to your business info in <button type="button" className="link" onClick={() => setTab("settings")}>Bot setup</button>, and your bot will use it from the next message.
                      <button type="button" className="link" onClick={() => setAnswerSaved(false)} aria-label="Dismiss"> Dismiss</button>
                    </div>
                  )}
                  {(() => {
                    const need = new Set(report.unanswered.map((q) => q.question));
                    const all = [...report.topQuestions, ...report.unanswered.filter((q) => !report.topQuestions.some((t) => t.question === q.question))];
                    const max = Math.max(1, ...all.map((q) => q.count));
                    const shown = all.filter((q) => repFilter === "all" || (repFilter === "needs") === need.has(q.question));
                    const visible = repAll ? shown : shown.slice(0, 8);
                    return (
                      <>
                        <div className="seg" role="tablist" aria-label="Filter questions">
                          {([["all", "All", all.length], ["needs", "Needs answer", need.size], ["answered", "Answered", all.length - need.size]] as const).map(([f, label, n]) => (
                            <button key={f} type="button" role="tab" aria-selected={repFilter === f} className={repFilter === f ? "seg-btn on" : "seg-btn"} onClick={() => { setRepFilter(f); setRepAll(false); }}>
                              {label} <em>{n}</em>
                            </button>
                          ))}
                        </div>
                        {shown.length === 0 ? (
                          <p className="hint">{repFilter === "needs" ? "Nothing here. Your bot answered everything." : "No questions yet."}</p>
                        ) : (
                          <ul className="qrows">
                            {visible.map((q) => {
                              const needs = need.has(q.question);
                              return (
                                <li key={q.question}>
                                  <div className="un-row">
                                    <span className="un-q">{q.question}</span>
                                    <span className="q-meta">
                                      <span className={needs ? "chip st-contacted" : "chip st-new"}><i />{needs ? "Needs answer" : "Answered"}</span>
                                      <b>{q.count}</b>
                                      {needs && (
                                        <button type="button" className="btn ghost small"
                                          onClick={() => { setAnswering(answering === q.question ? null : q.question); setAnswerText(""); setAnswerErr(""); }}>
                                          {answering === q.question ? "Cancel" : "Add answer"}
                                        </button>
                                      )}
                                      {needs && (
                                        <button type="button" className="btn ghost small ignore" onClick={() => ignoreQuestion(q.question)}>Ignore</button>
                                      )}
                                    </span>
                                  </div>
                                  <span className="rk-bar"><i style={{ width: `${(q.count / max) * 100}%` }} /></span>
                                  {needs && answering === q.question && (
                                    <div className="un-form">
                                      <textarea autoFocus maxLength={1000} value={answerText} placeholder="Type the answer your bot should give..."
                                        onChange={(e) => setAnswerText(e.target.value)} />
                                      <div className="row">
                                        <button type="button" className="btn small" disabled={answerBusy || !answerText.trim()} onClick={() => submitAnswer(q.question)}>
                                          {answerBusy ? "Saving..." : "Save answer"}
                                        </button>
                                        {answerErr && <span className="error" style={{ margin: 0 }}>{answerErr}</span>}
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {shown.length > 8 && (
                          <button type="button" className="link" onClick={() => setRepAll(!repAll)}>{repAll ? "Show fewer" : `Show all ${shown.length}`}</button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {bot && tab === "leads" && (
            <>
              {!form.collectLeads && (
                <div className="note static">Collecting contact details is off. Turn it on in <button type="button" className="link" onClick={() => setTab("settings")}>Bot setup</button>.</div>
              )}
              {!leads || leads.total === 0 ? (
                <div className="card empty">
                  <h2>No leads yet</h2>
                  <p>When the bot can&apos;t answer a question, visitors can leave their email or phone. It will show up here.</p>
                  <button type="button" className="btn secondary" onClick={() => setTab("install")}>Add it to your website</button>
                </div>
              ) : (
                <div className="card leadlist">
                  <div className="rate-head">
                    <h2>{leads.total} {leads.total === 1 ? "lead" : "leads"}</h2>
                    <button className="btn ghost small" type="button" onClick={loadLeads}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
                      Refresh
                    </button>
                  </div>
                  <div className="seg" role="tablist" aria-label="Filter leads">
                    {(["all", "new", "contacted", "done"] as const).map((f) => {
                      const n = f === "all" ? leads.leads.length : leads.leads.filter((l) => (l.status ?? "new") === f).length;
                      return (
                        <button key={f} type="button" role="tab" aria-selected={leadFilter === f} className={leadFilter === f ? "seg-btn on" : "seg-btn"} onClick={() => setLeadFilter(f)}>
                          {f === "all" ? "All" : f === "new" ? "New" : f === "contacted" ? "Contacted" : "Done"} <em>{n}</em>
                        </button>
                      );
                    })}
                  </div>
                  {leads.leads.filter((l) => leadFilter === "all" || (l.status ?? "new") === leadFilter).length === 0 && (
                    <p className="hint" style={{ margin: "16px 0 0" }}>No leads with this status.</p>
                  )}
                  <ul>
                    {leads.leads.filter((l) => leadFilter === "all" || (l.status ?? "new") === leadFilter).map((l) => (
                      <li key={l.id} className={l.status === "done" ? "lead-done" : ""}>
                        <span className="avatar">{(l.name || l.contact).trim().charAt(0).toUpperCase()}</span>
                        <div className="lead-main">
                          <b>{l.name || l.contact}</b>
                          <span className="lead-contact">
                            <a href={/@/.test(l.contact) ? `mailto:${l.contact}` : `tel:${l.contact.replace(/[^\d+]/g, "")}`}>{l.contact}</a>
                            <button type="button" className="icon-btn" onClick={() => copyContact(l)} aria-label="Copy contact" title="Copy">
                              {copiedLead === l.id ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                              )}
                            </button>
                          </span>
                          {l.question && <span className="lead-q">Asked: {l.question}</span>}
                        </div>
                        <div className="lead-side">
                          <time className="lead-time" title={new Date(l.createdAt).toLocaleString()}>{timeAgo(l.createdAt)}</time>
                          <span className={`chip st-${l.status ?? "new"}`}><i />{STATUS_LABEL[l.status ?? "new"]}</span>
                          <button type="button" className="btn ghost small" onClick={() => setLeadStatus(l, NEXT[l.status ?? "new"][1])}>{NEXT[l.status ?? "new"][0]}</button>
                          <details className="more">
                            <summary aria-label="More actions">&middot;&middot;&middot;</summary>
                            <div className="more-menu"><button type="button" onClick={() => deleteLead(l)}>Delete lead</button></div>
                          </details>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {leads.limited && (
                    <p className="hint">You have more leads than shown. <button type="button" className="link" onClick={() => setTab("plan")}>Upgrade to Pro</button> to see all of them.</p>
                  )}
                </div>
              )}
            </>
          )}

          {bot && tab === "appearance" && (
            <form id="design-form" className="design" onSubmit={save}>
              <div className="design-grid">
                <div className="design-forms">
                  <section className="card">
                    <h2>Look</h2>
                    <label>Design</label>
                    <div className="theme-cards" style={{ "--pv": form.color } as React.CSSProperties}>
                      {THEMES.map((t) => (
                        <button key={t.id} type="button" className={form.theme === t.id ? "theme-card on" : "theme-card"} onClick={() => update("theme", t.id)}>
                          <span className={`mini mini-${t.id}`}>
                            <i className="mini-head" />
                            <i className="mini-bot" />
                            <i className="mini-you" />
                          </span>
                          <b>{t.name}</b>
                          <span className="theme-text">{t.text}</span>
                        </button>
                      ))}
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

                    <div className="two">
                      <div>
                        <label htmlFor="title">Chat title</label>
                        <input id="title" type="text" value={form.title} maxLength={40}
                          placeholder={form.name || "Your business name"}
                          onChange={(e) => update("title", e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="position">Button position</label>
                        <select id="position" value={form.position} onChange={(e) => update("position", e.target.value)}>
                          <option value="right">Bottom right</option>
                          <option value="left">Bottom left</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="card">
                    <h2>Voice</h2>
                    <div className="two">
                      <div>
                        <label htmlFor="tone">How it talks</label>
                        <select id="tone" value={form.tone} onChange={(e) => update("tone", e.target.value)}>
                          {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="audience">Who it talks to</label>
                        <select id="audience" value={form.audience} onChange={(e) => update("audience", e.target.value)}>
                          {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </div>

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
                  </section>
                </div>

                <aside className="design-preview">
                  <p className="preview-label">Live preview</p>
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
                        <div className="pv-bot">We&apos;re open every day from 9 to 6.</div>
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
                </aside>
              </div>
            </form>
          )}

          {!bot && (
            <form className="wizard" onSubmit={(e) => { if (wizStep === 1) { e.preventDefault(); setWizStep(2); } else save(e); }}>
              <div className="wiz-dots" aria-label={`Step ${wizStep} of 3`}>
                {[1, 2, 3].map((n) => <i key={n} className={n <= wizStep ? "on" : ""} />)}
              </div>
              {wizStep === 1 ? (
                <>
                  <h1>Let&apos;s set up your chatbot</h1>
                  <p className="lead">Two quick questions. It takes about two minutes.</p>
                  <label htmlFor="name">What&apos;s your business called?</label>
                  <input id="name" type="text" value={form.name} maxLength={80} required autoFocus placeholder="Joe's Pizza"
                    onChange={(e) => update("name", e.target.value)} />
                  <label htmlFor="domain">What&apos;s your website?</label>
                  <input id="domain" type="text" value={form.domain} required placeholder="joespizza.com"
                    onChange={(e) => update("domain", e.target.value)} />
                  <p className="hint">The chat will only work on this website.</p>
                  <div className="row" style={{ marginTop: 24 }}>
                    <button className="btn">Continue</button>
                  </div>
                </>
              ) : (
                <>
                  <h1>What should your chatbot know?</h1>
                  <p className="lead">It answers visitors only from what you write here. Include opening hours, services, prices, your area and how to reach you.</p>
                  <textarea id="context" value={form.context} maxLength={8000} required autoFocus
                    placeholder="Hours, services, prices, service area, how to book, phone number..."
                    onChange={(e) => update("context", e.target.value)} />
                  <p className="hint">
                    Not sure what to write?{" "}
                    <button type="button" className="link" onClick={() => update("context", `${form.name || "We"} is open Monday to Friday, 9am to 6pm, and Saturday 10am to 4pm. Closed on Sunday.\n\nServices and prices:\n- Service one: $00\n- Service two: $00\n\nWe serve: your city and nearby areas.\nTo book or ask a question: call 000-000-0000 or email hello@${form.domain || "yourwebsite.com"}.\n\nCommon questions:\n- Do you offer refunds? Yes, within 30 days.`)}>Use an example</button>{" "}
                    and replace it with your details. You can change it any time.
                  </p>
                  <div className="row" style={{ marginTop: 24 }}>
                    <button type="button" className="btn secondary" onClick={() => setWizStep(1)}>Back</button>
                    <button className="btn" disabled={saving}>{saving ? "Creating..." : "Create my chatbot"}</button>
                  </div>
                  {error && <p className="error">{error}</p>}
                </>
              )}
            </form>
          )}

          {bot && tab === "settings" && (
            <form id="setup-form" className="setup" onSubmit={save}>
              <section className="card">
                <h2>Your business</h2>
                <div className="two">
                  <div>
                    <label htmlFor="name">Business name</label>
                    <input id="name" type="text" value={form.name} maxLength={80} required
                      onChange={(e) => update("name", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="domain">Your website</label>
                    <input id="domain" type="text" value={form.domain} placeholder="mybusiness.com" required
                      onChange={(e) => update("domain", e.target.value)} />
                  </div>
                </div>
                <p className="hint">The chat only works on this website (and its subdomains).</p>
              </section>

              <section className="card">
                <h2>What your bot knows</h2>
                <p className="hint" style={{ marginTop: 0 }}>The chatbot answers only from this. Include hours, services, prices, your area, how to book and how to reach you. The more specific, the better.</p>
                <div className="import-box">
                  <div className="import-head"><b>Import from your website</b>{isFree && <span className="pro">Pro</span>}</div>
                  <div className="import-row">
                    <input type="text" aria-label="Website address" value={importUrl} placeholder={form.domain || "yourwebsite.com"} disabled={isFree}
                      onChange={(e) => setImportUrl(e.target.value)} />
                    {isFree ? (
                      <button type="button" className="btn secondary" onClick={() => setTab("plan")}>See Pro</button>
                    ) : (
                      <button type="button" className="btn secondary" disabled={importBusy} onClick={importFromWebsite}>
                        {importBusy ? "Reading your site..." : "Import"}
                      </button>
                    )}
                  </div>
                  <p className="hint" style={{ margin: "6px 0 0" }}>
                    {isFree ? "Pro reads your website and fills this in for you." : "We read your main pages and combine them with what you already wrote. You can edit the result before saving."}
                  </p>
                  {importMsg && <p className="ok" style={{ margin: "8px 0 0" }}>{importMsg}</p>}
                  {importErr && <p className="error" style={{ margin: "8px 0 0" }}>{importErr}</p>}
                </div>
                <textarea id="context" aria-label="Business information" value={form.context} maxLength={8000} required
                  placeholder="Hours, services, prices, service area, how to book, phone number..."
                  onChange={(e) => update("context", e.target.value)} />
                <p className="hint counter">{form.context.length} / 8000</p>
              </section>

              <section className="card">
                <h2>In the chat</h2>
                <label htmlFor="greeting">First message</label>
                <input id="greeting" type="text" value={form.greeting} maxLength={200} required
                  onChange={(e) => update("greeting", e.target.value)} />

                <label htmlFor="suggestions">Suggested questions (optional)</label>
                <textarea id="suggestions" style={{ minHeight: 110 }} value={form.suggestions.join("\n")}
                  placeholder={"What are your opening hours?\nHow much does it cost?"}
                  onChange={(e) => setForm((f) => ({ ...f, suggestions: e.target.value.split("\n").slice(0, 4) }))} />
                <p className="hint">One per line, up to 4. Visitors see them as buttons in the chat.</p>

                <label className="toggle">
                  <input type="checkbox" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} />
                  <span><b>Chatbot is on</b><small>Turn off to hide the chat from your website.</small></span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={form.collectLeads} onChange={(e) => update("collectLeads", e.target.checked)} />
                  <span><b>Collect contact details</b><small>When the bot can&apos;t help, it asks visitors for their email or phone.</small></span>
                </label>
              </section>
            </form>
          )}

          {bot && tab === "plan" && (
            <>
              {error && <p className="error">{error}</p>}
              <div className="plan-grid">
                {PLAN_DETAILS.map((p) => {
                  const cur = billing?.plan ?? "free";
                  const current = cur === p.id;
                  const onFree = cur === "free";
                  return (
                    <div key={p.id} className={`plan-card${current ? " current" : ""}${p.popular ? " popular" : ""}`}>
                      {p.popular && !current && <span className="plan-flag">Most popular</span>}
                      {current && <span className="plan-flag now">Your plan</span>}
                      <h2>{p.name}</h2>
                      <p className="plan-price"><b>{p.price}</b>{p.id !== "free" && <span>/month</span>}</p>
                      <p className="hint">{p.tag}</p>
                      <ul>
                        {p.features.map((f) => <li key={f}>{f}</li>)}
                      </ul>
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
                <div className="card row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>Billing</b>
                    <p className="hint" style={{ margin: 0 }}>Switch plan, update your card or cancel.</p>
                  </div>
                  <button className="btn secondary" type="button" disabled={billingBusy} onClick={() => openBilling("portal")}>
                    Manage billing
                  </button>
                </div>
              )}
            </>
          )}

          {bot && tab === "install" && (
            <div className="steps-col">
              <section className="card step">
                <span className="step-n">1</span>
                <div className="step-body">
                  <h2>Try it first</h2>
                  <p className="hint" style={{ marginTop: 0 }}>This is your chatbot, exactly as visitors will see it. Ask it something about your business.</p>
                  <div className="test-frame">
                    <iframe title="Test your chatbot" src={`${API}/widget/${bot.id}`} sandbox="allow-scripts allow-same-origin" />
                  </div>
                </div>
              </section>
              <section className="card step">
                <span className="step-n">2</span>
                <div className="step-body">
                  <h2>Copy your code</h2>
                  <p className="hint" style={{ marginTop: 0 }}>This one line adds the chat to your website.</p>
                  <pre>{snippet}</pre>
                  <button className="btn secondary" type="button" onClick={copySnippet}>{copied ? "Copied!" : "Copy code"}</button>
                </div>
              </section>
              <section className="card step">
                <span className="step-n">3</span>
                <div className="step-body">
                  <h2>Paste it into your site</h2>
                  <p className="hint" style={{ marginTop: 0 }}>Paste it just before the closing <code>&lt;/body&gt;</code> tag, on every page where you want the chat. If someone else manages your site, send it to them. Pick your website builder for help:</p>
                  <details><summary>WordPress</summary><p>Install the free plugin &quot;WPCode&quot;, add a new snippet, choose &quot;Site Wide Footer&quot;, paste the code and activate it.</p></details>
                  <details><summary>Wix</summary><p>Go to Settings, then Custom Code. Add new code, paste it, set it to load on all pages in the Body (end).</p></details>
                  <details><summary>Shopify</summary><p>Go to Online Store, then Themes, then Edit code. Open <code>theme.liquid</code> and paste the code just above <code>&lt;/body&gt;</code>.</p></details>
                  <details><summary>Squarespace</summary><p>Go to Settings, then Advanced, then Code Injection. Paste the code into the Footer box.</p></details>
                  <details><summary>My own website</summary><p>Open your HTML files and paste the code above the closing <code>&lt;/body&gt;</code> tag.</p></details>
                  <div className="row" style={{ marginTop: 18 }}>
                    <button type="button" className="btn" onClick={() => { setFlag("installed"); setTab("overview"); }}>
                      {flags.installed ? "Marked as added" : "I've added it"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}
        </div>
      </main>
    </div>
  );
}
