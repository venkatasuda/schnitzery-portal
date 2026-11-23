"use client";
// Payroll: what the manager or tax adviser must look at for sick pay this month (flags from src/lib/pay/sickPay.ts).
// Only the eAU tick is an action here; everything else is information for the payslip.
import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { setEauConfirmed } from "@/lib/queries/leave";
import { serverText } from "@/lib/i18n/serverMessages";
import { fmtDay } from "@/lib/time/berlinDate";
import type { SickFlag } from "@/lib/pay/sickPay";

type Row = { userId: string; name: string; sickDays: number; sickFlags: SickFlag[] };

export default function SickPayChecks({ rows, frozen, onChanged }: { rows: Row[]; frozen: boolean; onChanged: () => void }) {
  const { locale } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const d = (x: string) => fmtDay(x, locale);
  const items = rows.flatMap((r) => r.sickFlags.filter((f) => f.kind !== "missingWage").map((f, i) => ({ key: `${r.userId}-${i}`, name: r.name, f })));
  if (!rows.some((r) => r.sickDays > 0 || r.sickFlags.length)) return null;

  async function tick(leaveId: string) {
    setBusy(leaveId);
    const r = await setEauConfirmed(leaveId, true).catch(() => ({ ok: false, error: s("Network error.", "Netzwerkfehler.") }));
    setBusy(null);
    if (r.ok) { toast(s("eAU marked as retrieved.", "eAU als abgerufen markiert."), "success"); onChanged(); }
    else toast(serverText(r.error ?? "", locale) || s("Could not save.", "Speichern fehlgeschlagen."), "error");
  }

  const text = (f: SickFlag) => {
    switch (f.kind) {
      case "waiting": return s(`First 4 weeks of employment: no sick pay until ${d(f.until)} (§ 3 Abs. 3 EFZG).`, `Erste 4 Wochen der Beschäftigung: keine Entgeltfortzahlung bis ${d(f.until)} (§ 3 Abs. 3 EFZG).`);
      case "ended": return s(`6 weeks used up on ${d(f.on)}. From the next day the health insurer pays sick benefit (Krankengeld).`, `6 Wochen am ${d(f.on)} ausgeschöpft. Ab dem Folgetag zahlt die Krankenkasse Krankengeld.`);
      case "repeat": return s(`Sick again from ${d(f.from)}; last sickness ended ${d(f.lastEnd)}. If it is the same illness, the 6 weeks may continue: check with the tax adviser.`, `Erneut krank ab ${d(f.from)}; letzte Krankheit endete ${d(f.lastEnd)}. Bei derselben Krankheit laufen die 6 Wochen ggf. weiter: mit dem Steuerberater klären.`);
      case "eau": return s(`Sick ${d(f.from)} – ${d(f.to)} (more than 3 days) without a doctor's note.`, `Krank ${d(f.from)} – ${d(f.to)} (mehr als 3 Tage) ohne AU-Bescheinigung.`);
      case "noStart": return s("No start date: the 4-week waiting period was not checked.", "Kein Eintrittsdatum: die 4-Wochen-Wartezeit wurde nicht geprüft.");
      case "noHistory": return s("No roster and no past shifts: some sick days count 0 hours. Agree the hours with the tax adviser.", "Kein Dienstplan und keine früheren Schichten: einige Krankheitstage zählen 0 Std. Stunden mit dem Steuerberater klären.");
      default: return "";
    }
  };

  return (
    <section className="card mt-4" aria-labelledby="sick-checks-title">
      <div className="card-title" id="sick-checks-title">{s("Sick pay", "Entgeltfortzahlung")}{items.length > 0 ? ` · ${s(`${items.length} to check`, `${items.length} zu prüfen`)}` : ""}</div>
      {items.length > 0 && <ul className="sick-checks">
        {items.map(({ key, name, f }) => <li key={key}>
          <span className="fw-6">{name}</span> · {text(f)}
          {f.kind === "noStart" && <> <Link href="/staff" className="ui-text-link">{s("Set start date", "Eintrittsdatum setzen")}</Link></>}
          {f.kind === "eau" && !frozen && <> <button type="button" className="btn-secondary ui-btn-sm" disabled={busy === f.leaveId} onClick={() => void tick(f.leaveId)}>{busy === f.leaveId ? "…" : s("eAU retrieved", "eAU abgerufen")}</button></>}
        </li>)}
      </ul>}
      <div className="ui-note">{s("Calculated by § 4 EFZG: the hours rostered for that day (including shifts handed to a colleague), otherwise the 12-month average; overtime excluded; at most 6 weeks per illness.",
        "Berechnet nach § 4 EFZG: die für den Tag geplanten Stunden (auch an Kollegen abgegebene Schichten), sonst der 12-Monats-Durchschnitt; ohne Überstunden; höchstens 6 Wochen je Krankheit.")}</div>
    </section>
  );
}
