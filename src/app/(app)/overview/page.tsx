"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getOrgOverview } from "@/lib/queries/org-overview";
import { getBranchComparison } from "@/lib/queries/branch-analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";
import { Stat } from "@/components/ui";

const GREEN = "var(--success)", AMBER = "var(--warn)", RED = "var(--danger)", GOLD = "var(--gold-ink)";

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

  if (denied) return <div className="card ui-denied">{t("org.ownersOnly")}</div>;

  const rateColor = (r: number | null) => r == null ? "var(--gray)" : r >= 95 ? GREEN : r >= 85 ? AMBER : RED;

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🏢" size={22} /> {t("org.title")}</h1>
      <div className="page-sub">{t("org.subtitle")}</div>

      {loading || !data ? (
        <><div style={{ margin: "8px 0 14px" }}><StatsSkeleton count={3} /></div><Skeleton height={220} radius={14} /></>
      ) : (
        <>
          {/* totals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, margin: "6px 0 10px" }}>
            <Stat value={data.totals.branches} label={t("org.branches")} />
            <Stat value={data.totals.employees} label={t("org.employees")} />
            <Stat value={data.totals.workingNow} label={t("org.workingNow")} color={GREEN} />
            <Stat value={`${data.totals.attended}/${data.totals.scheduled}`} label={t("org.attendanceToday")} color={GOLD} />
            <Stat value={data.totals.issues} label={t("org.issues")} color={data.totals.issues ? AMBER : "var(--white)"} />
            <Stat value={data.expiringDocs} label={t("org.expiringDocs")} color={data.expiringDocs ? AMBER : "var(--white)"} />
          </div>

          {/* signals row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
            <Link href="/export" className="card" style={{ padding: 13, textDecoration: "none" }}>
              <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("org.payrollStatus")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: data.payroll.approved === data.payroll.total ? GREEN : AMBER }}>
                {data.payroll.approved}/{data.payroll.total} <span className="ui-muted">{t("org.approved")}</span>
              </div>
            </Link>
            <Link href="/kiosks" className="card" style={{ padding: 13, textDecoration: "none" }}>
              <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("org.systemHealth")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: data.health.status === "ok" ? GREEN : AMBER }}>
                {data.health.status === "ok" ? `✓ ${t("org.healthOk")}` : `${data.health.kiosksOffline} ${t("org.kiosksOffline")}`}
              </div>
            </Link>
          </div>

          {/* ranking */}
          <div className="section-label">{t("org.ranking")}</div>
          <div className="u-stack">
            {data.ranking.map((b: any) => (
              <div key={b.id} className="card p-3 d-flex ai-c gap-3">
                <div style={{ fontSize: 16, fontWeight: 800, color: b.rank === 1 ? GOLD : "var(--gray)", width: 26, textAlign: "center" }}>{b.rank}</div>
                <div className="u-grow">
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                  <div className="ui-muted">
                    <span className="d-iflex ai-c gap-2 f-wrap">
                      <span className="d-iflex ai-c gap-h"><Icon e="🟢" size={10} color="var(--success)" />{b.workingNow}</span>
                      <span className="d-iflex ai-c gap-h"><Icon e="👥" size={11} />{b.employees}</span>
                      {b.issues > 0 && <span className="d-iflex ai-c gap-h tone-warn"><Icon e="⚠" size={11} />{b.issues}</span>}
                      {b.expiringDocs > 0 && <span className="d-iflex ai-c gap-h"><Icon e="📄" size={11} />{b.expiringDocs}</span>}
                    </span>
                  </div>
                </div>
                <div className="u-right">
                  <div style={{ fontSize: 17, fontWeight: 700, color: rateColor(b.attendanceRate) }}>{b.attendanceRate == null ? "—" : `${b.attendanceRate}%`}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase" }}>{b.attendanceRate == null ? t("org.noRoster") : t("org.attendance")}</div>
                </div>
              </div>
            ))}
          </div>
          {/* branch comparison (period) */}
          <div className="section-label mt-4 d-flex ai-c jc-sb gap-3">
            <span>{t("org.compareTitle")}</span>
            <div className="hub-tabs u-m0">
              {(["weekly", "monthly"] as const).map((p) => (
                <button key={p} className={`hub-tab${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{t(`bana.${p}`)}</button>
              ))}
            </div>
          </div>
          {cmp?.ok && (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr>
                  <th className="u-left fw-6" scope="col">{t("org.colBranch")}</th>
                  <th className="u-center u-semibold" scope="col">{t("org.colAttendance")}</th>
                  <th className="u-center u-semibold" scope="col">{t("org.colHours")}</th>
                  <th className="u-right fw-6" scope="col">{t("org.colCost")}</th>
                </tr></thead>
                <tbody>
                  {cmp.rows.map((b: any) => (
                    <tr className="bt-1" key={b.id}>
                      <td className="ui-strong-inline">{b.name}</td>
                      <td style={{ textAlign: "center", color: rateColor(b.attendancePct), fontWeight: 700 }}>{b.attendancePct == null ? "—" : `${b.attendancePct}%`}</td>
                      <td className="u-center u-text">{b.laborHours}h</td>
                      <td className="u-right tone-action fw-6">{b.laborCost ? `${b.missingWageStaff ? "≥ " : ""}€${b.laborCost.toFixed(0)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold-ink)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

