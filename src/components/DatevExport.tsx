"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { Field } from "@/components/ui";
import { serverText } from "@/lib/i18n/serverMessages";
import { getDatevSettings, setDatevSettings } from "@/lib/queries/payroll";
import { buildLodas, datevSettingsError, DATEV_KINDS, type DatevRow, type DatevSettings } from "@/lib/pay/datev";

// DATEV LODAS file for the tax advisor. Only from an approved (frozen) month, so the file
// always matches what was signed off.
export default function DatevExport({ month, rows, approved }: { month: string; rows: DatevRow[]; approved: boolean }) {
  const { t, locale } = useLang();
  const [s, setS] = useState<DatevSettings | null>(null);
  const [saved, setSaved] = useState(false); // from the database, not from what is being typed
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<{ missingPnr: string[]; notInSnapshot: string[] } | null>(null);

  useEffect(() => { getDatevSettings().then((r) => { setS(r.settings); setSaved(!datevSettingsError(r.settings)); }).catch(() => setS({ beraterNr: "", mandantNr: "", lohnarten: {} })); }, []);
  useEffect(() => setLeft(null), [month]);
  if (!s) return null;

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      const r = await setDatevSettings(s);
      if (r.ok) { toast(t("datev.saved"), "success"); setSaved(true); setEdit(false); } else toast(serverText(r.error || "", locale) || t("pay.saveFailed"), "error");
    } catch { toast(t("pay.saveFailed"), "error"); }
    finally { setBusy(false); }
  }

  function download() {
    if (!s) return;
    try {
      const out = buildLodas(s, month, rows);
      setLeft({ missingPnr: out.missingPnr, notInSnapshot: out.notInSnapshot });
      if (!out.bookings) { toast(t("pay.nothingExport"), "error"); return; }
      const url = URL.createObjectURL(new Blob([out.text], { type: "text/plain;charset=windows-1252" }));
      const a = document.createElement("a"); a.href = url; a.download = `datev-lodas-${month}.txt`; a.click(); URL.revokeObjectURL(url);
      toast(t("pay.downloaded"), "success");
    } catch (e) { toast(e instanceof Error ? e.message : t("pay.saveFailed"), "error"); }
  }

  const la = (k: typeof DATEV_KINDS[number]) => (
    <Field key={k} label={t(`datev.la_${k}`)}><input className="form-input ui-input-sm" inputMode="numeric" maxLength={4} value={s.lohnarten[k] || ""} onChange={(e) => setS({ ...s, lohnarten: { ...s.lohnarten, [k]: e.target.value.replace(/\D/g, "") } })} style={{ width: 90 }} /></Field>
  );

  return (
    <div className="card mt-4">
      <div className="card-title">{t("datev.title")}</div>
      <p className="ui-sub">{t("datev.hint")}</p>
      {(edit || !saved) ? (
        <div className="d-flex f-col gap-3">
          <div className="d-flex gap-4 f-wrap">
            <Field label={t("datev.berater")}><input className="form-input ui-input-sm" inputMode="numeric" maxLength={7} value={s.beraterNr} onChange={(e) => setS({ ...s, beraterNr: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label={t("datev.mandant")}><input className="form-input ui-input-sm" inputMode="numeric" maxLength={5} value={s.mandantNr} onChange={(e) => setS({ ...s, mandantNr: e.target.value.replace(/\D/g, "") })} /></Field>
          </div>
          <div className="d-flex gap-4 f-wrap">{DATEV_KINDS.map(la)}</div>
          <p className="ui-sub">{t("datev.laHint")}</p>
          <button className="btn-gold as-start" onClick={save} disabled={busy}>{busy ? t("common.saving") : t("pay.saveRules")}</button>
        </div>
      ) : (
        <div className="d-flex gap-2 f-wrap ai-c">
          <button className="btn-gold" onClick={download} disabled={!approved}>{t("datev.download")}</button>
          <button className="btn-secondary ui-btn-sm" onClick={() => setEdit(true)}>{t("datev.edit")}</button>
          <span className="ui-muted t-xs">{t("datev.numbers", { b: s.beraterNr, m: s.mandantNr })}</span>
          {!approved && <span className="tone-warn t-xs">{t("datev.approveFirst")}</span>}
        </div>
      )}
      {left?.missingPnr.length ? <p className="tone-danger t-sm">{t("datev.missingPnr", { names: left.missingPnr.join(", ") })}</p> : null}
      {left?.notInSnapshot.length ? <p className="tone-warn t-sm">{t("datev.notInSnapshot")}</p> : null}
    </div>
  );
}
