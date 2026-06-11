"use client";

import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";

// Manager/Owner "Settings" hub — groups branch configuration, reports, and
// tools under one screen with the old app's hub-tab pattern. Reached from the
// home dashboard's "Settings" shortcut.
export default function SettingsHubPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"config" | "reports" | "tools">("config");

  return (
    <div className="fade-up">
      <div className="page-title">⚙️ {t("sh.title")}</div>
      <div className="page-sub">{t("sh.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "config" ? " active" : ""}`} onClick={() => setTab("config")}>
          {t("sh.tabConfig")}
        </button>
        <button className={`hub-tab${tab === "reports" ? " active" : ""}`} onClick={() => setTab("reports")}>
          {t("sh.tabReports")}
        </button>
        <button className={`hub-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>
          {t("sh.tabTools")}
        </button>
      </div>

      {tab === "config" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/settings"
            icon="⚙️"
            grad="linear-gradient(135deg,#555,#777)"
            title={t("profile.branchSettings")}
            sub={t("sh.branchSettingsSub2")}
          />
        </div>
      )}

      {tab === "reports" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/export"
            icon="📤"
            grad="linear-gradient(135deg,#117a65,#16a085)"
            title={t("profile.payrollExport")}
            sub={t("sh.payrollSub2")}
          />
          <HubLink
            href="/audit"
            icon="🔒"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title={t("profile.auditLog")}
            sub={t("profile.auditLogSub")}
          />
        </div>
      )}

      {tab === "tools" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/clock-display"
            icon="📲"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title={t("sh.clockDisplay")}
            sub={t("sh.clockDisplaySub")}
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