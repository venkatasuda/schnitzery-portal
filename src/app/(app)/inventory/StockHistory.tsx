"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getStockHistory } from "@/lib/queries/stock-history";
import MovementDetails from "@/components/inventory/MovementDetails";

type Event = {
  id: number; source_table: string; source_id: string; operation: string;
  before_row: Record<string, unknown> | null; after_row: Record<string, unknown> | null;
  actor_id: string | null; actor_name?:string|null; recorded_at: string;
};

export default function StockHistory() {
  const { t, locale } = useLang();
  const [source, setSource] = useState("all");
  const [before, setBefore] = useState<number>();
  const [next, setNext] = useState<number>();
  const [rows, setRows] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [detail,setDetail]=useState<{kind:"waste"|"transfer";id:string}|null>(null);
  const [draft,setDraft]=useState({product:"",from:"",to:""}),[filters,setFilters]=useState({product:"",from:"",to:""});
  useEffect(()=>{const q=new URLSearchParams(window.location.search);const f={product:q.get("historyProduct")||"",from:q.get("historyFrom")||"",to:q.get("historyTo")||""};setDraft(f);setFilters(f);},[]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setRows([]); setNext(undefined);
    getStockHistory(source, before, filters).then(result => {
      if (!active) return;
      if (result.ok) { setRows(result.rows as Event[]); setNext(result.next); }
      else setError(true);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source, before, retry,filters]);
  const value = (row: Event["before_row"], count: boolean) => row ? String(row[count ? "ist" : "qty"] ?? "—") + (row.unit ? ` ${row.unit}` : "") : "—";
  return <section className="card" aria-label={t("stockHistory.title")} aria-busy={loading}>
    <h2>{t("stockHistory.title")}</h2>
    <p className="page-sub">{t("stockHistory.note")}</p>
    {detail&&<MovementDetails {...detail} onClose={()=>setDetail(null)} onSaved={()=>setRetry(v=>v+1)}/>}
    <form className="inventory-toolbar" onSubmit={e=>{e.preventDefault();setFilters({...draft});setBefore(undefined);const url=new URL(window.location.href);for(const [key,value] of Object.entries(draft)){if(value)url.searchParams.set(`history${key[0].toUpperCase()}${key.slice(1)}`,value);else url.searchParams.delete(`history${key[0].toUpperCase()}${key.slice(1)}`);}window.history.replaceState(null,"",url);}}>
      <label>{t("inventoryOps.product")}<input type="search" className="form-input" maxLength={160} value={draft.product} onChange={e=>setDraft({...draft,product:e.target.value})}/></label>
      <label>{t("inventoryOps.recordedFrom")}<input type="date" className="form-input" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
      <label>{t("inventoryOps.recordedTo")}<input type="date" className="form-input" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label>
      <button className="btn-secondary">{t("inventoryOps.applyFilters")}</button>
    </form>
    <div className="inventory-toolbar">
      <label>{t("stockHistory.source")}<select className="form-select" value={source} onChange={e => { setSource(e.target.value); setBefore(undefined); }}>
        {["all", "inventory_counts", "inventory_purchases", "waste_log", "stock_transfers"].map(key => <option key={key} value={key}>{t(`stockHistory.${key}`)}</option>)}
      </select></label>
      <button className="btn-secondary" onClick={() => { setBefore(undefined); setRetry(x => x + 1); }} disabled={loading}>{t("stockHistory.latest")}</button>
    </div>
    {error ? <div role="alert"><p>{t("stockHistory.failed")}</p><button className="btn-secondary" onClick={() => setRetry(x => x + 1)}>{t("business.retry")}</button></div>
      : loading ? <p role="status">{t("common.loading")}</p>
      : rows.length === 0 ? <p>{t("stockHistory.empty")}</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-label={t("stockHistory.title")}><table className="data-table">
        <thead><tr>{["recorded", "product", "event", "quantity", "details"].map(key => <th scope="col" key={key}>{t(`stockHistory.${key}`)}</th>)}</tr></thead>
        <tbody>{rows.map(event => {
          const row = event.after_row || event.before_row;
          return <tr key={event.id}>
            <td>{new Date(event.recorded_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}<div className="muted">{event.actor_name||t("stockHistory.unknown")}</div></td>
            <td><strong>{String(row?.product ?? "—")}</strong><div className="page-sub">{String(row?.category ?? "")}</div></td>
            <td>{t(`stockHistory.${event.source_table}`)}<div>{t(`stockHistory.${event.operation}`)}</div></td>
            <td>{value(event.before_row, event.source_table === "inventory_counts")} → {value(event.after_row, event.source_table === "inventory_counts")}
              {event.source_table === "stock_transfers" && <div>{event.before_row?.status?t(`xfer.st_${event.before_row.status}`):"—"} → {event.after_row?.status?t(`xfer.st_${event.after_row.status}`):"—"}{event.after_row?.received_qty!=null&&` · ${t("inventoryOps.received")}: ${event.after_row.received_qty}`}</div>}</td>
            <td><details><summary>{t("stockHistory.details")}</summary>
              <p>{t("stockHistory.reference")}: {event.source_id}</p>
              <p>{t("stockHistory.actor")}: {event.actor_id || t("stockHistory.unknown")}</p>
              {([event.before_row, event.after_row] as const).map((snapshot, index) => snapshot && <div key={index}>
                <strong>{t(index ? "stockHistory.after" : "stockHistory.before")}</strong>
                <p>{String(snapshot.count_date ?? snapshot.purchase_date ?? snapshot.work_date ?? snapshot.created_at ?? "—")}</p>
                <p>{String(snapshot.reason ?? "")} {String(snapshot.note ?? "")}</p>
              </div>)}
            </details>{["waste_log","stock_transfers"].includes(event.source_table)&&<button className="btn-secondary" onClick={()=>setDetail({kind:event.source_table==="waste_log"?"waste":"transfer",id:event.source_id})}>{t("inventoryOps.openDetails")}</button>}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    {next !== undefined && !loading && <button className="btn-secondary" onClick={() => setBefore(next)}>{t("stockHistory.older")}</button>}
  </section>;
}
