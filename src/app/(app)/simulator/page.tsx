"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getMonthlySummary } from "@/lib/queries/labor";

const eur = (n: number) => "€" + Math.round(n || 0).toLocaleString("de-DE");
const pct = (n: number | null) => n == null ? "—" : `${Math.round(n * 10) / 10}%`;

export default function SimulatorPage() {
  const { t } = useLang();
  const [base, setBase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [food, setFood] = useState(0);   // ingredient cost change %
  const [labor, setLabor] = useState(0); // labor change %
  const [sales, setSales] = useState(0); // sales / menu-price change %

  useEffect(() => {
    (async () => { const r = await getMonthlySummary(); if (r.ok) setBase(r); setLoading(false); })();
  }, []);

  const reset = () => { setFood(0); setLabor(0); setSales(0); };

  // simulated figures
  const s = base || {};
  const simSales = (s.sales || 0) * (1 + sales / 100);
  const simFood = (s.foodSpend || 0) * (1 + food / 100);
  const simLabor = (s.laborCost || 0) * (1 + labor / 100);
  const foodPct = simSales > 0 && s.hasFood ? (simFood / simSales) * 100 : null;
  const laborPct = simSales > 0 ? (simLabor / simSales) * 100 : null;
  const primePct = foodPct != null && laborPct != null ? foodPct + laborPct : null;
  const marginPct = simSales > 0 ? ((simSales - simFood - simLabor) / simSales) * 100 : null;

  const primeColor = primePct == null ? "var(--gray)" : primePct <= 60 ? "var(--success)" : primePct <= 68 ? "#d4a847" : "var(--danger)";
  const marginColor = marginPct == null ? "var(--gray)" : marginPct >= 25 ? "var(--success)" : marginPct >= 12 ? "#d4a847" : "var(--danger)";

  const Slider = ({ label, val, set, hint }: { label: string; val: number; set: (n: number) => void; hint: string }) => (
    <div className="mb-5">
      <div className="d-flex jc-sb mb-2">
        <span className="ui-body">{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: val === 0 ? "var(--gray)" : val > 0 ? "var(--danger)" : "var(--success)" }}>{val > 0 ? "+" : ""}{val}%</span>
      </div>
      <input aria-label={label} type="range" min={-20} max={40} step={1} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--gold-ink)" }} />
      <div className="ui-meta">{hint}</div>
    </div>
  );

  const Metric = ({ label, baseVal, simVal, color }: { label: string; baseVal: number | null; simVal: number | null; color: string }) => {
    const delta = baseVal != null && simVal != null ? Math.round((simVal - baseVal) * 10) / 10 : null;
    return (
      <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
        <div className="ui-muted">{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct(simVal)}</div>
        <div className="ui-muted">
          {t("sim.was")} {pct(baseVal)}
          {delta != null && delta !== 0 && <span style={{ color: delta > 0 ? "var(--danger)" : "var(--success)", marginLeft: 4 }}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-up">
      <Link href="/summary" style={{ color: "var(--gray)", fontSize: 13, textDecoration: "none" }}>‹ {t("sim.back")}</Link>
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><Icon e="🎛️" size={22} /> {t("sim.title")}</h1>
      <div className="page-sub">{t("sim.subtitle")}</div>

      {loading ? <CardSkeleton rows={4} /> : !base || !base.hasSales ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 26, fontSize: 13, marginTop: 12 }}>{t("sim.needData")}</div>
      ) : !base.complete ? (
        // Release D: never simulate on a partial baseline — the result would look precise and be wrong.
        <div role="status" className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 26, fontSize: 13, marginTop: 12 }}>{t("sim.incomplete")}</div>
      ) : (
        <>
          <div className="card" style={{ margin: "12px 0", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 6 }}>
              <Metric label={t("sim.primeCost")} baseVal={base.primePct} simVal={primePct} color={primeColor} />
              <Metric label={t("sim.margin")} baseVal={base.hasFood ? ((base.sales - base.foodSpend - base.laborCost) / base.sales) * 100 : null} simVal={marginPct} color={marginColor} />
              <Metric label={t("sim.foodPct")} baseVal={base.foodPct} simVal={foodPct} color="var(--white)" />
              <Metric label={t("sim.laborPct")} baseVal={base.laborPct} simVal={laborPct} color="var(--white)" />
            </div>
            <div className="t-xs u-muted u-center mt-2">
              {t("sim.projected", { sales: eur(simSales), food: eur(simFood), labor: eur(simLabor) })}
            </div>
          </div>

          <div className="card p-4">
            <div className="d-flex jc-sb ai-c mb-4">
              <div className="card-title u-m0">{t("sim.whatIf")}</div>
              <button className="ui-link-btn" onClick={reset}>{t("sim.reset")}</button>
            </div>
            <Slider label={t("sim.ingredientCost")} val={food} set={setFood} hint={t("sim.ingredientHint")} />
            <Slider label={t("sim.laborCost")} val={labor} set={setLabor} hint={t("sim.laborHint")} />
            <Slider label={t("sim.salesPrice")} val={sales} set={setSales} hint={t("sim.salesHint")} />
          </div>

          <div className="t-xs u-muted mt-3 u-center">{t("sim.note")}</div>
        </>
      )}
    </div>
  );
}