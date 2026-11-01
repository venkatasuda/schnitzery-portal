"use client";

import { useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { serverText } from "@/lib/i18n/serverMessages";
import { uploadPayslip } from "@/lib/queries/documents";

// Upload the tax advisor's payslip PDFs for the month; staff find them under Documents.
export default function PayslipUpload({ month, people }: { month: string; people: { userId?: string; name: string }[] }) {
  const { t, locale } = useLang();
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const file = useRef<HTMLInputElement>(null);
  const list = people.filter((p): p is { userId: string; name: string } => !!p.userId);

  async function send() {
    const f = file.current?.files?.[0];
    if (!who || !f) { toast(t("payslip.pick"), "error"); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.set("userId", who); fd.set("month", month); fd.set("file", f);
      const r = await uploadPayslip(fd);
      if (r.ok) { toast(t("payslip.done"), "success"); setDone((d) => new Set(d).add(`${who}|${month}`)); setWho(""); if (file.current) file.current.value = ""; }
      else toast(serverText(r.error, locale), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setBusy(false); }
  }

  if (!list.length) return null;
  return (
    <div className="card mt-4">
      <div className="card-title">{t("payslip.title")}</div>
      <p className="ui-sub">{t("payslip.hint")}</p>
      <div className="d-flex gap-2 ai-c f-wrap">
        <select className="form-select ui-input-sm" value={who} disabled={busy} onChange={(e) => setWho(e.target.value)} aria-label={t("payslip.person")}>
          <option value="">{t("payslip.person")}</option>
          {list.map((p) => <option key={p.userId} value={p.userId}>{done.has(`${p.userId}|${month}`) ? "✓ " : ""}{p.name}</option>)}
        </select>
        <input ref={file} type="file" accept="application/pdf,.pdf" disabled={busy} aria-label={t("payslip.file")} />
        <button className="btn-gold" onClick={send} disabled={busy}>{busy ? t("common.saving") : t("payslip.upload")}</button>
      </div>
    </div>
  );
}
