"use client";
// Batch costing (AI Studio "Batch BOM"): a saved recipe at 1× / 10× / 25× / 50×, with scaled ingredient amounts,
// batch cost, cost per portion, and — only when net prices were confirmed — food cost % and margin per portion.
import { useState } from "react";
import { recipeCost, type RecipeVersion } from "@/lib/inventory/recipes";
import { formatEur, formatPct } from "@/lib/format";
import { channelMargins } from "@/lib/inventory/channelMargin";

type Price = { product: string; category?: string | null; unit?: string | null; price: number | null };
const FACTORS = [1, 10, 25, 50] as const;

export default function RecipeScale({ recipe, prices, locale, onClose }: { recipe: RecipeVersion; prices: Price[]; locale: string; onClose: () => void }) {
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [factor, setFactor] = useState<number>(1);
  const [menu, setMenu] = useState({ gross: "", commission: "30", packaging: "0" }); // screen only, nothing saved
  const cost = recipeCost(recipe, prices);
  const num = (v: number) => v.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 3 });
  const money = (v: number | null) => formatEur(v, locale, 2);
  const dec = (v: string) => Number(v.replace(",", "."));
  const portionCost = cost.perPortion ?? (recipe.portions > 0 && cost.total.value > 0 ? cost.total.value / recipe.portions : null); // lower bound when prices are missing
  const gross = dec(menu.gross);
  const channels = portionCost != null && gross > 0 && Number.isFinite(gross)
    ? channelMargins(gross, portionCost, { commissionPct: Math.max(0, dec(menu.commission) || 0), packaging: Math.max(0, dec(menu.packaging) || 0) }) : null;
  const channelName = { dineIn: s("Dine-in (19 % VAT)", "Im Haus (19 % MwSt.)"), takeaway: s("Takeaway (7 % VAT)", "Mitnahme (7 % MwSt.)"), delivery: s("Delivery (7 % VAT, fee, packaging)", "Lieferung (7 % MwSt., Provision, Verpackung)") };
  const bound = (lead: string) => (cost.total.complete ? "" : lead);
  return (
    <section className="card recipe-scale" aria-labelledby="recipe-scale-title">
      <header>
        <div><h2 id="recipe-scale-title">{recipe.name}</h2><span className="ui-muted inv-mono">{num(recipe.portions * factor)} {s("portions", "Portionen")}</span></div>
        <div className="recipe-scale-actions">
          <div className="ui-segmented" role="group" aria-label={s("Batch size", "Ansatzgröße")}>
            {FACTORS.map((f) => <button key={f} type="button" aria-pressed={factor === f} onClick={() => setFactor(f)}>{f}×</button>)}
          </div>
          <button type="button" className="btn-secondary ui-btn-sm" onClick={onClose}>{s("Close", "Schließen")}</button>
        </div>
      </header>
      <div className="table-scroll" role="region" tabIndex={0} aria-label={s("Scaled ingredients", "Skalierte Zutaten")}>
        <table className="data-table">
          <thead><tr><th scope="col">{s("Ingredient", "Zutat")}</th><th scope="col" className="numeric">{s("Amount", "Menge")}</th><th scope="col" className="numeric">{s("Cost", "Kosten")}</th></tr></thead>
          <tbody>{cost.lines.map((l, i) => (
            <tr key={`${l.product_id}${i}`}>
              <td><strong>{l.product}</strong><div className="muted">{l.category}</div></td>
              <td className="numeric inv-mono">{num(l.entered_qty * factor)} {l.entered_unit}</td>
              <td className="numeric inv-mono">{l.cost == null ? s("Price missing", "Preis fehlt") : money(l.cost * factor)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="recipe-scale-kpis">
        <div><span>{s("Batch cost", "Ansatzkosten")}</span><strong>{cost.total.complete ? money(cost.total.value * factor) : cost.total.value > 0 ? `≥ ${money(cost.total.value * factor)}` : "—"}</strong></div>
        <div><span>{s("Cost per portion", "Kosten pro Portion")}</span><strong>{money(cost.perPortion)}</strong></div>
        <div><span>{s("Food cost % of net price", "Wareneinsatz vom Nettopreis")}</span><strong className={cost.ingredientPct != null && cost.ingredientPct > 35 ? "tone-danger" : undefined}>{formatPct(cost.ingredientPct == null ? null : Math.round(cost.ingredientPct * 10) / 10, locale)}</strong></div>
        <div><span>{s("Margin per portion", "Marge pro Portion")}</span><strong>{money(cost.contribution)}</strong></div>
      </div>
      <fieldset className="recipe-channels">
        <legend>{s("Margin per channel (per portion)", "Marge je Kanal (pro Portion)")}</legend>
        <div className="ui-form-grid">
          <label>{s("Menu price incl. VAT (€)", "Kartenpreis inkl. MwSt. (€)")}<input className="form-input" inputMode="decimal" value={menu.gross} onChange={(e) => setMenu({ ...menu, gross: e.target.value })} /></label>
          <label>{s("Delivery commission (%)", "Lieferprovision (%)")}<input className="form-input" inputMode="decimal" value={menu.commission} onChange={(e) => setMenu({ ...menu, commission: e.target.value })} /></label>
          <label>{s("Packaging per order (€)", "Verpackung pro Bestellung (€)")}<input className="form-input" inputMode="decimal" value={menu.packaging} onChange={(e) => setMenu({ ...menu, packaging: e.target.value })} /></label>
        </div>
        {channels && <div className="table-scroll"><table className="data-table">
          <thead><tr><th scope="col">{s("Channel", "Kanal")}</th><th scope="col" className="numeric">{s("Net price", "Nettopreis")}</th><th scope="col" className="numeric">{s("Food cost %", "Wareneinsatz")}</th><th scope="col" className="numeric">{s("Margin", "Marge")}</th></tr></thead>
          <tbody>{channels.map((c) => <tr key={c.channel}><th scope="row">{channelName[c.channel]}</th>
            <td className="numeric inv-mono">{money(c.net)}</td>
            <td className={`numeric inv-mono${c.foodPct != null && c.foodPct > 35 ? " tone-danger" : ""}`}>{c.foodPct == null ? "—" : `${bound("≥ ")}${formatPct(c.foodPct, locale)}`}</td>
            <td className={`numeric inv-mono${c.margin < 0 ? " tone-danger" : ""}`}>{bound("≤ ")}{money(c.margin)}</td></tr>)}</tbody>
        </table></div>}
        {!channels && gross > 0 && portionCost == null && <p className="ui-muted">{s("Add ingredient prices to see the margin per channel.", "Zutatenpreise erfassen, um die Marge je Kanal zu sehen.")}</p>}
      </fieldset>
      {(cost.ingredientPct == null || !cost.total.complete) && <p className="ui-muted recipe-scale-note">{!cost.total.complete ? s("Some ingredient prices are missing.", "Einige Zutatenpreise fehlen.") : s("Food cost % and margin show once the net prices of this version are confirmed.", "Wareneinsatz und Marge erscheinen, sobald die Nettopreise dieser Version bestätigt sind.")}</p>}
    </section>
  );
}
