"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMyLeaveBalance } from "@/lib/queries/leave-balance";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import AvailabilityForm from "@/components/AvailabilityForm";
import LeavePage from "../leave/page";
import HoursPage from "../hours/page";
import ChecklistPage from "../checklist/page";

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
      <h1 className="page-title u-row"><Icon e="📅" size={22} /> {t("myday.title")}</h1>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "avail" ? " active" : ""}`} onClick={() => setTab("avail")}>
          <Icon className="u-icon-inline" e="📋" size={14} /> {t("myday.tabAvail")}
        </button>
        <button className={`hub-tab${tab === "timeoff" ? " active" : ""}`} onClick={() => setTab("timeoff")}>
          <Icon className="u-icon-inline" e="🌴" size={14} /> {t("myday.tabTimeOff")}
        </button>
        <button className={`hub-tab${tab === "hours" ? " active" : ""}`} onClick={() => setTab("hours")}>
          <Icon className="u-icon-inline" e="⏱" size={14} /> {t("myday.tabHours")}
        </button>
        <button className={`hub-tab${tab === "work" ? " active" : ""}`} onClick={() => setTab("work")}>
          <Icon className="u-icon-inline" e="🧰" size={14} /> {t("myday.tabWork")}
        </button>
      </div>

      {tab === "avail" && (
        <div className="hub-tab-panel active">
          <AvailabilityForm />
        </div>
      )}

      {tab === "timeoff" && (
        <div className="hub-tab-panel active">
          {bal && (
            <div className="card mb-1">
              <div className="d-flex jc-sb ai-b mb-2">
                <span className="t-md fw-7 u-text"><Icon className="u-icon-inline" e="🌴" size={13} /> {t("myday.vacationYear", { year: bal.year })}</span>
                <span className="t-sm tone-action fw-7">{t("myday.daysLeft", { n: bal.remaining })}</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${bal.allowance > 0 ? Math.min(100, Math.round((bal.used / bal.allowance) * 100)) : 0}%`, height: "100%", background: "var(--gold)" }} />
              </div>
              <div className="t-xs u-muted mt-2">{t("myday.daysTaken", { used: bal.used, total: bal.allowance })}</div>
            </div>
          )}
          {/* The real screens render inside the tab (only the open tab loads); their own page heading is hidden. */}
          <div className="myday-embed"><LeavePage /></div>
          <Link className="ui-back-link" href="/leave-calendar">{t("myday.teamLeaveCal")} →</Link>
        </div>
      )}

      {tab === "hours" && (
        <div className="hub-tab-panel active myday-embed"><HoursPage /></div>
      )}
      {tab === "work" && (
        <div className="hub-tab-panel active">
          <div className="myday-embed"><ChecklistPage /></div>
          <Link className="ui-back-link" href="/directory">{t("myday.teamDirectory")} →</Link>
        </div>
      )}
    </div>
  );
}
