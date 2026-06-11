"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMyLeaveBalance } from "@/lib/queries/leave-balance";
import { useLang } from "@/components/LanguageProvider";

// Staff "My Day" hub — groups the three planning features under one nav button
// using the old app's hub-tab pattern, so the bottom nav stays at 4 tidy items.
// Each tab links through to the full feature page (which already works).
export default function MyDayPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"avail" | "timeoff" | "hours" | "work">("avail");
  const [bal, setBal] = useState<any>(null);
  useEffect(() => { getMyLeaveBalance().then((r) => { if (r.ok) setBal(r); }); }, []);

  return (
    <div className="fade-up">
      <div className="page-title">📅 {t("myday.title")}</div>
      <div className="page-sub">{t("myday.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "avail" ? " active" : ""}`} onClick={() => setTab("avail")}>
          📋 {t("myday.tabAvail")}
        </button>
        <button className={`hub-tab${tab === "timeoff" ? " active" : ""}`} onClick={() => setTab("timeoff")}>
          🌴 {t("myday.tabTimeOff")}
        </button>
        <button className={`hub-tab${tab === "hours" ? " active" : ""}`} onClick={() => setTab("hours")}>
          ⏱ {t("myday.tabHours")}
        </button>
        <button className={`hub-tab${tab === "work" ? " active" : ""}`} onClick={() => setTab("work")}>
          🧰 {t("myday.tabWork")}
        </button>
      </div>

      {tab === "avail" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/availability"
            icon="🗓"
            grad="linear-gradient(135deg,#8b6914,#d4a847)"
            title={t("myday.availTitle")}
            sub={t("myday.availSub")}
          />
          <div className="card" style={{ fontSize: 12, color: "var(--gray)", lineHeight: 1.6 }}>
{t("myday.availNote")}
          </div>
        </div>
      )}

      {tab === "timeoff" && (
        <div className="hub-tab-panel active">
          {bal && (
            <div className="card" style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--white)" }}>🌴 {t("myday.vacationYear", { year: bal.year })}</span>
                <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>{t("myday.daysLeft", { n: bal.remaining })}</span>
              </div>
              <div style={{ height: 6, background: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${bal.allowance > 0 ? Math.min(100, Math.round((bal.used / bal.allowance) * 100)) : 0}%`, height: "100%", background: "var(--gold)" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 6 }}>{t("myday.daysTaken", { used: bal.used, total: bal.allowance })}</div>
            </div>
          )}
          <HubLink
            href="/leave"
            icon="🌴"
            grad="linear-gradient(135deg,#117a65,#16a085)"
            title={t("myday.requestTimeOff")}
            sub={t("myday.requestTimeOffSub")}
          />
          <HubLink
            href="/leave-calendar"
            icon="📆"
            grad="linear-gradient(135deg,#1a6b8a,#3498db)"
            title={t("myday.teamLeaveCal")}
            sub={t("myday.teamLeaveCalSub")}
          />
        </div>
      )}

      {tab === "hours" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/hours"
            icon="⏱"
            grad="linear-gradient(135deg,#6b2fa0,#9b59b6)"
            title={t("myday.hoursSummary")}
            sub={t("myday.hoursSummarySub")}
          />
          <HubLink
            href="/timesheet"
            icon="✍️"
            grad="linear-gradient(135deg,#922b21,#c0392b)"
            title={t("myday.signTimesheet")}
            sub={t("myday.signTimesheetSub")}
          />
        </div>
      )}
      {tab === "work" && (
        <div className="hub-tab-panel active">
          <HubLink
            href="/checklist"
            icon="✅"
            grad="linear-gradient(135deg,#1e8449,#27ae60)"
            title={t("myday.dailyChecklist")}
            sub={t("myday.dailyChecklistSub")}
          />
          <HubLink
            href="/directory"
            icon="📇"
            grad="linear-gradient(135deg,#2c3e50,#34495e)"
            title={t("myday.teamDirectory")}
            sub={t("myday.teamDirectorySub")}
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