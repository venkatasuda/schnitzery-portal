"use client";

import { PageHeader } from "@/components/ui";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CardSkeleton } from "@/components/Skeleton";
import Link from "next/link";
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
  return <Suspense fallback={<CardSkeleton rows={4} />}><MyDayContent /></Suspense>;
}

function MyDayContent() {
  const { t } = useLang();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("tab");
  const tab = requested === "timeoff" || requested === "hours" || requested === "work" ? requested : "avail";
  // ponytail: retain at most four visited views; pause polling here if background polling is added.
  const [visited, setVisited] = useState<string[]>([tab]);
  // Browser Back/Forward can visit a view without going through changeTab.
  if (!visited.includes(tab)) setVisited([...visited, tab]);
  function changeTab(next: "avail" | "timeoff" | "hours" | "work") {
    if (next === tab) return;
    setVisited(previous => [...new Set([...previous, tab, next])]);
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.push(`/my-day?${query}`, { scroll: false });
  }

  return (
    <div className="fade-up">
      <PageHeader title={ <><Icon e="📅" size={22} /> {t("myday.title")}</> } />

      <div className="hub-tabs" role="group" aria-label={t("myday.title")}>
        <button className={`hub-tab${tab === "avail" ? " active" : ""}`} aria-pressed={tab === "avail"} onClick={() => changeTab("avail")}>
          <Icon className="u-icon-inline" e="📋" size={14} /> {t("myday.tabAvail")}
        </button>
        <button className={`hub-tab${tab === "timeoff" ? " active" : ""}`} aria-pressed={tab === "timeoff"} onClick={() => changeTab("timeoff")}>
          <Icon className="u-icon-inline" e="🌴" size={14} /> {t("myday.tabTimeOff")}
        </button>
        <button className={`hub-tab${tab === "hours" ? " active" : ""}`} aria-pressed={tab === "hours"} onClick={() => changeTab("hours")}>
          <Icon className="u-icon-inline" e="⏱" size={14} /> {t("myday.tabHours")}
        </button>
        <button className={`hub-tab${tab === "work" ? " active" : ""}`} aria-pressed={tab === "work"} onClick={() => changeTab("work")}>
          <Icon className="u-icon-inline" e="🧰" size={14} /> {t("myday.tabWork")}
        </button>
      </div>

      {(tab === "avail" || visited.includes("avail")) && (
        <div className={`hub-tab-panel${tab === "avail" ? " active" : ""}`} hidden={tab !== "avail"}>
          <AvailabilityForm />
        </div>
      )}

      {(tab === "timeoff" || visited.includes("timeoff")) && (
        <div className={`hub-tab-panel${tab === "timeoff" ? " active" : ""}`} hidden={tab !== "timeoff"}>
          {/* Screens load on first visit and retain their local form state; their own page heading is hidden. */}
          <div className="myday-embed"><LeavePage /></div>
          <Link className="ui-back-link" href="/leave-calendar">{t("myday.teamLeaveCal")} →</Link>
        </div>
      )}

      {(tab === "hours" || visited.includes("hours")) && (
        <div className={`hub-tab-panel myday-embed${tab === "hours" ? " active" : ""}`} hidden={tab !== "hours"}><HoursPage /></div>
      )}
      {(tab === "work" || visited.includes("work")) && (
        <div className={`hub-tab-panel${tab === "work" ? " active" : ""}`} hidden={tab !== "work"}>
          <div className="myday-embed"><ChecklistPage /></div>
          <Link className="ui-back-link" href="/directory">{t("myday.teamDirectory")} →</Link>
        </div>
      )}
    </div>
  );
}
