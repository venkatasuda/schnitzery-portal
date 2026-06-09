"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMyLeaveBalance } from "@/lib/queries/leave-balance";

// Staff "My Day" hub — groups the three planning features under one nav button
// using the old app's hub-tab pattern, so the bottom nav stays at 4 tidy items.
// Each tab links through to the full feature page (which already works).
export default function MyDayPage() {
  const [tab, setTab] = useState<"avail" | "timeoff" | "hours" | "work">("avail");
  const [bal, setBal] = useState<any>(null);
  useEffect(() => { getMyLeaveBalance().then((r) => { if (r.ok) setBal(r); }); }, []);

  return (
    <div className="fade-up">
      <div className="page-title">📅 My Day</div>
      <div className="page-sub">Plan ahead · request time off · review your hours</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "avail" ? " active" : ""}`} onClick={() => setTab("avail")}>
          📋 Availability
        </button>
        <button className={`hub-tab${tab === "timeoff" ? " active" : ""}`} onClick={() => setTab("timeoff")}>
          🌴 Time Off
        </button>
        <button className={`hub-tab${tab === "hours" ? " active" : ""}`} onClick={() => setTab("hours")}>
          ⏱ My Hours
        </button>
        <button className={`hub-tab${tab === "work" ? " active" : ""}`} onClick={() => setTab("work")}>
          🧰 Workplace
        </button>
      </div>

      {tab === "avail" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/availability"
            icon="🗓"
            grad="linear-gradient(135deg,#8b6914,#d4a847)"
            title="Set My Availability"
            sub="Mark which days and shifts you can work next week"
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            Submit your availability before Sunday — the roster for the coming week is
            generated automatically once submissions close.
          </div>
        </div>
      )}

      {tab === "timeoff" && (
        <div className="hub-tab-panel active">
          {bal && (
            <div className="card" style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--white)" }}>🌴 Vacation {bal.year}</span>
                <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>{bal.remaining} days left</span>
              </div>
              <div style={{ height: 6, background: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${bal.allowance > 0 ? Math.min(100, Math.round((bal.used / bal.allowance) * 100)) : 0}%`, height: "100%", background: "var(--gold)" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 6 }}>{bal.used} of {bal.allowance} days taken</div>
            </div>
          )}
          <HubLink
            href="/leave"
            icon="🌴"
            grad="linear-gradient(135deg,#117a65,#16a085)"
            title="Request Time Off"
            sub="Vacation, sick leave, personal or emergency"
          />
          <HubLink
            href="/leave-calendar"
            icon="📆"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title="Team Leave Calendar"
            sub="See who else is off before you request"
          />
        </div>
      )}

      {tab === "hours" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/hours"
            icon="⏱"
            grad="linear-gradient(135deg,#6b2fa0,#9b59b6)"
            title="Hours Summary"
            sub="Your monthly hours vs. contract"
          />
          <HubLink
            href="/timesheet"
            icon="✍️"
            grad="linear-gradient(135deg,#922b21,#c0392b)"
            title="Sign Timesheet"
            sub="Confirm your worked hours for payroll"
          />
        </div>
      )}
      {tab === "work" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/checklist"
            icon="✅"
            grad="linear-gradient(135deg,#1e8449,#27ae60)"
            title="Daily Checklist"
            sub="Opening & closing tasks for your shift"
          />
          <HubLink
            href="/directory"
            icon="📇"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title="Team Directory"
            sub="Find & contact colleagues"
          />
        </div>
      )}
    </div>
  );
}

function HubLink({ href, icon, grad, title, sub }: { href: string; icon: string; grad: string; title: string; sub: string }) {
  return (
    <Link href={href} className="feature-card">
      <div className="feature-icon" style={{ background: grad }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="feature-title">{title}</div>
        <div className="feature-sub">{sub}</div>
      </div>
      <span className="feature-chev">›</span>
    </Link>
  );
}