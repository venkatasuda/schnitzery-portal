import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, parseSalesCsv } from "./parseSalesCsv";

describe("parseSalesCsv", () => {
  it("reads a German till export (semicolon, German numbers) and sums same-day lines", () => {
    const csv = "﻿Datum;Zahlart;Umsatz brutto\n21.10.2026;Bar;1.234,50\n21.10.2026;Karte;765,50\n22.10.2026;Bar;900\n";
    expect(parseSalesCsv(csv)).toEqual({ rows: [{ date: "2026-10-21", amount: 2000 }, { date: "2026-10-22", amount: 900 }], skipped: [] });
  });

  it("reads an English export with quotes and thousands commas", () => {
    const csv = 'Date,Total\n2026-10-21,"1,250.75"\n2026-10-22,"980.00"';
    expect(parseSalesCsv(csv).rows).toEqual([{ date: "2026-10-21", amount: 1250.75 }, { date: "2026-10-22", amount: 980 }]);
  });

  it("finds columns without a header", () => {
    expect(parseSalesCsv("21.10.2026;Shop;812,40\n22.10.2026;Shop;903,10").rows).toEqual([
      { date: "2026-10-21", amount: 812.4 }, { date: "2026-10-22", amount: 903.1 },
    ]);
  });

  it("reports unreadable lines instead of guessing", () => {
    const r = parseSalesCsv("Datum;Umsatz\n21.10.2026;100\nSumme;100\n31.02.2026;50\n22.10.2026;abc");
    expect(r.rows).toEqual([{ date: "2026-10-21", amount: 100 }]);
    expect(r.skipped).toEqual([3, 4, 5]);
  });

  it("parses single values strictly", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("01/03/26")).toBe("2026-03-01");
    expect(parseAmount("€ 1.234.567")).toBe(1234567);
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});
