"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";
import { getShiftConflicts } from "@/lib/queries/shift-conflicts";
import { CardSkeleton } from "@/components/Skeleton";

export default function ConflictsPage() {
  const { t } = useLang();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getShiftConflicts({ weeks: 2 }).then((r) => {
      if (r.ok) setD(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  return (
    <div className="fade-up">
      <div className="page-title">⚠️ {t("conf.title")}</div>
      <div className="page-sub">{t("conf.subtitle")}</div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : !d || d.total === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ color: "#58d68d", fontSize: 16, fontWeight: 700 }}>{t("conf.none")}</div>
          <div style={{ color: "var(--gray)", fontSize: 13, marginTop: 6 }}>{t("conf.noneSub")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.conflicts.map((c: any, i: number) => (
            <div key={i} className="card" style={{ padding: 14, borderLeft: "3px solid #ec7063" }}>
              <Link href={`/staff/${c.userId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>👤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "var(--white)" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>{c.date}{c.crossBranch ? ` · ${t("conf.crossBranch")}` : ""}</div>
                </div>
                <span style={{ color: "var(--gray)" }}>›</span>
              </Link>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {c.shifts.map((s: any, j: number) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--dark3)", borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: "#ec7063" }}>●</span>
                    <span style={{ flex: 1 }}>{s.branch} · {s.team} · {s.shift}</span>
                    <span style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/action" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}