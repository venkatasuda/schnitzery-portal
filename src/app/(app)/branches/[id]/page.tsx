"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBranchDetail } from "@/lib/queries/owner";
import { ErrorState, Stat, StatGrid } from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import { serverText } from "@/lib/i18n/serverMessages";

const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier", "Dishwashing"];
const TEAM_COLORS: Record<string, string> = { Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)", Cashier: "#9b59b6" };

export default function BranchDetailPage() {
  const { t, locale } = useLang();
  const branchId = useParams()?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await getBranchDetail(branchId);
      if (res.ok) setData(res); else setError(serverText(res.error ?? "", locale) || t("common.loadFailed"));
    } catch { setError(t("common.loadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = <Link href="/branches" className="ui-text-link t-sm">{t("branches.backAll")}</Link>;
  if (loading) return <CardSkeleton rows={3} />;
  if (error) return <div>{back}<div className="mt-4"><ErrorState message={error} onRetry={load} retryLabel={t("business.retry")} /></div></div>;

  const { branch, stats, staffList } = data;
  return (
    <div>
      {back}
      <h1 className="page-title mt-3">{branch.name}</h1>
      <p className="page-sub">{branch.address || "—"}{branch.franchise ? ` · ${branch.franchise}` : ""}</p>

      <StatGrid label={branch.name}>
        <Stat label={t("branches.totalStaff")} value={stats.staff} tone="info" />
        <Stat label={t("branches.workingNow")} value={stats.workingNow} tone="success" />
        <Stat label={t("branches.pendingLeave")} value={stats.pendingLeave} tone={stats.pendingLeave ? "warn" : "default"} />
        <Stat label={t("branches.openIncidents")} value={stats.openIncidents} tone={stats.openIncidents ? "danger" : "default"} />
        <Stat label={t("branches.lowStock")} value={stats.lowStock} tone={stats.lowStock ? "warn" : "default"} />
      </StatGrid>

      <div className="section-label">{t("branches.team", { n: staffList.length })}</div>
      {staffList.length === 0 ? (
        <div className="card ui-empty-msg">{t("branches.noStaff")}</div>
      ) : (
        staffList.map((s: any) => (
          <div key={s.id} className="card mb-2 d-flex ai-c gap-4 p-4">
            <div className="ui-avatar" style={{ background: TEAM_COLORS[s.team] || "#666" }} aria-hidden="true">{(s.full_name || "?")[0].toUpperCase()}</div>
            <div className="u-flex1">
              <div className="ui-strong">{s.full_name}</div>
              <div className="ui-muted">{s.team ? (TEAMS.includes(s.team) ? t("teams." + s.team) : s.team) : t("branches.noTeam")} · {t(`roles.${s.role}`)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
