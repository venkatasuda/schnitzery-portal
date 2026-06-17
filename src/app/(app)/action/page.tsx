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

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const it = d?.items;
  const rows = it ? [
    { key: "approvals", icon: "✅", count: it.approvals.count, href: "/approvals", color: "#e8a35a",
      sub: `${it.approvals.leave} ${t("act.leave")} · ${it.approvals.swaps} ${t("act.swaps")} · ${it.approvals.attendance} ${t("act.time")}` },
    { key: "corrections", icon: "✏️", count: it.corrections, href: "/approvals", color: "#e8a35a", sub: t("act.correctionsSub") },
    { key: "noShows", icon: "🚫", count: it.noShows, href: "/noshow", color: "#ec7063", sub: t("act.noShowsSub") },
    { key: "conflicts", icon: "🔀", count: it.conflicts, href: "/conflicts", color: "#ec7063", sub: t("act.conflictsSub") },
    { key: "notCheckedIn", icon: "⏳", count: it.notCheckedIn, href: "/ops", color: "#e8a35a", sub: t("act.notInSub") },
    { key: "expiringDocs", icon: "📄", count: it.expiringDocs, href: "/expiring-docs", color: "#e8a35a", sub: t("act.docsSub") },
    { key: "payroll", icon: "💶", count: it.payrollPending, href: "/export", color: "#e8a35a", sub: t("act.payrollSub") },
  ] : [];
  const active = rows.filter((r) => r.count > 0);

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🎯" size={22} /> {t("act.title")}</div>
      <div className="page-sub">{t("act.subtitle")}</div>

      {!loading && alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><Icon e="⚠️" size={14} color="#e8a35a" /> {t("act.alertsTitle")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => {
              const color = a.severity === "high" ? "#ec7063" : "#e8a35a";
              const ic = a.type === "absent" ? "🚫" : a.type === "lowAtt" ? "📉" : "⏰";
              const msg = a.type === "late" ? t("act.alertLate", { name: a.name, n: a.n })
                : a.type === "absent" ? t("act.alertAbsent", { name: a.name, n: a.n })
                : t("act.alertLowAtt", { name: a.name, n: a.n });
              return (
                <Link key={a.id} href={`/staff/${a.userId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${color}` }}>
                  <Icon e={ic} size={16} color={color} />
                  <span style={{ fontSize: 13, color: "var(--white)", flex: 1, minWidth: 0 }}>{msg}</span>
                  <span style={{ color: "var(--gray)" }}>›</span>
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
          <div style={{ marginBottom: 8 }}><Icon e="🎉" size={34} color="#58d68d" /></div>
          <div style={{ color: "#58d68d", fontSize: 16, fontWeight: 700 }}>{t("act.allClear")}</div>
          <div style={{ color: "var(--gray)", fontSize: 13, marginTop: 6 }}>{t("act.allClearSub")}</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ textAlign: "center", padding: 16, marginBottom: 14, background: "linear-gradient(135deg,rgba(232,163,90,0.12),rgba(20,20,20,0.4))" }}>
            <span style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", color: "#e8a35a" }}>{d.total}</span>
            <span style={{ fontSize: 14, color: "var(--gray)", marginLeft: 8 }}>{t("act.needAttention")}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map((r) => (
              <Link key={r.key} href={r.href} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 13, textDecoration: "none", borderLeft: `3px solid ${r.color}` }}>
                <Icon e={r.icon} size={22} color={r.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{t(`act.${r.key}`)}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>{r.sub}</div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.count}</span>
                <span style={{ color: "var(--gray)" }}>›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}