"use client";

import { useState } from "react";
import Link from "next/link";

// Manager/Owner "People" hub — groups team management, the directory, and
// notes/recognition under one screen with the old app's hub-tab pattern.
// Reached from the home dashboard's "People & Team" shortcut.
export default function PeopleHubPage() {
  const [tab, setTab] = useState<"team" | "notes">("team");

  return (
    <div className="fade-up">
      <div className="page-title">👥 People</div>
      <div className="page-sub">Manage your team · directory · notes</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "team" ? " active" : ""}`} onClick={() => setTab("team")}>
          👥 Team
        </button>
        <button className={`hub-tab${tab === "notes" ? " active" : ""}`} onClick={() => setTab("notes")}>
          📝 Notes
        </button>
      </div>

      {tab === "team" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/staff"
            icon="👥"
            grad="linear-gradient(135deg,#6b2fa0,#9b59b6)"
            title="Staff Management"
            sub="Edit profiles, contracts & create accounts"
          />
          <HubLink
            href="/directory"
            icon="📇"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title="Team Directory"
            sub="Browse & contact everyone on the team"
          />
        </div>
      )}

      {tab === "notes" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/notes"
            icon="📝"
            grad="linear-gradient(135deg,#922b21,#c0392b)"
            title="Notes & Recognition"
            sub="Private performance notes and shout-outs"
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            Performance notes are private to managers. Mark a note as recognition to
            celebrate a team member's great work.
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