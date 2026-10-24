"use client";

import { useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { parseSalesCsv, type SalesRow } from "@/lib/sales/parseSalesCsv";
import { importDailySales } from "@/lib/queries/labor";
import { fmtDay } from "@/lib/time/berlinDate";
import { toast } from "@/components/Toast";

// Upload the till's daily sales export (CSV) instead of typing each day.
// Read in the browser → preview (days, range, total, unreadable lines) → confirm.
export default function SalesImport({ onDone }: { onDone: () => void }) {
  const { t, locale } = useLang();
  const file = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SalesRow[] | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const eur = (v: number) => new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR" }).format(v);

  async function read(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) { toast(t("salesImport.tooBig"), "error"); return; }
    const r = parseSalesCsv(await f.text());
    setSkipped(r.skipped);
    if (r.rows.length === 0) { setRows(null); toast(t("salesImport.nothing"), "error"); return; }
    setRows(r.rows);
  }

  async function confirm() {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await importDailySales(rows);
      if (!r.ok) { toast(r.error ?? t("common.loadFailed"), "error"); return; }
      toast(t("salesImport.done", { n: r.count }), "success");
      setRows(null); setSkipped([]); if (file.current) file.current.value = "";
      onDone();
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setBusy(false); }
  }

  const total = rows?.reduce((s, r) => s + r.amount, 0) ?? 0;
  return (
    <div className="card u-mb-2">
      <div className="d-flex ai-c jc-sb gap-3 f-wrap">
        <div>
          <div className="fw-6">{t("salesImport.title")}</div>
          <div className="ui-note">{t("salesImport.hint")}</div>
        </div>
        <label className="btn-secondary">
          {t("salesImport.choose")}
          <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
        </label>
      </div>
      {rows && (
        <div className="mt-3" role="status">
          <p className="t-sm">{t("salesImport.preview", { n: rows.length, from: fmtDay(rows[0].date, locale), to: fmtDay(rows[rows.length - 1].date, locale), total: eur(total) })}</p>
          {skipped.length > 0 && <p className="t-sm tone-warn">{t("salesImport.skipped", { lines: skipped.slice(0, 10).join(", ") + (skipped.length > 10 ? " …" : "") })}</p>}
          <p className="ui-note">{t("salesImport.overwrite")}</p>
          <div className="d-flex gap-2 mt-2">
            <button className="btn-gold" onClick={confirm} disabled={busy}>{busy ? t("common.saving") : t("salesImport.import", { n: rows.length })}</button>
            <button className="btn-secondary" onClick={() => { setRows(null); setSkipped([]); if (file.current) file.current.value = ""; }} disabled={busy}>{t("common.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
