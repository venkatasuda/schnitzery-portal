"use client";

import { useState } from "react";
import Link from "next/link";

// Manager "Schedule" hub — groups roster, requests and export under one nav
// button using the old app's hub-tab pattern. Each tab links to the existing
// feature page (all already working), taming the long manager home card-wall.
export default function ScheduleHubPage() {
  const [tab, setTab] = useState<"roster" | "requests" | "export">("roster");

  return (
    <div className="fade-up">
      <div className="page-title">📅 Schedule</div>
      <div className="page-sub">Build the roster · handle requests · export</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "roster" ? " active" : ""}`} onClick={() => setTab("roster")}>
          📋 Roster
        </button>
        <button className={`hub-tab${tab === "requests" ? " active" : ""}`} onClick={() => setTab("requests")}>
          ✅ Requests
        </button>
        <button className={`hub-tab${tab === "export" ? " active" : ""}`} onClick={() => setTab("export")}>
          📤 Export
        </button>
      </div>

      {tab === "roster" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/roster"
            icon="📋"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title="Weekly Roster"
            sub="Build and view this week's schedule"
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            The roster is generated from staff availability each week. Open it to review
            assignments, make manual changes, and publish.
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/approvals"
            icon="✅"
            grad="linear-gradient(135deg,#1e8449,#27ae60)"
            title="Approvals"
            sub="Leave requests & shift swaps awaiting your decision"
          />
          <HubLink
            href="/noshow"
            icon="⚠️"
            grad="linear-gradient(135deg,#b9770e,#e67e22)"
            title="Missing Availability"
            sub="Chase staff who haven't submitted yet"
          />
        </div>
      )}

      {tab === "export" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/export"
            icon="📤"
            grad="linear-gradient(135deg,#117a65,#16a085)"
            title="Payroll Export"
            sub="Monthly hours per staff member — download as CSV"
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