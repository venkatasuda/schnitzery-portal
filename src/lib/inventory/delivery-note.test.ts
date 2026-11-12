import { describe, expect, it } from "vitest";
import { checkNote, isParsedNote, matchProduct, parseMetroText, stockQty, type NoteLine, type ParsedNote } from "./delivery-note";

// Lines as printed on real Stuttgart delivery notes (Metro 9-250709271, ConVency 2026-2843, Afes A1113835).
const L = (o: Partial<NoteLine> & { description: string; qty: number }): NoteLine => ({ article: null, pack: 1, unitPrice: null, lineTotal: null, lot: null, expiry: null, weightKg: null, ...o });
const rotkohl = L({ description: "10kg ROTKOHL DE", qty: 2, unitPrice: 8.21, lineTotal: 16.42 });
const essig = L({ description: "750ml KUEHNE APFELESSIG 5%", qty: 2, pack: 6, unitPrice: 2.03, lineTotal: 24.4 });
const grana = L({ description: "MC GRANA PAD. CA.2kg 16 M. 32%", qty: 9.17, unitPrice: 13.98, lineTotal: 128.2 });
const milch = L({ description: "ARO 1L H-MILCH 3,5%", qty: 3, pack: 12, unitPrice: 0.76, lineTotal: 27.51 });
const tuch = L({ description: "300BL. ARO KUECHENTUCH 2LG", qty: 20, unitPrice: 1.63, lineTotal: 32.6 });
const sauce = L({ description: "Honey Mustard Sauce (à 10 l)", qty: 11, lot: "L30126202", expiry: "2027-01-13" });
const chicken = L({ description: "Hähnchen Schnitzel NL", qty: 4, weightKg: 100.5 });

const catalog = [
  { id: "rot", product: "Rotkohl", category: "Gemüse", unit: "kg" },
  { id: "weiss", product: "Weißkohl", category: "Gemüse", unit: "kg" },
  { id: "mayo", product: "Mayonnaise", category: "Saucen", unit: "kg" },
  { id: "honey", product: "Honey Mustard Sauce", category: "Saucen", unit: "l" },
  { id: "garlic", product: "Garlic Sauce", category: "Saucen", unit: "l" },
  { id: "spicy", product: "Spicy Garlic Sauce", category: "Saucen", unit: "l" },
  { id: "chick", product: "Hähnchen Schnitzel", category: "Fleisch", unit: "kg" },
];

