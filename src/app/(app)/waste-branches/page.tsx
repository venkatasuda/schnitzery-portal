"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getWasteByBranch } from "@/lib/queries/waste";

const eur = (n: number) => "€" + (Math.round((n || 0) * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WasteByBranchPage() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setLoading(true);
    getWasteByBranch(days).then((r) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Owners")) setDenied(true);
      setLoading(false);
    });
  }, [days]);

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("wbranch.ownersOnly")}</div>;
  }

  const rows = data?.rows || [];
  const max = Math.max(1, ...rows.map((r: any) => r.value));

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🗑️" size={22} /> {t("wbranch.title")}</div>
      <div className="page-sub">{t("wbranch.subtitle")}</div>

      <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: days === d ? "var(--gold)" : "rgba(255,255,255,0.06)", color: days === d ? "#1a0e0e" : "var(--gray)" }}>
            {t("wbranch.days", { n: d })}
          </button>
        ))}
      </div>

      {loading ? <CardSkeleton /> : rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("wbranch.none")}</div>
      ) : (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("wbranch.total")}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#ec7063" }}>{eur(data.total)}</div>
          </div>

          {rows.map((r: any, i: number) => (
            <div key={r.branchId} className="card" style={{ padding: 14, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>
                  <span style={{ color: i === 0 ? "#ec7063" : "var(--gray)", marginRight: 6 }}>#{i + 1}</span>{r.name}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#ec7063" }}>{eur(r.value)}</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((r.value / max) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#e67e22,#c0392b)" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span>{t("wbranch.entries", { n: r.count })}</span>
                {r.pct != null && <span>{t("wbranch.pctOfSales", { p: r.pct })}</span>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
