"use client";

import { useState } from "react";
import { SITES } from "./sites";

type Theme = "clean" | "bold" | "soft";
type Example = {
  id: string;
  business: string;
  tagline: string;
  theme: Theme;
  themeName: string;
  tone: string;
  color: string;
  tint: string;
  button: string;
  greeting: string;
  chips: string[];
  chat: { who: "you" | "bot"; text: string }[];
  lead?: boolean;
};

const EXAMPLES: Example[] = [
  {
    id: "pizza",
    business: "Napoli Slice",
    tagline: "Wood-fired pizza by the slice",
    theme: "soft",
    themeName: "Soft",
    tone: "playful",
    color: "#c2410c",
    tint: "#fff3e8",
    button: "Ask us",
    greeting: "Ciao! Hungry? Ask me anything.",
    chips: ["Menu", "Delivery area"],
    chat: [
      { who: "you", text: "Are you open late on Friday?" },
      { who: "bot", text: "You bet! Fridays we're open until 1 AM. Slices at the counter, whole pies for delivery." },
    ],
  },
  {
    id: "law",
    business: "Hart & Lowell LLP",
    tagline: "Employment law for New Yorkers",
    theme: "bold",
    themeName: "Bold",
    tone: "professional",
    color: "#1e3a8a",
    tint: "#eef2fb",
    button: "Chat with us",
    greeting: "Welcome to Hart & Lowell. How can we help?",
    chips: ["Free consultation?", "Practice areas"],
    chat: [
      { who: "you", text: "Can you represent me in a wage dispute?" },
      { who: "bot", text: "I'm not sure about that. Please contact the business directly." },
    ],
    lead: true,
  },
  {
    id: "dental",
    business: "Bright Smile Dental",
    tagline: "Family dentistry in Brooklyn",
    theme: "clean",
    themeName: "Clean",
    tone: "friendly",
    color: "#0f766e",
    tint: "#e8f6f4",
    button: "",
    greeting: "Hi! How can I help you today?",
    chips: ["Insurance", "Book a visit"],
    chat: [
      { who: "you", text: "Do you take Delta Dental?" },
      { who: "bot", text: "We do! We also accept Aetna and Cigna. Please bring your insurance card to your first visit." },
    ],
  },
];

function Bubble() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

function MockSite({ ex }: { ex: Example }) {
  return (
    <div className="ex-site" style={{ "--c": ex.color, "--tint": ex.tint } as React.CSSProperties}>
      <div className="ex-browser">
        <span /><span /><span />
      </div>
      <div className="ex-page">
        <div className="site" dangerouslySetInnerHTML={{ __html: SITES[ex.id] ?? "" }} />

        <div className={`ex-chat ex-${ex.theme}`}>
          <div className="ex-head">{ex.business}</div>
          <div className="ex-log">
            <div className="ex-msg bot">{ex.greeting}</div>
            <div className="ex-chips">{ex.chips.map((c) => <span key={c}>{c}</span>)}</div>
            {ex.chat.map((m, i) => (
              <div key={i} className={`ex-msg ${m.who}`}>{m.text}</div>
            ))}
            {ex.lead && (
              <div className="ex-lead">
                <p>Leave your email or phone and {ex.business} will get back to you.</p>
                <span>name@email.com</span>
                <b>Send</b>
              </div>
            )}
          </div>
          <div className="ex-input"><span>Type your question...</span><b>Send</b></div>
        </div>
        <div className={`ex-launch ex-${ex.theme}`}>
          <Bubble />
          {ex.button && <span>{ex.button}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Examples() {
  const [active, setActive] = useState(EXAMPLES[0].id);
  const ex = EXAMPLES.find((e) => e.id === active) ?? EXAMPLES[0];

  return (
    <div className="ex-wrap">
      <div className="ex-list" role="tablist" aria-label="Example businesses">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={e.id === active}
            className={e.id === active ? "ex-tab on" : "ex-tab"}
            onClick={() => setActive(e.id)}
          >
            <b>{e.business}</b>
            <span>{e.themeName} design, {e.tone} tone</span>
          </button>
        ))}
      </div>
      <MockSite ex={ex} />
    </div>
  );
}
