"use client";

import { useState } from "react";
import Link from "next/link";

// Manager/Owner "Settings" hub — groups branch configuration, reports, and
// tools under one screen with the old app's hub-tab pattern. Reached from the
// home dashboard's "Settings" shortcut.
export default function SettingsHubPage() {
  const [tab, setTab] = useState<"config" | "reports" | "tools">("config");

  return (
    <div className="fade-up">
      <div className="page-title">⚙️ Settings</div>
      <div className="page-sub">Configuration · reports · tools</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "config" ? " active" : ""}`} onClick={() => setTab("config")}>
          ⚙️ Config
        </button>
        <button className={`hub-tab${tab === "reports" ? " active" : ""}`} onClick={() => setTab("reports")}>
          📊 Reports
        </button>
        <button className={`hub-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>
          🔧 Tools
        </button>
      </div>

      {tab === "config" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/settings"
            icon="⚙️"
            grad="linear-gradient(135deg,#555,#777)"
            title="Branch Settings"
            sub="QR clock-in, GPS check & branch options"
          />
        </div>
      )}

      {tab === "reports" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/export"
            icon="📤"
            grad="linear-gradient(135deg,#117a65,#16a085)"
            title="Payroll Export"
            sub="Monthly hours per staff — download CSV"
          />
          <HubLink
            href="/audit"
            icon="🔒"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title="Audit Log"
            sub="Every manager action, time-stamped"
          />
        </div>
      )}

      {tab === "tools" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/clock-display"
            icon="📲"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title="Clock-In Display"
            sub="Rotating QR + code screen for on-site clock-in"
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