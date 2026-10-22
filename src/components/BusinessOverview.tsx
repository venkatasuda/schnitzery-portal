"use client";

import Link from "next/link";
import { useLang } from "./LanguageProvider";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { getBranchAnalytics } from "@/lib/queries/branch-analytics";

type Report = Extract<Awaited<ReturnType<typeof getBranchAnalytics>>, { ok: true }>;

export default function BusinessOverview({ data }: { data: Report }) {
  const { t, locale } = useLang();
  const { metrics: m, business: b } = data;
  const { sales, labor, spend } = b.coverage;
  const min = (f: { complete: boolean }) => f.complete ? "" : "≥ "; // known part of an incomplete figure
  const money = (v: number) => new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  return <section className="business-overview" aria-label={t("business.overview")}>
    <div className="business-kpis">
      {[
        [t("business.sales"), b.salesDays ? min(sales) + money(m.totalSales) : "—", t("business.recordedDays", { n: b.salesDays, total: b.elapsedDays })],
        [t("business.labor"), min(labor) + money(m.laborCost), b.missingWageStaff ? t("business.missingWages", { n: b.missingWageStaff }) : t("business.baseWages")],
        [t("business.purchases"), min(spend) + money(b.purchaseSpend), spend.missing.costs ? t("business.missingCosts", { n: spend.missing.costs }) : t("business.purchaseNote")],
        [t("business.productivity"), m.salesPerLaborHour == null ? "—" : money(m.salesPerLaborHour), t("business.perPaidHour")],
      ].map(([label, value, note]) => <article className="business-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
    </div>
    <div className="business-grid">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><h2>{t("business.salesTrend")}</h2><span className="status-badge">{data.from} – {data.to}</span></div>
        <p className="dashboard-muted">{t("business.salesGapNote")}</p>
        <div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={b.salesTrend.map(d => ({ ...d, sales: d.recorded ? d.sales : null }))}>
          <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="day" tickFormatter={v => String(v).slice(5)} tick={{ fill: "var(--gray)", fontSize: 12 }} /><YAxis tick={{ fill: "var(--gray)", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "var(--dark)", borderColor: "var(--border)", color: "var(--white)" }} formatter={v => money(Number(v))} /><Bar dataKey="sales" name={t("business.sales")} fill="var(--info)" radius={[4, 4, 0, 0]} />
        </BarChart></ResponsiveContainer></div>
      </section>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><h2>{t("business.nextActions")}</h2></div>
        <div className="business-action"><strong>{t("business.salesCoverage")}</strong><p>{t("business.recordedDays", { n: b.salesDays, total: b.elapsedDays })}</p><Link href="/labor">{t("business.recordSales")} →</Link></div>
        <div className="business-action"><strong>{t("business.wageCoverage")}</strong><p>{b.missingWageStaff ? t("business.missingWages", { n: b.missingWageStaff }) : t("business.wagesComplete")}</p><Link href="/labor">{t("business.reviewWages")} →</Link></div>
        <div className="business-action"><strong>{t("business.waste")}</strong><p>{t("business.wasteEntries", { n: b.wasteEntries })}</p><Link href="/waste">{t("business.reviewWaste")} →</Link></div>
      </section>
    </div>
    <div className="business-note"><strong>{t("business.interpretation")}</strong><p>{t("business.limitations")}</p></div>
  </section>;
}
