"use client";

import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";

// Manager/Owner "People" hub — groups team management, the directory, and
// notes/recognition under one screen with the old app's hub-tab pattern.
// Reached from the home dashboard's "People & Team" shortcut.
export default function PeopleHubPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"team" | "notes">("team");

  return (
    <div className="fade-up">
      <div className="page-title">👥 {t("ph.title")}</div>
      <div className="page-sub">{t("ph.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "team" ? " active" : ""}`} onClick={() => setTab("team")}>
          {t("ph.tabTeam")}
        </button>
        <button className={`hub-tab${tab === "notes" ? " active" : ""}`} onClick={() => setTab("notes")}>
          {t("ph.tabNotes")}
        </button>
      </div>

      {tab === "team" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/staff"
            icon="👥"
            grad="linear-gradient(135deg,#6b2fa0,#9b59b6)"
            title={t("staff.title")}
            sub={t("ph.staffSub")}
          />
          <HubLink
            href="/directory"
            icon="📇"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title={t("directory.title")}
            sub={t("ph.dirSub")}
          />
        </div>
      )}

      {tab === "notes" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/notes"
            icon="📝"
            grad="linear-gradient(135deg,#922b21,#c0392b)"
            title={t("schedhub.notes")}
            sub={t("ph.notesSub")}
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
            {t("ph.noteHint")}
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