"use client";

import { formatEur, formatPct } from "@/lib/format";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getMonthlySummary } from "@/lib/queries/labor";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { Stat } from "@/components/ui";


// Declared at module scope, NOT inside the page component. A component created
// during render is a brand-new component type on every render, so React
// unmounts and remounts it each time — losing any state and costing DOM work.
const csvCell = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;

function lastMonths(n: number, locale: string) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: d.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { month: "short", year: "numeric" }) });
  }
  return out;
}

export default function SummaryPage() {
  const { t, locale } = useLang();
  const eur = (n: number) => formatEur((n || 0), locale, "auto");
  const months = lastMonths(6, locale);
  const [month, setMonth] = useState(months[0].value);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  async function load(m: string) {
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    setLoading(true);
    const res = await getMonthlySummary(m);
    if (res.ok) setData(res);
    else if (res.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(month); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [month]);

  // Monthly profit-and-loss sheet for the owner / tax advisor (browser print → PDF).
  // Incomplete figures are printed as "≥" with the reason, never as final amounts.
  function printReport() {
    if (!data) return;
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const cov = data.coverage || {};
    const eur = (v: number | null | undefined, complete = true) => v == null ? "—" : `${complete ? "" : "≥ "}${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)}`;
    const pct = (v: number | null | undefined) => formatPct(v, locale);
    const sales = data.sales ?? null, labour = data.laborCost ?? null, purch = data.foodSpend ?? null;
    const complete = cov.sales?.complete !== false && cov.labor?.complete !== false && cov.spend?.complete !== false;
    const rest = sales != null && labour != null && purch != null ? sales - labour - purch : null;
    const rows: [string, string, boolean?][] = [
      [t("summary.sales"), eur(sales, cov.sales?.complete !== false)],
      [t("summary.labourCost"), cov.labor?.complete === false && !labour ? "—" : eur(labour, cov.labor?.complete !== false)], // no wages at all → unknown, not "≥ 0 €"
      [t("summary.purchases"), eur(purch, cov.spend?.complete !== false)],
      [t("summary.afterPrime"), complete ? eur(rest) : "—", true],
      [t("summary.laborPct"), pct(data.laborPct)], [t("summary.foodPct"), pct(data.foodPct)], [t("summary.primePct"), pct(data.primePct)],
    ];
    const notes = [
      cov.sales?.missing?.salesDays ? t("business.missingSalesDays", { n: cov.sales.missing.salesDays }) : "",
      cov.labor?.missing?.wages ? t("business.missingWages", { n: cov.labor.missing.wages }) : "",
      cov.spend?.missing?.costs ? t("business.missingCosts", { n: cov.spend.missing.costs }) : "",
    ].filter(Boolean);
    const monthName = months.find((m) => m.value === data.month)?.label ?? data.month;
    const w = window.open("", "_blank");
    if (!w) { toast(t("common.loadFailed"), "error"); return; }
    w.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>Schnitzery — ${esc(t("summary.reportTitle"))} ${esc(monthName)}</title><style>
      body{font-family:Arial,sans-serif;color:#222;padding:32px;max-width:640px}h1{font-size:20px;margin:0 0 4px}.m{color:#666;margin-bottom:20px}
      table{border-collapse:collapse;width:100%}td{padding:8px 10px;border-bottom:1px solid #ddd}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
      tr.b td{font-weight:bold;border-top:2px solid #222}.n{margin-top:18px;font-size:12px;color:#8a5a00}.f{margin-top:28px;font-size:11px;color:#666}</style></head><body>
      <h1>Schnitzery — ${esc(t("summary.reportTitle"))}</h1><div class="m">${esc(monthName)}</div>
      <table>${rows.map(([k, v, b]) => `<tr${b ? ' class="b"' : ""}><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      ${notes.length ? `<div class="n">⚠ ${notes.map(esc).join("<br>⚠ ")}</div>` : ""}
      <div class="f">${esc(t("summary.reportNote"))}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

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
          <div className="t-sm fw-6 u-text">{t("summary.simulator")}</div>
          <div className="ui-muted">{t("summary.simulatorSub")}</div>
        </div>
        <span className="u-muted">›</span>
      </Link>

      <div className="ui-toolbar mb-4">
        <select aria-label={t("summary.month")} value={month} onChange={(e) => setMonth(e.target.value)} className="form-select ui-input-sm">
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="d-flex gap-2">
          <button className="btn-secondary" onClick={downloadCsv} disabled={!data}>{t("summary.downloadCsv")}</button>
          <button className="btn-gold" onClick={printReport} disabled={!data}>{t("summary.printPdf")}</button>
        </div>
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
            <Stat label={t("summary.primePct")} value={formatPct(data.primePct, locale)} color={primeColor} sub={t("summary.primeNote")} />
            <Stat label={t("summary.laborPct")} value={formatPct(data.laborPct, locale)} sub={(data.coverage.labor.complete ? "" : "≥ ") + eur(data.laborCost)} />
            <Stat label={t("summary.foodPct")} value={formatPct(data.foodPct, locale)} sub={(data.coverage.spend.complete ? "" : "≥ ") + eur(data.foodSpend)} />
            <Stat label={t("summary.overtime")} value={`${Number(data.overtimeHrs).toLocaleString(locale === "de" ? "de-DE" : "en-GB")} h`} />
            <Stat label={t("summary.lateRate")} value={formatPct(data.lateRate, locale)} />
            <Stat label={t("summary.totalHours")} value={`${Number(data.totalHours).toLocaleString(locale === "de" ? "de-DE" : "en-GB")} h`} />
            <Stat label={t("summary.shifts")} value={String(data.shifts)} />
          </div>

          <div className="card mt-2">
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
                      <tr className="bt-1" key={i}>
                        <td className="u-text">{r.name}<span className="ui-muted"> · {r.team}</span></td>
                        <td className="u-right">{r.hours}h</td>
                        <td className={`u-right ${r.overtime > 0 ? "tone-danger" : "u-muted"}`.trim()}>{r.overtime > 0 ? `${r.overtime}h` : "—"}</td>
                        <td className={`u-right ${r.late > 0 ? "tone-warn" : "u-muted"}`.trim()}>{r.late || "—"}</td>
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