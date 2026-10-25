"use client";

import { formatEur } from "@/lib/format";
import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getWasteByBranch } from "@/lib/queries/waste";


export default function WasteByBranchPage() {
  const { t, locale } = useLang();
  const eur = (n: number) => formatEur((n || 0), locale, 2);
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
    return <div className="card ui-denied">{t("wbranch.ownersOnly")}</div>;
  }

  const rows = data?.rows || [];
  const max = Math.max(1, ...rows.map((r: any) => r.value));

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🗑️" size={22} /> {t("wbranch.title")}</h1>
      <div className="page-sub">{t("wbranch.subtitle")}</div>

      <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: days === d ? "var(--action)" : "rgba(255,255,255,0.06)", color: days === d ? "var(--on-action)" : "var(--gray)" }}>
            {t("wbranch.days", { n: d })}
          </button>
        ))}
      </div>

      {loading ? <CardSkeleton /> : rows.length === 0 ? (
        <div className="card ui-empty-msg">{t("wbranch.none")}</div>
      ) : (
        <>
          <div className="card p-4 mb-3">
            <div className="ui-muted">{t("wbranch.total")}</div>
            <div className="t-2xl fw-7 tone-danger">{eur(data.total)}</div>
          </div>

          {rows.map((r: any, i: number) => (
            <div key={r.branchId} className="card p-4 mb-2">
              <div className="d-flex jc-sb ai-b mb-2">
                <span className="t-lg fw-6 u-text">
                  <span className={`mr-2 ${i === 0 ? "tone-danger" : "u-muted"}`.trim()}>#{i + 1}</span>{r.name}
                </span>
                <span className="t-lg fw-7 tone-danger">{eur(r.value)}</span>
              </div>
              <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((r.value / max) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#e67e22,#c0392b)" }} />
              </div>
              <div className="t-xs u-muted mt-2 d-flex jc-sb">
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
