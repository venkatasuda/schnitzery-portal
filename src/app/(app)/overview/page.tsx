"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getOrgOverview } from "@/lib/queries/org-overview";
import { getBranchComparison } from "@/lib/queries/branch-analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";

const GREEN = "#58d68d", AMBER = "#e8a35a", RED = "#ec7063", GOLD = "#d4a847";

export default function OverviewPage() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [cmp, setCmp] = useState<any>(null);

  useEffect(() => {
    getOrgOverview().then((r) => {
      if (r.ok) setData(r);
      else setDenied(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { getBranchComparison({ period }).then((r) => setCmp(r.ok ? r : null)); }, [period]);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("org.ownersOnly")}</div>;

  const rateColor = (r: number | null) => r == null ? "var(--gray)" : r >= 95 ? GREEN : r >= 85 ? AMBER : RED;

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🏢" size={22} /> {t("org.title")}</div>
      <div className="page-sub">{t("org.subtitle")}</div>

      {loading || !data ? (
        <><div style={{ margin: "8px 0 14px" }}><StatsSkeleton count={3} /></div><Skeleton height={220} radius={14} /></>
      ) : (
        <>
          {/* totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "6px 0 10px" }}>
            <Stat value={data.totals.branches} label={t("org.branches")} />
            <Stat value={data.totals.employees} label={t("org.employees")} />
            <Stat value={data.totals.workingNow} label={t("org.workingNow")} color={GREEN} />
            <Stat value={`${data.totals.attended}/${data.totals.scheduled}`} label={t("org.attendanceToday")} color={GOLD} />
            <Stat value={data.totals.issues} label={t("org.issues")} color={data.totals.issues ? AMBER : "var(--white)"} />
            <Stat value={data.expiringDocs} label={t("org.expiringDocs")} color={data.expiringDocs ? AMBER : "var(--white)"} />
          </div>

          {/* signals row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <Link href="/export" className="card" style={{ padding: 13, textDecoration: "none" }}>
              <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("org.payrollStatus")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: data.payroll.approved === data.payroll.total ? GREEN : AMBER }}>
                {data.payroll.approved}/{data.payroll.total} <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400 }}>{t("org.approved")}</span>
              </div>
            </Link>
            <Link href="/kiosks" className="card" style={{ padding: 13, textDecoration: "none" }}>
              <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("org.systemHealth")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: data.health.status === "ok" ? GREEN : AMBER }}>
                {data.health.status === "ok" ? `✓ ${t("org.healthOk")}` : `${data.health.kiosksOffline} ${t("org.kiosksOffline")}`}
              </div>
            </Link>
          </div>

          {/* ranking */}
          <div className="section-label">{t("org.ranking")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.ranking.map((b: any) => (
              <div key={b.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: b.rank === 1 ? GOLD : "var(--gray)", width: 26, textAlign: "center" }}>{b.rank}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "var(--gray)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon e="🟢" size={10} color="#58d68d" />{b.workingNow}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon e="👥" size={11} />{b.employees}</span>
                      {b.issues > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#e8a35a" }}><Icon e="⚠" size={11} />{b.issues}</span>}
                      {b.expiringDocs > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon e="📄" size={11} />{b.expiringDocs}</span>}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: rateColor(b.attendanceRate) }}>{b.attendanceRate == null ? "—" : `${b.attendanceRate}%`}</div>
                  <div style={{ fontSize: 9, color: "var(--gray)", textTransform: "uppercase" }}>{b.attendanceRate == null ? t("org.noRoster") : t("org.attendance")}</div>
                </div>
              </div>
            ))}
          </div>
          {/* branch comparison (period) */}
          <div className="section-label" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span>{t("org.compareTitle")}</span>
            <div className="hub-tabs" style={{ margin: 0 }}>
              {(["weekly", "monthly"] as const).map((p) => (
                <button key={p} className={`hub-tab${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{t(`bana.${p}`)}</button>
              ))}
            </div>
          </div>
          {cmp?.ok && (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ color: "var(--gray)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>{t("org.colBranch")}</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", fontWeight: 600 }}>{t("org.colAttendance")}</th>
                  <th style={{ textAlign: "center", padding: "10px 8px", fontWeight: 600 }}>{t("org.colHours")}</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600 }}>{t("org.colCost")}</th>
                </tr></thead>
                <tbody>
                  {cmp.rows.map((b: any) => (
                    <tr key={b.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--white)", fontWeight: 600 }}>{b.name}</td>
                      <td style={{ textAlign: "center", padding: "10px 8px", color: rateColor(b.attendancePct), fontWeight: 700 }}>{b.attendancePct == null ? "—" : `${b.attendancePct}%`}</td>
                      <td style={{ textAlign: "center", padding: "10px 8px", color: "var(--white)" }}>{b.laborHours}h</td>
                      <td style={{ textAlign: "right", padding: "10px 12px", color: "var(--gold)", fontWeight: 600 }}>{b.laborCost ? `€${b.laborCost.toFixed(0)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}