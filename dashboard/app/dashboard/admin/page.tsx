"use client";

import { useEffect, useState } from "react";
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

export default function AdminPage() {
  const { getToken, isLoaded } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [myId, setMyId] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [showArchived, setShowArchived] = useState(false);

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
            <div className="card"><span className="num">{data.totals.owners}</span><span className="hint">Owners</span></div>
            <div className="card"><span className="num">{data.totals.bots}</span><span className="hint">Bots</span></div>
            <div className="card"><span className="num">{data.totals.leads}</span><span className="hint">Leads</span></div>
            <div className="card"><span className="num">${data.totalCostUsd.toFixed(2)}</span><span className="hint">AI cost, {data.month}</span></div>
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
