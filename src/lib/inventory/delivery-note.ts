// Delivery notes (Lieferscheine) read from a photo or PDF → a pre-filled "Receive a delivery" form. Pure.
// The reader (src/app/api/inventory/delivery-note/route.ts) returns only what is printed; everything here is
// arithmetic and matching, and the person at the door still reviews and saves. Nothing is booked from here.
export type NoteLine = {
  article: string | null;       // supplier article number
  description: string;          // as printed, e.g. "10kg ROTKOHL DE"
  qty: number;                  // "Menge" (may be a weight, e.g. 9,17 for cheese sold by kg)
  pack: number | null;          // "Gebinde": 6 for "6er", 1 for "1er"; null when not printed
  unitPrice: number | null;     // net price per unit, null when the note has no prices
  lineTotal: number | null;     // net line total
  lot: string | null;           // batch / Charge
  expiry: string | null;        // MHD as YYYY-MM-DD
  weightKg: number | null;      // printed weight (e.g. Afes: 100,50 kg)
};
export type ParsedNote = { supplier: string | null; reference: string | null; date: string | null; netTotal: number | null; lines: NoteLine[] };
export type CatalogProduct = { id: string; product: string; category: string; unit: string | null };

const norm = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
const words = (s: string) => norm(s).split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
const STOP = new Set(["aro", "metro", "chef", "stueck", "pack", "flasche", "eimer", "dose", "ca"]);

// Best catalogue product for a printed description, or null when nothing fits well enough.
// A word matches when one contains the other ("mayonnaise" in "salatmayonnaise", "rotkohl" = "rotkohl").
// ponytail: word overlap only; remember supplier article → product once confirmed if this proves too weak.
export function matchProduct(description: string, products: CatalogProduct[]): string | null {
  const d = words(description);
  let best: { id: string; score: number } | null = null, tie = false;
  for (const p of products) {
    const pw = words(p.product);
    if (!pw.length) continue;
    const hit = pw.filter((w) => d.some((x) => x.includes(w) || w.includes(x))).length;
    const score = hit / pw.length + hit * 0.01; // all product words found beats a partial match; more words break ties
    if (hit && score >= 0.5) { if (!best || score > best.score) { best = { id: p.id, score }; tie = false; } else if (score === best.score) tie = true; }
  }
  return best && !tie ? best.id : null;
}

// Size printed in the description: "10kg", "750ml", "5 KG", "1l", "500g" → amount in kg or litres.
function sizeOf(description: string): { kg?: number; l?: number } {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i.exec(description);
  if (!m) return {};
  const n = Number(m[1].replace(",", ".")), u = m[2].toLowerCase();
  return u === "kg" ? { kg: n } : u === "g" ? { kg: n / 1000 } : u === "l" ? { l: n } : { l: n / 1000 };
}

// Quantity in the product's stock unit (kg, l, or pieces), or null when it cannot be derived safely.
export function stockQty(line: NoteLine, unit: string | null): number | null {
  const u = norm(unit ?? "").trim(), units = line.qty * (line.pack ?? 1), size = sizeOf(line.description);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  if (u === "kg") {
    if (line.weightKg != null) return round(line.weightKg);
    if (!Number.isInteger(line.qty) && (line.pack ?? 1) === 1) return round(line.qty); // sold by weight: Menge is already kg
    return size.kg != null ? round(units * size.kg) : null;
  }
  if (u === "l" || u === "liter") return size.l != null ? round(units * size.l) : null;
  return Number.isFinite(units) && units > 0 ? round(units) : null; // pieces / packs / buckets
}

// Arithmetic checks on what was read: each line (qty × pack × unit price ≈ total) and the sum against the net total.
// Metro rounds unit prices, so a line may differ by a few cents per unit.
export function checkNote(note: ParsedNote): { sum: number | null; totalOk: boolean | null; oddLines: number[] } {
  const priced = note.lines.filter((l) => l.lineTotal != null);
  const sum = priced.length ? Math.round(priced.reduce((n, l) => n + l.lineTotal!, 0) * 100) / 100 : null;
  const oddLines = note.lines.map((l, i) => {
    if (l.lineTotal == null || l.unitPrice == null) return -1;
    const units = l.qty * (l.pack ?? 1), expected = units * l.unitPrice;
    return Math.abs(expected - l.lineTotal) > Math.max(0.05, units * 0.01) ? i : -1;
  }).filter((i) => i >= 0);
  return { sum, totalOk: sum != null && note.netTotal != null && priced.length === note.lines.length ? Math.abs(sum - note.netTotal) <= 0.05 : null, oddLines };
}

