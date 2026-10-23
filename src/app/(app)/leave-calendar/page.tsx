"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getTeamLeave } from "@/lib/queries/leave";
import { CardSkeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";

export default function LeaveCalendarPage() {
  const { t, locale } = useLang();
  const loc = locale === "de" ? "de-DE" : "en-GB";
  const [leave, setLeave] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function load() {
    setLoading(true); setFailed(false);
    try {
      const res = await getTeamLeave();
      if (res.ok) setLeave(res.leave); else setFailed(true);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Dates are calendar days: format at noon UTC so no timezone shifts them a day.
  const day = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d.slice(0, 10) + "T12:00:00Z").toLocaleDateString(loc, { ...o, timeZone: "UTC" });
  const fmtDate = (d: string) => (d ? day(d, { weekday: "short", day: "2-digit", month: "short" }) : "—");
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000) + 1;

  const byMonth: Record<string, any[]> = {};
  for (const l of leave) (byMonth[day(l.from_date, { month: "long", year: "numeric" })] ||= []).push(l);

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="📆" size={22} /> {t("misc.leaveTitle")}</h1>
      <p className="ui-lede">{t("misc.leaveSub")}</p>

      {loading ? <CardSkeleton rows={3} />
        : failed ? <ErrorState message={t("common.loadFailed")} onRetry={load} retryLabel={t("business.retry")} />
        : leave.length === 0 ? <div className="card ui-empty-msg"><Icon e="☀️" size={28} color="var(--gray)" /><br />{t("misc.leaveNone")}</div>
        : Object.entries(byMonth).map(([month, items]) => (
          <section className="mb-5" key={month}>
            <h2 className="section-label">{month}</h2>
            {items.map((l) => (
              <div key={l.id} className="card mb-2 u-between">
                <div>
                  <div className="ui-strong">{l.users?.full_name || "—"}</div>
                  <div className="ui-meta">{fmtDate(l.from_date)} → {fmtDate(l.to_date)}{l.reason ? ` · ${l.reason}` : ""}</div>
                </div>
                <div className="t-xs tone-action fw-6">{t("misc.days", { n: daysBetween(l.from_date, l.to_date) })}</div>
              </div>
            ))}
          </section>
        ))}
    </div>
  );
}
