"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTodayChecklist, toggleTask, saveTaskValue } from "@/lib/queries/operations";
import { useLang } from "@/components/LanguageProvider";
import { PageHeader, Panel, ErrorState, EmptyState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";

// Today's checklist for everyone on shift: tick tasks, enter readings. Tasks come from the
// branch's weekday templates (managed under /checklist/templates) plus any added by hand.
// Team / section names are stored in English; show them in German when the user reads German.
const TEAM_DE: Record<string, string> = { Manager: "Leitung", Preparation: "Vorbereitung", Kitchen: "Küche", Cashier: "Kasse", Dishwashing: "Spüler", Morning: "Früh", Evening: "Spät", Lager: "Lager" };
const teamLabel = (group: string, locale: string) => locale === "de" ? group.split(" · ").map((p) => TEAM_DE[p] ?? p).join(" · ") : group;
type Task = { id: string; type: string | null; task: string | null; task_de: string | null; done: boolean; input_kind: string; value: string | null; completed_at: string | null };

export default function ChecklistPage() {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [mine, setMine] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  async function load() {
    try {
      const r = await getTodayChecklist();
      if (!r.ok) { setError(true); return; }
      setTasks(r.tasks as Task[]); setTeam(r.team); setCanManage(r.canManage); setError(false);
    } catch { setError(true); }
  }
  useEffect(() => { void load(); }, []);

  async function act(id: string, fn: () => Promise<{ ok: boolean }>) {
    if (busy) return;
    setBusy(id);
    try { if (!(await fn()).ok) setError(true); await load(); } catch { setError(true); } finally { setBusy(null); }
  }

  if (error && !tasks) return <ErrorState message={s("Checklist could not be loaded.", "Checkliste konnte nicht geladen werden.")} onRetry={load} retryLabel={s("Retry", "Erneut versuchen")} />;
  if (!tasks) return <CardSkeleton rows={5} />;

  const myGroup = (type: string | null) => !!team && (type ?? "").toLowerCase().startsWith(team.toLowerCase());
  const hasMine = tasks.some((t) => myGroup(t.type));
  const shown = mine && hasMine ? tasks.filter((t) => myGroup(t.type)) : tasks;
  const groups = [...new Map(shown.map((t) => [t.type ?? "—", [] as Task[]])).entries()];
  for (const t of shown) groups.find(([g]) => g === (t.type ?? "—"))![1].push(t);
  const done = shown.filter((t) => t.done).length;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <PageHeader title={s("Today's checklist", "Heutige Checkliste")} subtitle={`${done} / ${shown.length} ${s("done", "erledigt")}`}
        actions={canManage ? <div className="row-actions"><Link className="btn-secondary" href="/checklist/templates">{s("Manage templates", "Vorlagen verwalten")}</Link><Link className="btn-secondary" href="/checklist-status">{s("Status & history", "Status & Verlauf")}</Link></div> : undefined} />
      {error && <ErrorState message={s("Last change not confirmed. Check the list and retry.", "Letzte Änderung nicht bestätigt. Liste prüfen und erneut versuchen.")} onRetry={load} retryLabel={s("Refresh", "Aktualisieren")} />}
      {hasMine && <div className="row-actions" role="group" aria-label={s("Show tasks", "Aufgaben anzeigen")}>
        <button className={mine ? "btn-gold" : "btn-secondary"} aria-pressed={mine} onClick={() => setMine(true)}>{s("My team", "Mein Team")} · {teamLabel(team ?? "", locale)}</button>
        <button className={!mine ? "btn-gold" : "btn-secondary"} aria-pressed={!mine} onClick={() => setMine(false)}>{s("All teams", "Alle Teams")}</button>
      </div>}
      {shown.length === 0 && <EmptyState title={s("No tasks for today", "Keine Aufgaben für heute")}>{canManage ? s("Add standing tasks per team and weekday under Manage templates.", "Feste Aufgaben je Team und Wochentag unter Vorlagen verwalten anlegen.") : s("Ask your manager to set up the checklist.", "Bitte die Leitung, die Checkliste einzurichten.")}</EmptyState>}
      {groups.map(([group, items]) => (
        <Panel key={group} title={`${teamLabel(group, locale)} ·${items.filter((t) => t.done).length}/${items.length}`}>
          <ul className="checklist-list">
            {items.map((t) => {
              const label = (locale === "de" && t.task_de) || t.task || "—";
              return <li key={t.id} className="checklist-item">
                {t.input_kind === "number"
                  ? <form className="row-actions" onSubmit={(e) => { e.preventDefault(); void act(t.id, () => saveTaskValue(t.id, values[t.id] ?? t.value ?? "")); }}>
                      <label className="u-grow">{label}<input className="form-input" inputMode="decimal" aria-label={label} value={values[t.id] ?? t.value ?? ""} onChange={(e) => setValues({ ...values, [t.id]: e.target.value })} disabled={busy === t.id} /></label>
                      <button className="btn-secondary" disabled={busy === t.id}>{s("Save", "Speichern")}</button>
                    </form>
                  : <label className="checklist-check"><input type="checkbox" checked={t.done} disabled={busy === t.id} onChange={(e) => void act(t.id, () => toggleTask(t.id, e.target.checked))} /><span className={t.done ? "u-muted" : undefined}>{label}</span></label>}
              </li>;
            })}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
