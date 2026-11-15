"use client";

import { CardSkeleton } from "@/components/Skeleton";
import { packTotal } from "@/lib/inventory/packCount";
import { toast } from "@/components/Toast";
import { saveDraft, readDraft, clearDraft } from "@/lib/localDraft";
import { askConfirm } from "@/components/ConfirmDialog";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import InventoryNav from "@/components/InventoryNav";
import { useLang } from "@/components/LanguageProvider";
import { ErrorState, EmptyState, PageHeader } from "@/components/ui";
import { getCountSessions, editCountSession, type CountLine } from "@/lib/queries/count-sessions";
import { fmtDay } from "@/lib/time/berlinDate";

type Workspace = Extract<Awaited<ReturnType<typeof getCountSessions>>, { ok: true }>;

export default function CountSessionsPage() {
  const { t, locale } = useLang();
  const [data, setData] = useState<Workspace | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(""); // "" = all categories
  const [status, setStatus] = useState<"all" | "open" | "done">("all");
  const [packFor, setPackFor] = useState<string | null>(null), [pack, setPack] = useState({ i: 0, packs: "", loose: "" });
  const [reviewed, setReviewed] = useState(false);
  const request = useRef(0);
  const mounted = useRef(true);
  const dirty = Object.keys(entries).length > 0;
  // Autosave: unsaved quantities of an open draft are kept on this device until saved or discarded.
  const draftKey = data?.session?.status === "draft" ? `count-draft:${data.session.id}` : null;
  useEffect(() => { if (draftKey) saveDraft(draftKey, dirty ? entries : null); }, [draftKey, entries, dirty]);
  const canLeave = async () => {
    if (!dirty) return true;
    const ok = await askConfirm({ message: t("countSession.discard") });
    if (ok && draftKey) clearDraft(draftKey);
    return ok;
  };

  async function load(id?: string) {
    if (!mounted.current) return;
    const current = ++request.current;
    setLoading(true); setError("");
    try {
      const result = await getCountSessions(id);
      if (current !== request.current) return;
      if (!result.ok) { setError(t(`countSession.error_${result.error}`)); return; }
      // Restore unsaved quantities from this device (only lines that still exist in the draft).
      const backup = result.session?.status === "draft" ? readDraft<Record<string, string>>(`count-draft:${result.session.id}`) : null;
      const restored = backup ? Object.fromEntries(Object.entries(backup).filter(([id, v]) => typeof v === "string" && result.lines.some(line => line.id === id))) : {};
      setData(result); setEntries(restored); setReviewed(false);
      if (Object.keys(restored).length) toast(locale === "de" ? "Ungespeicherte Zählungen wiederhergestellt" : "Unsaved counts restored", "info");
      const url = new URL(window.location.href);
      if (result.session) url.searchParams.set("session", result.session.id); else url.searchParams.delete("session");
      window.history.replaceState(null, "", url);
    } catch { if (current === request.current) setError(t("countSession.error_load")); }
    finally { if (current === request.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; load(new URLSearchParams(window.location.search).get("session") || undefined); return () => { mounted.current = false; request.current++; }; }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const value = (line: CountLine) => entries[line.id] ?? (line.quantity == null ? "" : String(line.quantity));
  const invalid = data?.lines.some(line => value(line) !== "" && (!Number.isFinite(Number(value(line))) || Number(value(line)) < 0));
  const counted = data?.lines.filter(line => value(line).trim() !== "" && Number.isFinite(Number(value(line))) && Number(value(line)) >= 0).length ?? 0;
  const draft = data?.session?.status === "draft";
  const visibleLines = data?.lines.filter(line => (!category || line.category === category) && (status === "all" || (status === "done") === (value(line).trim() !== "")) && `${line.product} ${line.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  // Walk the shelves: progress per category; tap one to count only that part.
  const categories = [...new Set(data?.lines.map(line => line.category) ?? [])].map(name => {
    const own = data!.lines.filter(line => line.category === name);
    return { name, total: own.length, done: own.filter(line => value(line).trim() !== "").length };
  });
  // Fast counting: Enter / ↓ next field, ↑ previous (number fields would otherwise change their value).
  function moveFocus(event: React.KeyboardEvent<HTMLInputElement>) {
    const step = event.key === "Enter" || event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>("input[data-count]")], at = inputs.indexOf(event.currentTarget);
    inputs[at + step]?.focus(); inputs[at + step]?.select();
  }
  function setPackValue(line: CountLine, next: { i: number; packs: string; loose: string }) {
    setPack(next);
    const size = data?.packs?.[line.id]?.[next.i]?.qty ?? 0, total = packTotal(next.packs, size, next.loose);
    setEntries({ ...entries, [line.id]: total == null ? "" : Number.isNaN(total) ? "-1" : String(total) }); // "-1" shows the invalid warning
    setReviewed(false);
  }
  const recentSessions = data?.session && !data.sessions.some(s => s.id === data.session!.id) ? [data.session, ...data.sessions] : data?.sessions ?? [];
  async function mutate(action: "start" | "save" | "complete" | "cancel") {
    if (!data || busy || (action !== "start" && !data.session)) return;
    if (action === "cancel" && !(await askConfirm({ message: t("countSession.cancelConfirm") }))) return;
    if (action === "complete" && !(await askConfirm({ message: t("countSession.completeConfirm") }))) return;
    setBusy(true); setError("");
    try {
      const lines = Object.entries(entries).map(([id, quantity]) => ({ id, quantity: quantity.trim() === "" ? null : Number(quantity) }));
      const result = await editCountSession(data.branch.id, action === "start" ? crypto.randomUUID() : data.session!.id, action, data.session?.revision ?? 0, action === "save" ? lines : []);
      if (!mounted.current) return;
      if (!result.ok) { setError(t(`countSession.error_${result.error}`)); return; }
      if (data.session) clearDraft(`count-draft:${data.session.id}`);
      await load(result.id);
    } catch { if (mounted.current) setError(t("countSession.error_save")); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <div className="inventory-page">
    {data?.canPublish !== false ? <InventoryNav active="stock" canLeave={canLeave} /> : <Link className="inventory-back" href="/shift">← {locale==="de"?"Zurück zu Inventar":"Back to Inventory"}</Link>}
    <PageHeader title={t("countSession.title")} subtitle={data?.branch.name ?? t("common.loading")} actions={data?.canPublish === false ? undefined : <Link className="btn-secondary" href="/inventory?view=count" aria-disabled={busy} onClick={async event=>{if(!busy&&!dirty)return;event.preventDefault();if(!busy&&await canLeave())window.location.assign("/inventory?view=count");}}>{locale==="de"?"Einzelnen Artikel zählen":"Count one item"}</Link>} />
    {error && <ErrorState message={error} onRetry={async () => { if (await canLeave()) load(data?.session?.id); }} retryLabel={t("countSession.reload")} />}
    {loading ? <CardSkeleton rows={4} /> : data && <>
      {/* 1. Session bar: which count + the actions for it (top), filters (bottom), as in the AI Studio count sheet. */}
      <section className="card count-bar" aria-label={t("countSession.title")}>
        <div className="count-bar-top">
          <label className="count-pick"><span>{t("countSession.recent")}</span><select className="form-select" value={data.session?.id ?? ""} disabled={busy} onChange={async event => { const v = event.target.value; if (await canLeave()) load(v); }}>
            {!data.session && <option value="">—</option>}
            {recentSessions.map(s => <option key={s.id} value={s.id}>{fmtDay(s.count_date, locale)} · {t(`countSession.${s.status}`)} · {s.id.slice(0, 8)}</option>)}
          </select></label>
          <div className="count-bar-actions">
            {!draft && <button className="btn-gold" disabled={busy || dirty} onClick={() => mutate("start")}>{t("countSession.start")}</button>}
            {draft && <>
              <button className="btn-secondary" disabled={busy} onClick={() => mutate("cancel")}>{t("countSession.cancel")}</button>
              <button className="btn-gold" disabled={busy || !dirty || invalid} onClick={() => mutate("save")}>{t("countSession.save")}{dirty ? ` (${Object.keys(entries).length})` : ""}</button>
            </>}
          </div>
        </div>
        {data.session && <div className="count-bar-filters">
          <input type="search" className="form-input" aria-label={t("countSession.search")} placeholder={t("countSession.search")} value={search} onChange={event => setSearch(event.target.value)} />
          <select className="form-select" aria-label={locale === "de" ? "Status" : "Status"} value={status} onChange={event => setStatus(event.target.value as typeof status)}>
            <option value="all">{locale === "de" ? "Alle Artikel" : "All items"}</option>
            <option value="open">{locale === "de" ? "Noch nicht gezählt" : "Not counted yet"}</option>
            <option value="done">{locale === "de" ? "Gezählt" : "Counted"}</option>
          </select>
          <span className="ui-muted inv-mono">{visibleLines.length} {locale === "de" ? "angezeigt" : "shown"}</span>
        </div>}
      </section>

      {!data.session ? <EmptyState title={t("countSession.empty")} /> : <>
        {/* 2. Walk the shelves: progress per category. */}
        <section className="card count-walk-bar">
          <div className="count-walk-status">
            <strong>{fmtDay(data.session.count_date, locale)} · {t(`countSession.${data.session.status}`)}</strong>
            <span className="ui-muted inv-mono">{t("countSession.progress", { counted, total: data.lines.length })} · {t("countSession.revision", { n: data.session.revision })}</span>
          </div>
          {categories.length > 1 && <div className="count-walk" role="group" aria-label={locale === "de" ? "Bereiche" : "Areas"}>
            <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>{locale === "de" ? "Alle" : "All"} <span>{counted}/{data.lines.length}</span></button>
            {categories.map(c => <button type="button" key={c.name} aria-pressed={category === c.name} className={c.done === c.total ? "done" : undefined} onClick={() => setCategory(category === c.name ? "" : c.name)}>{c.name || "—"} <span>{c.done}/{c.total}</span></button>)}
          </div>}
        </section>
        {dirty && <p role="status" className="count-note">{t("countSession.unsaved")}</p>}
        {invalid && <p role="alert" className="count-note is-error">{t("countSession.error_invalid")}</p>}

        {/* 3. The sheet: a table on laptop/tablet, one card per item on a phone. */}
        <section className="card count-sheet">
          <div className="table-scroll" role="region" tabIndex={0} aria-label={t("countSession.title")}>
            <table className="data-table count-table"><thead><tr><th scope="col">{t("inv.product")}</th><th scope="col">{t("inv.targetCol")}</th><th scope="col">{t("inv.count")}</th></tr></thead>
            <tbody>{visibleLines.map(line => <tr key={line.id} className={value(line).trim() !== "" ? "is-counted" : undefined}>
              <td><strong>{line.product}</strong><div className="muted">{line.category} · {line.unit || "—"}</div></td>
              <td className="inv-mono" data-label={t("inv.targetCol")}>{line.target} {line.unit}</td>
              <td>{draft ? <>
                <div className="count-cell">
                  {!!data.packs?.[line.id]?.length && <button type="button" className="btn-secondary ui-btn-sm" aria-expanded={packFor === line.id} disabled={busy}
                    onClick={() => { setPackFor(packFor === line.id ? null : line.id); setPack({ i: 0, packs: "", loose: "" }); }}>{locale === "de" ? "Gebinde" : "Packs"}</button>}
                  <input type="number" inputMode="decimal" min="0" step="any" data-count className="form-input quantity-input" aria-label={`${t("inv.count")}: ${line.product} (${line.unit || "—"})`} value={value(line)} disabled={busy} onKeyDown={moveFocus} onChange={event => { setEntries({ ...entries, [line.id]: event.target.value }); setReviewed(false); }} />
                  <span className="count-unit">{line.unit}</span>
                </div>
                {packFor === line.id && data.packs?.[line.id] && <div className="pack-calc" role="group" aria-label={locale === "de" ? "In Gebinden zählen" : "Count in packs"}>
                  <input type="number" inputMode="decimal" min="0" step="any" className="form-input" aria-label={locale === "de" ? "Anzahl Gebinde" : "Number of packs"} value={pack.packs} onChange={event => setPackValue(line, { ...pack, packs: event.target.value })} autoFocus />
                  <span>×</span>
                  {data.packs[line.id].length > 1
                    ? <select className="form-select" aria-label={locale === "de" ? "Gebinde" : "Pack"} value={pack.i} onChange={event => setPackValue(line, { ...pack, i: Number(event.target.value) })}>{data.packs[line.id].map((p, i) => <option key={p.label} value={i}>{p.label} ({p.qty} {line.unit})</option>)}</select>
                    : <span>{data.packs[line.id][0].label} ({data.packs[line.id][0].qty} {line.unit})</span>}
                  <span>+</span>
                  <input type="number" inputMode="decimal" min="0" step="any" className="form-input" aria-label={locale === "de" ? `Lose Menge (${line.unit || "—"})` : `Loose (${line.unit || "—"})`} value={pack.loose} onChange={event => setPackValue(line, { ...pack, loose: event.target.value })} />
                  <span>= <strong>{value(line) || "—"}</strong> {line.unit}</span>
                </div>}
              </> : <span className="inv-mono">{line.quantity ?? "—"} {line.quantity != null ? line.unit : ""}</span>}</td>
            </tr>)}{visibleLines.length === 0 && <tr><td colSpan={3}>{t("inventoryWorkflow.noMatches")} <button className="btn-secondary" onClick={() => { setSearch(""); setCategory(""); setStatus("all"); }}>{t("inventoryWorkflow.reset")}</button></td></tr>}</tbody></table>
          </div>
        </section>

        {/* 4. Publish: review and complete (managers), separate from saving. */}
        {draft && <section className="card count-publish">
          <p className="muted">{data.canPublish !== false ? t("countSession.publishHelp") : (locale==="de"?"Speichere deinen Stand. Eine Führungskraft prüft und veröffentlicht die Zählung.":"Save your progress. A manager reviews and publishes the count.")}</p>
          {data.canPublish !== false && <div className="count-publish-row">
            <label><input type="checkbox" checked={reviewed} disabled={dirty || busy} onChange={event => setReviewed(event.target.checked)} /> {t("countSession.review")}</label>
            <button className="btn-secondary" disabled={busy || dirty || !reviewed || counted !== data.lines.length || !counted} onClick={() => mutate("complete")}>{t("countSession.complete")}</button>
          </div>}
        </section>}
      </>}
    </>}
  </div>;
}
