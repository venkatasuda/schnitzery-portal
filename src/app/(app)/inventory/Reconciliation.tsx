"use client";

import { serverText } from "@/lib/i18n/serverMessages";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { EmptyState, ErrorState, Segmented } from "@/components/ui";
import NativeDialog from "@/components/NativeDialog";
import Link from "next/link";
import { addReconciliationReview, getReconciliation } from "@/lib/queries/reconciliation";
import { getAnalyticsScope } from "@/lib/queries/branch-analytics";
import { reviewSnapshot, sameSnapshot, type ReviewSnapshot } from "@/lib/inventory/reconciliation";

type Row = Extract<Awaited<ReturnType<typeof getReconciliation>>, { ok: true }>["rows"][number];
const FLAGGED = ["gain", "unusual"];
// Any change to figures, status or reasons makes a review stale (review finding 7).
const changedSince = (r: Row) => !!r.review && !sameSnapshot(r.review.figures as ReviewSnapshot, r);

export default function Reconciliation() {
  const { t, locale } = useLang();
  const loc = locale === "de" ? "de-DE" : "en-GB";
  const [days, setDays] = useState(90);
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branch, setBranch] = useState<string | null>(null); // null = own branch

  // HQ only: brand owners / super admins can review any branch.
  useEffect(() => {
    getAnalyticsScope().then(s => { if (s.ok && s.canPickBranch) { setBranches(s.branches); setBranch(s.defaultBranch || s.branches[0]?.id || null); } }).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setOpen(null);setNote("");
    setLoading(true); setError(null);
    getReconciliation(days, branch).then(r => { if (!active) return; if (r.ok) setRows(r.rows); else setError(serverText(r.error ?? "", locale)); })
      .catch(() => { if (active) setError("failed"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, retry, branch]);

  const n = (v: number) => Number.isFinite(v) ? v.toLocaleString(loc, { maximumFractionDigits: 2 }) : "—";
  const d = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(loc, { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const needs = (r: Row) => FLAGGED.includes(r.status) && (!r.review || changedSince(r));
  const shown = all ? rows : rows.filter(needs);
  const detail = rows.find(r=>`${r.fromId}|${r.toId}`===open);

  async function save(r: Row) {
    setSaving(true);
    const res = await addReconciliationReview(r.fromId, r.toId, note, reviewSnapshot(r), days, branch).catch(() => ({ ok: false as const, code: "saveFailed" }));
    setSaving(false);
    if (res.ok) { toast(t("reconcile.saved"), "success"); setOpen(null); setNote(""); setRetry(x => x + 1); return; }
    const code = "code" in res ? res.code : undefined;
    toast(code ? t(`reconcile.${code === "changed" ? "changedErr" : code}`) : (("error" in res && res.error) || t("reconcile.saveFailed")), "error");
    if (code === "changed") setRetry(x => x + 1);
  }

  return <section className="card" aria-label={t("reconcile.title")} aria-busy={loading}>
    <p className="ui-lede">{t("reconcile.note")}</p>
    <div className="ui-toolbar">
      {branches.length > 1 && <label className="ui-inline-field"><span className="ui-field-label">{t("reconcile.branch")}</span><select className="form-select" value={branch || ""} onChange={e => setBranch(e.target.value)}>
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>}
      <label className="ui-inline-field"><span className="ui-field-label">{t("reconcile.period")}</span><select className="form-select" value={days} onChange={e => setDays(Number(e.target.value))}>
        {[30, 90, 180].map(v => <option key={v} value={v}>{t(`reconcile.days${v}`)}</option>)}
      </select></label>
      <Segmented label={t("reconcile.view")} value={all ? "all" : "review"} onChange={v => setAll(v === "all")}
        options={[{ value: "review", label: t("reconcile.needsReview") }, { value: "all", label: t("reconcile.all") }]} />
    </div>
    {error ? <ErrorState message={error.startsWith("Manager") ? t("common.managersOnly") : t("reconcile.failed")} onRetry={() => setRetry(x => x + 1)} retryLabel={t("business.retry")} />
      : loading ? <div role="status" aria-label={t("common.loading")}><CardSkeleton rows={3} /></div>
      : shown.length === 0 ? <EmptyState title={t(all ? "reconcile.emptyAll" : "reconcile.empty")} />
      : <div className="table-scroll" tabIndex={0} role="region" aria-label={t("reconcile.title")}><table className="data-table">
        <thead><tr>{["product", "interval", "used", "status", "review"].map(k =>
          <th scope="col" key={k} className={["opening", "delivered", "transfers", "waste", "closing", "used"].includes(k) ? "numeric" : undefined}>{t(`reconcile.${k}`)}</th>)}</tr></thead>
        <tbody>{shown.map(r => {
          const key = `${r.fromId}|${r.toId}`, changed = changedSince(r);
          return <tr key={key}>
            <td><strong>{r.product}</strong><div className="page-sub">{r.category}{r.unit ? ` · ${r.unit}` : ""}</div></td>
            <td>{d(r.from)} → {d(r.to)}</td>
            <td className="numeric"><strong>{n(r.used)}</strong></td>
            <td><span className={`status-badge ${{ gain: "low", unusual: "warn", ok: "good", uncertain: "" }[r.status]}`}>{t(`reconcile.${r.status}`)}</span>
              </td>
            <td>
              {r.review&&<span className="muted">{t(changed?"reconcile.changed":"reconcile.reviewedOn")}</span>}
              <button className="btn-secondary" onClick={()=>{setOpen(key);setNote("");}}>{t("inventoryOps.openDetails")}</button>
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
    {detail&&<NativeDialog title={`${t("reconcile.title")}: ${detail.product}`} busy={saving} onClose={()=>setOpen(null)}>
      <h2>{detail.product} · {detail.unit||"—"}</h2><p>{d(detail.from)} → {d(detail.to)}</p><p>{t("reconcile.note")}</p>
      <dl className="inventory-detail-grid">{(["opening","delivered","received","sent","wasted","closing","expected","used"] as const).map(key=><div key={key}><dt>{t(key==="received"||key==="sent"?`inventoryOps.${key}`:key==="expected"?"inventoryOps.expectedBalance":`reconcile.${key==="wasted"?"waste":key}`)}</dt><dd>{n(detail[key])} {detail.unit}</dd></div>)}</dl>
      {detail.reasons.length>0&&<ul>{detail.reasons.map(reason=><li key={reason}>{t(`reconcile.${reason}`)}</li>)}</ul>}
      <Link className="btn-secondary" href={`/inventory?view=history&historyProduct=${encodeURIComponent(detail.product)}`}>{t("inventoryOps.inspectMovements")}</Link>
      <details><summary>{t("inventoryOps.evidence")}</summary><p>{detail.fromId} → {detail.toId}</p></details>
      {detail.review&&<p>{t("reconcile.reviewedOn")} {new Date(detail.review.created_at).toLocaleString(loc,{timeZone:"Europe/Berlin"})}: {detail.review.note}{changedSince(detail)&&` · ${t("reconcile.changed")}`}</p>}
      {FLAGGED.includes(detail.status)&&(!detail.review||changedSince(detail))&&<><textarea aria-label={t("reconcile.noteLabel")} className="form-input" maxLength={500} rows={3} value={note} placeholder={t("reconcile.notePlaceholder")} onChange={e=>setNote(e.target.value)}/><button className="btn-gold" disabled={saving||note.trim().length<3} onClick={()=>save(detail)}>{t("reconcile.save")}</button></>}
      <button className="btn-secondary" disabled={saving} onClick={()=>setOpen(null)}>{t("common.close")}</button>
    </NativeDialog>}
  </section>;
}
