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

  const primeColor = primePct == null ? "var(--gray)" : primePct <= 60 ? "***REMOVED***58d68d" : primePct <= 68 ? "***REMOVED***d4a847" : "***REMOVED***ec7063";
  const marginColor = marginPct == null ? "var(--gray)" : marginPct >= 25 ? "***REMOVED***58d68d" : marginPct >= 12 ? "***REMOVED***d4a847" : "***REMOVED***ec7063";

  const Slider = ({ label, val, set, hint }: { label: string; val: number; set: (n: number) => void; hint: string }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--white)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: val === 0 ? "var(--gray)" : val > 0 ? "***REMOVED***ec7063" : "***REMOVED***58d68d" }}>{val > 0 ? "+" : ""}{val}%</span>
      </div>
      <input type="range" min={-20} max={40} step={1} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%", accentColor: "***REMOVED***d4a847" }} />
      <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>{hint}</div>
    </div>
  );

  const Metric = ({ label, baseVal, simVal, color }: { label: string; baseVal: number | null; simVal: number | null; color: string }) => {
    const delta = baseVal != null && simVal != null ? Math.round((simVal - baseVal) * 10) / 10 : null;
    return (
      <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: "var(--gray)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct(simVal)}</div>
        <div style={{ fontSize: 11, color: "var(--gray)" }}>
          {t("sim.was")} {pct(baseVal)}
          {delta != null && delta !== 0 && <span style={{ color: delta > 0 ? "***REMOVED***ec7063" : "***REMOVED***58d68d", marginLeft: 4 }}>{delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-up">
      <Link href="/summary" style={{ color: "var(--gray)", fontSize: 13, textDecoration: "none" }}>‹ {t("sim.back")}</Link>
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><Icon e="🎛️" size={22} /> {t("sim.title")}</div>
      <div className="page-sub">{t("sim.subtitle")}</div>

      {loading ? <CardSkeleton rows={4} /> : !base || !base.hasSales ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 26, fontSize: 13, marginTop: 12 }}>{t("sim.needData")}</div>
      ) : (
        <>
          <div className="card" style={{ margin: "12px 0", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
              <Metric label={t("sim.primeCost")} baseVal={base.primePct} simVal={primePct} color={primeColor} />
              <Metric label={t("sim.margin")} baseVal={base.hasFood ? ((base.sales - base.foodSpend - base.laborCost) / base.sales) * 100 : null} simVal={marginPct} color={marginColor} />
              <Metric label={t("sim.foodPct")} baseVal={base.foodPct} simVal={foodPct} color="var(--white)" />
              <Metric label={t("sim.laborPct")} baseVal={base.laborPct} simVal={laborPct} color="var(--white)" />
            </div>
            <div style={{ fontSize: 11, color: "var(--gray)", textAlign: "center", marginTop: 8 }}>
              {t("sim.projected", { sales: eur(simSales), food: eur(simFood), labor: eur(simLabor) })}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0 }}>{t("sim.whatIf")}</div>
              <button onClick={reset} style={{ fontSize: 12, color: "var(--gray)", background: "none", border: "none", cursor: "pointer" }}>{t("sim.reset")}</button>
            </div>
            <Slider label={t("sim.ingredientCost")} val={food} set={setFood} hint={t("sim.ingredientHint")} />
            <Slider label={t("sim.laborCost")} val={labor} set={setLabor} hint={t("sim.laborHint")} />
            <Slider label={t("sim.salesPrice")} val={sales} set={setSales} hint={t("sim.salesHint")} />
          </div>

          <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 12, textAlign: "center" }}>{t("sim.note")}</div>
        </>
      )}
    </div>
  );
}