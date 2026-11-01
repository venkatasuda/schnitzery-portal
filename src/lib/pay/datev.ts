// DATEV LODAS ASCII movement data (Bewegungsdaten) from an approved payroll month.
// Pure. Hours only (Bearbeitungsschlüssel 1 = Stunden); the tax advisor's Lohnarten turn
// them into pay and tax-free SFN surcharges. Format per DATEV's LODAS ASCII interface.
// ponytail: LODAS only; add DATEV Lohn und Gehalt when a tax advisor asks for it.

export const DATEV_KINDS = ["regular", "overtime", "night", "sunday", "holiday"] as const;
export type DatevKind = typeof DATEV_KINDS[number];
export type DatevSettings = { beraterNr: string; mandantNr: string; lohnarten: Partial<Record<DatevKind, string>> };
export type DatevRow = { name: string; code: string; regularH?: number; overtimeH?: number; nightH?: number; sundayH?: number; holidayH?: number };

const FIELD: Record<DatevKind, keyof DatevRow> = { regular: "regularH", overtime: "overtimeH", night: "nightH", sunday: "sundayH", holiday: "holidayH" };
const digits = (s: string, min: number, max: number) => new RegExp(`^\\d{${min},${max}}$`).test(s);

export function datevSettingsError(s: DatevSettings): string | null {
  if (!digits(s.beraterNr, 4, 7)) return "Beraternummer: 4–7 digits.";
  if (!digits(s.mandantNr, 1, 5)) return "Mandantennummer: 1–5 digits.";
  for (const k of DATEV_KINDS) { const la = s.lohnarten[k]; if (la && !digits(la, 1, 4)) return "Lohnart: 1–4 digits."; }
  if (!s.lohnarten.regular) return "Lohnart for regular hours is required.";
  return null;
}

// `month` = "YYYY-MM". Returns the file text plus what was left out, so the owner can fix
// it before sending (nothing is silently dropped).
export function buildLodas(s: DatevSettings, month: string, rows: DatevRow[]) {
  const err = datevSettingsError(s);
  if (err) throw new Error(err);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month.");
  const period = `01.${month.slice(5, 7)}.${month.slice(0, 4)}`;
  const missingPnr: string[] = [], notInSnapshot = new Set<DatevKind>();
  const lines = [
    "[Allgemein]", "Ziel=LODAS", "Version_SST=1.0", `BeraterNr=${s.beraterNr}`, `MandantenNr=${s.mandantNr}`,
    "Datumsformat=TT.MM.JJJJ", "Feldtrennzeichen=;", "Zahlenkomma=,", "Stringbegrenzer=\"",
    "", "[Satzbeschreibung]", "1;u_lod_bwd_buchung_standard;pnr#bwd;abrechnung_zeitraum#bwd;bs_wert_butab#bwd;bs_nr#bwd;la_eigene#bwd;",
    "", "[Bewegungsdaten]",
  ];
  for (const r of rows) {
    const pnr = String(r.code || "").trim();
    if (!digits(pnr, 1, 5)) { missingPnr.push(r.name || "—"); continue; }
    for (const k of DATEV_KINDS) {
      const la = s.lohnarten[k];
      if (!la) continue;
      const v = r[FIELD[k]];
      if (v === undefined) { notInSnapshot.add(k); continue; }
      const h = Number(v);
      if (!Number.isFinite(h) || h <= 0) continue;
      lines.push(`1;${pnr};${period};${h.toFixed(2).replace(".", ",")};1;${la};`);
    }
  }
  return { text: lines.join("\r\n") + "\r\n", missingPnr, notInSnapshot: [...notInSnapshot], bookings: lines.filter((l) => l.startsWith("1;") && !l.includes("u_lod")).length };
}
