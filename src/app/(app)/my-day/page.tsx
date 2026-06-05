"use client";

import { useState } from "react";
import Link from "next/link";

// Staff "My Day" hub — groups the three planning features under one nav button
// using the old app's hub-tab pattern, so the bottom nav stays at 4 tidy items.
// Each tab links through to the full feature page (which already works).
export default function MyDayPage() {
  const [tab, setTab] = useState<"avail" | "timeoff" | "hours">("avail");

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