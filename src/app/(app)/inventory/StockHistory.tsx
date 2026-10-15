"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { getStockHistory } from "@/lib/queries/stock-history";

type Event = {
  id: number; source_table: string; source_id: string; operation: string;
  before_row: Record<string, unknown> | null; after_row: Record<string, unknown> | null;
  actor_id: string | null; recorded_at: string;
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
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setRows([]); setNext(undefined);
    getStockHistory(source, before).then(result => {
      if (!active) return;
      if (result.ok) { setRows(result.rows as Event[]); setNext(result.next); }
      else setError(true);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source, before, retry]);
  const value = (row: Event["before_row"], count: boolean) => row ? String(row[count ? "ist" : "qty"] ?? "—") + (row.unit ? ` ${row.unit}` : "") : "—";
  return <section className="card" aria-label={t("stockHistory.title")} aria-busy={loading}>
    <h2>{t("stockHistory.title")}</h2>
    <p className="page-sub">{t("stockHistory.note")}</p>
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
            <td>{new Date(event.recorded_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}</td>
            <td><strong>{String(row?.product ?? "—")}</strong><div className="page-sub">{String(row?.category ?? "")}</div></td>
            <td>{t(`stockHistory.${event.source_table}`)}<div>{t(`stockHistory.${event.operation}`)}</div></td>
            <td>{value(event.before_row, event.source_table === "inventory_counts")} → {value(event.after_row, event.source_table === "inventory_counts")}
              {event.source_table === "stock_transfers" && <div>{String(event.before_row?.status ?? "—")} → {String(event.after_row?.status ?? "—")}</div>}</td>
            <td><details><summary>{t("stockHistory.details")}</summary>
              <p>{t("stockHistory.reference")}: {event.source_id}</p>
              <p>{t("stockHistory.actor")}: {event.actor_id || t("stockHistory.unknown")}</p>
              {([event.before_row, event.after_row] as const).map((snapshot, index) => snapshot && <div key={index}>
                <strong>{t(index ? "stockHistory.after" : "stockHistory.before")}</strong>
                <p>{String(snapshot.count_date ?? snapshot.purchase_date ?? snapshot.work_date ?? snapshot.created_at ?? "—")}</p>
                <p>{String(snapshot.reason ?? "")} {String(snapshot.note ?? "")}</p>
              </div>)}
            </details></td>
          </tr>;
        })}</tbody>
      </table></div>}
    {next !== undefined && !loading && <button className="btn-secondary" onClick={() => setBefore(next)}>{t("stockHistory.older")}</button>}
  </section>;
}
