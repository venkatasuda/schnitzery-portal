"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
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
    setLoading(true); setError(null);
    getReconciliation(days, branch).then(r => { if (!active) return; if (r.ok) setRows(r.rows); else setError(r.error); })
      .catch(() => { if (active) setError("failed"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, retry, branch]);

  const n = (v: number) => Number.isFinite(v) ? v.toLocaleString(loc, { maximumFractionDigits: 2 }) : "—";
  const d = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(loc, { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const needs = (r: Row) => FLAGGED.includes(r.status) && (!r.review || changedSince(r));
  const shown = all ? rows : rows.filter(needs);

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
    <h2>{t("reconcile.title")}</h2>
    <p className="page-sub">{t("reconcile.note")}</p>
    <div className="inventory-toolbar">
      {branches.length > 1 && <label>{t("reconcile.branch")}<select className="form-select" value={branch || ""} onChange={e => setBranch(e.target.value)}>
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>}
      <label>{t("reconcile.period")}<select className="form-select" value={days} onChange={e => setDays(Number(e.target.value))}>
        {[30, 90, 180].map(v => <option key={v} value={v}>{t(`reconcile.days${v}`)}</option>)}
      </select></label>
      <div role="group" aria-label={t("reconcile.view")}>
        <button className={all ? "btn-secondary" : "btn-gold"} aria-pressed={!all} onClick={() => setAll(false)}>{t("reconcile.needsReview")}</button>
        <button className={all ? "btn-gold" : "btn-secondary"} aria-pressed={all} onClick={() => setAll(true)}>{t("reconcile.all")}</button>
      </div>
    </div>
    {error ? <div role="alert"><p>{error.startsWith("Manager") ? t("common.managersOnly") : t("reconcile.failed")}</p><button className="btn-secondary" onClick={() => setRetry(x => x + 1)}>{t("business.retry")}</button></div>
      : loading ? <p role="status">{t("common.loading")}</p>
      : shown.length === 0 ? <p>{t(all ? "reconcile.emptyAll" : "reconcile.empty")}</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-label={t("reconcile.title")}><table className="data-table">
        <thead><tr>{["product", "interval", "opening", "delivered", "transfers", "waste", "closing", "used", "status", "review"].map(k =>
          <th scope="col" key={k} className={["opening", "delivered", "transfers", "waste", "closing", "used"].includes(k) ? "numeric" : undefined}>{t(`reconcile.${k}`)}</th>)}</tr></thead>
        <tbody>{shown.map(r => {
          const key = `${r.fromId}|${r.toId}`, changed = changedSince(r);
          return <tr key={key}>
            <td><strong>{r.product}</strong><div className="page-sub">{r.category}{r.unit ? ` · ${r.unit}` : ""}</div></td>
            <td>{d(r.from)} → {d(r.to)}</td>
            <td className="numeric">{n(r.opening)}</td>
            <td className="numeric">+{n(r.delivered)}</td>
            <td className="numeric">+{n(r.received)} / −{n(r.sent)}</td>
            <td className="numeric">−{n(r.wasted)}</td>
            <td className="numeric">{n(r.closing)}</td>
            <td className="numeric"><strong>{n(r.used)}</strong></td>
            <td><span className={`status-badge ${{ gain: "low", unusual: "warn", ok: "good", uncertain: "" }[r.status]}`}>{t(`reconcile.${r.status}`)}</span>
              {r.reasons.length > 0 && <ul className="page-sub">{r.reasons.map(x => <li key={x}>{t(`reconcile.${x}`)}</li>)}</ul>}</td>
            <td>
              {r.review && <p><strong>{t("reconcile.reviewedOn")} {new Date(r.review.created_at).toLocaleDateString(loc, { timeZone: "Europe/Berlin" })}:</strong> {r.review.note}
                {changed && <span role="note" className="page-sub"> · {t("reconcile.changed")}</span>}</p>}
              {FLAGGED.includes(r.status) && (!r.review || changed) && (open === key
                ? <div>
                    <textarea aria-label={`${t("reconcile.noteLabel")}: ${r.product}`} className="form-input" autoFocus maxLength={500} rows={2} value={note} placeholder={t("reconcile.notePlaceholder")} onChange={e => setNote(e.target.value)} />
                    <div className="row-actions"><button className="btn-gold" disabled={saving || note.trim().length < 3} onClick={() => save(r)}>{t("reconcile.save")}</button>
                    <button className="btn-secondary" onClick={() => { setOpen(null); setNote(""); }}>{t("common.cancel")}</button></div></div>
                : <button className="btn-secondary" onClick={() => { setOpen(key); setNote(""); }}>{t("reconcile.markReviewed")}</button>)}
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
  </section>;
}
