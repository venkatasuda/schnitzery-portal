// Pure helpers for the daily prep list (no I/O). Used by the manager page, the employee page and tests.
export type PrepItem = {
  id: string; name: string; name_de: string | null; unit: string; container_size: number | null; container_label: string | null;
  target_min: number[]; target_max: number[]; reserve: number[]; sort: number; is_active: boolean; yield_id: string | null;
};
export type PrepLine = { item_id: string; target: number; leftover: number | null; reserve: number; override: number | null; reason: string | null };

// ISO weekday index 0..6 (Mon..Sun) of a YYYY-MM-DD calendar date.
export const weekdayIndex = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
export const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Same rule as private.save_prep_list: override, else max(0, target − leftover); not counted = nothing left.
export const toPrepare = (l: Pick<PrepLine, "target" | "leftover" | "override">) =>
  l.override != null ? l.override : Math.max(0, l.target - (l.leftover ?? 0));

// Whole containers needed (rounded up), or null when the item has no container size.
export const containers = (qty: number, size: number | null) =>
  size && size > 0 && qty > 0 ? Math.ceil(qty / size - 1e-9) : null;

// Default line for a plan date: the weekday's upper target, reserve, and the leftover counted the evening before.
export function defaultLine(item: PrepItem, day: string, leftover: number | null): PrepLine {
  const i = weekdayIndex(day);
  return { item_id: item.id, target: Number(item.target_max[i] ?? 0), leftover, reserve: Number(item.reserve[i] ?? 0), override: null, reason: null };
}

const fmt = (n: number, locale: string) => n.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 });

// Plain text for WhatsApp / any chat: one line per item with something to prepare, reserve separately.
export function shareText(day: string, items: PrepItem[], lines: PrepLine[], locale: string, note?: string | null) {
  const de = locale === "de";
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString(de ? "de-DE" : "en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows: string[] = [], reserve: string[] = [], uncounted: string[] = [];
  for (const l of lines) {
    const it = byId.get(l.item_id); if (!it) continue;
    const name = (de && it.name_de) || it.name, qty = toPrepare(l), c = containers(qty, it.container_size);
    if (qty > 0) rows.push(`• ${name}: ${fmt(qty, locale)} ${it.unit}${c ? ` (${c} ${it.container_label ?? (de ? "Behälter" : "containers")})` : ""}`);
    if (l.reserve > 0) reserve.push(`${name} +${fmt(l.reserve, locale)} ${it.unit}`);
    if (l.leftover == null && l.override == null) uncounted.push(name);
  }
  return [
    `${de ? "Vorbereitung" : "Prep list"} · ${date}`,
    ...(rows.length ? rows : [de ? "Nichts vorzubereiten." : "Nothing to prepare."]),
    ...(reserve.length ? [`${de ? "Reserve bei viel Betrieb" : "Reserve if busy"}: ${reserve.join(", ")}`] : []),
    ...(uncounted.length ? [`${de ? "Rest nicht gezählt" : "Leftover not counted"}: ${uncounted.join(", ")}`] : []),
    ...(note ? [note] : []),
  ].join("\n");
}
