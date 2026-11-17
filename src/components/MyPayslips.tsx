"use client";
// Employee: the payslips the manager uploaded (tax adviser PDFs), one row per month, tap to download.
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { listMyPayslips, getDocumentUrl } from "@/lib/queries/documents";
import { toast } from "@/components/Toast";

type Slip = { id: string; path: string; month: string; uploaded: string };

export default function MyPayslips() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [slips, setSlips] = useState<Slip[] | null>(null), [failed, setFailed] = useState(false), [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    listMyPayslips().then((r) => { if (!live) return; if (r.ok) setSlips(r.payslips); else setFailed(true); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  async function open(slip: Slip) {
    setBusy(slip.id);
    try {
      const r = await getDocumentUrl(slip.path);
      if (r.ok && r.url) window.open(r.url, "_blank", "noopener"); else toast(s("Could not open the payslip.", "Lohnabrechnung konnte nicht geöffnet werden."), "error");
    } catch { toast(s("Could not open the payslip.", "Lohnabrechnung konnte nicht geöffnet werden."), "error"); }
    finally { setBusy(null); }
  }

  return (
    <section className="card mt-4" aria-labelledby="payslips-title">
      <div className="card-title" id="payslips-title">💶 {s("Payslips", "Lohnabrechnungen")}</div>
      {failed ? <p className="ui-sub">{s("Payslips could not be loaded.", "Lohnabrechnungen konnten nicht geladen werden.")}</p>
        : slips == null ? <p className="ui-sub" aria-busy="true">{s("Loading…", "Wird geladen…")}</p>
        : !slips.length ? <p className="ui-sub">{s("No payslips yet. Your manager uploads them each month.", "Noch keine Lohnabrechnungen. Die Leitung lädt sie monatlich hoch.")}</p>
        : <ul className="payslip-list">{slips.map((p, i) => (
            <li key={p.id}>
              <span>{monthLabel(p.month)}{i > 0 && slips[i - 1].month === p.month ? ` · ${s("earlier version", "frühere Version")}` : ""}</span>
              <button type="button" className="btn-secondary ui-btn-sm" disabled={busy === p.id} aria-busy={busy === p.id} onClick={() => void open(p)}>
                {s("Download PDF", "PDF herunterladen")}
              </button>
            </li>))}
          </ul>}
    </section>
  );
}
