"use client";
// Managers: prep items with weekday targets (Mon..Sun), container size, optional recipe link,
// and which staff (shift leaders) may plan and send the list.
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { Field, Panel, ErrorState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { getPrepSetup, savePrepItem, setPrepItemActive, setShiftLeader, type PrepItemInput } from "@/lib/queries/prep-list";

type Setup = Extract<Awaited<ReturnType<typeof getPrepSetup>>, { ok: true }>;
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], DAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
type Form = { name: string; name_de: string; unit: string; container_size: string; container_label: string; target_min: string[]; target_max: string[]; reserve: string[]; sort: string; yield_id: string };
const blank = (): Form => ({ name: "", name_de: "", unit: "kg", container_size: "", container_label: "", target_min: Array(7).fill("0"), target_max: Array(7).fill("0"), reserve: Array(7).fill("0"), sort: "0", yield_id: "" });

export default function PrepSetup() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const days = locale === "de" ? DAYS_DE : DAYS_EN;
  const [data, setData] = useState<Setup | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(blank()), [editing, setEditing] = useState<string | null>(null);

  async function load() { try { const r = await getPrepSetup(); if (r.ok) { setData(r); setError(""); } else setError(r.error); } catch { setError("load"); } }
  useEffect(() => { void load(); }, []);
  async function run(fn: () => Promise<{ ok: boolean }>, reset = false) {
    if (busy) return; setBusy(true); setError("");
    try { if (!(await fn()).ok) { setError("save"); return; } if (reset) { setForm(blank()); setEditing(null); } await load(); } catch { setError("save"); } finally { setBusy(false); }
  }
  if (!data && !error) return <CardSkeleton rows={4} />;
  if (!data) return <ErrorState message={s("Setup could not be loaded (managers only).", "Einrichtung konnte nicht geladen werden (nur Leitung).")} onRetry={load} retryLabel={s("Retry", "Erneut versuchen")} />;

  const toInput = (f: Form): PrepItemInput => ({ name: f.name, name_de: f.name_de, unit: f.unit, container_size: f.container_size.trim() ? Number(f.container_size) : null, container_label: f.container_label,
    target_min: f.target_min.map(Number), target_max: f.target_max.map(Number), reserve: f.reserve.map(Number), sort: Number(f.sort) || 0, yield_id: f.yield_id || null });
  // Suggested target for a weekday, only when it differs from the current "up to" target.
  const sug = (id: string, n: number) => { const g = data.suggestions[id]?.[n]; const it = data.items.find((x) => x.id === id); return g && it && g.suggest !== Number(it.target_max[n]) ? g : null; };
  // Open the item in the form; with `apply`, suggested weekdays are filled in (the manager reviews and saves).
  const edit = (i: Setup["items"][number], apply = false) => {
    const max = i.target_max.map((v, n) => String(apply && sug(i.id, n) ? sug(i.id, n)!.suggest : v));
    setEditing(i.id);
    setForm({ name: i.name, name_de: i.name_de ?? "", unit: i.unit, container_size: i.container_size == null ? "" : String(i.container_size), container_label: i.container_label ?? "",
      target_min: i.target_min.map((v, n) => String(Math.min(Number(v), Number(max[n])))), target_max: max, reserve: i.reserve.map(String), sort: String(i.sort), yield_id: i.yield_id ?? "" });
    window.scrollTo({ top: 0 });
  };
  const week = (key: "target_min" | "target_max" | "reserve", label: string) => <fieldset className="prep-week"><legend>{label}</legend>
    {days.map((d, i) => <label key={d}>{d}<input className="form-input" type="number" min="0" step="any" value={form[key][i]} onChange={(e) => setForm({ ...form, [key]: form[key].map((v, n) => (n === i ? e.target.value : v)) })} /></label>)}
  </fieldset>;

  return <>
    {error && <ErrorState message={s("Not saved. Check the values (min ≤ max, numbers ≥ 0).", "Nicht gespeichert. Werte prüfen (Min ≤ Max, Zahlen ≥ 0).")} onRetry={load} retryLabel={s("Refresh", "Aktualisieren")} />}
    <Panel title={editing ? s("Edit prep item", "Vorbereitungsartikel bearbeiten") : s("Add prep item", "Vorbereitungsartikel hinzufügen")}>
      <form onSubmit={(e) => { e.preventDefault(); void run(() => savePrepItem(editing, toInput(form)), true); }}><fieldset disabled={busy} className="inventory-fieldset">
        <div className="inventory-insight-coverage">
          <Field label={s("Name", "Name")}><input className="form-input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={s("German name (optional)", "Deutscher Name (optional)")}><input className="form-input" maxLength={80} value={form.name_de} onChange={(e) => setForm({ ...form, name_de: e.target.value })} /></Field>
          <Field label={s("Unit (kg, containers, batches …)", "Einheit (kg, Behälter, Ansätze …)")}><input className="form-input" required maxLength={20} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label={s("Container size in this unit (optional)", "Behältergröße in dieser Einheit (optional)")}><input className="form-input" type="number" min="0" step="any" value={form.container_size} onChange={(e) => setForm({ ...form, container_size: e.target.value })} /></Field>
          <Field label={s("Container name (optional)", "Behältername (optional)")}><input className="form-input" maxLength={30} value={form.container_label} onChange={(e) => setForm({ ...form, container_label: e.target.value })} /></Field>
          <Field label={s("Order", "Reihenfolge")}><input className="form-input" type="number" step="1" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} /></Field>
          <Field label={s("Recipe yield for ingredients (optional)", "Rezeptausbeute für Zutaten (optional)")}><select className="form-select" value={form.yield_id} onChange={(e) => setForm({ ...form, yield_id: e.target.value })}><option value="">—</option>{data.yields.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></Field>
        </div>
        {week("target_min", s("Target from", "Ziel von"))}
        {week("target_max", s("Target up to (used for the list)", "Ziel bis (wird für die Liste genutzt)"))}
        {week("reserve", s("Reserve if busy (shown separately)", "Reserve bei Andrang (separat angezeigt)"))}
        <div className="row-actions"><button className="btn-gold">{editing ? s("Save changes", "Änderungen speichern") : s("Add item", "Artikel hinzufügen")}</button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(blank()); }}>{s("Cancel", "Abbrechen")}</button>}</div>
      </fieldset></form>
    </Panel>
    <Panel title={s("Prep items", "Vorbereitungsartikel")}>
      {!data.items.length ? <p>{s("No items yet.", "Noch keine Artikel.")}</p> : <div className="table-scroll" role="region" aria-label={s("Prep items", "Vorbereitungsartikel")} tabIndex={0}><table className="data-table">
        <thead><tr><th scope="col">{s("Item", "Artikel")}</th>{days.map((d) => <th scope="col" key={d}>{d}</th>)}<th scope="col">{s("Actions", "Aktionen")}</th></tr></thead>
        <tbody>{data.items.map((i) => <tr key={i.id} className={i.is_active ? undefined : "u-muted"}>
          <th scope="row">{(locale === "de" && i.name_de) || i.name} <span className="t-xs u-muted">({i.unit}{i.container_size ? ` · ${i.container_size}/${i.container_label ?? s("container", "Behälter")}` : ""})</span></th>
          {days.map((d, n) => { const g = sug(i.id, n); return <td key={d}>{Number(i.target_min[n]) === Number(i.target_max[n]) ? i.target_max[n] : `${i.target_min[n]}–${i.target_max[n]}`}{Number(i.reserve[n]) > 0 && <div className="t-xs u-muted">+{i.reserve[n]}</div>}
            {g && <div className="prep-suggest" title={s(`${g.days} days counted · average use ${g.avg}${g.soldOut ? ` · sold out ${g.soldOut}×` : ""}`, `${g.days} Tage gezählt · Ø Verbrauch ${g.avg}${g.soldOut ? ` · ${g.soldOut}× ausverkauft` : ""}`)}>→ {g.suggest}{g.soldOut ? "↑" : ""}</div>}</td>; })}
          <td><div className="row-actions">
            <button className="btn-secondary" disabled={busy} onClick={() => edit(i)}>{s("Edit", "Bearbeiten")}</button>
            {days.some((_, n) => sug(i.id, n)) && <button className="btn-gold" disabled={busy} onClick={() => edit(i, true)}>{s("Use suggestions", "Vorschläge übernehmen")}</button>}
            <button className="btn-secondary" disabled={busy} onClick={() => void run(() => setPrepItemActive(i.id, !i.is_active))}>{i.is_active ? s("Pause", "Pausieren") : s("Resume", "Fortsetzen")}</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </Panel>
    <Panel title={s("Shift leaders", "Schichtleitung")}>
      
      <ul className="checklist-list">{data.staff.map((u) => <li key={u.id} className="checklist-item"><label className="checklist-check">
        <input type="checkbox" checked={data.shiftLeaders.includes(u.id)} disabled={busy} onChange={(e) => void run(() => setShiftLeader(u.id, e.target.checked))} />
        <span>{u.full_name ?? "—"}{u.team ? <span className="t-xs u-muted"> · {u.team}</span> : null}</span></label></li>)}</ul>
    </Panel>
  </>;
}
