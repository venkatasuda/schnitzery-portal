"use client";

import { serverText } from "@/lib/i18n/serverMessages";
import { formatEur } from "@/lib/format";
import { berlinToday, fmtDay, fmtMonthDay } from "@/lib/time/berlinDate";
import { inventoryKey } from "@/lib/inventory/identity";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getProducts, getCounts, getInventoryContext, saveCount, getOrderAlert,
  addDelivery, getDeliveries, getInventoryAnalytics, getInventoryTrend, getInventoryVariance, getDepletionForecast,
} from "@/lib/queries/inventory";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import ScanToCount from "./ScanToCount";
import StockHistory from "./StockHistory";
import Reconciliation from "./Reconciliation";
import NativeDialog from "@/components/NativeDialog";
import InventoryNav, { type InventoryArea } from "@/components/InventoryNav";
import Products from "@/components/inventory/Products";
import { EmptyState, Field, Panel, Segmented, Stat, TabButton } from "@/components/ui";

const GOLD = "var(--gold-ink)";
const BLUE = "var(--info)";
const TOOLTIP = { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } as const;

export default function InventoryPage() {
  const { t, locale } = useLang();
  type View = "overview" | "count" | "deliveries" | "analytics" | "forecast" | "catalog" | "history" | "reconcile" | "movements";
  const [tab, setTab] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [context, setContext] = useState<{ branch: { id: string; name: string }; countDate: string } | null>(null);
  const [locationReady, setLocationReady] = useState(false);

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

  // quiet: refresh after an edit without swapping the list for a skeleton.
  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    setLoadError("");
    try {
    const [pRes, scope] = await Promise.all([getProducts(), getInventoryContext()]);
    if (!scope.ok) { setLoadError(t("inventoryWorkspace.scopeFailed")); return; }
    setContext(scope);
    if (!pRes.ok) { setLoadError(pRes.error || t("inv.failed")); setLoading(false); return; }
    setProducts(pRes.products);
    const cRes = await getCounts();
    if (!cRes.ok) { setLoadError(cRes.error || t("inv.failed")); setLoading(false); return; }
    const cMap: Record<string, any> = {};
    for (const c of (cRes.counts || [])) {
      if (c.ist != null && String(c.ist).trim() !== "" && Number.isFinite(Number(c.ist)) && Number(c.ist) >= 0) cMap[inventoryKey(c)] = c;
    }
    if (cRes.date) setContext({ ...scope, countDate: cRes.date });
    setCounts(cMap);
    const aRes = await getOrderAlert();
    if (aRes.ok) setLowStock(aRes.lowStock); else setLoadError(aRes.error || t("inv.failed"));
    } catch { setLoadError(t("inv.failed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const view = query.get("view") || "overview";
      setTab((["overview", "count", "deliveries", "analytics", "forecast", "catalog", "history", "reconcile", "movements"] as string[]).includes(view) ? view as View : "overview");
      setSearch(query.get("q") || ""); setActiveCat(query.get("category") || "");
      const status = query.get("status") || "all";
      setStatusFilter(["all", "low", "uncounted", "good"].includes(status) ? status : "all");
    };
    restore(); setLocationReady(true);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!locationReady) return;
    const url = new URL(window.location.href);
    for (const [key, value] of [["view", tab], ["q", search], ["category", activeCat], ["status", statusFilter === "all" ? "" : statusFilter]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }, [locationReady, tab, search, activeCat, statusFilter]);
  function navigate(view: string, status?: string) {
    if (!(["overview", "count", "deliveries", "analytics", "forecast", "catalog", "history", "reconcile", "movements"] as string[]).includes(view)) return;
    if (Object.values(entry).some(value => value !== "") && !confirm(t("inventoryWorkspace.unsaved"))) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    if (status) {
      url.searchParams.set("status", status);
      url.searchParams.delete("q");
      url.searchParams.delete("category");
    }
    window.history.pushState(null, "", url);
    setTab(view as View);
    if (status) { setStatusFilter(status); setSearch(""); setActiveCat(""); }
  }

  async function loadDeliveries() {
    const res = await getDeliveries(30);
    if (res.ok) setDeliveries(res.deliveries); else setLoadError(serverText(res.error ?? "", locale) || t("inv.failed"));
  }
  async function loadAnalytics(d: number) {
    setAnalytics(null);
    const res = await getInventoryAnalytics(d);
    if (res.ok) setAnalytics(res); else setLoadError(serverText(res.error ?? "", locale) || t("inv.failed"));
  }
  async function loadActiveTab() {
    try {
    if (tab === "deliveries") await loadDeliveries();
    if (tab === "analytics") { await Promise.all([loadAnalytics(days), getInventoryTrend(6).then((r) => { if (r.ok) setMonthTrend(r.trend); }), getInventoryVariance(30).then((r) => { if (r.ok) setVariance(r); })]); }
    if (tab === "forecast") { const r = await getDepletionForecast(30, coverDays); if (r.ok) setForecast(r); else setLoadError(serverText(r.error ?? "", locale) || t("inv.failed")); }
    } catch { setLoadError(t("inv.failed")); }
  }
  useEffect(() => {
    setLoadError("");
    loadActiveTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function doSaveCount(p: any) {
    await quickSave(p, entry[inventoryKey(p)] ?? "");
  }
  async function doAddDelivery() {
    if (!del.product) { toast(t("inv.pickProduct"), "error"); return; }
    if (del.qty.trim() === "" || del.cost.trim() === "") { toast(t("inv.enterQtyCost"), "error"); return; }
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
    if (soll <= 0) return "green";
    if (ist >= soll) return "green";
    if (ist >= soll * 0.5) return "amber";
    return "red";
  }
  async function quickSave(p: any, val: string) {
    if (savingP !== null) return;
    if (val === "" || val === undefined) { toast(t("inv.enterCount"), "error"); return; }
    if (!Number.isFinite(Number(val)) || Number(val) < 0) { toast(t("inv.failed"), "error"); return; }
    setSavingP(p.product);
    try {
    const res = await saveCount(p.product, p.category, Number(val), Number(p.soll), p.unit, context?.branch.id);
    if (res.ok) { toast(`${p.product} ${t("inv.countedToast")}`, "success"); setEntry(e => ({ ...e, [inventoryKey(p)]: "" })); setGridSel(null); setGridVal(""); load(true).catch(() => setLoadError(t("inv.failed"))); }
    else { toast(res.error || t("inv.failed"), "error"); if (res.error?.includes("Managers")) setDenied(true); }
    } catch { toast(t("inv.failed"), "error"); }
    finally { setSavingP(null); }
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
    const day = fmtDay(berlinToday(), locale);
    const rows = lowStock.map((l: any) => `<tr><td>${esc(l.product)}</td><td>${esc(l.category)}</td><td class="r">${l.ist}</td><td class="r">${l.soll}</td><td class="r b">${l.short} ${esc(l.unit || "")}</td></tr>`).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schnitzery — ${t("misc.shoppingTitle")}</title><style>
      *{box-sizing:border-box;font-family:system-ui,Arial,sans-serif}body{margin:0;padding:16mm;color:#111}
      h1{margin:0 0 2mm}.meta{color:#666;margin-bottom:8mm;font-size:11pt}
      table{width:100%;border-collapse:collapse;font-size:11pt}th,td{padding:2.5mm 3mm;border-bottom:1px solid #ddd;text-align:left}
      th{border-bottom:2px solid #333}.r{text-align:right}.b{font-weight:700}tr:nth-child(even){background:#f7f7f7}
    </style></head><body>
      <h1>Schnitzery — ${esc(t("inv.shoppingHdr"))}</h1><div class="meta">${day} · ${lowStock.length} ${esc(t("inv.itemsShort"))}</div>
      <table><thead><tr><th>${esc(t("inv.product"))}</th><th>${esc(t("inv.category"))}</th><th class="r">${esc(t("inventoryWorkspace.countedQuantity"))}</th><th class="r">${esc(t("inv.targetCol"))}</th><th class="r">${esc(t("inv.buyCol"))}</th></tr></thead>
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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const categories = [...new Set(products.map((p) => p.category))];
  const shownProducts = products.filter((p) => {
    const counted = counts[inventoryKey(p)];
    const status = !counted ? "uncounted" : Number(counted.ist) < Number(p.soll) ? "low" : "good";
    return (!activeCat || p.category === activeCat)
      && `${p.product} ${p.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      && (statusFilter === "all" || statusFilter === status);
  });
  const eur = (n: number | null | undefined) => formatEur(n, locale, 2);
  // Release D: an incomplete figure shows only its known part, marked as a lower bound.
  const atLeast = (complete: boolean | undefined, n: number | null | undefined) => (n != null && complete === false ? "≥ " : "") + eur(n);
  const area: InventoryArea = tab === "overview" ? "overview" : ["count", "catalog"].includes(tab) ? "stock" : ["forecast", "deliveries"].includes(tab) ? "purchasing" : ["movements", "history"].includes(tab) ? "movements" : "reports";
  const countedProducts = products.filter(p => counts[inventoryKey(p)]).length;
  const belowTarget = products.filter(p => counts[inventoryKey(p)] && Number(counts[inventoryKey(p)].ist) < Number(p.soll)).length;

  return (
    <div className="inventory-page">
      <InventoryNav active={area} onNavigate={navigate} />
      {loadError && <div role="alert" className="workspace-error"><p>{loadError}</p><button className="btn-secondary" onClick={async () => { await load(); await loadActiveTab(); }}>{t("business.retry")}</button></div>}
      <div className="inventory-heading">
        <div>
          <h1 className="page-title u-row"><Icon e="📦" size={22} /> {t("inv.title")}</h1>
          <p className="page-sub">{context ? `${context.branch.name}${tab === "count" || tab === "overview" ? ` · ${t("inventoryWorkspace.countDate", { date: fmtDay(context.countDate, locale) })}` : ""}` : t("common.loading")}</p>
        </div>
        <div className="inventory-heading-actions">
        {tab === "overview" && <button className="btn-gold" onClick={() => navigate("count")}>{t("inventoryWorkspace.openCount")}</button>}
        {tab === "count" && <><Link href="/inventory/counts" className="btn-gold">{t("countSession.title")}</Link><button className="btn-secondary" onClick={() => setShowScan(true)}>{t("scan.scanToCount")}</button></>}
        {tab === "forecast" && <><Link href="/inventory/purchasing?new=1" className="btn-gold">{t("inventoryOps.newOrder")}</Link><Link href="/inventory/order" className="btn-secondary">{t("orderDraft.title")}</Link></>}
        </div>
      </div>

      {area !== "overview" && <div className="hub-tabs inventory-subnav" role="group" aria-label={t(`inventoryWorkspace.${area}`)}>
        {area === "stock" && <><TabButton active={tab === "count"} onClick={() => navigate("count")}>{t("inv.tabCount")}</TabButton><TabButton active={tab === "catalog"} onClick={() => navigate("catalog")}>{t("inventoryWorkflow.catalogTab")}</TabButton><Link className="hub-tab" href="/expiry">{t("home.expiry")}</Link><Link className="hub-tab" href="/labels">{t("scan.labels")}</Link></>}
        {area === "purchasing" && <><TabButton active={tab === "forecast"} onClick={() => navigate("forecast")}>{t("inventoryWorkflow.reorder")}</TabButton><Link className="hub-tab" href="/inventory/purchasing">{t("inventoryOps.orders")}</Link><TabButton active={tab === "deliveries"} onClick={() => navigate("deliveries")}>{t("inv.tabDeliveries")}</TabButton></>}
        {area === "movements" && <><TabButton active={tab === "movements"} onClick={() => navigate("movements")}>{t("inventoryWorkspace.workflows")}</TabButton><TabButton active={tab === "history"} onClick={() => navigate("history")}>{t("stockHistory.title")}</TabButton></>}
        {area === "reports" && <><TabButton active={tab === "analytics"} onClick={() => navigate("analytics")}>{t("inventoryWorkflow.reports")}</TabButton><TabButton active={tab === "reconcile"} onClick={() => navigate("reconcile")}>{t("reconcile.title")}</TabButton></>}
      </div>}

      {loading ? <CardSkeleton rows={4} /> : loadError ? null : (
        <>
          {tab === "overview" && <>
            <div className="inventory-work-summary">
              <button onClick={() => navigate("count")}><span>{t("inventoryWorkspace.countProgress")}</span><strong>{countedProducts} / {products.length}</strong><small>{t("inventoryWorkspace.physicalCounts")}</small></button>
              <button onClick={() => navigate("count", "uncounted")}><span>{t("inventoryWorkspace.needsCount")}</span><strong>{products.length - countedProducts}</strong><small>{t("inventoryWorkspace.noZero")}</small></button>
              <button onClick={() => navigate("count", "low")}><span>{t("inventoryWorkspace.belowTarget")}</span><strong>{belowTarget}</strong><small>{t("inventoryWorkspace.snapshotNote")}</small></button>
            </div>
            <Panel title={t("inventoryWorkspace.dailyWork")}>
              <div className="inventory-task-grid">
                <Link className="inventory-task" href="/inventory/counts"><strong>{t("countSession.title")}</strong><span>{t("countSession.help")}</span></Link>
                <Link className="inventory-task" href="/inventory/purchasing"><strong>{t("inventoryOps.receive")}</strong><span>{t("inventoryWorkspace.receivingHelp")}</span></Link>
                <button className="inventory-task" onClick={() => navigate("forecast")}><strong>{t("inventoryWorkflow.reorder")}</strong><span>{t("inventoryWorkspace.reorderHelp")}</span></button>
                <Link className="inventory-task" href="/expiry"><strong>{t("home.expiry")}</strong><span>{t("inventoryWorkspace.expiryHelp")}</span></Link>
                <button className="inventory-task" onClick={() => navigate("reconcile")}><strong>{t("reconcile.title")}</strong><span>{t("inventoryWorkspace.reviewHelp")}</span></button>
              </div>
            </Panel>
          </>}
          {tab === "movements" && <Panel title={t("inventoryWorkspace.movements")}><div className="inventory-task-grid">
            <Link className="inventory-task" href="/transfers"><strong>{t("home.transfers")}</strong><span>{t("inventoryWorkspace.transferHelp")}</span></Link>
            <Link className="inventory-task" href="/waste"><strong>{t("home.wasteLog")}</strong><span>{t("inventoryWorkspace.wasteHelp")}</span></Link>
            <button className="inventory-task" onClick={() => navigate("history")}><strong>{t("stockHistory.title")}</strong><span>{t("inventoryWorkspace.historyHelp")}</span></button>
          </div></Panel>}
          {tab === "history" && <StockHistory />}
          {tab === "reconcile" && <Reconciliation />}
          {/* ============ COUNT ============ */}
          {tab === "catalog" && <Products onChanged={()=>load(true)} />}
          {tab === "count" && (
            <>
              {showScan && <ScanToCount branchId={context?.branch.id} products={products} onClose={() => setShowScan(false)} onSaved={() => load(true)} />}
              {gridSel && (
                <NativeDialog title={`${t("inv.count")}: ${gridSel.product}`} busy={savingP === gridSel.product} onClose={() => setGridSel(null)}>
                    <div className="ui-muted">{gridSel.category}</div>
                    <div className="ui-dialog-title">{gridSel.product}</div>
                    <div className="ui-sub">{t("inv.targetShort")} {gridSel.soll}{gridSel.unit ? ` ${gridSel.unit}` : ""}{counts[inventoryKey(gridSel)] ? ` · ${t("inventoryWorkspace.countedQuantity")} ${counts[inventoryKey(gridSel)].ist}` : ""}</div>
                    <input type="number" min="0" step="any" aria-label={t("inv.count")} inputMode="decimal" autoFocus value={gridVal} onChange={(e) => setGridVal(e.target.value)} placeholder={t("inv.count")}
                      className="form-input ui-big-input" />
                    <div className="ui-actions">
                      <button type="button" className="btn-gold u-flex1" onClick={() => quickSave(gridSel, gridVal)} disabled={savingP === gridSel.product}>{savingP === gridSel.product ? "…" : t("inv.count")}</button>
                      <button type="button" className="btn-secondary" disabled={savingP === gridSel.product} onClick={() => setGridSel(null)}>{t("common.cancel")}</button>
                    </div>
                </NativeDialog>
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
                    <option value="uncounted">{t("inv.notCountedStatus")}</option>
                    <option value="good">{t("inv.atTargetStatus")}</option>
                  </select>
                </label>
                {tab === "count" && <>
                <div className="inventory-view" role="group" aria-label={t("inv.tabCount")}>
                  <button className={countView === "list" ? "active" : ""} aria-pressed={countView === "list"} onClick={() => setCountView("list")}>{t("inv.viewList")}</button>
                  <button className={countView === "grid" ? "active" : ""} aria-pressed={countView === "grid"} onClick={() => setCountView("grid")}>{t("inv.viewGrid")}</button>
                </div>
                </>}
              </div>
              <div className="inventory-result-bar">
                <span>{t("inventoryWorkflow.results", { n: shownProducts.length, total: products.length })}</span>
                {tab === "count" && <Link href="/stock-alerts">{t("home.stockAlerts")} →</Link>}
              </div>


              {categories.length === 0 ? (
                <div className="card ui-empty-msg">{t("inv.noProducts")}</div>
              ) : (
                <>
                  {countView === "grid" && tab === "count" ? (
                    <div className="inventory-grid">
                      {shownProducts.length === 0 && <div className="inventory-empty">{t("inventoryWorkflow.noMatches")} <button className="btn-secondary" onClick={() => { setSearch(""); setActiveCat(""); setStatusFilter("all"); }}>{t("inventoryWorkflow.reset")}</button></div>}
                      {shownProducts.map((p) => {
                        const st = stockStatus(p);
                        const c = counts[inventoryKey(p)];
                        return (
                          <button key={p.id} type="button" className={`inv-tile ${st}`} onClick={() => { setGridSel(p); setGridVal(""); }}
                            aria-label={`${p.product}: ${c ? c.ist : "—"} / ${p.soll}${p.unit ? " " + p.unit : ""}`}>
                            <span className="inv-tile-name">{p.product}</span>
                            <span className="ui-meta">{c ? `${c.ist}` : "—"}/{p.soll}{p.unit ? " " + p.unit : ""}</span>
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
                      <th scope="col" className="numeric">{t("inventoryWorkspace.countedQuantity")}</th>
                      <th scope="col" className="numeric">{t("inv.targetCol")}</th>
                      <th scope="col">{t("inv.status")}</th>
                      <th scope="col" className="numeric">{t("inv.count")}</th>
                    </tr></thead>
                    <tbody>
                  {shownProducts.map((p) => {
                    const counted = counts[inventoryKey(p)];
                    const isLow = counted && Number(counted.ist) < Number(p.soll);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="u-semibold">{p.product}</div>
                          <div className="muted">{p.category}{p.unit ? ` · ${p.unit}` : ""}</div>
                        </td>
                        <td className="numeric" data-label={t("inventoryWorkspace.countedQuantity")}>{counted ? counted.ist : "—"}{counted && p.unit ? ` ${p.unit}` : ""}</td>
                        <td className="numeric" data-label={t("inv.targetCol")}>{p.soll}{p.unit ? ` ${p.unit}` : ""}</td>
                        <td data-label={t("inv.status")}><span className={`status-badge${counted ? isLow ? " low" : " good" : ""}`}>{!counted ? t("inv.notCountedStatus") : isLow ? t("inv.lowStatus") : t("inv.atTargetStatus")}</span></td>
                        <td className="numeric">
                          <form className="row-actions" onSubmit={event => { event.preventDefault(); doSaveCount(p); }}>
                          <input type="number" inputMode="decimal" min="0" step="any" aria-label={`${t("inv.count")}: ${p.product}${p.unit ? ` (${p.unit})` : ""}`} value={entry[inventoryKey(p)] ?? ""} onChange={(e) => setEntry({ ...entry, [inventoryKey(p)]: e.target.value })}
                            placeholder={counted ? String(counted.ist) : "0"} className="form-input quantity-input" />
                          <button type="submit" disabled={savingP !== null} className="btn-gold" aria-label={`${t("inv.count")}: ${p.product}`}>
                            {savingP === p.product ? "…" : t("inv.count")}
                          </button>
                          </form>
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
              <p className="ui-note">{t("inventoryOps.quickDeliveryHelp")} <Link href="/inventory/purchasing">{t("inventoryOps.orders")}</Link></p>
              {products.length === 0 ? (
                <div className="card ui-empty-msg">{t("inv.addProductsFirst")}</div>
              ) : (
                <Panel title={t("inv.recordDelivery")}>
                  <p className="ui-sub">{t("inv.recordDeliverySub")}</p>
                  <div className="ui-form-grid">
                    <Field label={t("inv.product")}>
                      <select value={del.product} onChange={(e) => setDel({ ...del, product: e.target.value })} className="form-input">
                        <option value="">{t("inv.pickProductOpt")}</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.product} · {p.category}{p.unit ? ` (${p.unit})` : ""}</option>)}
                      </select>
                    </Field>
                    <Field label={t("inv.qtyReceived")}><input type="number" value={del.qty} onChange={(e) => setDel({ ...del, qty: e.target.value })} className="form-input" placeholder="100" /></Field>
                    <Field label={t("inv.costPaid")}><input type="number" value={del.cost} onChange={(e) => setDel({ ...del, cost: e.target.value })} className="form-input" placeholder="40.00" /></Field>
                    <Field label={t("inv.date")}><input type="date" value={del.date} onChange={(e) => setDel({ ...del, date: e.target.value })} className="form-input" /></Field>
                    <Field label={t("inv.supplier")}><input value={del.supplier} onChange={(e) => setDel({ ...del, supplier: e.target.value })} className="form-input" placeholder={t("inv.phSupplier")} /></Field>
                    <Field label={t("inv.note")}><input value={del.note} onChange={(e) => setDel({ ...del, note: e.target.value })} className="form-input" /></Field>
                  </div>
                  <button type="button" className="btn-gold ui-block" onClick={doAddDelivery} disabled={savingDel}>{savingDel ? t("common.saving") : t("inv.saveDelivery")}</button>
                </Panel>
              )}

              <section><h2 className="inventory-section-title">{t("inv.recentDeliveries")}</h2>
              {deliveries.length === 0 ? (
                <div className="card"><EmptyState title={t("inv.noDeliveries")} /></div>
              ) : <ul className="card ui-list" aria-label={t("inv.recentDeliveries")}>{deliveries.map((d) => (
                <li key={d.id} className="ui-list-item">
                  <div className="u-grow">
                    <div className="ui-strong">{d.product} <span className="ui-muted">· {d.qty} {d.unit || ""}</span></div>
                    <div className="ui-muted">{fmtDay(d.purchase_date, locale)}{d.supplier ? ` · ${d.supplier}` : ""}{d.note ? ` · ${d.note}` : ""}</div>
                  </div>
                  <strong className="ui-figure">{d.cost == null || d.cost === "" ? "—" : eur(Number(d.cost))}</strong>
                </li>
              ))}</ul>}
              </section>
            </div>
          )}

          {/* ============ ANALYTICS ============ */}
          {tab === "analytics" && (
            <>
              <Segmented label={t("business.reportPeriod")} value={String(days)} onChange={(v) => { setDays(Number(v)); loadAnalytics(Number(v)); }}
                options={[7, 30, 90].map((d) => ({ value: String(d), label: t("inv.lastNDays", { n: d }) }))} />

              {(analytics?.needsReview || variance?.needsReview) && <p role="status" className="card">{t("inventoryReview.explanation")}</p>}

              {!analytics ? <CardSkeleton rows={4} /> : !analytics.hasPurchases && !analytics.hasCounts ? (
                <div className="card ui-empty-msg">{t("inv.noAnalytics")}</div>
              ) : (
                <div className="inventory-report-grid">
                  <Panel title={t("inv.spentOnStock")} actions={analytics.spendPctChange != null ? (
                        <span className={`ui-trend ${analytics.spendPctChange > 0 ? "tone-danger" : "tone-success"}`}>
                          {analytics.spendPctChange > 0 ? "▲" : "▼"} {Math.abs(analytics.spendPctChange)}% {t("inv.vsPrev")}
                        </span>) : undefined}>
                    <div className="ui-chips">
                      {analytics.foodCostPct != null ? (
                        <span className="ui-chip">{t("inv.foodCost")}: <b style={{ color: fcColor(analytics.foodCostPct) }}>{analytics.foodCostPct}%</b></span>
                      ) : (
                        <span className="ui-chip muted">{analytics.missingSalesDays ? t("business.missingSalesDays", { n: analytics.missingSalesDays }) : analytics.missingCosts ? t("business.missingCosts", { n: analytics.missingCosts }) : t("inv.addSalesForFoodCost")}</span>
                      )}
                      <span className={`ui-chip${analytics.cogsPct != null ? "" : " muted"}`}>{t("inv.cogsPct")}: {analytics.cogsPct != null ? <b>{analytics.cogsPct}%</b> : t("inv.cogsUnavailable")}</span>
                      {analytics.topCategory && <span className="ui-chip">{t("inv.topCat")}: <b>{analytics.topCategory.category}</b> · {eur(analytics.topCategory.eur)}</span>}
                    </div>
                  </Panel>

                  <div className="inventory-report-kpis">
                    <Stat label={t("inv.kSpend")} value={atLeast(analytics.spendComplete, analytics.totalSpend)} tone="action" />
                    <Stat label={t("inv.kUsed")} value={atLeast(analytics.usageComplete, analytics.totalUsageEur)} tone="info" />
                    <Stat label={t("inv.kStockValue")} value={atLeast(analytics.stockComplete, analytics.stockValue)} tone="success" />
                  </div>

                  <div className="card">
                    <div className="ui-title">{t("inv.spendVsUse")}</div>
                    <div className="ui-sub">{t("inv.spendVsUseSub")}</div>
                    {analytics.trend.length === 0 ? (
                      <EmptyState title={t("inv.noTrend")} />
                    ) : (
                      <div className="ui-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.trend} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={(v) => fmtMonthDay(v, locale)} tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={TOOLTIP} labelFormatter={(v) => fmtMonthDay(String(v), locale)} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar name={t("inv.legendSpend")} dataKey="spend" fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                            <Bar name={t("inv.legendUse")} dataKey="usageEur" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {monthTrend.length > 0 && (
                    <div className="card">
                      <div className="ui-title">{t("inv.sixMonth")}</div>
                      <div className="ui-sub">{t("inv.sixMonthSub")}</div>
                      <div className="ui-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={monthTrend} margin={{ top: 6, right: -12, bottom: 0, left: -18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="l" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 12, fill: "var(--gray)" }} tickLine={false} axisLine={false} unit="%" />
                            <Tooltip contentStyle={TOOLTIP} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="l" name={t("inv.legendSpend")} dataKey="spend" fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                            <Line yAxisId="r" name={t("inv.foodCost")} dataKey="foodCostPct" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {variance?.hasData && variance.items.some((v: any) => v.flag === "up" || v.flag === "down") && (
                    <div className="card">
                      <div className="ui-title">{t("inv.variance")}</div>
                      <div className="ui-sub">{variance.normalised ? t("inv.varianceSubNorm") : t("inv.varianceSubRaw")}</div>
                      {variance.items.filter((v: any) => v.flag === "up" || v.flag === "down").slice(0, 8).map((v: any, i: number) => {
                        const up = v.flag === "up";
                        return (
                          <div key={i} className="ui-list-item">
                            <div>
                              <div className="ui-body">{v.product}</div>
                              <div className="ui-muted">€{v.prevEur} → €{v.curEur}</div>
                            </div>
                            <div className={`ui-trend ${up ? "tone-danger" : "tone-success"}`}>
                              {v.changePct != null ? `${v.changePct > 0 ? "▲" : "▼"} ${Math.abs(v.changePct)}%` : "—"}
                            </div>
                          </div>
                        );
                      })}
                      <div className="ui-note">{t("inv.varianceNote")}</div>
                    </div>
                  )}

                  <div className="card">
                    <div className="ui-title spaced">{t("inv.byCategory")}</div>
                    {analytics.byCategory.length === 0 ? <div className="ui-muted">{t("inv.noData")}</div> :
                      analytics.byCategory.map((r: any, i: number) => {
                        const pct = analytics.totalSpend > 0 ? Math.round((r.eur / analytics.totalSpend) * 100) : 0;
                        return (
                          <div key={i} className="ui-bar-row">
                            <div className="u-between ui-body"><span>{r.category}</span><span className="tone-action u-semibold">{eur(r.eur)} · {pct}%</span></div>
                            <div className="ui-bar" role="img" aria-label={`${r.category}: ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="card">
                    <div className="ui-title spaced">{t("inv.topSpend")}</div>
                    {analytics.topSpend.length === 0 ? <div className="ui-muted">{t("inv.noData")}</div> :
                      analytics.topSpend.map((r: any, i: number) => (
                        <div key={i} className="ui-list-item ui-body">
                          <span>{r.product}</span><span className="ui-figure tone-action">{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>

                  <div className="card">
                    <div className="ui-title">{t("inv.topUse")}</div>
                    <div className="ui-sub">{t("inv.topUseSub")}</div>
                    {analytics.topUsage.length === 0 ? <div className="ui-muted">{t("inv.noUseData")}</div> :
                      analytics.topUsage.map((r: any, i: number) => (
                        <div key={i} className="ui-list-item ui-body">
                          <span>{r.product} <span className="ui-muted">· {r.qty}</span></span>
                          <span className="ui-figure tone-info">{eur(r.eur)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "forecast" && (
            <>
              <div className="ui-sub">{t("inv.forecastIntro")}</div>
              <Link href="/stock-alerts" className="inventory-alert-link">{t("home.stockAlerts")} →</Link>
              {lowStock.length > 0 && <details className="inventory-operation-menu">
                <summary>{t("inventoryWorkflow.exportShortages")}</summary>
                <div className="inventory-links">
                  <button className="btn-secondary" onClick={copyShoppingList}>{t("inv.copyShort")}</button>
                  <button className="btn-secondary" onClick={downloadShoppingCsv}>CSV</button>
                  <button className="btn-secondary" onClick={printShoppingList}>{t("inventoryWorkflow.print")}</button>
                </div>
              </details>}
              <div className="ui-toolbar">
                <span className="ui-muted">{t("inv.coverFor")}</span>
                <Segmented label={t("inv.coverFor")} value={String(coverDays)} onChange={(v) => { const cd = Number(v); setCoverDays(cd); getDepletionForecast(30, cd).then((r) => { if (r.ok) setForecast(r); else setLoadError(serverText(r.error ?? "", locale) || t("inv.failed")); }); }}
                  options={[7, 14, 30].map((cd) => ({ value: String(cd), label: `${cd}${t("inv.daysShort")}` }))} />
                <button type="button" className="btn-secondary u-push" onClick={copyOrderList}>{t("inv.copyOrder")}</button>
              </div>
              {!forecast ? <CardSkeleton rows={4} /> : forecast.items.length === 0 ? (
                <div className="card"><EmptyState title={forecast.hasData ? t("inv.forecastNoUse") : t("inv.forecastNoData")} /></div>
              ) : <div className="table-scroll" role="region" aria-label={t("inventoryWorkflow.reorder")} tabIndex={0}><table className="data-table inventory-table"><thead><tr>
                <th scope="col">{t("inv.product")}</th><th scope="col" className="numeric">{t("inv.onHand")}</th><th scope="col" className="numeric">{t("inventoryWorkflow.dailyUsage")}</th><th scope="col" className="numeric">{t("inventoryWorkflow.coverage")}</th><th scope="col" className="numeric">{t("inv.order")}</th>
              </tr></thead><tbody>{forecast.items.map((it: any, i: number) => {
                const dl = it.daysLeft;
                const c = dl == null ? "" : dl < 2 ? "tone-danger" : dl < 4 ? "tone-warn" : "tone-success";
                return (
                  <tr key={i}>
                    <td><strong>{it.product}</strong><div className="muted">{it.category}</div><div className="muted">{it.countDate} · {it.needsReview ? t("inventoryReview.recount") : it.stale ? t("inventoryWorkflow.recount") : t("inventoryWorkflow.observed", { n: it.observedDays || 0 })}</div></td>
                    <td className="numeric" data-label={t("inv.onHand")}>{it.current ?? "—"} {it.unit || ""}</td>
                    <td className="numeric" data-label={t("inventoryWorkflow.dailyUsage")}>{it.usageRate > 0 ? `${it.usageRate} ${it.unit || ""}` : "—"}</td>
                    <td className={`numeric ${c}`} data-label={t("inventoryWorkflow.coverage")}>{dl == null ? "—" : t("inv.daysLeftVal", { n: dl })}</td>
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

function fcColor(pct: number) { return pct <= 32 ? "var(--success)" : pct <= 38 ? "#d4a847" : "var(--danger)"; }
