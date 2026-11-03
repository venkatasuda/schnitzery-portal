"use client";

import { useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { serverText } from "@/lib/i18n/serverMessages";
import { zonedToUtc } from "@/lib/time/roster";
import { closeOpenShift } from "@/lib/queries/live-attendance";

// Berlin wall-clock "YYYY-MM-DDTHH:mm" for a datetime-local input.
const berlinLocal = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ms).replace(" ", "T");

// Close a forgotten open shift with the real end time and a reason (logged; the employee is notified).
export default function CloseShiftForm({ id, clockIn, onDone }: { id: string; clockIn: string; onDone: () => void }) {
  const { t, locale } = useLang();
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const inMs = Date.parse(clockIn);
  const min = berlinLocal(inMs + 60000), max = berlinLocal(Math.min(Date.now(), inMs + 16 * 3600e3));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!end || reason.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      const [d, hm] = end.split("T");
      const r = await closeOpenShift(id, zonedToUtc(d, hm).toISOString(), reason.trim());
      if (r.ok) { toast(t("ahub.closeDone"), "success"); setOpen(false); onDone(); }
      else toast(serverText(r.error || "", locale), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setBusy(false); }
  }

  if (!open) return <button type="button" className="btn-secondary ui-btn-sm ml-2" onClick={() => setOpen(true)}>{t("ahub.closeShift")}</button>;
  return (
    <form onSubmit={submit} className="d-flex gap-2 ai-c f-wrap mt-2">
      <label className="ui-muted t-xs">{t("ahub.closeEnd")}
        <input className="form-input ui-input-sm" type="datetime-local" required min={min} max={max} value={end} disabled={busy} onChange={(e) => setEnd(e.target.value)} style={{ display: "block" }} />
      </label>
      <label className="ui-muted t-xs u-flex1">{t("ahub.closeReason")}
        <input className="form-input ui-input-sm" required minLength={3} maxLength={500} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder={t("ahub.closeReasonPh")} style={{ display: "block", width: "100%" }} />
      </label>
      <button type="submit" className="btn-gold ui-btn-sm" disabled={busy || !end || reason.trim().length < 3}>{busy ? t("common.saving") : t("ahub.closeConfirm")}</button>
      <button type="button" className="btn-secondary ui-btn-sm" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
    </form>
  );
}
