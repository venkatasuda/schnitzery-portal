"use client";
// One prep day as a single flow: pick the date → count last night's leftovers → "Next day" → adjust and send.
// Planners (managers + shift leaders) edit; everyone else sees the sent list read-only.
// Used in Inventory → Kitchen and the employee prep page. No extra tables: leftovers + list lines as before.
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { ErrorState, EmptyState } from "@/components/ui";
import { CardSkeleton } from "@/components/Skeleton";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";
import { addDays, containers, defaultLine, shareText, toPrepare, type PrepLine } from "@/lib/inventory/prep-list";
import { preparationNeeds } from "@/lib/inventory/preparation";
import { getPrepDay, savePrepLeftovers, savePrepList } from "@/lib/queries/prep-list";

type Data = Extract<Awaited<ReturnType<typeof getPrepDay>>, { ok: true }>;
type Edit = { target: string; reserve: string; override: string; reason: string };
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export default function PrepDay({ initialDay, allowPicker = true }: { initialDay?: string; allowPicker?: boolean }) {
  const { locale } = useLang();
  const de = locale === "de", s = (en: string, d: string) => (de ? d : en);
  const fmt = (n: number) => n.toLocaleString(de ? "de-DE" : "en-GB", { maximumFractionDigits: 2 });
  const today = berlinToday(), tomorrow = addDays(today, 1);
  const [day, setDay] = useState(initialDay ?? tomorrow);
  const [data, setData] = useState<Data | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState(""), [toast, setToast] = useState(""), [busy, setBusy] = useState(false), [shareFirst, setShareFirst] = useState(false);
  const [left, setLeft] = useState<Record<string, string>>({});
  const [savedLeft, setSavedLeft] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Record<string, Edit>>({});
  const [note, setNote] = useState("");
  const seq = useRef(0), firstLoad = useRef(true), stepFor = useRef("");

  async function load(d: string) {
    const n = ++seq.current;
    setError("");
    try {
      const r = await getPrepDay(d);
      if (n !== seq.current) return;
      if (!r.ok) { setData(null); setError(r.error); return; }
      // Employee page: planners work in the evening, so they land on tomorrow.
      if (!allowPicker && firstLoad.current && r.canPlan && d === berlinToday()) { firstLoad.current = false; setDay(addDays(d, 1)); return; }
      firstLoad.current = false;
      setData(r);
      const saved = new Map(r.lines.map((l) => [l.item_id, l]));
      const lf = Object.fromEntries(r.items.map((i) => [i.id, r.leftovers[i.id] != null ? String(r.leftovers[i.id]) : saved.get(i.id)?.leftover != null ? String(saved.get(i.id)!.leftover) : ""]));
      setLeft(lf); setSavedLeft(lf);
      setLines(Object.fromEntries(r.items.map((i) => {
        const l = saved.get(i.id), dflt = defaultLine(i, d, null);
        return [i.id, { target: String(l?.target ?? dflt.target), reserve: String(l?.reserve ?? dflt.reserve), override: l?.override != null ? String(l.override) : "", reason: l?.reason ?? "" }];
      })));
      setNote(r.list?.note ?? "");
      // Open on step 2 when tonight's count is already done or the list exists; only on the first load of a date.
      if (stepFor.current !== d) { stepFor.current = d; setStep(r.list || Object.keys(r.leftovers).length ? 2 : 1); setShareFirst(false); setToast(""); }
    } catch { if (n === seq.current) setError("load"); }
  }
  useEffect(() => { void load(day); }, [day]);

  if (error && !data) return <ErrorState message={error === "access" ? s("No access to this branch's prep list.", "Kein Zugriff auf die Vorbereitungsliste.") : s("Prep list could not be loaded.", "Vorbereitungsliste konnte nicht geladen werden.")} onRetry={() => load(day)} retryLabel={s("Retry", "Erneut versuchen")} />;
  if (!data) return <CardSkeleton rows={5} />;

  const items = data.items;
  const name = (id: string) => { const it = items.find((i) => i.id === id); return (it && ((de && it.name_de) || it.name)) || "—"; };
  const draftLines: PrepLine[] = items.map((i) => {
    const e = lines[i.id] ?? { target: "0", reserve: "0", override: "", reason: "" }, d = defaultLine(i, day, num(left[i.id] ?? ""));
    return { ...d, target: Number(e.target) || 0, reserve: Number(e.reserve) || 0, override: num(e.override), reason: e.override.trim() !== "" ? e.reason.trim() || null : null };
  });
  const valid = draftLines.every((l) => [l.target, l.reserve, l.leftover ?? 0, l.override ?? 0].every((v) => Number.isFinite(v) && v >= 0 && v < 1e6));
  const countDate = addDays(day, -1);
  const editable = data.canPlan && day >= today;
  const sent = data.list?.status === "sent";
  const leftDirty = items.some((i) => (left[i.id] ?? "") !== (savedLeft[i.id] ?? ""));
  const counted = items.filter((i) => num(left[i.id] ?? "") != null).length;
  const set = (id: string, patch: Partial<Edit>) => setLines({ ...lines, [id]: { ...lines[id], ...patch } });

  async function run<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, after?: (r: T) => void) {
    if (busy) return false;
    setBusy(true); setError(""); setToast("");
    try {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "save"); if (r.error === "conflict") await load(day); return false; }
      after?.(r); await load(day); return true;
    } catch { setError("save"); return false; } finally { setBusy(false); }
  }
  async function nextDay() {
    if (leftDirty && !(await run(() => savePrepLeftovers(data!.branch.id, countDate, items.filter((i) => num(left[i.id] ?? "") != null).map((i) => ({ item_id: i.id, qty: Number(left[i.id]) })))))) return;
    setStep(2);
  }
  const saveList = (send: boolean) => run(() => savePrepList(data.branch.id, day, draftLines, note, send, data.list?.version ?? 0), (r: { notified?: number }) => {
    if (!send) return setToast(s("Draft saved", "Entwurf gespeichert"));
    setToast(r.notified ? s(`Sent · ${r.notified} notified`, `Gesendet · ${r.notified} benachrichtigt`) : s("Sent", "Gesendet"));
    setShareFirst(!r.notified);
  });
  async function share() {
    const text = shareText(day, items, sent && !editable ? data!.lines : draftLines, locale, note);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setToast(s("Copied", "Kopiert")); } } catch { /* share sheet closed */ }
  }
  const ingredients = (itemId: string, amount: number) => {
    const it = items.find((i) => i.id === itemId), y = it?.yield_id ? data.yields.find((v) => v.id === it.yield_id) : undefined, r = y ? data.recipes.find((v) => v.id === y.recipe_id) : undefined;
    if (!y || !r || y.output_unit !== it!.unit || amount <= 0) return null;
    return preparationNeeds(y, r.ingredients, amount, 0, 0, 0)?.ingredients.map((g) => `${g.product} ${fmt(g.raw)} ${g.unit}`).join(" · ") ?? null;
  };
  const errorText = !error ? "" : error === "conflict" ? s("Changed by someone else — reloaded.", "Von jemand anderem geändert — neu geladen.")
    : error === "access" ? s("No permission for this branch.", "Keine Berechtigung für diese Filiale.") : s("Not saved — check the numbers.", "Nicht gespeichert — Zahlen prüfen.");
  const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "";
  const status = data.list ? (sent ? { cls: "is-sent", text: `${s("Sent", "Gesendet")} ${time(data.list.sent_at)}${data.list.sent_by_name ? ` · ${data.list.sent_by_name}` : ""}` } : { cls: "is-draft", text: s("Draft", "Entwurf") }) : { cls: "", text: s("Not planned", "Nicht geplant") };
  const viewLines = editable ? draftLines : data.lines;

  return <div className="prep-day">
    {/* Date bar */}
    <div className="prep-bar">
      {(allowPicker || data.canPlan) && <div className="prep-seg" role="group" aria-label={s("Prep date", "Vorbereitungsdatum")}>
        {[today, tomorrow].map((d, i) => <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}>{i ? s("Tomorrow", "Morgen") : s("Today", "Heute")}</button>)}
        {allowPicker && <input className="prep-date" type="date" aria-label={s("Choose date", "Datum wählen")} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />}
      </div>}
      <div className="prep-bar-day"><strong>{fmtDay(day, locale)}</strong><span className={`prep-pill ${status.cls}`}>{status.text}</span></div>
    </div>

    {!items.length && <EmptyState title={s("No prep items yet", "Noch keine Vorbereitungsartikel")}>{data.isManager ? s("Add them under Setup.", "Unter Einrichtung anlegen.") : null}</EmptyState>}

    {/* Stepper: one flow, two views */}
    {editable && !!items.length && <ol className="prep-steps">
      <li><button type="button" aria-current={step === 1 ? "step" : undefined} onClick={() => setStep(1)}>
        <span className="prep-steps-n">{step === 2 ? "✓" : "1"}</span><span>{s("Leftovers", "Reste")}<small>{fmtDay(countDate, locale)} · {counted}/{items.length}</small></span></button></li>
      <li><button type="button" aria-current={step === 2 ? "step" : undefined} onClick={() => void nextDay()} disabled={busy}>
        <span className="prep-steps-n">2</span><span>{s("Prep", "Vorbereitung")}<small>{fmtDay(day, locale)}</small></span></button></li>
    </ol>}

    {errorText && <p className="prep-error" role="alert">{errorText}</p>}

    {editable && !!items.length && step === 1 && <form className="prep-card" onSubmit={(e) => { e.preventDefault(); void nextDay(); }}>
      <fieldset disabled={busy} className="prep-left-list">
        <legend className="sr-only">{s("Leftovers", "Reste")}</legend>
        {items.map((i) => <label key={i.id} className="prep-left-row">
          <span>{name(i.id)}</span>
          <span className="prep-unit-input"><input className="form-input" type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={left[i.id] ?? ""} onChange={(e) => setLeft({ ...left, [i.id]: e.target.value })} /><em>{i.unit}</em></span>
        </label>)}
      </fieldset>
      <div className="prep-actions"><button className="btn-gold" disabled={busy}>{s("Next day", "Nächster Tag")} →</button></div>
    </form>}

    {!!items.length && (editable ? step === 2 : data.lines.length > 0 && (sent || data.canPlan)) && <div className="prep-card">
      <div className="table-scroll" role="region" aria-label={s("Prep list", "Vorbereitungsliste")} tabIndex={0}><table className="data-table prep-table">
        <thead><tr>
          <th scope="col">{s("Item", "Artikel")}</th><th scope="col">{s("Target", "Ziel")}</th>
          <th scope="col" title={s("Blank = nothing left", "Leer = nichts übrig")}>{s("Left", "Rest")}</th>
          <th scope="col">{s("Reserve", "Reserve")}</th><th scope="col" className="prep-col-main">{s("To prepare", "Vorbereiten")}</th>
        </tr></thead>
        <tbody>{viewLines.map((l) => {
          const it = items.find((i) => i.id === l.item_id), n = it ? name(l.item_id) : ("item_name" in l ? (l as { item_name: string }).item_name : "—");
          const unit = it?.unit ?? ("unit" in l ? (l as { unit: string }).unit : ""), amount = toPrepare(l), auto = toPrepare({ ...l, override: null });
          const c = containers(amount, it?.container_size ?? null), e = lines[l.item_id], ing = ingredients(l.item_id, amount);
          return <tr key={l.item_id} className={amount > 0 ? undefined : "is-zero"}>
            <th scope="row">{n}{ing && <div className="prep-sub">{ing}</div>}</th>
            <td>{editable ? <input className="form-input prep-num" type="number" min="0" step="any" aria-label={`${s("Target", "Ziel")}: ${n}`} value={e?.target ?? ""} onChange={(ev) => set(l.item_id, { target: ev.target.value })} disabled={busy} /> : `${fmt(l.target)} ${unit}`}</td>
            <td>{l.leftover == null ? <span className="u-muted">—</span> : `${fmt(l.leftover)} ${unit}`}</td>
            <td>{editable ? <input className="form-input prep-num" type="number" min="0" step="any" aria-label={`${s("Reserve", "Reserve")}: ${n}`} value={e?.reserve ?? ""} onChange={(ev) => set(l.item_id, { reserve: ev.target.value })} disabled={busy} /> : l.reserve > 0 ? `+${fmt(l.reserve)} ${unit}` : "—"}</td>
            <td className="prep-col-main">
              {editable ? <span className="prep-unit-input"><input className={`form-input prep-num prep-result${l.override != null ? " is-changed" : ""}`} type="number" min="0" step="any" placeholder={fmt(auto)} aria-label={`${s("To prepare", "Vorbereiten")}: ${n}`} title={l.override != null ? `${s("Calculated", "Berechnet")}: ${fmt(auto)} ${unit}` : undefined} value={e?.override ?? ""} onChange={(ev) => set(l.item_id, { override: ev.target.value })} disabled={busy} /><em>{unit}</em></span>
                : <strong className="prep-result-ro">{fmt(amount)} {unit}</strong>}
              {c ? <div className="prep-sub">{c} × {it?.container_label ?? s("container", "Behälter")}</div> : null}
              {editable && e?.override !== "" ? <input className="form-input prep-reason" maxLength={200} placeholder={s("Reason", "Grund")} aria-label={`${s("Reason", "Grund")}: ${n}`} value={e?.reason ?? ""} onChange={(ev) => set(l.item_id, { reason: ev.target.value })} disabled={busy} />
                : l.reason ? <div className="prep-sub">{l.reason}</div> : null}
            </td>
          </tr>;
        })}</tbody>
      </table></div>

      {editable ? <>
        <input className="form-input prep-note" maxLength={500} placeholder={s("Note for the team", "Hinweis fürs Team")} aria-label={s("Note for the team", "Hinweis fürs Team")} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        <div className="prep-actions">
          {toast && <span className="prep-toast" role="status">{toast}</span>}
          <button className="btn-secondary" disabled={busy || !valid} onClick={() => void saveList(false)}>{s("Save draft", "Entwurf")}</button>
          <button className={shareFirst ? "btn-gold" : "btn-secondary"} disabled={busy || !valid} onClick={() => void share()}>{s("Share", "Teilen")}</button>
          <button className={shareFirst ? "btn-secondary" : "btn-gold"} disabled={busy || !valid} onClick={() => { if (window.confirm(s("Send to the Preparation team?", "An das Vorbereitungsteam senden?"))) void saveList(true); }}>{sent ? s("Send update", "Update senden") : s("Send", "Senden")}</button>
        </div>
      </> : <div className="prep-actions">{data.list?.note && <p className="prep-note-ro">{data.list.note}</p>}<button className="btn-secondary" onClick={() => void share()}>{s("Share", "Teilen")}</button></div>}
    </div>}

    {!editable && !!items.length && !(data.lines.length > 0 && (sent || data.canPlan)) && <EmptyState title={data.canPlan ? s("Not planned", "Nicht geplant") : s("Not sent yet", "Noch nicht gesendet")} />}
  </div>;
}
