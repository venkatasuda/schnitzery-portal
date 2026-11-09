"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getChecklistTemplates, saveChecklistTemplate, setChecklistTemplateActive, type ChecklistTemplateInput } from "@/lib/queries/operations";
import { TEAMS } from "@/lib/queries/schedule-constants";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, Panel, Field, ErrorState, EmptyState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";

// Manager: standing checklist tasks per team and weekday. Changes apply from the next day the
// list is opened; tasks already copied into today stay as they are.
type Template = ChecklistTemplateInput & { id: string; is_active: boolean; section: string | null; task_de: string | null };
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], DAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const blank = (): ChecklistTemplateInput => ({ team: TEAMS[1], section: "", task: "", task_de: "", weekdays: [1, 2, 3, 4, 5, 6, 7], input_kind: "check" });

export default function ChecklistTemplatesPage() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const days = locale === "de" ? DAYS_DE : DAYS_EN;
  const [list, setList] = useState<Template[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ChecklistTemplateInput>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const r = await getChecklistTemplates(); if (r.ok) { setList(r.templates as Template[]); setError(""); } else setError(r.error); }
    catch { setError(s("Templates could not be loaded.", "Vorlagen konnten nicht geladen werden.")); }
  }
  useEffect(() => { void load(); }, []);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, reset = false) {
    if (busy) return;
    setBusy(true);
    try { const r = await fn(); if (!r.ok) { setError(r.error || s("Not saved.", "Nicht gespeichert.")); return; } if (reset) { setForm(blank()); setEditing(null); } await load(); }
    catch { setError(s("Not saved. Check the list before retrying.", "Nicht gespeichert. Vor erneutem Versuch Liste prüfen.")); }
    finally { setBusy(false); }
  }
  const toggleDay = (d: number) => setForm({ ...form, weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d] });
  const dayText = (w: number[]) => w.length === 7 ? s("Every day", "Täglich") : [...w].sort().map((d) => days[d - 1]).join(" + ");

  if (!list && !error) return <CardSkeleton rows={5} />;
  const groups = [...new Set((list ?? []).map((t) => t.section ? `${t.team} · ${t.section}` : t.team))];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <PageHeader title={s("Checklist templates", "Checklisten-Vorlagen")}
        actions={<Link className="btn-secondary" href="/checklist">{s("Today's checklist", "Heutige Checkliste")}</Link>} />
      {error && <ErrorState message={error} onRetry={load} retryLabel={s("Refresh", "Aktualisieren")} />}

      <Panel title={editing ? s("Edit task", "Aufgabe bearbeiten") : s("Add a task", "Aufgabe hinzufügen")}>
        <form onSubmit={(e) => { e.preventDefault(); void run(() => saveChecklistTemplate(editing, form), true); }}>
          <fieldset disabled={busy} className="inventory-fieldset">
            <Field label={s("Team", "Team")}><select className="form-select" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label={s("Section (optional, e.g. Morning, Evening, Lager)", "Bereich (optional, z. B. Früh, Spät, Lager)")}><input className="form-input" maxLength={60} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field>
            <Field label={s("Task (English)", "Aufgabe (Englisch)")}><input className="form-input" required minLength={3} maxLength={300} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} /></Field>
            <Field label={s("Task (German, optional)", "Aufgabe (Deutsch, optional)")}><input className="form-input" minLength={3} maxLength={300} value={form.task_de} onChange={(e) => setForm({ ...form, task_de: e.target.value })} /></Field>
            <fieldset className="row-actions"><legend>{s("Weekdays", "Wochentage")}</legend>
              {days.map((d, i) => <label key={d}><input type="checkbox" checked={form.weekdays.includes(i + 1)} onChange={() => toggleDay(i + 1)} /> {d}</label>)}
            </fieldset>
            <Field label={s("Answer", "Antwort")}><select className="form-select" value={form.input_kind} onChange={(e) => setForm({ ...form, input_kind: e.target.value })}><option value="check">{s("Tick when done", "Abhaken")}</option><option value="number">{s("Enter a reading (e.g. °C)", "Messwert eingeben (z. B. °C)")}</option></select></Field>
            <div className="row-actions">
              <button className="btn-gold" disabled={form.weekdays.length === 0}>{editing ? s("Save changes", "Änderungen speichern") : s("Add task", "Aufgabe hinzufügen")}</button>
              {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(blank()); }}>{s("Cancel", "Abbrechen")}</button>}
            </div>
          </fieldset>
        </form>
      </Panel>

      {list && list.length === 0 && <EmptyState title={s("No templates yet", "Noch keine Vorlagen")}>{s("Add the first standing task above.", "Oben die erste feste Aufgabe anlegen.")}</EmptyState>}
      {groups.map((g) => (
        <Panel key={g} title={g}>
          <ul className="checklist-list">
            {(list ?? []).filter((t) => (t.section ? `${t.team} · ${t.section}` : t.team) === g).map((t) => (
              <li key={t.id} className="checklist-item">
                <div className="u-grow"><span className={t.is_active ? undefined : "u-muted"}>{(locale === "de" && t.task_de) || t.task}</span>
                  <div className="t-xs u-muted">{dayText(t.weekdays)}{t.input_kind === "number" ? ` · ${s("reading", "Messwert")}` : ""}{t.is_active ? "" : ` · ${s("paused", "pausiert")}`}</div></div>
                <div className="row-actions">
                  <button className="btn-secondary" disabled={busy} onClick={() => { setEditing(t.id); setForm({ team: t.team, section: t.section ?? "", task: t.task, task_de: t.task_de ?? "", weekdays: t.weekdays, input_kind: t.input_kind }); window.scrollTo({ top: 0 }); }}>{s("Edit", "Bearbeiten")}</button>
                  <button className="btn-secondary" disabled={busy} onClick={() => void run(() => setChecklistTemplateActive(t.id, !t.is_active))}>{t.is_active ? s("Pause", "Pausieren") : s("Resume", "Fortsetzen")}</button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
