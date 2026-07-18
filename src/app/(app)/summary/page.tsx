"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getMonthlySummary } from "@/lib/queries/labor";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

const eur = (n: number) => "€" + (n || 0).toLocaleString("de-DE");

// Declared at module scope, NOT inside the page component. A component created
// during render is a brand-new component type on every render, so React
// unmounts and remounts it each time — losing any state and costing DOM work.
function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--gray)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--white)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
const csvCell = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;

function lastMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: `${MON[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

export default function SummaryPage() {
  const { t } = useLang();
  const months = lastMonths(6);
  const [month, setMonth] = useState(months[0].value);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  async function load(m: string) {
    setLoading(true);
    const res = await getMonthlySummary(m);
    if (res.ok) setData(res);
    else if (res.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    setLoading(false);
  }
  useEffect(() => { load(month); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [month]);

  function downloadCsv() {
    if (!data) return;
    const head = ["Name", "Team", "Hours", "Shifts", "Late", "Overtime (h)", "Labor cost (EUR)"];
    const lines = [head.join(",")];
    for (const r of data.rows) lines.push([csvCell(r.name), csvCell(r.team), r.hours, r.shifts, r.late, r.overtime, r.laborCost].join(","));
    lines.push("");
    const kv: [string, any][] = [
      ["Month", data.month], ["Sales (EUR)", data.sales],
      ["Labor cost (EUR)", data.laborCost], ["Labor %", data.laborPct ?? ""],
      ["Food spend (EUR)", data.foodSpend], ["Food cost %", data.foodPct ?? ""],
      ["Prime cost %", data.primePct ?? ""], ["Total hours", data.totalHours],
      ["Shifts", data.shifts], ["Overtime hours", data.overtimeHrs], ["Late rate %", data.lateRate ?? ""],
    ];
    for (const [k, v] of kv) lines.push([csvCell(k), csvCell(v)].join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `schnitzery-summary-${data.month}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast(t("summary.exported"), "success");
  }

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("summary.managersOnly")}</div>;
  }

  const primeColor = data?.primePct == null ? "var(--gray)" : data.primePct <= 60 ? "#27ae60" : data.primePct <= 68 ? "#d4a847" : "#e74c3c";

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📊" size={22} /> {t("summary.title")}</div>
      <div className="page-sub">{t("summary.subtitle")}</div>

      <Link href="/simulator" className="card" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", margin: "12px 0 0" }}>
        <Icon e="🎛️" size={18} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{t("summary.simulator")}</div>
          <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("summary.simulatorSub")}</div>
        </div>
        <span style={{ color: "var(--gray)" }}>›</span>
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14 }}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={downloadCsv} disabled={!data} style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(212,168,71,0.12)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 13, fontWeight: 600, cursor: data ? "pointer" : "default" }}>{t("summary.downloadCsv")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : !data ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("summary.noData")}</div>
      ) : (
        <>
          {!data.hasSales && (
            <div className="card" style={{ marginBottom: 12, fontSize: 12, color: "#d4a847", borderColor: "rgba(212,168,71,0.3)" }}>{t("summary.needSales")}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <Kpi label={t("summary.sales")} value={eur(data.sales)} />
            <Kpi label={t("summary.primePct")} value={data.primePct != null ? `${data.primePct}%` : "—"} color={primeColor} sub={t("summary.primeNote")} />
            <Kpi label={t("summary.laborPct")} value={data.laborPct != null ? `${data.laborPct}%` : "—"} sub={eur(data.laborCost)} />
            <Kpi label={t("summary.foodPct")} value={data.foodPct != null ? `${data.foodPct}%` : "—"} sub={eur(data.foodSpend)} />
            <Kpi label={t("summary.overtime")} value={`${data.overtimeHrs}h`} />
            <Kpi label={t("summary.lateRate")} value={data.lateRate != null ? `${data.lateRate}%` : "—"} />
            <Kpi label={t("summary.totalHours")} value={`${data.totalHours}h`} />
            <Kpi label={t("summary.shifts")} value={String(data.shifts)} />
          </div>

          <div className="card" style={{ marginTop: 6 }}>
            <div className="card-title">{t("summary.staffBreakdown")}</div>
            {data.rows.length === 0 ? (
              <div style={{ color: "var(--gray)", fontSize: 13, padding: "8px 0" }}>{t("summary.noStaffData")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "var(--gray)", textAlign: "left", fontSize: 11 }}>
                      <th style={{ padding: "6px 4px" }}>{t("summary.name")}</th>
                      <th style={{ padding: "6px 4px", textAlign: "right" }}>{t("summary.hours")}</th>
                      <th style={{ padding: "6px 4px", textAlign: "right" }}>{t("summary.ot")}</th>
                      <th style={{ padding: "6px 4px", textAlign: "right" }}>{t("summary.late")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "7px 4px", color: "var(--white)" }}>{r.name}<span style={{ color: "var(--gray)", fontSize: 11 }}> · {r.team}</span></td>
                        <td style={{ padding: "7px 4px", textAlign: "right" }}>{r.hours}h</td>
                        <td style={{ padding: "7px 4px", textAlign: "right", color: r.overtime > 0 ? "#ec7063" : "var(--gray)" }}>{r.overtime > 0 ? `${r.overtime}h` : "—"}</td>
                        <td style={{ padding: "7px 4px", textAlign: "right", color: r.late > 0 ? "#d4a847" : "var(--gray)" }}>{r.late || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}