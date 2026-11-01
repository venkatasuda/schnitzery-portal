"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { serverText } from "@/lib/i18n/serverMessages";
import { formatEur } from "@/lib/format";
import { berlinMonday } from "@/lib/time/berlinDate";
import { getTipWeek, setTipWeek } from "@/lib/queries/tips";

type Week = Extract<Awaited<ReturnType<typeof getTipWeek>>, { ok: true }>;
const shiftWeek = (w: string, n: number) => { const x = new Date(`${w}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 7 * n); return x.toISOString().slice(0, 10); };

// Weekly tip pool: enter the week's cash + card tips, see each person's share by hours.
export default function TipPool() {
  const { t, locale } = useLang();
  const [week, setWeek] = useState(() => berlinMonday(-1)); // last full week
  const [data, setData] = useState<Week | null>(null);
  const [cash, setCash] = useState(""), [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const eur = (n: number) => formatEur(n, locale, 2);
  const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" });

  const load = useCallback(async () => {
    setData(null); setFailed("");
    try {
      const r = await getTipWeek(week);
      if (r.ok) { setData(r); setCash(r.entered ? String(r.cash) : ""); setCard(r.entered ? String(r.card) : ""); }
      else setFailed(serverText(r.error, locale)); // shown in the card, never an endless "Loading…"
    } catch { setFailed(t("staff.networkErr")); }
  }, [week, locale, t]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const n = (s: string) => (s.trim() === "" ? 0 : parseFloat(s.replace(",", ".")));
    setBusy(true);
    try {
      const r = await setTipWeek(week, n(cash), n(card));
      if (r.ok) { toast(t("tips.saved"), "success"); load(); } else toast(serverText(r.error, locale), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setBusy(false); }
  }

  const total = data ? data.cash + data.card : 0;
  return (
    <div className="card u-mb-3">
      <div className="card-title">{t("tips.title")}</div>
      <p className="ui-sub">{t("tips.hint")}</p>
      <div className="d-flex gap-2 ai-c f-wrap">
        <button className="btn-secondary ui-btn-sm" onClick={() => setWeek(shiftWeek(week, -1))} aria-label={t("tips.prev")}>‹</button>
        <strong>{t("tips.week", { from: day(week), to: day(new Date(Date.parse(`${week}T12:00:00Z`) + 6 * 864e5).toISOString()) })}</strong>
        <button className="btn-secondary ui-btn-sm" onClick={() => setWeek(shiftWeek(week, 1))} disabled={week >= berlinMonday()} aria-label={t("tips.next")}>›</button>
      </div>
      <div className="d-flex gap-3 ai-c f-wrap mt-2">
        <label className="ui-muted">{t("tips.cash")}<input className="form-input ui-input-sm" type="number" inputMode="decimal" min="0" step="0.01" value={cash} disabled={busy || !data} onChange={(e) => setCash(e.target.value)} style={{ display: "block", width: 110 }} /></label>
        <label className="ui-muted">{t("tips.card")}<input className="form-input ui-input-sm" type="number" inputMode="decimal" min="0" step="0.01" value={card} disabled={busy || !data} onChange={(e) => setCard(e.target.value)} style={{ display: "block", width: 110 }} /></label>
        <button className="btn-gold" onClick={save} disabled={busy || !data}>{busy ? t("common.saving") : t("tips.save")}</button>
      </div>
      {failed ? <p role="alert" className="tone-danger t-sm">{failed} <button className="btn-secondary ui-btn-sm" onClick={load}>{t("business.retry")}</button></p>
        : !data ? <p className="ui-sub">{t("common.loading")}</p> : !data.shares.length ? <p className="ui-sub">{t("tips.noHours")}</p> : (
        <>
          {data.unapproved > 0 && <p className="tone-warn t-sm">{t("tips.unapproved", { n: data.unapproved })}</p>}
          <table className="data-table mt-2">
            <thead><tr><th scope="col">{t("pay.cName")}</th><th scope="col" className="numeric">{t("tips.hours")}</th><th scope="col" className="numeric">{t("tips.share")}</th></tr></thead>
            <tbody>{data.shares.map((s) => <tr key={s.userId}><td>{s.name}</td><td className="numeric">{s.hours}</td><td className="numeric">{data.entered ? eur(s.eur) : "—"}</td></tr>)}</tbody>
            {data.entered && <tfoot><tr><th scope="row">{t("pay.cTotal")}</th><td className="numeric">{Math.round(data.shares.reduce((a, s) => a + s.hours, 0) * 10) / 10}</td><td className="numeric fw-7">{eur(total)}</td></tr></tfoot>}
          </table>
        </>
      )}
      <p className="ui-note">{t("tips.taxNote")}</p>
    </div>
  );
}
