"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getOrgOverview } from "@/lib/queries/org-overview";
import { getBranchComparison } from "@/lib/queries/branch-analytics";
import { Skeleton, StatsSkeleton } from "@/components/Skeleton";
import { Stat, StatGrid, type Tone } from "@/components/ui";

const rateTone = (r: number | null): Tone => r == null ? "default" : r >= 95 ? "success" : r >= 85 ? "warn" : "danger";

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

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🏢" size={22} /> {t("org.title")}</h1>
      <div className="page-sub">{t("org.subtitle")}</div>

      {loading || !data ? (
        <><div className="mb-4"><StatsSkeleton count={3} /></div><Skeleton height={220} radius={14} /></>
      ) : (
        <>
          {/* totals */}
          <StatGrid label={t("org.title")}>
            <Stat value={data.totals.branches} label={t("org.branches")} />
            <Stat value={data.totals.employees} label={t("org.employees")} />
            <Stat value={data.totals.workingNow} label={t("org.workingNow")} tone="success" />
            <Stat value={`${data.totals.attended}/${data.totals.scheduled}`} label={t("org.attendanceToday")} tone="action" />
            <Stat value={data.totals.issues} label={t("org.issues")} tone={data.totals.issues ? "warn" : "default"} />
            <Stat value={data.expiringDocs} label={t("org.expiringDocs")} tone={data.expiringDocs ? "warn" : "default"} />
          </StatGrid>

          {/* signals row */}
          <div className="ui-grid-2">
            <Link href="/export" className="card ui-link-card">
              <span className="ui-stat-label">{t("org.payrollStatus")}</span>
              <strong className={data.payroll.approved === data.payroll.total ? "tone-success" : "tone-warn"}>
                {data.payroll.approved}/{data.payroll.total} <span className="ui-muted">{t("org.approved")}</span>
              </strong>
            </Link>
            <Link href="/kiosks" className="card ui-link-card">
              <span className="ui-stat-label">{t("org.systemHealth")}</span>
              <strong className={data.health.status === "ok" ? "tone-success" : "tone-warn"}>
                {data.health.status === "ok" ? `✓ ${t("org.healthOk")}` : `${data.health.kiosksOffline} ${t("org.kiosksOffline")}`}
              </strong>
            </Link>
          </div>

          {/* ranking */}
          <div className="section-label">{t("org.ranking")}</div>
          <div className="u-stack">
            {data.ranking.map((b: any) => (
              <div key={b.id} className="card p-3 d-flex ai-c gap-3">
                <div className={`org-rank${b.rank === 1 ? " first" : ""}`}>{b.rank}</div>
                <div className="u-grow">
                  <div className="fw-6 u-ellipsis">{b.name}</div>
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
                  <div className={`t-lg fw-7 tone-${rateTone(b.attendanceRate)}`}>{b.attendanceRate == null ? "—" : `${b.attendanceRate}%`}</div>
                  <div className="ui-stat-label">{b.attendanceRate == null ? t("org.noRoster") : t("org.attendance")}</div>
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
            <div className="card ui-flush">
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
                      <td className={`u-center fw-7 tone-${rateTone(b.attendancePct)}`}>{b.attendancePct == null ? "—" : `${b.attendancePct}%`}</td>
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

      <Link href="/" className="ui-back-link">{t("approvals.back")}</Link>
    </div>
  );
}

