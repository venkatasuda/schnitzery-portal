"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getMyHours } from "@/lib/queries/timepay";
import { Stat, StatGrid, ErrorState } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";

export default function HoursPage() {
  const { t, locale } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState("");

  async function load(m?: string) {
    setLoading(true); setFailed(false);
    try {
      const res = await getMyHours(m);
      if (res.ok) { setData(res); setMonth(res.month ?? ""); } else setFailed(true);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    load(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = month ? new Date(month + "-01T12:00:00").toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric" }) : "";
  const pct = data?.targetHours ? Math.min(100, Math.round((data.totalHours / data.targetHours) * 100)) : 0;
  const owes = data?.debt != null && data.debt > 0;

  return (
    <div className="ui-narrow">
      <h1 className="page-title u-row"><Icon e="⏱" size={22} /> {t("hours.title")}</h1>
      <p className="ui-lede">{t("hours.subtitle")}</p>

      <div className="d-flex jc-sb ai-c mb-4">
        <button className="btn-secondary ui-btn-sm" disabled={loading || !month} onClick={() => shiftMonth(-1)}>{t("shifts.prev")}</button>
        <span className="t-md tone-action fw-6" aria-live="polite">{monthLabel}</span>
        <button className="btn-secondary ui-btn-sm" disabled={loading || !month} onClick={() => shiftMonth(1)}>{t("shifts.next")}</button>
      </div>

      {loading ? <CardSkeleton rows={3} />
        : failed ? <ErrorState message={t("common.loadFailed")} onRetry={() => load(month || undefined)} retryLabel={t("business.retry")} />
        : !data ? <div className="card ui-empty-msg">{t("hours.noData")}</div>
        : (
        <>
          <div className="card clock-timer">
            <div className="clock-timer-value">{data.totalHours}h</div>
            <div className="clock-caption">{t("hours.workedThisMonth")}</div>
          </div>
          <StatGrid>
            <Stat label={t("hours.shifts")} value={String(data.shifts)} />
            <Stat label={t("hours.target")} value={data.targetHours != null ? `${data.targetHours}h` : "—"} />
            <Stat label={owes ? t("hours.remaining") : t("hours.over")} value={data.debt != null ? `${Math.abs(data.debt)}h` : "—"} tone={owes ? "warn" : "success"} />
          </StatGrid>
          {data.targetHours != null && (
            <div className="card">
              <div className="t-xs u-muted mb-2">{t("hours.progress", { h: data.targetHours })}</div>
              <div className={`ui-bar${pct >= 100 ? "" : " near"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="t-xs tone-action u-center mt-2">{pct}%</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
