"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getProducts, getCounts, saveCount, addProduct, getOrderAlert,
  addDelivery, getDeliveries, getInventoryAnalytics,
} from "@/lib/queries/inventory";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const GOLD = "#d4a847";
const BLUE = "#3498db";

export default function InventoryPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"count" | "deliveries" | "analytics">("count");

  // shared catalog
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  // COUNT tab
  const [counts, setCounts] = useState<Record<string, any>>({});
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [savingP, setSavingP] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [np, setNp] = useState({ category: "", product: "", soll: "", unit: "" });

  // DELIVERIES tab
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [del, setDel] = useState({ product: "", qty: "", cost: "", supplier: "", note: "", date: "" });
  const [savingDel, setSavingDel] = useState(false);

  // ANALYTICS tab
  const [analytics, setAnalytics] = useState<any>(null);
  const [days, setDays] = useState(30);

  async function load() {
    setLoading(true);
    const pRes = await getProducts();
    if (!pRes.ok) { setLoading(false); return; }
    setProducts(pRes.products);
    const cRes = await getCounts();
    const cMap: Record<string, any> = {};
    for (const c of (cRes.counts || [])) cMap[c.product] = c;
    setCounts(cMap);
    const aRes = await getOrderAlert();
    if (aRes.ok) setLowStock(aRes.lowStock);
    const cats = [...new Set(pRes.products.map((p: any) => p.category))];
    if (cats.length && !activeCat) setActiveCat(cats[0] as string);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function loadDeliveries() {
    const res = await getDeliveries(30);
    if (res.ok) setDeliveries(res.deliveries);
  }
  async function loadAnalytics(d: number) {
    setAnalytics(null);
    const res = await getInventoryAnalytics(d);
    if (res.ok) setAnalytics(res);
  }
  useEffect(() => {
    if (tab === "deliveries") loadDeliveries();
    if (tab === "analytics") loadAnalytics(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function doSaveCount(p: any) {
    const val = entry[p.product];
    if (val === undefined || val === "") { toast(t("inv.enterCount"), "error"); return; }
    setSavingP(p.product);
    const res = await saveCount(p.product, p.category, Number(val), Number(p.soll), p.unit);
    setSavingP(null);
    if (res.ok) { toast(`${p.product} ${t("inv.countedToast")}`, "success"); setEntry((e) => ({ ...e, [p.product]: "" })); load(); }
    else { toast(res.error || t("inv.failed"), "error"); if (res.error?.includes("Managers")) setDenied(true); }
  }
  async function doAddProduct() {
    if (!np.category || !np.product) { toast(t("inv.catProductRequired"), "error"); return; }
    const res = await addProduct(np.category, np.product, Number(np.soll) || 0, np.unit);
    if (res.ok) { toast(t("inv.productAdded"), "success"); setNp({ category: "", product: "", soll: "", unit: "" }); setShowAdd(false); load(); }
    else toast(res.error || t("inv.failed"), "error");
  }
  async function doAddDelivery() {
    if (!del.product) { toast(t("inv.pickProduct"), "error"); return; }
    if (del.qty === "" && del.cost === "") { toast(t("inv.enterQtyCost"), "error"); return; }
    const prod = products.find((p) => p.product === del.product);
    setSavingDel(true);
    const res = await addDelivery({
      product: del.product, category: prod?.category || "",
      qty: Number(del.qty) || 0, unit: prod?.unit || "", cost: Number(del.cost) || 0,
      supplier: del.supplier || undefined, note: del.note || undefined, date: del.date || undefined,
    });
    setSavingDel(false);
    if (res.ok) { toast(t("inv.deliverySaved"), "success"); setDel({ product: "", qty: "", cost: "", supplier: "", note: "", date: "" }); loadDeliveries(); }
    else toast(res.error || t("inv.failed"), "error");
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const categories = [...new Set(products.map((p) => p.category))];
  const shownProducts = products.filter((p) => p.category === activeCat);
  const eur = (n: number) => `€${Math.round(n || 0).toLocaleString()}`;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="📦" size={22} /> {t("inv.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 14 }}>{t("inv.subtitle")}</p>

      <div style={tabBar}>
        <TabBtn active={tab === "count"} onClick={() => setTab("count")}>{t("inv.tabCount")}</TabBtn>
        <TabBtn active={tab === "deliveries"} onClick={() => setTab("deliveries")}>{t("inv.tabDeliveries")}</TabBtn>
        <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>{t("inv.tabAnalytics")}</TabBtn>
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {/* ============ COUNT ============ */}
          {tab === "count" && (
            <>
              <div style={{ ...card, marginBottom: 14, borderColor: lowStock.length ? "rgba(231,76,60,0.3)" : "rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: lowStock.length ? 10 : 0 }}>
                  {lowStock.length ? t("inv.belowTarget", { n: lowStock.length }) : t("inv.allAtTarget")}
                </div>
                {lowStock.map((l, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                    <span>{l.product} <span style={{ color: "#9a8f8f", fontSize: 11 }}>({l.category})</span></span>
                    <span style={{ color: "#ec7063" }}>{l.ist}/{l.soll} {l.unit || ""} · {t("inv.short")} {l.short}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setShowAdd(!showAdd)} style={{ ...primaryBtn, width: "100%", marginBottom: 12, background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
                {showAdd ? t("common.close") : t("inv.addToCatalog")}
              </button>
              {showAdd && (
                <div style={{ ...card, marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label={t("inv.category")}><input value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} style={input} placeholder={t("inv.phCategory")} /></Field>
                    <Field label={t("inv.product")}><input value={np.product} onChange={(e) => setNp({ ...np, product: e.target.value })} style={input} placeholder={t("inv.phProduct")} /></Field>
                    <Field label={t("inv.target")}><input type="number" value={np.soll} onChange={(e) => setNp({ ...np, soll: e.target.value })} style={input} placeholder="20" /></Field>
                    <Field label={t("inv.unit")}><input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} style={input} placeholder={t("inv.phUnit")} /></Field>
                  </div>
                  <button onClick={doAddProduct} style={primaryBtn}>{t("inv.addProduct")}</button>
                </div>
              )}

              {categories.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>{t("inv.noProducts")}</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {categories.map((c) => (
                      <button key={c} onClick={() => setActiveCat(c)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        background: activeCat === c ? "#d4a847" : "rgba(255,255,255,0.04)", color: activeCat === c ? "#1a0e0e" : "#9a8f8f", border: "1px solid rgba(255,255,255,0.1)" }}>{c}</button>
                    ))}
                  </div>
                  {shownProducts.map((p) => {
                    const counted = counts[p.product];
                    const isLow = counted && Number(counted.ist) < Number(p.soll);
                    return (
                      <div key={p.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{p.product}</div>
                            <div style={{ fontSize: 12, color: "#9a8f8f" }}>
                              {t("inv.targetShort")} {p.soll} {p.unit || ""}
                              {counted && <span style={{ color: isLow ? "#ec7063" : "#58d68d" }}> · {t("inv.counted")} {counted.ist}</span>}
                            </div>
                          </div>
                          <input type="number" value={entry[p.product] ?? ""} onChange={(e) => setEntry({ ...entry, [p.product]: e.target.value })}
                            placeholder={counted ? String(counted.ist) : "0"} style={{ ...input, width: 70, textAlign: "center" }} />
                          <button onClick={() => doSaveCount(p)} disabled={savingP === p.product} style={{ ...primaryBtn, width: "auto", padding: "10px 16px", flex: "0 0 auto" }}>
                            {savingP === p.product ? "…" : t("inv.count")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* ============ DELIVERIES ============ */}
          {tab === "deliveries" && (
            <>
              {products.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>{t("inv.addProductsFirst")}</div>
              ) : (
                <div style={{ ...card, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.recordDelivery")}</div>
                  <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 12 }}>{t("inv.recordDeliverySub")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label={t("inv.product")}>
                      <select value={del.product} onChange={(e) => setDel({ ...del, product: e.target.value })} style={input}>
                        <option value="">{t("inv.pickProductOpt")}</option>
                        {products.map((p) => <option key={p.id} value={p.product}>{p.product}{p.unit ? ` (${p.unit})` : ""}</option>)}
                      </select>
                    </Field>
                    <Field label={t("inv.qtyReceived")}><input type="number" value={del.qty} onChange={(e) => setDel({ ...del, qty: e.target.value })} style={input} placeholder="100" /></Field>
                    <Field label={t("inv.costPaid")}><input type="number" value={del.cost} onChange={(e) => setDel({ ...del, cost: e.target.value })} style={input} placeholder="40.00" /></Field>
                    <Field label={t("inv.date")}><input type="date" value={del.date} onChange={(e) => setDel({ ...del, date: e.target.value })} style={input} /></Field>
                    <Field label={t("inv.supplier")}><input value={del.supplier} onChange={(e) => setDel({ ...del, supplier: e.target.value })} style={input} placeholder={t("inv.phSupplier")} /></Field>
                    <Field label={t("inv.note")}><input value={del.note} onChange={(e) => setDel({ ...del, note: e.target.value })} style={input} /></Field>
                  </div>
                  <button onClick={doAddDelivery} disabled={savingDel} style={primaryBtn}>{savingDel ? t("common.saving") : t("inv.saveDelivery")}</button>
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "#9a8f8f", margin: "4px 2px 8px" }}>{t("inv.recentDeliveries")}</div>
              {deliveries.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#9a8f8f", fontSize: 13 }}>{t("inv.noDeliveries")}</div>
              ) : deliveries.map((d) => (
                <div key={d.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.product} <span style={{ fontSize: 12, color: "#9a8f8f", fontWeight: 400 }}>· {d.qty} {d.unit || ""}</span></div>
                      <div style={{ fontSize: 11, color: "#9a8f8f" }}>{d.purchase_date}{d.supplier ? ` · ${d.supplier}` : ""}{d.note ? ` · ${d.note}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{eur(Number(d.cost))}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ============ ANALYTICS ============ */}
          {tab === "analytics" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => { setDays(d); loadAnalytics(d); }} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: days === d ? GOLD : "rgba(255,255,255,0.04)", color: days === d ? "#1a0e0e" : "#9a8f8f", border: "1px solid rgba(255,255,255,0.1)" }}>{t("inv.lastNDays", { n: d })}</button>
                ))}
              </div>

              {!analytics ? <CardSkeleton rows={4} /> : !analytics.hasPurchases && !analytics.hasCounts ? (
                <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>{t("inv.noAnalytics")}</div>
              ) : (
                <>
                  <div style={{ ...card, marginBottom: 14, borderColor: "rgba(212,168,71,0.3)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: GOLD }}>{eur(analytics.totalSpend)}</div>
                      {analytics.spendPctChange != null && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: analytics.spendPctChange > 0 ? "#ec7063" : "#58d68d" }}>
                          {analytics.spendPctChange > 0 ? "▲" : "▼"} {Math.abs(analytics.spendPctChange)}% {t("inv.vsPrev")}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#cbbfbf", marginTop: 3 }}>{t("inv.spentOnStock")}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {analytics.foodCostPct != null ? (
                        <span style={chip}>{t("inv.foodCost")}: <b style={{ color: fcColor(analytics.foodCostPct) }}>{analytics.foodCostPct}%</b></span>
                      ) : (
                        <span style={{ ...chip, color: "#9a8f8f" }}>{t("inv.addSalesForFoodCost")}</span>
                      )}
                      {analytics.topCategory && <span style={chip}>{t("inv.topCat")}: <b>{analytics.topCategory.category}</b> · {eur(analytics.topCategory.eur)}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <Kpi label={t("inv.kSpend")} value={eur(analytics.totalSpend)} color={GOLD} />
                    <Kpi label={t("inv.kUsed")} value={eur(analytics.totalUsageEur)} color={BLUE} />
                    <Kpi label={t("inv.kStockValue")} value={eur(analytics.stockValue)} color="#58d68d" />
                  </div>

                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.spendVsUse")}</div>
                    <div style={{ fontSize: 11, color: "#9a8f8f", marginBottom: 12 }}>{t("inv.spendVsUseSub")}</div>
                    {analytics.trend.length === 0 ? (
                      <div style={{ color: "#9a8f8f", fontSize: 12, textAlign: "center", padding: 20 }}>{t("inv.noTrend")}</div>
                    ) : (
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.trend} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#9a8f8f" }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: "#241414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar name={t("inv.legendSpend")} dataKey="spend" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={22} />
                            <Bar name={t("inv.legendUse")} dataKey="usageEur" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("inv.byCategory")}</div>
                    {analytics.byCategory.length === 0 ? <div style={{ color: "#9a8f8f", fontSize: 12 }}>{t("inv.noData")}</div> :
                      analytics.byCategory.map((r: any, i: number) => {
                        const pct = analytics.totalSpend > 0 ? Math.round((r.eur / analytics.totalSpend) * 100) : 0;
                        return (
                          <div key={i} style={{ marginBottom: 9 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                              <span>{r.category}</span><span style={{ color: GOLD, fontWeight: 600 }}>{eur(r.eur)} · {pct}%</span>
                            </div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: GOLD }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("inv.topSpend")}</div>
                    {analytics.topSpend.length === 0 ? <div style={{ color: "#9a8f8f", fontSize: 12 }}>{t("inv.noData")}</div> :
                      analytics.topSpend.map((r: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                          <span>{r.product}</span><span style={{ color: GOLD, fontWeight: 600 }}>{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>

                  <div style={{ ...card }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.topUse")}</div>
                    <div style={{ fontSize: 11, color: "#9a8f8f", marginBottom: 10 }}>{t("inv.topUseSub")}</div>
                    {analytics.topUsage.length === 0 ? <div style={{ color: "#9a8f8f", fontSize: 12 }}>{t("inv.noUseData")}</div> :
                      analytics.topUsage.map((r: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                          <span>{r.product} <span style={{ color: "#9a8f8f", fontSize: 11 }}>· {r.qty}</span></span>
                          <span style={{ color: BLUE, fontWeight: 600 }}>{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 11, color: "#9a8f8f", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "10px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Kpi({ label, value, color }: any) {
  return (
    <div style={{ ...card, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#9a8f8f", marginTop: 3, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}
const tabBar: React.CSSProperties = { display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 };
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const chip: React.CSSProperties = { fontSize: 12, padding: "5px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 };
function fcColor(pct: number) { return pct <= 32 ? "#58d68d" : pct <= 38 ? "#d4a847" : "#ec7063"; }