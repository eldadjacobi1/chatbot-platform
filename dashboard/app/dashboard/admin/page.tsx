"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import "../app.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Overview = {
  month: string;
  totals: { bots: number; owners: number; leads: number };
  totalCostUsd: number;
  bots: { botId: string; name: string; requests: number; promptTokens: number; completionTokens: number; estimatedCostUsd: number }[];
  feedback: { id: number; email: string; page: string; message: string; createdAt: string; archived: boolean }[];
};

type AdminUser = { id: string; email: string; plan: string; bots: number; questions30d: number; leads: number; costUsd: number; signedUp: number | null; lastActive: number | null };
type UserDetail = { bots: { id: string; name: string; enabled: boolean; website: string; leads: number }[]; questions: { question: string; unanswered: boolean; createdAt: string }[] };

function ago(ms: number | string | null): string {
  if (!ms) return "never";
  const t = typeof ms === "string" ? new Date(ms).getTime() : ms;
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d < 8 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminPage() {
  const { getToken, isLoaded } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [myId, setMyId] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [showArchived, setShowArchived] = useState(false);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [openUser, setOpenUser] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);

  async function toggleUser(id: string) {
    if (openUser === id) return setOpenUser("");
    setOpenUser(id);
    setDetail(null);
    const token = await getToken();
    const res = await fetch(`${API}/api/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setDetail(await res.json());
  }

  async function changeFeedback(id: number, action: "archive" | "restore" | "delete") {
    if (action === "delete" && !window.confirm("Delete this message for good?")) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/admin/feedback/${id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { Authorization: `Bearer ${token}`, ...(action === "delete" ? {} : { "Content-Type": "application/json" }) },
      ...(action === "delete" ? {} : { body: JSON.stringify({ archived: action === "archive" }) }),
    });
    if (!res.ok) return;
    setData((d) =>
      d && {
        ...d,
        feedback:
          action === "delete"
            ? d.feedback.filter((f) => f.id !== id)
            : d.feedback.map((f) => (f.id === id ? { ...f, archived: action === "archive" } : f)),
      },
    );
  }

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const me = await fetch(`${API}/api/admin/me`, { headers }).then((r) => r.json()).catch(() => ({}));
      if (!me.admin) {
        setMyId(me.userId ?? "");
        setState("denied");
        return;
      }
      const res = await fetch(`${API}/api/admin/overview`, { headers });
      if (!res.ok) return setState("denied");
      setData(await res.json());
      setState("ok");
      fetch(`${API}/api/admin/users`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setUsers(j?.users ?? []))
        .catch(() => setUsers([]));
    })();
  }, [isLoaded, getToken]);

  return (
    <div className="admin">
      <Link href="/dashboard" className="link">&larr; Back to dashboard</Link>
      <h1>Admin</h1>

      {state === "loading" && <p className="hint">Loading...</p>}

      {state === "denied" && (
        <div className="card">
          <h2>This page is private</h2>
          {myId ? (
            <>
              <p className="hint">This account is not an admin. In Clerk, open this user and set its public metadata to <code>{`{"role":"admin"}`}</code>, then sign out and back in.</p>
            </>
          ) : (
            <p className="hint">Sign in to continue.</p>
          )}
        </div>
      )}

      {state === "ok" && data && (
        <>
          <div className="admin-stats">
            <div className="card"><span className="num">{users ? users.length : "-"}</span><span className="hint">Users</span></div>
            <div className="card"><span className="num">{users ? users.filter((u) => u.lastActive && Date.now() - u.lastActive < 7 * 864e5).length : "-"}</span><span className="hint">Active this week</span></div>
            <div className="card"><span className="num">{users ? users.filter((u) => u.plan !== "free").length : "-"}</span><span className="hint">On a paid plan</span></div>
            <div className="card"><span className="num">${data.totalCostUsd < 0.01 ? data.totalCostUsd.toFixed(4) : data.totalCostUsd.toFixed(2)}</span><span className="hint">AI cost, {data.month}</span></div>
          </div>

          <div className="card">
            <h2>Users</h2>
            {users === null ? (
              <p className="hint">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="hint">No users yet.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>User</th><th>Plan</th><th>Bots</th><th>Questions (30d)</th><th>Leads</th><th>AI cost</th><th>Signed up</th><th>Last active</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <Fragment key={u.id}>
                      <tr onClick={() => toggleUser(u.id)} style={{ cursor: "pointer" }}>
                        <td>{u.email || u.id}</td>
                        <td><span className={`plan-pill ${u.plan}`}>{u.plan}</span></td>
                        <td>{u.bots}</td>
                        <td>{u.questions30d}</td>
                        <td>{u.leads}</td>
                        <td>${u.costUsd < 0.01 ? u.costUsd.toFixed(4) : u.costUsd.toFixed(2)}</td>
                        <td>{u.signedUp ? new Date(u.signedUp).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "-"}</td>
                        <td>{ago(u.lastActive)}</td>
                      </tr>
                      {openUser === u.id && (
                        <tr>
                          <td colSpan={8}>
                            {!detail ? (
                              <p className="hint">Loading...</p>
                            ) : (
                              <>
                                {detail.bots.length === 0 ? <p className="hint">No bots yet.</p> : detail.bots.map((b) => (
                                  <p key={b.id} className="hint"><b>{b.name}</b> &middot; {b.website || "no website"} &middot; {b.enabled ? "on" : "off"} &middot; {b.leads} leads</p>
                                ))}
                                {detail.questions.length > 0 && (
                                  <>
                                    <p className="hint"><b>Latest questions</b></p>
                                    {detail.questions.map((q, i) => (
                                      <p key={i} className="hint">{q.unanswered ? "\u26A0 " : ""}{q.question} &middot; {ago(q.createdAt)}</p>
                                    ))}
                                  </>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>AI usage this month</h2>
            {data.bots.length === 0 ? (
              <p className="hint">No AI answers yet this month.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Bot</th><th>Answers</th><th>Tokens in</th><th>Tokens out</th><th>Est. cost</th></tr></thead>
                <tbody>
                  {data.bots.map((b) => (
                    <tr key={b.botId}>
                      <td>{b.name}</td>
                      <td>{b.requests}</td>
                      <td>{b.promptTokens.toLocaleString()}</td>
                      <td>{b.completionTokens.toLocaleString()}</td>
                      <td>${b.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="admin-fb-head">
              <h2>Feedback</h2>
              <div className="seg small" role="tablist" aria-label="Feedback filter">
                <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? "seg-btn on" : "seg-btn"} onClick={() => setShowArchived(false)}>Open <em>{data.feedback.filter((f) => !f.archived).length}</em></button>
                <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? "seg-btn on" : "seg-btn"} onClick={() => setShowArchived(true)}>Archived <em>{data.feedback.filter((f) => f.archived).length}</em></button>
              </div>
            </div>
            {data.feedback.filter((f) => f.archived === showArchived).length === 0 ? (
              <p className="hint">{showArchived ? "Nothing archived." : "No open feedback."}</p>
            ) : (
              <ul className="admin-fb">
                {data.feedback.filter((f) => f.archived === showArchived).map((f) => (
                  <li key={f.id}>
                    <p>{f.message}</p>
                    <span className="hint">
                      {f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : "no email"} &middot; {f.page || "dashboard"} &middot; {new Date(f.createdAt).toLocaleString()}
                    </span>
                    <span className="admin-fb-actions">
                      <button type="button" className="btn ghost small" onClick={() => changeFeedback(f.id, f.archived ? "restore" : "archive")}>{f.archived ? "Restore" : "Archive"}</button>
                      <button type="button" className="btn ghost small ignore" onClick={() => changeFeedback(f.id, "delete")}>Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
