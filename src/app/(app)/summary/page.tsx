"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getMonthlySummary } from "@/lib/queries/labor";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { Stat } from "@/components/ui";

const eur = (n: number) => "€" + (n || 0).toLocaleString("de-DE");

// Declared at module scope, NOT inside the page component. A component created
// during render is a brand-new component type on every render, so React
// unmounts and remounts it each time — losing any state and costing DOM work.
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
    // Review finding 10: an export carries completeness with every money figure, so a
    // lower bound never becomes an apparently final amount.
    const head = ["Name", "Team", "Hours", "Shifts", "Late", "Overtime (h)", "Labor cost (EUR)", "Wage confirmed"];
    const lines = [head.join(",")];
    for (const r of data.rows) lines.push([csvCell(r.name), csvCell(r.team), r.hours, r.shifts, r.late, r.overtime, r.laborCost ?? "", r.laborCost == null ? "no" : "yes"].join(","));
    lines.push("");
    const cov = data.coverage, state = (f: { complete: boolean }) => f.complete ? "complete" : "incomplete (lower bound)";
    const kv: [string, any][] = [
      ["Month", data.month],
      ["Sales (EUR)", data.sales], ["Sales status", state(cov.sales)], ["Open days without sales", cov.sales.missing.salesDays ?? 0],
      ["Labor cost (EUR)", data.laborCost], ["Labor cost status", state(cov.labor)], ["Working employees without wage", cov.labor.missing.wages ?? 0],
      ["Labor % (blank = inputs incomplete)", data.laborPct ?? ""],
      ["Purchase spend (EUR)", data.foodSpend], ["Purchase spend status", state(cov.spend)], ["Deliveries without cost", cov.spend.missing.costs ?? 0],
      ["Purchase spend / sales % (blank = inputs incomplete)", data.foodPct ?? ""],
      ["Labor + purchases % (blank = inputs incomplete)", data.primePct ?? ""], ["Total hours", data.totalHours],
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
    return <div className="card ui-denied">{t("summary.managersOnly")}</div>;
  }

  const primeColor = data?.primePct == null ? "var(--gray)" : data.primePct <= 60 ? "#27ae60" : data.primePct <= 68 ? "#d4a847" : "#e74c3c";

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📊" size={22} /> {t("summary.title")}</h1>
      <div className="page-sub">{t("summary.subtitle")}</div>

      <Link href="/simulator" className="card" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", margin: "12px 0 0" }}>
        <Icon e="🎛️" size={18} color="var(--gold)" />
        <div className="u-flex1">
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{t("summary.simulator")}</div>
          <div className="ui-muted">{t("summary.simulatorSub")}</div>
        </div>
        <span className="u-muted">›</span>
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        <select aria-label={t("summary.month")} value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid var(--border)", fontSize: 14 }}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={downloadCsv} disabled={!data} style={{ padding: "9px 14px", borderRadius: 8, background: "var(--accent-soft)", color: "var(--gold-ink)", border: "1px solid var(--accent-line)", fontSize: 13, fontWeight: 600, cursor: data ? "pointer" : "default" }}>{t("summary.downloadCsv")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : !data ? (
        <div className="card ui-empty-msg">{t("summary.noData")}</div>
      ) : (
        <>
          {data.hasSales && !data.complete && (
            <div role="status" className="card" style={{ marginBottom: 12, fontSize: 12, color: "var(--gold-ink)", borderColor: "var(--accent-line)" }}>
              {[data.coverage.labor.missing.wages ? t("business.missingWages", { n: data.coverage.labor.missing.wages }) : "", data.coverage.sales.missing.salesDays ? t("business.missingSalesDays", { n: data.coverage.sales.missing.salesDays }) : "", data.coverage.spend.missing.costs ? t("business.missingCosts", { n: data.coverage.spend.missing.costs }) : ""].filter(Boolean).join(" · ")}
            </div>
          )}
          {!data.hasSales && (
            <div className="card" style={{ marginBottom: 12, fontSize: 12, color: "var(--gold-ink)", borderColor: "var(--accent-line)" }}>{t("summary.needSales")}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
            <Stat label={t("summary.sales")} value={eur(data.sales)} />
            <Stat label={t("summary.primePct")} value={data.primePct != null ? `${data.primePct}%` : "—"} color={primeColor} sub={t("summary.primeNote")} />
            <Stat label={t("summary.laborPct")} value={data.laborPct != null ? `${data.laborPct}%` : "—"} sub={(data.coverage.labor.complete ? "" : "≥ ") + eur(data.laborCost)} />
            <Stat label={t("summary.foodPct")} value={data.foodPct != null ? `${data.foodPct}%` : "—"} sub={(data.coverage.spend.complete ? "" : "≥ ") + eur(data.foodSpend)} />
            <Stat label={t("summary.overtime")} value={`${data.overtimeHrs}h`} />
            <Stat label={t("summary.lateRate")} value={data.lateRate != null ? `${data.lateRate}%` : "—"} />
            <Stat label={t("summary.totalHours")} value={`${data.totalHours}h`} />
            <Stat label={t("summary.shifts")} value={String(data.shifts)} />
          </div>

          <div className="card" style={{ marginTop: 6 }}>
            <div className="card-title">{t("summary.staffBreakdown")}</div>
            {data.rows.length === 0 ? (
              <div style={{ color: "var(--gray)", fontSize: 13, padding: "8px 0" }}>{t("summary.noStaffData")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("summary.name")}</th>
                      <th className="u-right" scope="col">{t("summary.hours")}</th>
                      <th className="u-right" scope="col">{t("summary.ot")}</th>
                      <th className="u-right" scope="col">{t("summary.late")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="u-text">{r.name}<span className="ui-muted"> · {r.team}</span></td>
                        <td className="u-right">{r.hours}h</td>
                        <td style={{ textAlign: "right", color: r.overtime > 0 ? "var(--danger)" : "var(--gray)" }}>{r.overtime > 0 ? `${r.overtime}h` : "—"}</td>
                        <td style={{ textAlign: "right", color: r.late > 0 ? "var(--warn)" : "var(--gray)" }}>{r.late || "—"}</td>
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