// Monday summary for owners (docs/OWNER-COCKPIT.md). Pure: the cron route gathers the
// numbers, this turns them into the stored notification payload and the push text.
// Missing sales are never shown as €0 — the line says "not entered" instead.

export type BranchWeek = { sales: number | null; salesPrev: number | null; hours: number; purchases: number; open: number };
export type WeeklyPayload = { week: string; branches: number; sales: number | null; salesPrev: number | null; hours: number; purchases: number; open: number; salesMissing: number };

export function summarise(week: string, rows: BranchWeek[]): WeeklyPayload {
  const known = rows.filter((r) => r.sales != null);
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  const prevKnown = rows.filter((r) => r.sales != null && r.salesPrev != null);
  return {
    week, branches: rows.length,
    sales: known.length ? sum(known.map((r) => r.sales!)) : null,
    // Compare like with like: previous week only for branches that have both weeks.
    salesPrev: prevKnown.length ? sum(prevKnown.map((r) => r.salesPrev!)) : null,
    hours: Math.round(sum(rows.map((r) => r.hours)) * 10) / 10,
    purchases: sum(rows.map((r) => r.purchases)),
    open: rows.reduce((a, r) => a + r.open, 0),
    salesMissing: rows.length - known.length,
  };
}

const TEXT = {
  en: { title: "Your week in numbers", sales: "Sales", missing: "sales not entered", hours: "h worked", purchases: "purchases", open: "{n} item(s) need you", none: "nothing waiting", branches: "{n} branches" },
  de: { title: "Deine Woche in Zahlen", sales: "Umsatz", missing: "Umsatz nicht eingetragen", hours: "Std. gearbeitet", purchases: "Einkauf", open: "{n} Punkt(e) warten auf dich", none: "nichts offen", branches: "{n} Filialen" },
};

export function pushText(p: WeeklyPayload, lang: "en" | "de") {
  const x = TEXT[lang];
  const eur = (v: number) => new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const change = p.sales != null && p.salesPrev ? Math.round(((p.sales - p.salesPrev) / p.salesPrev) * 100) : null;
  const sales = p.sales == null ? x.missing
    : `${x.sales} ${p.salesMissing ? "≥ " : ""}${eur(p.sales)}${change != null ? ` (${change >= 0 ? "▲" : "▼"}${Math.abs(change)}%)` : ""}`;
  const parts = [sales, `${p.hours} ${x.hours}`, `${eur(p.purchases)} ${x.purchases}`, p.open ? x.open.replace("{n}", String(p.open)) : x.none];
  return { title: p.branches > 1 ? `${x.title} · ${x.branches.replace("{n}", String(p.branches))}` : x.title, body: parts.join(" · ") };
}
