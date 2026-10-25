"use client";

import { useEffect, useRef, useState } from "react";
import InventoryNav from "@/components/InventoryNav";
import { useLang } from "@/components/LanguageProvider";
import { ErrorState, EmptyState, PageHeader, Panel } from "@/components/ui";
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
  const [reviewed, setReviewed] = useState(false);
  const request = useRef(0);
  const mounted = useRef(true);
  const dirty = Object.keys(entries).length > 0;
  const canLeave = () => !dirty || window.confirm(t("countSession.discard"));

  async function load(id?: string) {
    if (!mounted.current) return;
    const current = ++request.current;
    setLoading(true); setError("");
    try {
      const result = await getCountSessions(id);
      if (current !== request.current) return;
      if (!result.ok) { setError(t(`countSession.error_${result.error}`)); return; }
      setData(result); setEntries({}); setReviewed(false);
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
  const visibleLines = data?.lines.filter(line => `${line.product} ${line.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const recentSessions = data?.session && !data.sessions.some(s => s.id === data.session!.id) ? [data.session, ...data.sessions] : data?.sessions ?? [];
  async function mutate(action: "start" | "save" | "complete" | "cancel") {
    if (!data || busy || (action !== "start" && !data.session)) return;
    if (action === "cancel" && !window.confirm(t("countSession.cancelConfirm"))) return;
    if (action === "complete" && !window.confirm(t("countSession.completeConfirm"))) return;
    setBusy(true); setError("");
    try {
      const lines = Object.entries(entries).map(([id, quantity]) => ({ id, quantity: quantity.trim() === "" ? null : Number(quantity) }));
      const result = await editCountSession(data.branch.id, action === "start" ? crypto.randomUUID() : data.session!.id, action, data.session?.revision ?? 0, action === "save" ? lines : []);
      if (!mounted.current) return;
      if (!result.ok) { setError(t(`countSession.error_${result.error}`)); return; }
      await load(result.id);
    } catch { if (mounted.current) setError(t("countSession.error_save")); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <div className="inventory-page">
    <InventoryNav active="stock" canLeave={canLeave} />
    <PageHeader title={t("countSession.title")} subtitle={data?.branch.name ?? t("common.loading")} />
    <p className="page-sub">{t("countSession.help")}</p>
    {error && <ErrorState message={error} onRetry={() => { if (canLeave()) load(data?.session?.id); }} retryLabel={t("countSession.reload")} />}
    {loading ? <p role="status">{t("common.loading")}</p> : data && <>
      <div className="row-actions">
        <button className="btn-gold" disabled={busy || dirty} onClick={() => mutate("start")}>{t("countSession.start")}</button>
        <label>{t("countSession.recent")} <select className="form-select" value={data.session?.id ?? ""} disabled={busy} onChange={event => { if (canLeave()) load(event.target.value); }}>
          {!data.session && <option value="">—</option>}
          {recentSessions.map(s => <option key={s.id} value={s.id}>{fmtDay(s.count_date, locale)} · {t(`countSession.${s.status}`)} · {s.id.slice(0, 8)}</option>)}
        </select></label>
      </div>
      {!data.session ? <EmptyState title={t("countSession.empty")} /> : <Panel title={`${fmtDay(data.session.count_date, locale)} · ${t(`countSession.${data.session.status}`)}`}>
        <p>{t("countSession.progress", { counted, total: data.lines.length })} · {t("countSession.revision", { n: data.session.revision })}</p>
        {dirty && <p role="status">{t("countSession.unsaved")}</p>}
        {invalid && <p role="alert">{t("countSession.error_invalid")}</p>}
        <label className="ui-field">{t("countSession.search")}<input type="search" className="form-input" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="table-scroll" role="region" tabIndex={0} aria-label={t("countSession.title")}>
          <table className="data-table"><thead><tr><th scope="col">{t("inv.product")}</th><th scope="col">{t("inv.targetCol")}</th><th scope="col">{t("inv.count")}</th></tr></thead>
          <tbody>{visibleLines.map(line => <tr key={line.id}>
            <td><strong>{line.product}</strong><div className="muted">{line.category} · {line.unit || "—"}</div></td><td>{line.target} {line.unit}</td>
            <td>{draft ? <input type="number" inputMode="decimal" min="0" step="any" className="form-input quantity-input" aria-label={`${t("inv.count")}: ${line.product} (${line.unit || "—"})`} value={value(line)} disabled={busy} onChange={event => { setEntries({ ...entries, [line.id]: event.target.value }); setReviewed(false); }} /> : line.quantity ?? "—"}</td>
          </tr>)}{visibleLines.length === 0 && <tr><td colSpan={3}>{t("inventoryWorkflow.noMatches")} <button className="btn-secondary" onClick={() => setSearch("")}>{t("inventoryWorkflow.reset")}</button></td></tr>}</tbody></table>
        </div>
        {draft && <>
          <p className="muted">{t("countSession.publishHelp")}</p>
          <label><input type="checkbox" checked={reviewed} disabled={dirty || busy} onChange={event => setReviewed(event.target.checked)} /> {t("countSession.review")}</label>
          <div className="row-actions">
            <button className="btn-gold" disabled={busy || !dirty || invalid} onClick={() => mutate("save")}>{t("countSession.save")}</button>
            <button className="btn-secondary" disabled={busy || dirty || !reviewed || counted !== data.lines.length || !counted} onClick={() => mutate("complete")}>{t("countSession.complete")}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => mutate("cancel")}>{t("countSession.cancel")}</button>
          </div>
        </>}
      </Panel>}
    </>}
  </div>;
}
