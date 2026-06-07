"use client";

import { useState } from "react";
import Link from "next/link";

// Manager "Attendance" hub — groups the live overview, no-show tracking, the
// clock-in display screen, and the manager's own clock-in under one nav button.
// Mirrors the old app's Attendance hub (Live / No-Shows / Display). Each tab
// links to the existing working page.
export default function AttendanceHubPage() {
  const [tab, setTab] = useState<"live" | "noshow" | "display">("live");

  return (
    <div className="fade-up">
      <div className="page-title">🕐 Attendance</div>
      <div className="page-sub">Live overview · no-shows · clock-in display</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "live" ? " active" : ""}`} onClick={() => setTab("live")}>
          🔴 Live
        </button>
        <button className={`hub-tab${tab === "noshow" ? " active" : ""}`} onClick={() => setTab("noshow")}>
          🚫 No-Shows
        </button>
        <button className={`hub-tab${tab === "display" ? " active" : ""}`} onClick={() => setTab("display")}>
          📲 Display
        </button>
      </div>

      {tab === "live" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/dashboard"
            icon="🔴"
            grad="linear-gradient(135deg,#922b21,#c0392b)"
            title="Live Branch Overview"
            sub="Who's working, on break, and completed today"
          />
          <HubLink
            href="/attendance"
            icon="🕐"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title="My Clock In / Out"
            sub="Track your own hours"
          />
        </div>
      )}

      {tab === "noshow" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/noshow"
            icon="🚫"
            grad="linear-gradient(135deg,#b9770e,#e67e22)"
            title="No-Show Tracking"
            sub="Scheduled staff who didn't clock in"
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            Run a check for today, review recent no-shows, and mark them excused or
            warned. Repeated no-shows lower a person's scheduling priority.
          </div>
        </div>
      )}

      {tab === "display" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/clock-display"
            icon="📲"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title="Clock-In Display Screen"
            sub="Rotating QR + code for staff to clock in on-site"
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            Keep this open on a screen at the restaurant. The code changes every
            30 seconds so staff can only clock in when physically present.
          </div>
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