describe("delivery note", () => {
  it("matches printed descriptions to catalogue products, and refuses when unsure", () => {
    expect(matchProduct("10kg ROTKOHL DE", catalog)).toBe("rot");
    expect(matchProduct("10kg WEISSKOHL DE", catalog)).toBe("weiss");            // ß = ss
    expect(matchProduct("10kg ARO SALATMAYONNAISE 50%", catalog)).toBe("mayo");   // word inside a longer word
    expect(matchProduct("Hähnchen Schnitzel NL", catalog)).toBe("chick");
    expect(matchProduct("Spicy Garlic Sauce (à 10 l)", catalog)).toBe("spicy");   // the more specific product wins
    expect(matchProduct("Garlic Sauce (à 10 l)", catalog)).toBe("garlic");
    expect(matchProduct("300BL. ARO KUECHENTUCH 2LG", catalog)).toBeNull();       // not in the catalogue
  });
  it("converts Menge × Gebinde × size into the stock unit", () => {
    expect(stockQty(rotkohl, "kg")).toBe(20);        // 2 × 10 kg
    expect(stockQty(essig, "l")).toBe(9);            // 2 × 6 × 0.75 l
    expect(stockQty(milch, "l")).toBe(36);           // 3 × 12 × 1 l
    expect(stockQty(grana, "kg")).toBe(9.17);        // sold by weight
    expect(stockQty(chicken, "kg")).toBe(100.5);     // printed weight, not 4 crates
    expect(stockQty(sauce, "l")).toBe(110);          // 11 buckets à 10 l
    expect(stockQty(tuch, "Stk.")).toBe(20);
    expect(stockQty(tuch, "kg")).toBeNull();         // no weight printed: do not guess
  });
  it("checks line arithmetic and the net total", () => {
    const note: ParsedNote = { supplier: "METRO", reference: "9-250709271", date: "2026-10-29", netTotal: 229.13, lines: [rotkohl, essig, grana, milch, tuch] };
    expect(checkNote(note)).toEqual({ sum: 229.13, totalOk: true, oddLines: [] }); // Metro's rounded unit prices are tolerated
    expect(checkNote({ ...note, netTotal: 300 }).totalOk).toBe(false);
    expect(checkNote({ ...note, lines: [{ ...rotkohl, lineTotal: 164.2 }] }).oddLines).toEqual([0]); // misread total
    expect(checkNote({ ...note, netTotal: null, lines: [sauce] })).toEqual({ sum: null, totalOk: null, oddLines: [] }); // no prices printed
  });
  it("reads a Metro PDF's text without AI, and only when the rows add up to the Nettosumme", () => {
    // Text as a PDF would yield it for Lieferschein 9-248640895 (two pages; GTIN lines and category headings between rows).
    const page1 = `METRO METRO GASTRO Böblingen · Herrenberger Str. 100 · 71034 Böblingen 07031 43 66 296 Lieferschein 9-248640895 Auftraggeber 632/12161 CrunchyGastro GmbH
      Auftragsdatum 22.10.2026 Delivery Sequence Number 6322026296/9-248640895 Lieferart: Lieferung Voraussichtlicher Liefertermin: 23.10.2026 Telefonnummer: 07031 43 66 296
      Artikel Artikelbeschreibung Menge Gebinde Einzelpreis (netto) Gesamtpreis (netto) MwSt.
      Obst/Gemüse/Sauerkonserven
      9651 3100ml MC JALAPENOS SCHEIBEN 3 1er 3,39 € 10,17 € 7 %
      GTIN: 4018905665497
      643184 850ml RINK MANGO-PUEREE GEZU. 2 6er 5,33 € 63,90 € 7 %
      GTIN: 4002194005911
      Essig/Speiseoele
      800983 750ml KUEHNE APFELESSIG 5% 2 6er 2,03 € 24,40 € 7 %
      Back-/Dessertart./Zucker/Salz
      131599 500g ARO TAFELSALZ 2 24er 0,27 € 12,96 € 7 %
      Gewuerze
      993554 2kg MC ROESTZWIEBELN 2 5er 7,21 € 72,14 € 7 %
      Ketchup/Saucen/Senf/Mayonnaise
      516043 100x17ml HEINZ TOMATO KETCHUP 1 1er 9,41 € 9,41 € 7 %
      730492 100x17ml HEINZ SALAT MAYONN. 1 1er 10,90 € 10,90 € 7 %
      Haushaltshelfer
      13846 2X25MPRO MUELLS. 130l 55 MY BLACK 2 2er 7,93 € 31,72 € 19 %
      Alle Preise sind Nettopreise, soweit nicht anders angegeben und verstehen sich zuzüglich der jeweils gültigen gesetzlichen Mehrwertsteuer. METRO Deutschland GmbH Metrostraße 8 40235 Düsseldorf`;
    const page2 = `Lieferschein 9-248640895 632/12161 CrunchyGastro GmbH Seite: 2 /3 Artikel Artikelbeschreibung Menge Gebinde Einzelpreis (netto) Gesamtpreis (netto) MwSt.
      Kaese 710723 MC GRANA PAD. CA.2kg 16 M. 32% 11,934 1er 13,98 € 166,84 € 7 %
      GTIN: 2877760022508, 2877762024906, 2877769024480
      Gemuese 283614 10kg ROTKOHL DE 10 1er 8,69 € 86,90 € 7 % GTIN: 4003721222009
      283623 10kg WEISSKOHL DE 6 1er 7,00 € 42,00 € 7 %
      Nettosumme: Bruttosumme: Zahlungsart METRO Kredit 531,34 € 572,34 € Alle Preise sind Nettopreise`;
    const note = parseMetroText(`${page1}\n${page2}`)!;
    expect(note).toMatchObject({ supplier: "METRO", reference: "9-248640895", date: "2026-10-23", netTotal: 531.34 });
    expect(note.lines).toHaveLength(11);
    expect(note.lines[1]).toEqual(L({ article: "643184", description: "850ml RINK MANGO-PUEREE GEZU.", qty: 2, pack: 6, unitPrice: 5.33, lineTotal: 63.9 }));
    expect(note.lines[8]).toMatchObject({ article: "710723", qty: 11.934, lineTotal: 166.84 });
    expect(stockQty(note.lines[9], "kg")).toBe(100); // 10 × 10 kg Rotkohl
    // A row lost in extraction → the sum no longer matches → no result (the caller falls back to the AI reader).
    expect(parseMetroText(`${page1}\n${page2}`.replace("283623 10kg WEISSKOHL DE 6 1er", "283623 10kg WEISSKOHL DE"))).toBeNull();
    expect(parseMetroText("ConVency Lieferschein 2026-2843 71442 Honey Mustard Sauce 11 Eimer")).toBeNull(); // not Metro
  });

  it("rejects malformed reader output", () => {
    expect(isParsedNote({ supplier: "METRO", reference: null, date: null, netTotal: null, lines: [rotkohl] })).toBe(true);
    expect(isParsedNote({ supplier: "METRO", reference: null, date: "29.10.2026", netTotal: null, lines: [] })).toBe(false);
    expect(isParsedNote({ supplier: "METRO", reference: null, date: null, netTotal: null, lines: [{ ...rotkohl, qty: -1 }] })).toBe(false);
  });
});
