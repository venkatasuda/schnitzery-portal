"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import Link from "next/link";
import { getBranchStats } from "@/lib/queries/owner";

export default function BranchesPage() {
  const { t } = useLang();
  const [branches, setBranches] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const res = await getBranchStats();
      if (!res.ok) { if (res.error?.includes("Owners")) setDenied(true); setLoading(false); return; }
      setBranches(res.branches); setTotals(res.totals); setRole(res.role || "");
      setLoading(false);
    })();
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto" }}>{t("branches.ownersOnly")}</div>;

  const roleLabel = role === "brand_owner" ? t("branches.allBranches") : t("branches.myFranchise");
  const filtered = branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || (b.address || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1 className="page-title u-row"><Icon e="🏢" size={22} /> {roleLabel}</h1>
      <p className="page-sub">{t("branches.subtitle", { n: totals?.branches || 0 })}</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : (
        <>
          {/* ORG TOTALS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 18 }}>
            <Total label={t("branches.branches")} value={totals.branches} />
            <Total label={t("branches.totalStaff")} value={totals.staff} color="var(--info)" />
            <Total label={t("branches.workingNow")} value={totals.workingNow} color="var(--success)" />
            <Total label={t("branches.pendingLeave")} value={totals.pendingLeave} color={totals.pendingLeave ? "#d4a847" : "var(--success)"} />
            <Total label={t("branches.openIncidents")} value={totals.openIncidents} color={totals.openIncidents ? "var(--danger)" : "var(--success)"} />
          </div>

          <input aria-label={t("branches.search")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("branches.search")}
            style={{ width: "100%", padding: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box", marginBottom: 14 }} />

          <div className="section-label">{t("branches.sectionBranches")}</div>
          {filtered.map((b) => (
            <Link key={b.id} href={`/branches/${b.id}`} className="feature-card" style={{ alignItems: "stretch" }}>
              <div className="u-flex1">
                <div className="feature-title">{b.name}</div>
                <div className="feature-sub">{b.address || "—"}</div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                  <Mini label={t("branches.miniStaff")} value={b.staff} />
                  <Mini label={t("branches.miniWorking")} value={b.workingNow} color="var(--success)" />
                  {b.pendingLeave > 0 && <Mini label={t("branches.miniLeave")} value={b.pendingLeave} color="var(--gold-ink)" />}
                  {b.openIncidents > 0 && <Mini label={t("branches.miniIncidents")} value={b.openIncidents} color="var(--danger)" />}
                </div>
              </div>
              <span className="feature-chev" style={{ alignSelf: "center" }}>›</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

function Total({ label, value, color }: any) {
  return (
    <div className="card" style={{ textAlign: "center", marginBottom: 0, padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
      <div className="ui-meta">{label}</div>
    </div>
  );
}
function Mini({ label, value, color }: any) {
  return <span className="ui-muted"><b style={{ color: color || "var(--text)" }}>{value}</b> {label}</span>;
}