"use client";

import { berlinToday } from "@/lib/time/berlinDate";
import { inventoryKey } from "@/lib/inventory/identity";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getProducts, getCounts, saveCount, addProduct, removeProduct, getOrderAlert,
  addDelivery, getDeliveries, getInventoryAnalytics, getInventoryTrend, getInventoryVariance, getDepletionForecast,
} from "@/lib/queries/inventory";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import ScanToCount from "./ScanToCount";
import StockHistory from "./StockHistory";

const GOLD = "var(--gold-ink)";
const BLUE = "var(--info)";

export default function InventoryPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"count" | "deliveries" | "analytics" | "forecast" | "catalog" | "history">("count");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // shared catalog
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [countView, setCountView] = useState<"list" | "grid">("list");
  const [gridSel, setGridSel] = useState<any>(null);
  const [gridVal, setGridVal] = useState("");

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
  const [monthTrend, setMonthTrend] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [variance, setVariance] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [coverDays, setCoverDays] = useState(7);

  async function load() {
    setLoading(true);
    setLoadError("");
    const pRes = await getProducts();
    if (!pRes.ok) { setLoadError(pRes.error || t("inv.failed")); setLoading(false); return; }
    setProducts(pRes.products);
    const cRes = await getCounts();
    if (!cRes.ok) { setLoadError(cRes.error || t("inv.failed")); setLoading(false); return; }
    const cMap: Record<string, any> = {};
    for (const c of (cRes.counts || [])) cMap[inventoryKey(c)] = c;
    setCounts(cMap);
    const aRes = await getOrderAlert();
    if (aRes.ok) setLowStock(aRes.lowStock); else setLoadError(aRes.error || t("inv.failed"));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function loadDeliveries() {
    const res = await getDeliveries(30);
    if (res.ok) setDeliveries(res.deliveries); else setLoadError(res.error || t("inv.failed"));
  }
  async function loadAnalytics(d: number) {
    setAnalytics(null);
    const res = await getInventoryAnalytics(d);
    if (res.ok) setAnalytics(res); else setLoadError(res.error || t("inv.failed"));
  }
  useEffect(() => {
    if (tab === "deliveries") loadDeliveries();
    if (tab === "analytics") { loadAnalytics(days); getInventoryTrend(6).then((r) => { if (r.ok) setMonthTrend(r.trend); }); getInventoryVariance(30).then((r) => { if (r.ok) setVariance(r); }); }
    if (tab === "forecast") { getDepletionForecast(30, coverDays).then((r) => { if (r.ok) setForecast(r); else setLoadError(r.error || t("inv.failed")); }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function doSaveCount(p: any) {
    const val = entry[inventoryKey(p)];
    if (val === undefined || val === "") { toast(t("inv.enterCount"), "error"); return; }
    setSavingP(p.product);
    const res = await saveCount(p.product, p.category, Number(val), Number(p.soll), p.unit);
    setSavingP(null);
    if (res.ok) { toast(`${p.product} ${t("inv.countedToast")}`, "success"); setEntry((e) => ({ ...e, [inventoryKey(p)]: "" })); load(); }
    else { toast(res.error || t("inv.failed"), "error"); if (res.error?.includes("Managers")) setDenied(true); }
  }
  async function doAddProduct() {
    if (!np.category || !np.product) { toast(t("inv.catProductRequired"), "error"); return; }
    const res = await addProduct(np.category, np.product, Number(np.soll) || 0, np.unit);
    if (res.ok) { toast(t("inv.productAdded"), "success"); setNp({ category: "", product: "", soll: "", unit: "" }); setShowAdd(false); load(); }
    else toast(res.error || t("inv.failed"), "error");
  }
  async function doRemoveProduct(p: any) {
    if (!confirm(t("inv.confirmRemoveProduct", { name: p.product }))) return;
    const res = await removeProduct(p.id);
    if (res.ok) { toast(t("inv.productRemoved"), "success"); load(); }
    else toast(res.error || t("inv.failed"), "error");
  }
  async function doAddDelivery() {
    if (!del.product) { toast(t("inv.pickProduct"), "error"); return; }
    if (del.qty === "" && del.cost === "") { toast(t("inv.enterQtyCost"), "error"); return; }
    const prod = products.find((p) => p.id === del.product);
    setSavingDel(true);
    const res = await addDelivery({
      product: prod?.product || "", category: prod?.category || "",
      qty: Number(del.qty) || 0, unit: prod?.unit || "", cost: Number(del.cost) || 0,
      supplier: del.supplier || undefined, note: del.note || undefined, date: del.date || undefined,
    });
    setSavingDel(false);
    if (res.ok) { toast(t("inv.deliverySaved"), "success"); setDel({ product: "", qty: "", cost: "", supplier: "", note: "", date: "" }); loadDeliveries(); }
    else toast(res.error || t("inv.failed"), "error");
  }

  function stockStatus(p: any): "green" | "amber" | "red" | "none" {
    const c = counts[inventoryKey(p)];
    const ist = c ? Number(c.ist) : null;
    const soll = Number(p.soll) || 0;
    if (ist === null) return "none";
    if (soll <= 0) return ist > 0 ? "green" : "red";
    if (ist >= soll) return "green";
    if (ist >= soll * 0.5) return "amber";
    return "red";
  }
  async function quickSave(p: any, val: string) {
    if (val === "" || val === undefined) { toast(t("inv.enterCount"), "error"); return; }
    setSavingP(p.product);
    const res = await saveCount(p.product, p.category, Number(val), Number(p.soll), p.unit);
    setSavingP(null);
    if (res.ok) { toast(`${p.product} ${t("inv.countedToast")}`, "success"); setGridSel(null); setGridVal(""); load(); }
    else { toast(res.error || t("inv.failed"), "error"); if (res.error?.includes("Managers")) setDenied(true); }
  }
  function downloadShoppingCsv() {
    if (!lowStock.length) return;
    const csv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Product", "Category", "Current", "Target", "To buy", "Unit"];
    const rows = lowStock.map((l: any) => [csv(l.product), csv(l.category), l.ist, l.soll, l.short, csv(l.unit)].join(","));
    const day = berlinToday();
    const blob = new Blob(["\uFEFF" + [head.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `schnitzery-shopping-${day}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(t("inv.listDownloaded"), "success");
  }
  function printShoppingList() {
    if (!lowStock.length) return;
    const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const day = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const rows = lowStock.map((l: any) => `<tr><td>${esc(l.product)}</td><td>${esc(l.category)}</td><td class="r">${l.ist}</td><td class="r">${l.soll}</td><td class="r b">${l.short} ${esc(l.unit || "")}</td></tr>`).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schnitzery Shopping List</title><style>
      *{box-sizing:border-box;font-family:system-ui,Arial,sans-serif}body{margin:0;padding:16mm;color:#111}
      h1{margin:0 0 2mm}.meta{color:#666;margin-bottom:8mm;font-size:11pt}
      table{width:100%;border-collapse:collapse;font-size:11pt}th,td{padding:2.5mm 3mm;border-bottom:1px solid #ddd;text-align:left}
      th{border-bottom:2px solid #333}.r{text-align:right}.b{font-weight:700}tr:nth-child(even){background:#f7f7f7}
    </style></head><body>
      <h1>Schnitzery — ${esc(t("inv.shoppingHdr"))}</h1><div class="meta">${day} · ${lowStock.length} ${esc(t("inv.itemsShort"))}</div>
      <table><thead><tr><th>${esc(t("inv.product"))}</th><th>${esc(t("inv.category"))}</th><th class="r">${esc(t("inv.currentCol"))}</th><th class="r">${esc(t("inv.targetCol"))}</th><th class="r">${esc(t("inv.buyCol"))}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }
  function copyShoppingList() {
    const lines = lowStock.map((l: any) => `• ${l.product}: ${l.short}${l.unit ? " " + l.unit : ""}`);
    const text = `${t("inv.shoppingListTitle")}\n${lines.join("\n")}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(t("inv.listCopied"), "success")).catch(() => toast(t("inv.failed"), "error"));
    } else toast(t("inv.failed"), "error");
  }
  function copyOrderList() {
    if (!forecast) return;
    const lines = forecast.items.filter((x: any) => x.suggested > 0).map((x: any) => `• ${x.product}: ${x.suggested}${x.unit ? " " + x.unit : ""}`);
    if (lines.length === 0) { toast(t("inv.nothingToOrder"), "success"); return; }
    const text = `${t("inv.orderListTitle")}\n${lines.join("\n")}`;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(t("inv.listCopied"), "success")).catch(() => toast(t("inv.failed"), "error"));
    else toast(t("inv.failed"), "error");
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const categories = [...new Set(products.map((p) => p.category))];
  const shownProducts = products.filter((p) => {
    const counted = counts[inventoryKey(p)];
    const status = !counted ? "uncounted" : Number(counted.ist) < Number(p.soll) ? "low" : "good";
    return (!activeCat || p.category === activeCat)
      && `${p.product} ${p.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      && (statusFilter === "all" || statusFilter === status);
  });
  const eur = (n: number) => `€${Math.round(n || 0).toLocaleString()}`;

  return (
    <div className="inventory-page">
      {loadError && <div role="alert" style={{ ...card, color: "var(--danger)", marginBottom: 16 }}>{loadError}</div>}
      <div className="inventory-heading">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon e="📦" size={22} /> {t("inv.title")}</h1>
          <p className="page-sub">{t("inv.subtitle")}</p>
        </div>
        <div className="inventory-heading-actions">
        {tab === "count" && <button className="btn-gold" onClick={() => setShowScan(true)}>{t("scan.scanToCount")}</button>}
        {tab === "catalog" && <button className="btn-gold" onClick={() => setShowAdd(!showAdd)} aria-expanded={showAdd}>{showAdd ? t("common.close") : t("inv.addToCatalog")}</button>}
        {(tab === "forecast" || tab === "analytics") && <Link href="/inventory/order" className="btn-gold"><Icon e="🧾" size={16} />{t("inv.buildOrder")}</Link>}
      <details className="inventory-operation-menu">
        <summary><Icon e="🔄" size={16} /> {t("inventoryWorkflow.movements")}</summary>
        <nav className="inventory-links" aria-label={t("inventoryWorkflow.movements")}>
        {[
          { href: "/waste", icon: "🗑️", label: t("home.wasteLog") },
          { href: "/expiry", icon: "📅", label: t("home.expiry") },
          { href: "/transfers", icon: "🔄", label: t("home.transfers") },
        ].map((l) => (
          <Link key={l.href} href={l.href}>
            <Icon e={l.icon} size={14} /> {l.label}
          </Link>
        ))}
        </nav>
      </details>
        </div>
      </div>

      <div className="hub-tabs" role="group" aria-label={t("inv.title")}>
        <TabBtn active={tab === "count"} onClick={() => setTab("count")}>{t("inv.tabCount")}</TabBtn>
        <TabBtn active={tab === "deliveries"} onClick={() => setTab("deliveries")}>{t("inv.tabDeliveries")}</TabBtn>
        <TabBtn active={tab === "forecast"} onClick={() => setTab("forecast")}>{t("inventoryWorkflow.reorder")}</TabBtn>
        <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>{t("inventoryWorkflow.reports")}</TabBtn>
        <TabBtn active={tab === "catalog"} onClick={() => setTab("catalog")}>{t("inventoryWorkflow.catalogTab")}</TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")}>{t("stockHistory.title")}</TabBtn>
      </div>
      <p className="inventory-task-description">{t(tab === "history" ? "stockHistory.help" : `inventoryWorkflow.${tab}Help`)}</p>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {tab === "history" && <StockHistory />}
          {/* ============ COUNT ============ */}
          {(tab === "count" || tab === "catalog") && (
            <>
              {showScan && <ScanToCount products={products} onClose={() => setShowScan(false)} onSaved={() => load()} />}
              {gridSel && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setGridSel(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--dark)", borderRadius: 14, padding: 20, width: "100%", maxWidth: 320, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, color: "var(--gray)" }}>{gridSel.category}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--white)", marginBottom: 4 }}>{gridSel.product}</div>
                    <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>{t("inv.targetShort")} {gridSel.soll}{gridSel.unit ? ` ${gridSel.unit}` : ""}{counts[inventoryKey(gridSel)] ? ` · ${t("inv.current")} ${counts[inventoryKey(gridSel)].ist}` : ""}</div>
                    <input type="number" inputMode="decimal" autoFocus value={gridVal} onChange={(e) => setGridVal(e.target.value)} placeholder={t("inv.count")}
                      style={{ width: "100%", padding: 14, fontSize: 20, textAlign: "center", borderRadius: 10, background: "var(--dark2)", color: "var(--white)", border: "1px solid var(--border)", fontWeight: 700 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={() => quickSave(gridSel, gridVal)} disabled={savingP === gridSel.product} style={{ flex: 1, padding: 13, borderRadius: 10, background: "var(--action)", color: "var(--on-action)", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{savingP === gridSel.product ? "…" : t("inv.count")}</button>
                      <button onClick={() => setGridSel(null)} style={{ padding: "13px 16px", borderRadius: 10, background: "transparent", color: "var(--gray)", border: "1px solid var(--border)", cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="inventory-toolbar">
                <label className="inventory-search">
                  <span>{t("inventoryWorkflow.search")}</span>
                  <input type="search" className="form-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("inventoryWorkflow.searchPlaceholder")} />
                </label>
                <label className="inventory-category">
                  <span>{t("inv.category")}</span>
                  <select className="form-select" value={activeCat} onChange={(e) => setActiveCat(e.target.value)}>
                    <option value="">{t("inventoryWorkflow.allCategories")}</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="inventory-filter">
                  <span>{t("inv.status")}</span>
                  <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">{t("inventoryWorkflow.allStatuses")}</option>
                    <option value="low">{t("inv.lowStatus")}</option>
                    <option value="uncounted">{t("salert.notCounted")}</option>
                    <option value="good">{t("inv.atTargetStatus")}</option>
                  </select>
                </label>
                {tab === "count" && <>
                <div className="inventory-view" role="group" aria-label={t("inv.tabCount")}>
                  <button className={countView === "list" ? "active" : ""} aria-pressed={countView === "list"} onClick={() => setCountView("list")}>{t("inv.viewList")}</button>
                  <button className={countView === "grid" ? "active" : ""} aria-pressed={countView === "grid"} onClick={() => setCountView("grid")}>{t("inv.viewGrid")}</button>
                </div>
                </>}
                {tab === "catalog" && <>
                    <Link href="/labels" className="btn-secondary">{t("scan.labels")}</Link>
                </>}
              </div>
              <div className="inventory-result-bar">
                <span>{t("inventoryWorkflow.results", { n: shownProducts.length, total: products.length })}</span>
                {tab === "count" && <Link href="/stock-alerts">{t("home.stockAlerts")} →</Link>}
              </div>

              {tab === "catalog" && showAdd && (
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
                <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("inv.noProducts")}</div>
              ) : (
                <>
                  {countView === "grid" && tab === "count" ? (
                    <div className="inventory-grid">
                      {shownProducts.length === 0 && <div className="inventory-empty">{t("inventoryWorkflow.noMatches")} <button className="btn-secondary" onClick={() => { setSearch(""); setActiveCat(""); setStatusFilter("all"); }}>{t("inventoryWorkflow.reset")}</button></div>}
                      {shownProducts.map((p) => {
                        const st = stockStatus(p);
                        const bg = st === "green" ? "rgba(39,174,96,0.18)" : st === "amber" ? "rgba(212,168,71,0.18)" : st === "red" ? "rgba(231,76,60,0.18)" : "var(--dark2)";
                        const bd = st === "green" ? "rgba(39,174,96,0.4)" : st === "amber" ? "rgba(212,168,71,0.4)" : st === "red" ? "rgba(231,76,60,0.4)" : "var(--border)";
                        const c = counts[inventoryKey(p)];
                        return (
                          <button key={p.id} onClick={() => { setGridSel(p); setGridVal(""); }}
                            style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: 10, textAlign: "left", cursor: "pointer", minHeight: 68 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--white)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product}</div>
                            <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4 }}>{c ? `${c.ist}` : "—"}/{p.soll}{p.unit ? " " + p.unit : ""}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                  <>
                  <div className="table-scroll" role="region" aria-label={t("inv.tabCount")} tabIndex={0}>
                  <table className="data-table inventory-table">
                    <thead><tr>
                      <th scope="col">{t("inv.product")}</th>
                      <th scope="col" className="numeric">{t("inv.currentCol")}</th>
                      <th scope="col" className="numeric">{t("inv.targetCol")}</th>
                      <th scope="col">{t("inv.status")}</th>
                      <th scope="col" className="numeric">{tab === "catalog" ? t("inventoryWorkflow.actions") : t("inv.count")}</th>
                    </tr></thead>
                    <tbody>
                  {shownProducts.map((p) => {
                    const counted = counts[inventoryKey(p)];
                    const isLow = counted && Number(counted.ist) < Number(p.soll);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.product}</div>
                          <div className="muted">{p.category}{p.unit ? ` · ${p.unit}` : ""}</div>
                        </td>
                        <td className="numeric" data-label={t("inv.currentCol")}>{counted ? counted.ist : "—"}{counted && p.unit ? ` ${p.unit}` : ""}</td>
                        <td className="numeric" data-label={t("inv.targetCol")}>{p.soll}{p.unit ? ` ${p.unit}` : ""}</td>
                        <td data-label={t("inv.status")}><span className={`status-badge${counted ? isLow ? " low" : " good" : ""}`}>{!counted ? t("salert.notCounted") : isLow ? t("inv.lowStatus") : t("inv.atTargetStatus")}</span></td>
                        <td>
                          {tab === "catalog" ? <button onClick={() => doRemoveProduct(p)} className="inventory-archive" aria-label={`${t("inv.removeProduct")}: ${p.product}`}>{t("inv.removeProduct")}</button> : <div className="row-actions">
                          <input type="number" inputMode="decimal" min="0" step="any" aria-label={`${t("inv.count")}: ${p.product}${p.unit ? ` (${p.unit})` : ""}`} value={entry[inventoryKey(p)] ?? ""} onChange={(e) => setEntry({ ...entry, [inventoryKey(p)]: e.target.value })}
                            placeholder={counted ? String(counted.ist) : "0"} className="form-input quantity-input" />
                          <button onClick={() => doSaveCount(p)} disabled={savingP === p.product} className="btn-gold">
                            {savingP === p.product ? "…" : t("inv.count")}
                          </button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })}
                      {shownProducts.length === 0 && <tr><td colSpan={5} className="inventory-empty">{t("inventoryWorkflow.noMatches")} <button className="btn-secondary" onClick={() => { setSearch(""); setActiveCat(""); setStatusFilter("all"); }}>{t("inventoryWorkflow.reset")}</button></td></tr>}
                    </tbody>
                  </table>
                  </div>
                  </>
                  )}
                </>
              )}
            </>
          )}

          {/* ============ DELIVERIES ============ */}
          {tab === "deliveries" && (
            <div className="inventory-delivery-grid">
              {products.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("inv.addProductsFirst")}</div>
              ) : (
                <div style={{ ...card, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.recordDelivery")}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{t("inv.recordDeliverySub")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label={t("inv.product")}>
                      <select value={del.product} onChange={(e) => setDel({ ...del, product: e.target.value })} style={input}>
                        <option value="">{t("inv.pickProductOpt")}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.product} · {p.category}{p.unit ? ` (${p.unit})` : ""}</option>)}
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

              <section><h2 className="inventory-section-title">{t("inv.recentDeliveries")}</h2>
              {deliveries.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>{t("inv.noDeliveries")}</div>
              ) : deliveries.map((d) => (
                <div key={d.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.product} <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400 }}>· {d.qty} {d.unit || ""}</span></div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>{d.purchase_date}{d.supplier ? ` · ${d.supplier}` : ""}{d.note ? ` · ${d.note}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{eur(Number(d.cost))}</div>
                  </div>
                </div>
              ))}
              </section>
            </div>
          )}

          {/* ============ ANALYTICS ============ */}
          {tab === "analytics" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => { setDays(d); loadAnalytics(d); }} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: days === d ? "var(--action)" : "var(--dark2)", color: days === d ? "var(--on-action)" : "var(--gray)", border: "1px solid var(--border)" }}>{t("inv.lastNDays", { n: d })}</button>
                ))}
              </div>

              {!analytics ? <CardSkeleton rows={4} /> : !analytics.hasPurchases && !analytics.hasCounts ? (
                <div style={{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("inv.noAnalytics")}</div>
              ) : (
                <div className="inventory-report-grid">
                  <div style={{ ...card, marginBottom: 14, borderColor: "rgba(212,168,71,0.3)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>{t("inv.spentOnStock")}</strong>
                      {analytics.spendPctChange != null && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: analytics.spendPctChange > 0 ? "var(--danger)" : "var(--success)" }}>
                          {analytics.spendPctChange > 0 ? "▲" : "▼"} {Math.abs(analytics.spendPctChange)}% {t("inv.vsPrev")}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {analytics.foodCostPct != null ? (
                        <span style={chip}>{t("inv.foodCost")}: <b style={{ color: fcColor(analytics.foodCostPct) }}>{analytics.foodCostPct}%</b></span>
                      ) : (
                        <span style={{ ...chip, color: "var(--gray)" }}>{t("inv.addSalesForFoodCost")}</span>
                      )}
                      {analytics.topCategory && <span style={chip}>{t("inv.topCat")}: <b>{analytics.topCategory.category}</b> · {eur(analytics.topCategory.eur)}</span>}
                    </div>
                  </div>

                  <div className="inventory-report-kpis">
                    <Kpi label={t("inv.kSpend")} value={eur(analytics.totalSpend)} color={GOLD} />
                    <Kpi label={t("inv.kUsed")} value={eur(analytics.totalUsageEur)} color={BLUE} />
                    <Kpi label={t("inv.kStockValue")} value={eur(analytics.stockValue)} color="var(--success)" />
                  </div>

                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.spendVsUse")}</div>
                    <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{t("inv.spendVsUseSub")}</div>
                    {analytics.trend.length === 0 ? (
                      <div style={{ color: "var(--gray)", fontSize: 12, textAlign: "center", padding: 20 }}>{t("inv.noTrend")}</div>
                    ) : (
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.trend} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar name={t("inv.legendSpend")} dataKey="spend" fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                            <Bar name={t("inv.legendUse")} dataKey="usageEur" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {monthTrend.length > 0 && (
                    <div style={{ ...card, marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.sixMonth")}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{t("inv.sixMonthSub")}</div>
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={monthTrend} margin={{ top: 6, right: -12, bottom: 0, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="l" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} unit="%" />
                            <Tooltip contentStyle={{ background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="l" name={t("inv.legendSpend")} dataKey="spend" fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Line yAxisId="r" name={t("inv.foodCost")} dataKey="foodCostPct" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {variance?.hasData && variance.items.some((v: any) => v.flag === "up" || v.flag === "down") && (
                    <div style={{ ...card, marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.variance")}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{variance.normalised ? t("inv.varianceSubNorm") : t("inv.varianceSubRaw")}</div>
                      {variance.items.filter((v: any) => v.flag === "up" || v.flag === "down").slice(0, 8).map((v: any, i: number) => {
                        const up = v.flag === "up";
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                            <div>
                              <div style={{ fontSize: 13, color: "var(--white)" }}>{v.product}</div>
                              <div style={{ fontSize: 12, color: "var(--gray)" }}>€{v.prevEur} → €{v.curEur}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: up ? "var(--danger)" : "var(--success)" }}>
                              {v.changePct != null ? `${v.changePct > 0 ? "▲" : "▼"} ${Math.abs(v.changePct)}%` : "—"}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 10 }}>{t("inv.varianceNote")}</div>
                    </div>
                  )}

                  <div style={{ ...card, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("inv.byCategory")}</div>
                    {analytics.byCategory.length === 0 ? <div style={{ color: "var(--gray)", fontSize: 12 }}>{t("inv.noData")}</div> :
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
                    {analytics.topSpend.length === 0 ? <div style={{ color: "var(--gray)", fontSize: 12 }}>{t("inv.noData")}</div> :
                      analytics.topSpend.map((r: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                          <span>{r.product}</span><span style={{ color: GOLD, fontWeight: 600 }}>{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>

                  <div style={{ ...card }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("inv.topUse")}</div>
                    <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 10 }}>{t("inv.topUseSub")}</div>
                    {analytics.topUsage.length === 0 ? <div style={{ color: "var(--gray)", fontSize: 12 }}>{t("inv.noUseData")}</div> :
                      analytics.topUsage.map((r: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                          <span>{r.product} <span style={{ color: "var(--gray)", fontSize: 12 }}>· {r.qty}</span></span>
                          <span style={{ color: BLUE, fontWeight: 600 }}>{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "forecast" && (
            <>
              <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>{t("inv.forecastIntro")}</div>
              <Link href="/stock-alerts" className="inventory-alert-link">{t("home.stockAlerts")} →</Link>
              {lowStock.length > 0 && <details className="inventory-operation-menu">
                <summary>{t("inventoryWorkflow.exportShortages")}</summary>
                <div className="inventory-links">
                  <button className="btn-secondary" onClick={copyShoppingList}>{t("inv.copyShort")}</button>
                  <button className="btn-secondary" onClick={downloadShoppingCsv}>CSV</button>
                  <button className="btn-secondary" onClick={printShoppingList}>{t("inventoryWorkflow.print")}</button>
                </div>
              </details>}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--gray)" }}>{t("inv.coverFor")}</span>
                {[7, 14, 30].map((cd) => (
                  <button key={cd} onClick={() => { setCoverDays(cd); getDepletionForecast(30, cd).then((r) => { if (r.ok) setForecast(r); else setLoadError(r.error || t("inv.failed")); }); }}
                    style={{ ...chip, background: coverDays === cd ? "rgba(212,168,71,0.15)" : "var(--dark2)", color: coverDays === cd ? "var(--gold-ink)" : "var(--gray)", borderColor: coverDays === cd ? "rgba(212,168,71,0.3)" : "var(--border)", cursor: "pointer" }}>
                    {cd}{t("inv.daysShort")}
                  </button>
                ))}
                <button onClick={copyOrderList} style={{ ...chip, marginLeft: "auto", cursor: "pointer" }}>{t("inv.copyOrder")}</button>
              </div>
              {!forecast ? <CardSkeleton rows={4} /> : forecast.items.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>{forecast.hasData ? t("inv.forecastNoUse") : t("inv.forecastNoData")}</div>
              ) : <div className="table-scroll" role="region" aria-label={t("inventoryWorkflow.reorder")} tabIndex={0}><table className="data-table inventory-table"><thead><tr>
                <th scope="col">{t("inv.product")}</th><th scope="col" className="numeric">{t("inv.onHand")}</th><th scope="col" className="numeric">{t("inventoryWorkflow.dailyUsage")}</th><th scope="col" className="numeric">{t("inventoryWorkflow.coverage")}</th><th scope="col" className="numeric">{t("inv.order")}</th>
              </tr></thead><tbody>{forecast.items.map((it: any, i: number) => {
                const dl = it.daysLeft;
                const c = dl == null ? "var(--gray)" : dl < 2 ? "var(--danger)" : dl < 4 ? "var(--gold-ink)" : "var(--success)";
                return (
                  <tr key={i}>
                    <td><strong>{it.product}</strong><div className="muted">{it.category}</div><div className="muted">{it.countDate} · {it.stale ? t("inventoryWorkflow.recount") : t("inventoryWorkflow.observed", { n: it.observedDays || 0 })}</div></td>
                    <td className="numeric" data-label={t("inv.onHand")}>{it.current} {it.unit || ""}</td>
                    <td className="numeric" data-label={t("inventoryWorkflow.dailyUsage")}>{it.usageRate > 0 ? `${it.usageRate} ${it.unit || ""}` : "—"}</td>
                    <td className="numeric" data-label={t("inventoryWorkflow.coverage")} style={{ color: c }}>{dl == null ? "—" : t("inv.daysLeftVal", { n: dl })}</td>
                    <td className="numeric" data-label={t("inv.order")}>{it.suggested > 0 ? `${it.suggested} ${it.unit || ""}` : "—"}</td>
                  </tr>
                );
              })}</tbody></table></div>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return <label style={{ display: "block", marginBottom: 10 }}><span style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 6 }}>{label}</span>{children}</label>;
}
function TabBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} aria-pressed={active} className={`hub-tab${active ? " active" : ""}`}>{children}</button>;
}
function Kpi({ label, value, color }: any) {
  return (
    <div style={{ ...card, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 6, lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const chip: React.CSSProperties = { fontSize: 12, padding: "5px 10px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8 };
function fcColor(pct: number) { return pct <= 32 ? "var(--success)" : pct <= 38 ? "#d4a847" : "var(--danger)"; }
