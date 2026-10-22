"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getActionCenter, getStaffAlerts } from "@/lib/queries/action-center";
import { CardSkeleton } from "@/components/Skeleton";

export default function ActionCenterPage() {
  const { t } = useLang();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    getActionCenter().then((r) => {
      if (r.ok) setD(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
    getStaffAlerts().then((r) => setAlerts(r.ok ? r.alerts : []));
  }, []);

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const it = d?.items;
  const rows = it ? [
    { key: "approvals", icon: "✅", count: it.approvals.count, href: "/approvals", color: "var(--warn)",
      sub: `${it.approvals.leave} ${t("act.leave")} · ${it.approvals.swaps} ${t("act.swaps")} · ${it.approvals.attendance} ${t("act.time")}` },
    { key: "corrections", icon: "✏️", count: it.corrections, href: "/approvals", color: "var(--warn)", sub: t("act.correctionsSub") },
    { key: "noShows", icon: "🚫", count: it.noShows, href: "/noshow", color: "var(--danger)", sub: t("act.noShowsSub") },
    { key: "conflicts", icon: "🔀", count: it.conflicts, href: "/conflicts", color: "var(--danger)", sub: t("act.conflictsSub") },
    { key: "notCheckedIn", icon: "⏳", count: it.notCheckedIn, href: "/ops", color: "var(--warn)", sub: t("act.notInSub") },
    { key: "expiringDocs", icon: "📄", count: it.expiringDocs, href: "/expiring-docs", color: "var(--warn)", sub: t("act.docsSub") },
    { key: "payroll", icon: "💶", count: it.payrollPending, href: "/export", color: "var(--warn)", sub: t("act.payrollSub") },
  ] : [];
  const active = rows.filter((r) => r.count > 0);

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🎯" size={22} /> {t("act.title")}</h1>
      <div className="page-sub">{t("act.subtitle")}</div>

      {!loading && alerts.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="section-label d-flex ai-c gap-2 mb-3"><Icon e="⚠️" size={14} color="var(--warn)" /> {t("act.alertsTitle")}</div>
          <div className="u-stack">
            {alerts.map((a) => {
              const color = a.severity === "high" ? "var(--danger)" : "var(--warn)";
              const ic = a.type === "absent" ? "🚫" : a.type === "lowAtt" ? "📉" : "⏰";
              const msg = a.type === "late" ? t("act.alertLate", { name: a.name, n: a.n })
                : a.type === "absent" ? t("act.alertAbsent", { name: a.name, n: a.n })
                : t("act.alertLowAtt", { name: a.name, n: a.n });
              return (
                <Link key={a.id} href={`/staff/${a.userId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", borderLeft: `3px solid ${color}` }}>
                  <Icon e={ic} size={16} color={color} />
                  <span className="t-sm u-text u-flex1 mw-0">{msg}</span>
                  <span className="u-muted">›</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <CardSkeleton rows={4} />
      ) : d?.total === 0 && alerts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <div className="u-mb-2"><Icon e="🎉" size={34} color="var(--success)" /></div>
          <div className="tone-success t-lg fw-7">{t("act.allClear")}</div>
          <div className="u-muted t-sm mt-2">{t("act.allClearSub")}</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ textAlign: "center", padding: 16, marginBottom: 14, background: "linear-gradient(135deg,rgba(232,163,90,0.12),rgba(20,20,20,0.4))" }}>
            <span style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--warn)" }}>{d.total}</span>
            <span className="t-md u-muted ml-2">{t("act.needAttention")}</span>
          </div>

          <div className="u-stack">
            {active.map((r) => (
              <Link key={r.key} href={r.href} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 13, textDecoration: "none", borderLeft: `3px solid ${r.color}` }}>
                <Icon e={r.icon} size={22} color={r.color} />
                <div className="u-grow">
                  <div className="fw-6">{t(`act.${r.key}`)}</div>
                  <div className="ui-muted">{r.sub}</div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.count}</span>
                <span className="u-muted">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <Link className="ui-back-link" href="/">{t("approvals.back")}</Link>
    </div>
  );
}