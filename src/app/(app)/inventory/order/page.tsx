"use client";
import { askConfirm } from "@/components/ConfirmDialog";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import InventoryNav from "@/components/InventoryNav";
import { EmptyState, ErrorState, PageHeader, Segmented } from "@/components/ui";
import { getInventoryContext, getPurchaseOrderDraft } from "@/lib/queries/inventory";
import { orderLineCost, orderSummary } from "@/lib/inventory/orderDraft";
import { STAGE_KEY, type Staged } from "@/lib/inventory/stageOrder";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { formatEur } from "@/lib/format";

type Item = { product: string; category: string; qty: number | string; unit: string; unitPrice: number | null; priceDate?: string | null };
type Group = { supplier: string; items: Item[] };

export default function OrderPage() {
  const { t, locale } = useLang();
  const [groups, setGroups] = useState<Group[]>([]);
  const [coverDays, setCoverDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [branchName, setBranchName] = useState("");
  const request = useRef(0), leaving = useRef(false);
  const eur = (n: number, unit = false) => formatEur(n, locale, unit ? 4 : 2);
  async function load(cd: number) {
    const id = ++request.current;
    setLoading(true); setError(false); setGroups([]); setDirty(false);
    try {
      const [result, context] = await Promise.all([getPurchaseOrderDraft(cd), getInventoryContext()]);
      if (id !== request.current) return;
      if (!result.ok || !context.ok) { setError(true); return; }
      setBranchName(context.branch.name);
      setGroups(result.groups.map(g => ({ supplier: g.supplier, items: g.items.map(it => ({ ...it })) })));
    } catch { if (id === request.current) setError(true); }
    finally { if (id === request.current) setLoading(false); }
  }
  useEffect(() => { load(coverDays); return () => { request.current++; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [coverDays]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (leaving.current) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function setQty(gi: number, ii: number, value: string) {
    setDirty(true);
    setGroups(old => old.map((group, index) => index !== gi ? group : { ...group, items: group.items.map((item, i) => i !== ii ? item : { ...item, qty: value }) }));
  }
  function removeItem(gi: number, ii: number) {
    setDirty(true);
    setGroups(old => old.map((group, index) => index !== gi ? group : { ...group, items: group.items.filter((_, i) => i !== ii) }).filter(group => group.items.length));
  }
  const summary = orderSummary(groups.flatMap(g => g.items));
  const exportable = !loading && !error && summary.selected > 0 && summary.invalidQuantities === 0;
  const amount = (items: Item[]) => {
    const s = orderSummary(items);
    return `${t(s.complete ? "po.subtotal" : "orderDraft.knownAmount")}: ${s.complete ? "" : "≥ "}${eur(s.value)}${s.missingPrices ? ` · ${t("orderDraft.missingPrices", { n: s.missingPrices })}` : ""}`;
  };
  function groupText(group: Group) {
    return [t("orderDraft.title"), `${branchName} · ${fmtDay(berlinToday(), locale)}`, t("orderDraft.notice"), `${t("po.supplier")}: ${group.supplier || t("po.noSupplier")}`,
      ...group.items.filter(it => Number(it.qty) > 0).map(it => `${it.product}: ${it.qty} ${it.unit} · ${orderLineCost(it) == null ? t("po.noPrice") : eur(orderLineCost(it)!)}`), amount(group.items)].join("\n");
  }
  // Hand this supplier's lines to the purchase order form (pre-filled, unsaved). Quantities as edited here.
  function createOrder(group: Group) {
    const staged: Staged = { supplier: group.supplier, items: group.items.map(({ product, category, unit, qty, unitPrice }) => ({ product, category, unit, qty, unitPrice })) };
    try { sessionStorage.setItem(STAGE_KEY, JSON.stringify(staged)); } catch { toast(t("po.failed"), "error"); return; }
    leaving.current = true; // the edits travel with the order: no "unsaved changes" prompt
    window.location.assign("/inventory/purchasing?new=1&stage=1");
  }
  async function copy(group: Group) {
    try { await navigator.clipboard.writeText(groupText(group)); toast(t("po.copied"), "success"); }
    catch { toast(t("po.failed"), "error"); }
  }
  function print() {
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const win = window.open("", "_blank");
    if (!win) { toast(t("orderDraft.printBlocked"), "error"); return; }
    win.document.write(`<!doctype html><html lang="${locale}"><head><title>${esc(t("orderDraft.title"))}</title><style>body{font:14px system-ui;color:#111;padding:24px}pre{font:inherit;white-space:pre-wrap;line-height:1.8}section{break-inside:avoid;border-bottom:1px solid #ccc;padding:16px 0}</style></head><body>${groups.filter(g => orderSummary(g.items).selected > 0).map(g => `<section><pre>${esc(groupText(g))}</pre></section>`).join("")}<p>${esc(amount(groups.flatMap(g => g.items)))}</p><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }
  return <div className="inventory-page">
    <InventoryNav active="purchasing" canLeave={async () => !dirty || (await askConfirm({ message: t("orderDraft.discard") }))} />
    <PageHeader title={locale==="de"?"Nachbestell-Arbeitsblatt":"Reorder worksheet"} subtitle={branchName || t("common.loading")} />
    <p className="ui-note">{t("orderDraft.notice")}</p>
    <Link className="btn-gold" href="/inventory/purchasing?new=1" onClick={async event=>{if(!dirty)return;event.preventDefault();if(await askConfirm({ message: t("orderDraft.discard") }))window.location.assign("/inventory/purchasing?new=1");}}>{t("inventoryOps.createSavedOrder")}</Link>
    <div className="ui-toolbar">
      <Segmented label={t("po.coverFor")} value={String(coverDays)} onChange={async value => { if (!dirty || (await askConfirm({ message: t("orderDraft.discard") }))) setCoverDays(Number(value)); }} options={[7, 14, 30].map(n => ({ value: String(n), label: t("orderDraft.days", { n }) }))} />
      <button type="button" className="btn-secondary u-push" onClick={print} disabled={!exportable}>{t("po.printPdf")}</button>
    </div>
    {loading ? <CardSkeleton rows={4} /> : error ? <ErrorState message={t("orderDraft.loadFailed")} onRetry={() => load(coverDays)} retryLabel={t("business.retry")} />
      : groups.length === 0 ? <EmptyState title={t("orderDraft.empty")}><span>{t("orderDraft.emptyHelp")}</span></EmptyState>
      : <>
        <div className="order-draft-summary" role="status"><strong>{amount(groups.flatMap(g => g.items))}</strong><span>{dirty ? t("orderDraft.edited") : t("orderDraft.estimate")}</span>
          {summary.invalidQuantities > 0 && <span className="tone-danger">{t("orderDraft.invalidQuantities")}</span>}
          {summary.selected === 0 && <span>{t("orderDraft.selectItems")}</span>}
        </div>
        {/* One card per supplier (AI Studio "reorder runway"): editable quantities, line and supplier totals, then "Create order". */}
        <div className="supplier-cards">{groups.map((group, gi) => { const sum = orderSummary(group.items); return <section key={gi} className="card supplier-card" aria-labelledby={`sup-${gi}`}>
          <header>
            <div><h2 id={`sup-${gi}`}>{group.supplier || t("po.noSupplier")}</h2><span className="ui-muted inv-mono">{group.items.length} {locale === "de" ? "Artikel" : "items"} · {amount(group.items)}</span></div>
            <button type="button" className="btn-gold ui-btn-sm" disabled={!exportable || sum.selected === 0 || sum.invalidQuantities > 0} onClick={() => createOrder(group)}>{locale === "de" ? "Bestellung anlegen" : "Create order"}</button>
          </header>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={group.supplier || t("po.noSupplier")}>
            <table className="data-table supplier-table"><thead><tr><th scope="col">{t("po.product")}</th><th scope="col" className="numeric">{t("po.qty")}</th><th scope="col" className="numeric">{t("po.unitPrice")}</th><th scope="col" className="numeric">{t("po.lineTotal")}</th><th scope="col"><span className="sr-only">{t("inventoryWorkflow.actions")}</span></th></tr></thead>
              <tbody>{group.items.map((it, ii) => <tr key={`${it.category}|${it.product}|${it.unit}`}>
                <td><strong>{it.product}</strong><div className="muted">{it.category} · {it.unit}</div></td>
                <td className="numeric" data-label={t("po.qty")}><input className="form-input quantity-input" aria-label={`${t("po.qty")}: ${it.product} (${it.unit})`} type="number" inputMode="decimal" min="0" step="any" value={it.qty} onChange={e => setQty(gi, ii, e.target.value)} aria-invalid={it.qty === "" || !Number.isFinite(Number(it.qty)) || Number(it.qty) < 0} /> <span className="count-unit">{it.unit}</span></td>
                <td className="numeric inv-mono" data-label={t("po.unitPrice")}>{it.unitPrice == null ? t("po.noPrice") : eur(it.unitPrice, true)}{it.priceDate && <div className="muted">{fmtDay(it.priceDate, locale)}</div>}</td>
                <td className="numeric inv-mono" data-label={t("po.lineTotal")}><strong>{orderLineCost(it) == null ? "—" : eur(orderLineCost(it)!)}</strong></td>
                <td><button className="btn-quiet-danger ui-btn-sm" type="button" onClick={() => removeItem(gi, ii)} aria-label={`${t("common.delete")}: ${it.product}`}>{t("common.delete")}</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <footer><button className="btn-secondary ui-btn-sm" onClick={() => copy(group)} disabled={!exportable || sum.selected === 0}>{t("po.copy")}</button>
            <button className="btn-secondary ui-btn-sm" disabled={!exportable || sum.selected === 0} onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(t("orderDraft.title"))}&body=${encodeURIComponent(groupText(group))}`; }}>{t("po.email")}</button>
          </footer>
        </section>; })}</div>
      </>}
  </div>;
}
