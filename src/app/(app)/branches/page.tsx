"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
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

  if (denied) return <div className="card" style={{ textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("branches.ownersOnly")}</div>;

  const roleLabel = role === "brand_owner" ? t("branches.allBranches") : t("branches.myFranchise");
  const filtered = branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || (b.address || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1 className="page-title">🏢 {roleLabel}</h1>
      <p className="page-sub">{t("branches.subtitle", { n: totals?.branches || 0 })}</p>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : (
        <>
          {/* ORG TOTALS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 18 }}>
            <Total label={t("branches.branches")} value={totals.branches} />
            <Total label={t("branches.totalStaff")} value={totals.staff} color="#3498db" />
            <Total label={t("branches.workingNow")} value={totals.workingNow} color="#58d68d" />
            <Total label={t("branches.pendingLeave")} value={totals.pendingLeave} color={totals.pendingLeave ? "#d4a847" : "#58d68d"} />
            <Total label={t("branches.openIncidents")} value={totals.openIncidents} color={totals.openIncidents ? "#ec7063" : "#58d68d"} />
          </div>

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("branches.search")}
            style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontSize: 14, boxSizing: "border-box", marginBottom: 14 }} />

          <div className="section-label">{t("branches.sectionBranches")}</div>
          {filtered.map((b) => (
            <Link key={b.id} href={`/branches/${b.id}`} className="feature-card" style={{ alignItems: "stretch" }}>
              <div style={{ flex: 1 }}>
                <div className="feature-title">{b.name}</div>
                <div className="feature-sub">{b.address || "—"}</div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                  <Mini label={t("branches.miniStaff")} value={b.staff} />
                  <Mini label={t("branches.miniWorking")} value={b.workingNow} color="#58d68d" />
                  {b.pendingLeave > 0 && <Mini label={t("branches.miniLeave")} value={b.pendingLeave} color="#d4a847" />}
                  {b.openIncidents > 0 && <Mini label={t("branches.miniIncidents")} value={b.openIncidents} color="#ec7063" />}
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
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9a8f8f", marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Mini({ label, value, color }: any) {
  return <span style={{ fontSize: 12, color: "#9a8f8f" }}><b style={{ color: color || "#fff" }}>{value}</b> {label}</span>;
}