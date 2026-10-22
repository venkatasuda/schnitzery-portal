"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getCompliance } from "@/lib/queries/compliance";
import { Skeleton } from "@/components/Skeleton";
import { Stat } from "@/components/ui";

const ICON: Record<string, string> = { Break: "☕", Rest: "🌙", "Long shift": "⏱" };

export default function CompliancePage() {
  const { t } = useLang();
  const compType = (k: string) => (["Break", "Rest", "Long shift"].includes(k) ? t("compType." + k) : k);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getCompliance().then((r) => {
      if (r.ok) setData(r);
      else if (r.error?.includes("Managers")) setDenied(true);
      setLoading(false);
    });
  }, []);

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const v = data?.violations || [];

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="⚖️" size={22} /> {t("home.compliance")}</h1>
      <div className="page-sub">{t("comp.subtitle")}</div>

      {loading ? (
        <>
          <Skeleton height={70} radius={12} style={{ marginBottom: 14 }} />
          <Skeleton height={150} radius={12} />
        </>
      ) : (
        <>
          {/* summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 16 }}>
            <Stat value={data.counts.breakCount} label={t("comp.breakIssues")} color={data.counts.breakCount > 0 ? "var(--danger)" : "var(--success)"} />
            <Stat value={data.counts.restCount} label={t("comp.restIssues")} color={data.counts.restCount > 0 ? "var(--danger)" : "var(--success)"} />
            <Stat value={data.counts.longCount} label={t("comp.over10h")} color={data.counts.longCount > 0 ? "var(--warn)" : "var(--success)"} />
          </div>

          {v.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div className="u-mb-2"><Icon e="✅" size={30} color="var(--success)" /></div>
              <div className="tone-success t-lg fw-7">{t("comp.allCompliant")}</div>
              <div className="u-muted t-xs mt-2">
                {t("comp.checkedNote", { n: data.checked })}
              </div>
            </div>
          ) : (
            <>
              <div className="section-label">{t("comp.issuesHeader", { n: v.length, c: data.checked })}</div>
              <div className="card p-2">
                {v.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < v.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                    <Icon e={ICON[item.type] || "⚠️"} size={18} />
                    <div className="u-flex1">
                      <div className="ui-strong">
                        {item.name} <span className="fw-4 t-xs u-muted">· {item.date}</span>
                      </div>
                      <div style={{ fontSize: 12, color: item.severity === "high" ? "var(--danger)" : "var(--warn)" }}>{compType(item.type)} — {item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* rules reference */}
          <div className="card" style={{ marginTop: 14, fontSize: 12, color: "var(--gray)", lineHeight: 1.7 }}>
            <div className="fw-7 u-text mb-2">{t("comp.rulesTitle")}</div>
            {t("comp.ruleBreak")}<br />
            {t("comp.ruleRest")}<br />
            {t("comp.ruleMax")}<br />
            <span style={{ fontSize: 12, opacity: 0.8 }}>{t("comp.ruleNote")}</span>
          </div>
        </>
      )}

      <Link className="ui-back-link" href="/">{t("approvals.back")}</Link>
    </div>
  );
}

