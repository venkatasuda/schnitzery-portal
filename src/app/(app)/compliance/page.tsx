"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getCompliance } from "@/lib/queries/compliance";
import { Skeleton } from "@/components/Skeleton";

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

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const v = data?.violations || [];

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="⚖️" size={22} /> {t("home.compliance")}</div>
      <div className="page-sub">{t("comp.subtitle")}</div>

      {loading ? (
        <>
          <Skeleton height={70} radius={12} style={{ marginBottom: 14 }} />
          <Skeleton height={150} radius={12} />
        </>
      ) : (
        <>
          {/* summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Stat value={data.counts.breakCount} label={t("comp.breakIssues")} color={data.counts.breakCount > 0 ? "#ec7063" : "#58d68d"} />
            <Stat value={data.counts.restCount} label={t("comp.restIssues")} color={data.counts.restCount > 0 ? "#ec7063" : "#58d68d"} />
            <Stat value={data.counts.longCount} label={t("comp.over10h")} color={data.counts.longCount > 0 ? "#e8a35a" : "#58d68d"} />
          </div>

          {v.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ marginBottom: 8 }}><Icon e="✅" size={30} color="#58d68d" /></div>
              <div style={{ color: "#58d68d", fontSize: 15, fontWeight: 700 }}>{t("comp.allCompliant")}</div>
              <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 6 }}>
                {t("comp.checkedNote", { n: data.checked })}
              </div>
            </div>
          ) : (
            <>
              <div className="section-label">{t("comp.issuesHeader", { n: v.length, c: data.checked })}</div>
              <div className="card" style={{ padding: 8 }}>
                {v.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: i < v.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                    <Icon e={ICON[item.type] || "⚠️"} size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                        {item.name} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--gray)" }}>· {item.date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: item.severity === "high" ? "#ec7063" : "#e8a35a" }}>{compType(item.type)} — {item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* rules reference */}
          <div className="card" style={{ marginTop: 14, fontSize: 12, color: "var(--gray)", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: "var(--white)", marginBottom: 6 }}>{t("comp.rulesTitle")}</div>
            {t("comp.ruleBreak")}<br />
            {t("comp.ruleRest")}<br />
            {t("comp.ruleMax")}<br />
            <span style={{ fontSize: 11, opacity: 0.8 }}>{t("comp.ruleNote")}</span>
          </div>
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,var(--dark3),var(--dark2))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", color: color || "var(--white)", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}