"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";
import { getBranchExpiringDocs } from "@/lib/queries/doc-expiry";
import { CardSkeleton } from "@/components/Skeleton";

export default function ExpiringDocsPage() {
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getBranchExpiringDocs().then((r) => {
      if (r.ok) setItems(r.items || []);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  function statusOf(days: number) {
    if (days < 0) return { label: t("staffd.expired", { n: Math.abs(days) }), color: "#ec7063" };
    if (days === 0) return { label: t("exp.expiresToday"), color: "#ec7063" };
    return { label: t("staffd.expiresIn", { n: days }), color: days <= 30 ? "#ec7063" : "#e8a35a" };
  }

  return (
    <div className="fade-up">
      <div className="page-title">📑 {t("exp.title")}</div>
      <div className="page-sub">{t("exp.subtitle")}</div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
          <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>{t("exp.nothing")}</div>
          <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>{t("exp.nothingSub")}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {items.map((it, i) => {
            const st = statusOf(it.days);
            return (
              <Link key={it.id} href={`/staff/${it.userId}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", borderBottom: i < items.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none", textDecoration: "none" }}>
                <span style={{ fontSize: 18 }}>📑</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>{it.docLabel}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{st.label}</div>
                  <div style={{ fontSize: 10, color: "var(--gray)" }}>{new Date(it.expiry).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}</div>
                </div>
                <span className="feature-chev">›</span>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}