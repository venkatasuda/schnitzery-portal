"use client";

import { fmtDay } from "@/lib/time/berlinDate";
import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getShiftConflicts } from "@/lib/queries/shift-conflicts";
import { CardSkeleton } from "@/components/Skeleton";

export default function ConflictsPage() {
  const { t, locale } = useLang();
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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="⚠️" size={22} /> {t("conf.title")}</h1>
      <div className="page-sub">{t("conf.subtitle")}</div>

      {loading ? (
        <CardSkeleton rows={3} />
      ) : !d || d.total === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <div className="u-mb-2"><Icon e="✅" size={34} color="var(--success)" /></div>
          <div className="tone-success t-lg fw-7">{t("conf.none")}</div>
          <div className="u-muted t-sm mt-2">{t("conf.noneSub")}</div>
        </div>
      ) : (
        <div className="d-flex f-col gap-3">
          {d.conflicts.map((c: any, i: number) => (
            <div key={i} className="card" style={{ padding: 14, borderLeft: "3px solid #ec7063" }}>
              <Link href={`/staff/${c.userId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 10 }}>
                <Icon e="👤" size={18} />
                <div className="u-flex1">
                  <div className="fw-7 u-text">{c.name}</div>
                  <div className="ui-muted">{fmtDay(c.date, locale)}{c.crossBranch ? ` · ${t("conf.crossBranch")}` : ""}</div>
                </div>
                <span className="u-muted">›</span>
              </Link>
              <div className="u-stack tight">
                {c.shifts.map((s: any, j: number) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--dark3)", borderRadius: 8, fontSize: 13 }}>
                    <span className="tone-danger">●</span>
                    <span className="u-flex1">{s.branch} · {s.team} · {s.shift}</span>
                    <span style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link className="ui-back-link" href="/action">{t("approvals.back")}</Link>
    </div>
  );
}