"use client";

import { formatEur } from "@/lib/format";
import { healthTone } from "@/lib/owner/insights";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { EmptyState, ErrorState, Segmented } from "@/components/ui";
import { getBranchComparison } from "@/lib/queries/branch-analytics";
import { useLang } from "@/components/LanguageProvider";
import { serverText } from "@/lib/i18n/serverMessages";
import { getMyBranchesOverview } from "@/lib/queries/my-branches";
import { setActiveBranch } from "@/lib/queries/branch-switch";
import { toast } from "@/components/Toast";

type Row = { id: string; name: string; health: number | null; workingNow: number | null; scheduled: number | null; late: number | null; absent: number | null; laborHours: number | null; toApprove: number | null };

// "All my branches": read-only, one row per branch. Work happens inside a branch,
// so the only action is "Open", which switches the active branch.
export default function MyBranchesPage() {
  const { t, locale } = useLang();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [cmp, setCmp] = useState<{ id: string; name: string; attendancePct: number | null; laborHours: number; laborCost: number; missingWageStaff?: number }[] | null>(null);
  useEffect(() => {
    setCmp(null);
    getBranchComparison({ period }).then((r) => setCmp(r.ok ? (r.rows as NonNullable<typeof cmp>) : [])).catch(() => setCmp([]));
  }, [period]);

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await getMyBranchesOverview();
      if (r.ok) setRows(r.rows); else setError(serverText(r.error ?? "", locale) || t("common.loadFailed"));
    } catch { setError(t("common.loadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(id: string) {
    setOpening(id);
    const r = await setActiveBranch(id).catch(() => ({ ok: false as const, error: t("common.loadFailed") }));
    if (!r.ok) { setOpening(null); toast(r.error ?? t("common.loadFailed"), "error"); return; }
    router.push("/"); router.refresh();
  }

  const n = (v: number | null) => (v == null ? "—" : String(v));

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🏪" size={22} /> {t("mybr.title")}</h1>
      <p className="page-sub">{t("mybr.subtitle")}</p>
      {loading ? <CardSkeleton rows={3} />
        : error ? <ErrorState message={error} onRetry={load} retryLabel={t("business.retry")} />
        : rows.length === 0 ? <EmptyState title={t("mybr.none")} />
        : (
          <div className="table-scroll" role="region" aria-label={t("mybr.title")} tabIndex={0}>
            <table className="data-table">
              <thead><tr>
                <th scope="col">{t("org.colBranch")}</th>
                <th scope="col" className="numeric" title={t("insights.healthNote")}>{t("insights.score")}</th>
                <th scope="col" className="numeric">{t("org.workingNow")}</th>
                <th scope="col" className="numeric">{t("mybr.scheduled")}</th>
                <th scope="col" className="numeric">{t("home.statLate")}</th>
                <th scope="col" className="numeric">{t("mybr.absent")}</th>
                <th scope="col" className="numeric">{t("mybr.hours")}</th>
                <th scope="col" className="numeric">{t("mybr.toApprove")}</th>
                <th scope="col"><span className="sr-only">{t("mybr.open")}</span></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="u-left">{r.name}</th>
                    <td className={`numeric fw-7 ins-pct ${healthTone(r.health)}`}>{n(r.health)}</td>
                    <td className="numeric">{n(r.workingNow)}</td>
                    <td className="numeric">{n(r.scheduled)}</td>
                    <td className={`numeric${r.late ? " tone-warn" : ""}`}>{n(r.late)}</td>
                    <td className={`numeric${r.absent ? " tone-danger" : ""}`}>{n(r.absent)}</td>
                    <td className="numeric">{r.laborHours == null ? "—" : `${r.laborHours}h`}</td>
                    <td className={`numeric${r.toApprove ? " fw-7 tone-action" : ""}`}>{n(r.toApprove)}</td>
                    <td className="numeric">
                      <button className="btn-secondary ui-btn-sm" disabled={opening !== null} onClick={() => open(r.id)} aria-label={`${t("mybr.open")}: ${r.name}`}>
                        {opening === r.id ? "…" : t("mybr.open")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {rows.length > 1 && (
        <section className="mt-5">
          <div className="d-flex jc-sb ai-c f-wrap gap-3 mb-3">
            <h2 className="section-label u-m0">{t("org.compareTitle")}</h2>
            <Segmented label={t("org.compareTitle")} value={period} onChange={setPeriod} options={[{ value: "weekly", label: t("bana.weekly") }, { value: "monthly", label: t("bana.monthly") }]} />
          </div>
          {cmp == null ? <CardSkeleton rows={2} /> : cmp.length === 0 ? <EmptyState title={t("common.loadFailed")} /> : (
            <div className="table-scroll" role="region" aria-label={t("org.compareTitle")} tabIndex={0}>
              <table className="data-table">
                <thead><tr>
                  <th scope="col">{t("org.colBranch")}</th>
                  <th scope="col" className="numeric">{t("org.colAttendance")}</th>
                  <th scope="col" className="numeric">{t("org.colHours")}</th>
                  <th scope="col" className="numeric">{t("org.colCost")}</th>
                </tr></thead>
                <tbody>{cmp.map((b) => (
                  <tr key={b.id}>
                    <th scope="row" className="u-left">{b.name}</th>
                    <td className="numeric">{b.attendancePct == null ? "—" : `${b.attendancePct}%`}</td>
                    <td className="numeric">{b.laborHours}h</td>
                    <td className="numeric">{b.laborCost ? `${b.missingWageStaff ? "≥ " : ""}${formatEur(b.laborCost, locale, 0)}` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