// ── Metro PDF without AI ────────────────────────────────────────────────────────────────────────────────
// Reads the text of a Metro-generated Lieferschein PDF (not a scan). Row layout, as printed:
//   <Artikel> <Beschreibung> <Menge> <N>er <Einzelpreis> € <Gesamtpreis> € <MwSt> %
// Returns null unless at least one row was found AND the rows add up to the printed Nettosumme — so a layout
// we do not understand never produces wrong numbers; the caller then falls back to the AI reader.
const de = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const isoDate = (s: string | undefined) => (s ? `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : null);
export function parseMetroText(raw: string): ParsedNote | null {
  if (!/METRO/i.test(raw) || !/Lieferschein/i.test(raw)) return null;
  const text = raw.replace(/(?:LOT-Nr:?\s*[\d, ]+)?GTIN:?\s*\d+(?:\s*,\s*\d+)*/gi, " ").replace(/\s+/g, " ");
  const row = /\b(\d{3,7}) ([^€]{3,80}?) (\d+(?:,\d+)?) (\d+)er ([\d.]+,\d{2}) ?€ ([\d.]+,\d{2}) ?€ \d{1,2} ?%/g;
  const lines: NoteLine[] = [];
  // Rows follow each table header (its last column is "MwSt."); totals and the footer end a table.
  for (const part of text.split(/MwSt\.?/).slice(1)) {
    const body = part.split(/Nettosumme|Alle Preise sind/)[0];
    for (const m of body.matchAll(row)) {
      lines.push({ article: m[1], description: m[2].trim(), qty: de(m[3]), pack: Number(m[4]), unitPrice: de(m[5]), lineTotal: de(m[6]), lot: null, expiry: null, weightKg: null });
    }
  }
  const net = /Nettosumme:?[^€\d]*([\d.]+,\d{2})/.exec(text)?.[1];
  const note: ParsedNote = {
    supplier: "METRO", reference: /Lieferschein (\d[\d-]+)/.exec(text)?.[1] ?? null,
    date: isoDate((/Liefertermin:? ?(\d{2}\.\d{2}\.\d{4})/.exec(text) ?? /Auftragsdatum:? ?(\d{2}\.\d{2}\.\d{4})/.exec(text))?.[1]),
    netTotal: net ? de(net) : null, lines,
  };
  return lines.length > 0 && checkNote(note).totalOk === true ? note : null;
}

// Shape guard for the reader's answer (it is model output: never trusted as-is).
const num = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const str = (v: unknown, max: number) => v === null || (typeof v === "string" && v.length <= max);
export function isParsedNote(v: unknown): v is ParsedNote {
  const n = v as ParsedNote;
  return !!n && typeof n === "object" && str(n.supplier, 160) && str(n.reference, 160) && (n.date === null || /^\d{4}-\d{2}-\d{2}$/.test(String(n.date)))
    && (n.netTotal === null || num(n.netTotal, 1e7)) && Array.isArray(n.lines) && n.lines.length <= 200 && n.lines.every((l) =>
      !!l && typeof l.description === "string" && l.description.length > 0 && l.description.length <= 200 && str(l.article, 40) && num(l.qty, 1e6)
      && (l.pack === null || num(l.pack, 1e4)) && (l.unitPrice === null || num(l.unitPrice, 1e6)) && (l.lineTotal === null || num(l.lineTotal, 1e7))
      && str(l.lot, 80) && (l.expiry === null || /^\d{4}-\d{2}-\d{2}$/.test(String(l.expiry))) && (l.weightKg === null || num(l.weightKg, 1e6)));
}
