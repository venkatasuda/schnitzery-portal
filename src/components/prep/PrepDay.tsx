"use client";
// One prep day. Planners (managers + staff with "can plan prep"): count leftovers, adjust, save, send, share.
// Everyone else: the sent list, read-only. Used in Inventory → Kitchen and the employee "Today's prep" page.
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { Field, Panel, ErrorState, EmptyState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { addDays, containers, defaultLine, shareText, toPrepare, type PrepLine } from "@/lib/inventory/prep-list";
import { preparationNeeds } from "@/lib/inventory/preparation";
import { getPrepDay, savePrepLeftovers, savePrepList } from "@/lib/queries/prep-list";

type Data = Extract<Awaited<ReturnType<typeof getPrepDay>>, { ok: true }>;
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function PrepDay({ initialDay, allowPicker = true }: { initialDay?: string; allowPicker?: boolean }) {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const fmt = (n: number) => n.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 });
  const [day, setDay] = useState(initialDay ?? addDays(berlinToday(), 1));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Record<string, { target: string; override: string; reason: string }>>({});
  const [note, setNote] = useState("");
  const seq = useRef(0), firstLoad = useRef(true);

  async function load(d: string) {
    const n = ++seq.current;
    setError("");
    try {
      const r = await getPrepDay(d);
      if (n !== seq.current) return;
      if (!r.ok) { setData(null); setError(r.error); return; }
      // Employee page: shift leaders plan in the evening, so they land on tomorrow; everyone else on today.
      if (!allowPicker && firstLoad.current && r.canPlan && d === berlinToday()) { firstLoad.current = false; setDay(addDays(d, 1)); return; }
      firstLoad.current = false;
      setData(r);
      const saved = new Map(r.lines.map((l) => [l.item_id, l]));
      setLeft(Object.fromEntries(r.items.map((i) => [i.id, r.leftovers[i.id] != null ? String(r.leftovers[i.id]) : saved.get(i.id)?.leftover != null ? String(saved.get(i.id)!.leftover) : ""])));
      setLines(Object.fromEntries(r.items.map((i) => {
        const l = saved.get(i.id), dflt = defaultLine(i, d, null);
        return [i.id, { target: String(l?.target ?? dflt.target), override: l?.override != null ? String(l.override) : "", reason: l?.reason ?? "" }];
      })));
      setNote(r.list?.note ?? "");
    } catch { if (n === seq.current) setError("load"); }
  }
  useEffect(() => { void load(day); }, [day]);

  if (error && !data) return <ErrorState message={error === "access" ? s("No access to the prep list for this branch.", "Kein Zugriff auf die Vorbereitungsliste dieser Filiale.") : s("Prep list could not be loaded.", "Vorbereitungsliste konnte nicht geladen werden.")} onRetry={() => load(day)} retryLabel={s("Retry", "Erneut versuchen")} />;
  if (!data) return <CardSkeleton rows={5} />;

  const items = data.items;
  const draftLines: PrepLine[] = items.map((i) => {
    const e = lines[i.id] ?? { target: "0", override: "", reason: "" }, d = defaultLine(i, day, num(left[i.id] ?? ""));
    return { ...d, target: Number(e.target) || 0, override: num(e.override), reason: e.reason.trim() || null };
  });
  const valid = draftLines.every((l) => [l.target, l.reserve, l.leftover ?? 0, l.override ?? 0].every((v) => Number.isFinite(v) && v >= 0 && v < 1e6));
  const countDate = addDays(day, -1);
  const editable = data.canPlan && day >= berlinToday();

  async function run(fn: () => Promise<{ ok: boolean; error?: string; notified?: number }>, done: (r: { notified?: number }) => string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "save"); return; }
      setMessage(done(r)); await load(day);
    } catch { setError("save"); } finally { setBusy(false); }
  }
  const saveLeft = () => run(() => savePrepLeftovers(data.branch.id, countDate, items.filter((i) => num(left[i.id] ?? "") != null).map((i) => ({ item_id: i.id, qty: Number(left[i.id]) }))),
    () => s("Leftovers saved.", "Reste gespeichert."));
  const saveList = (send: boolean) => run(() => savePrepList(data.branch.id, day, draftLines, note, send, data.list?.version ?? 0),
    (r) => !send ? s("Draft saved.", "Entwurf gespeichert.")
      : r.notified ? s(`Sent. ${r.notified} people on the Preparation shift were notified.`, `Gesendet. ${r.notified} Personen der Vorbereitungsschicht wurden benachrichtigt.`)
      : s("Sent, but nobody is rostered on Preparation that day — use Share to post it in the group.", "Gesendet, aber an diesem Tag ist niemand für die Vorbereitung eingeplant — mit Teilen in die Gruppe posten."));
  async function share() {
    const text = shareText(day, items, data!.list?.status === "sent" && !editable ? data!.lines : draftLines, locale, note);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setMessage(s("Copied — paste it into the group.", "Kopiert — in die Gruppe einfügen.")); } } catch { /* share sheet closed */ }
  }
  const ingredients = (itemId: string, amount: number) => {
    const it = items.find((i) => i.id === itemId), y = it?.yield_id ? data.yields.find((v) => v.id === it.yield_id) : undefined, r = y ? data.recipes.find((v) => v.id === y.recipe_id) : undefined;
    if (!y || !r || y.output_unit !== it!.unit || amount <= 0) return null;
    return preparationNeeds(y, r.ingredients, amount, 0, 0, 0)?.ingredients.map((g) => `${g.product} ${fmt(g.raw)} ${g.unit}`).join(" · ") ?? null;
  };
  const errorText = error === "conflict" ? s("Someone else changed this list. It was reloaded — check and save again.", "Jemand hat die Liste geändert. Sie wurde neu geladen — prüfen und erneut speichern.")
    : error === "access" ? s("You are not allowed to plan prep for this branch.", "Du darfst für diese Filiale keine Vorbereitung planen.")
    : error ? s("Not saved. Check the numbers and retry.", "Nicht gespeichert. Zahlen prüfen und erneut versuchen.") : "";

  return <div className="prep-day">
    <div className="row-actions">
      {allowPicker && <Field label={s("Prep date", "Vorbereitungsdatum")}><input className="form-input" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>}
      {!allowPicker && data.canPlan && <div role="group" aria-label={s("Day", "Tag")} className="row-actions">
        {[berlinToday(), addDays(berlinToday(), 1)].map((d, i) => <button key={d} className={d === day ? "btn-gold" : "btn-secondary"} aria-pressed={d === day} onClick={() => setDay(d)}>{i ? s("Tomorrow", "Morgen") : s("Today", "Heute")}</button>)}
      </div>}
      <p className="page-sub">{fmtDay(day, locale)} · {data.list ? (data.list.status === "sent" ? `${s("Sent", "Gesendet")} ${data.list.sent_at ? new Date(data.list.sent_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""}${data.list.sent_by_name ? ` · ${data.list.sent_by_name}` : ""}` : s("Draft", "Entwurf")) : s("Not planned yet", "Noch nicht geplant")}</p>
    </div>
    {message && <p role="status">{message}</p>}
    {errorText && <p role="alert">{errorText}</p>}
    {!items.length && <EmptyState title={s("No prep items yet", "Noch keine Vorbereitungsartikel")}>{data.isManager ? s("Add items and weekday targets under Setup.", "Artikel und Wochenziele unter Einrichtung anlegen.") : s("Ask your manager to set up the prep list.", "Bitte die Leitung, die Vorbereitungsliste einzurichten.")}</EmptyState>}

    {editable && !!items.length && <Panel title={`1 · ${s("Left over", "Reste")} · ${fmtDay(countDate, locale)}`}>
      <p className="t-xs u-muted">{s("Count prepared food left at closing. Leave blank if not counted — it is then treated as nothing left.", "Vorbereitete Reste bei Schließung zählen. Leer lassen, wenn nicht gezählt — dann zählt es als nichts übrig.")}</p>
      <form onSubmit={(e) => { e.preventDefault(); void saveLeft(); }}><fieldset disabled={busy} className="prep-grid">
        {items.map((i) => <Field key={i.id} label={`${(locale === "de" && i.name_de) || i.name} (${i.unit})`}><input className="form-input" type="number" inputMode="decimal" min="0" step="any" value={left[i.id] ?? ""} onChange={(e) => setLeft({ ...left, [i.id]: e.target.value })} /></Field>)}
        <button className="btn-secondary" disabled={!items.some((i) => num(left[i.id] ?? "") != null)}>{s("Save leftovers", "Reste speichern")}</button>
      </fieldset></form>
    </Panel>}

    {!!items.length && (editable || data.list?.status === "sent" || data.canPlan) && <Panel title={`${editable ? "2 · " : ""}${s("To prepare", "Vorzubereiten")} · ${fmtDay(day, locale)}`}>
      {!editable && !data.lines.length ? <p>{s("Not planned for this date.", "Für dieses Datum nicht geplant.")}</p> :
      <div className="table-scroll" role="region" aria-label={s("Prep list", "Vorbereitungsliste")} tabIndex={0}><table className="data-table prep-table">
        <thead><tr><th scope="col">{s("Item", "Artikel")}</th><th scope="col">{s("Target", "Ziel")}</th><th scope="col">{s("Left", "Rest")}</th><th scope="col">{s("To prepare", "Vorbereiten")}</th>{editable && <th scope="col">{s("Change", "Ändern")}</th>}<th scope="col">{s("Reserve if busy", "Reserve bei Andrang")}</th></tr></thead>
        <tbody>{(editable ? draftLines : data.lines).map((l) => {
          const it = items.find((i) => i.id === l.item_id), name = (it && ((locale === "de" && it.name_de) || it.name)) || ("item_name" in l ? (l as { item_name: string }).item_name : "—");
          const unit = it?.unit ?? ("unit" in l ? (l as { unit: string }).unit : ""), amount = toPrepare(l), c = containers(amount, it?.container_size ?? null), e = lines[l.item_id];
          const ing = ingredients(l.item_id, amount);
          return <tr key={l.item_id}>
            <th scope="row">{name}{ing && <div className="t-xs u-muted">{ing}</div>}</th>
            <td>{editable ? <input className="form-input" type="number" min="0" step="any" aria-label={`${s("Target", "Ziel")}: ${name}`} value={e?.target ?? ""} onChange={(ev) => setLines({ ...lines, [l.item_id]: { ...e, target: ev.target.value } })} disabled={busy} /> : `${fmt(l.target)} ${unit}`}</td>
            <td>{l.leftover == null ? <span className="u-muted">{s("not counted", "nicht gezählt")}</span> : `${fmt(l.leftover)} ${unit}`}</td>
            <td><strong>{fmt(amount)} {unit}</strong>{c ? <div className="t-xs u-muted">{c} {it?.container_label ?? s("containers", "Behälter")}</div> : null}{l.override != null && <div className="t-xs u-muted">{s("changed", "geändert")}{l.reason ? `: ${l.reason}` : ""}</div>}</td>
            {editable && <td><input className="form-input" type="number" min="0" step="any" placeholder="—" aria-label={`${s("Change amount", "Menge ändern")}: ${name}`} value={e?.override ?? ""} onChange={(ev) => setLines({ ...lines, [l.item_id]: { ...e, override: ev.target.value } })} disabled={busy} />
              {e?.override !== "" && <input className="form-input" maxLength={200} placeholder={s("Reason (optional)", "Grund (optional)")} aria-label={`${s("Reason", "Grund")}: ${name}`} value={e?.reason ?? ""} onChange={(ev) => setLines({ ...lines, [l.item_id]: { ...e, reason: ev.target.value } })} disabled={busy} />}</td>}
            <td>{l.reserve > 0 ? `+${fmt(l.reserve)} ${unit}` : "—"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
      {editable && <><Field label={s("Note for the team (optional)", "Hinweis fürs Team (optional)")}><input className="form-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></Field>
        <div className="row-actions">
          <button className="btn-secondary" disabled={busy || !valid} onClick={() => void saveList(false)}>{s("Save draft", "Entwurf speichern")}</button>
          <button className="btn-gold" disabled={busy || !valid} onClick={() => { if (window.confirm(s("Send this list? Everyone on the Preparation shift that day gets a notification.", "Liste senden? Alle in der Vorbereitungsschicht an diesem Tag werden benachrichtigt."))) void saveList(true); }}>{data.list?.status === "sent" ? s("Send update", "Aktualisierung senden") : s("Send to team", "An Team senden")}</button>
          <button className="btn-secondary" disabled={busy || !valid} onClick={() => void share()}>{s("Share (WhatsApp …)", "Teilen (WhatsApp …)")}</button>
        </div></>}
      {!editable && data.list?.status === "sent" && <div className="row-actions">{data.list.note && <p>{data.list.note}</p>}<button className="btn-secondary" onClick={() => void share()}>{s("Share", "Teilen")}</button></div>}
    </Panel>}
    {!editable && !data.canPlan && data.list?.status !== "sent" && !!items.length && <EmptyState title={s("The prep list for this day has not been sent yet.", "Die Vorbereitungsliste für diesen Tag wurde noch nicht gesendet.")} />}
  </div>;
}
