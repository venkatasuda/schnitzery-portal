// Reads a till's daily sales export (CSV) into { date, amount } rows.
// Till systems differ, so this is deliberately forgiving about the SHAPE and strict
// about the VALUES:
//  - delimiter ";" or "," or tab (German exports usually use ";")
//  - header names in German or English (Datum/Date, Umsatz/Brutto/Gesamt/Total/Amount)
//    — without a recognisable header the first date-like and money-like columns are used
//  - dates: 2026-10-22, 22.10.2026, 22/10/2026 (day first)
//  - amounts: 1.234,56 / 1234,56 / 1,234.56 / 1234.56 / € and spaces allowed
// Several lines for the same date (e.g. one per shift or payment type) are summed.
// Lines that cannot be read are reported, never guessed.

export type SalesRow = { date: string; amount: number };
export type ParseResult = { rows: SalesRow[]; skipped: number[] };

const DATE_HEAD = /^(datum|date|tag|day|gesch[äa]ftstag|business ?date)$/i;
const AMOUNT_HEAD = /(umsatz|brutto|gesamt|summe|total|amount|betrag|sales|netto)/i;

function splitLine(line: string, d: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === d && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseDate(v: string): string | null {
  const s = v.trim().split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/))) { d = +r[1]; m = +r[2]; y = r[3].length === 2 ? 2000 + +r[3] : +r[3]; }
  else return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const t = Date.parse(iso + "T12:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso && y >= 2000 ? iso : null;
}

export function parseAmount(v: string): number | null {
  let s = v.replace(/[€\s ]|EUR/gi, "");
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");      // 1.234,56
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, "");  // 1,234.56
  else if (lastComma < 0 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, ""); // 1.234.567
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function parseSalesCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], skipped: [] };
  const delim = [";", "\t", ","].map((d) => [d, splitLine(lines[0], d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const cells = lines.map((l) => splitLine(l, delim));
  const head = cells[0];
  let dateCol = head.findIndex((h) => DATE_HEAD.test(h));
  let amountCol = head.findIndex((h) => AMOUNT_HEAD.test(h));
  const hasHeader = dateCol >= 0 || amountCol >= 0 || !head.some((h) => parseDate(h));
  const body = hasHeader ? cells.slice(1) : cells;
  // No usable header: first column that reads as a date / last that reads as money.
  const sample = body.slice(0, 5);
  if (dateCol < 0) dateCol = (sample[0] || []).findIndex((_, i) => sample.every((r) => parseDate(r[i] ?? "")));
  if (amountCol < 0) amountCol = [...(sample[0] || []).keys()].reverse().find((i) => i !== dateCol && sample.every((r) => parseAmount(r[i] ?? "") != null)) ?? -1;
  if (dateCol < 0 || amountCol < 0) return { rows: [], skipped: body.map((_, i) => i + (hasHeader ? 2 : 1)) };

  const byDate = new Map<string, number>(); const skipped: number[] = [];
  body.forEach((r, i) => {
    const date = parseDate(r[dateCol] ?? ""), amount = parseAmount(r[amountCol] ?? "");
    if (!date || amount == null) { skipped.push(i + (hasHeader ? 2 : 1)); return; }
    byDate.set(date, Math.round(((byDate.get(date) ?? 0) + amount) * 100) / 100);
  });
  return { rows: [...byDate].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)), skipped };
}
