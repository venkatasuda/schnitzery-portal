"use client";

import { PageHeader } from "@/components/ui";

import { appLocale } from "@/lib/format";
import { useState, useEffect, useRef } from "react";
import { getPendingApprovals, decideLeave, decideSwap, getSickNoteUrl } from "@/lib/queries/leave";
import { getAttendanceApprovals, setAttendanceApproval } from "@/lib/queries/live-attendance";
import { getCorrectionApprovals, decideCorrection } from "@/lib/queries/corrections";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

type Kind = "leave" | "swap" | "attendance" | "correction";
type Item = { kind: Kind; id: string; icon: string; name: string; detail: string; note?: boolean };
type Filter = "all" | Kind;

const fmtH = (m: number | null | undefined) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, "0")}m`;
const fmtD = (d?: string | null) => (d ? new Date(d).toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short" }) : "—");
const fmtT = (v?: string | null) => (v ? new Date(v).toLocaleTimeString(appLocale(), { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "—");

const CORR_KEY: Record<string, string> = { forgot_in: "typeForgotIn", forgot_out: "typeForgotOut", missing: "typeMissing", incorrect: "typeIncorrect" };

type Raw = [Awaited<ReturnType<typeof getPendingApprovals>>, Awaited<ReturnType<typeof getAttendanceApprovals>>, Awaited<ReturnType<typeof getCorrectionApprovals>>];

// The three lists arrive with the page (page.tsx reads them on the server, in parallel);
// this client part renders them and reloads after each decision.
export default function ApprovalsClient({ initial = null }: { initial?: Raw | null } = {}) {
  const { t, locale } = useLang();
  const dayLabel = (k: string | null | undefined) => (k && ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(k.toLowerCase()) ? t("days." + k.toLowerCase()) : (k || "?"));
  const corrLabel = (k: string) => t("corr." + (CORR_KEY[k] || "typeMissing"));
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load(pre?: Raw | null) {
    setLoading(true);
    setError(null);
    try {
    const [pa, att, corr] = pre ?? await Promise.all([getPendingApprovals(), getAttendanceApprovals(), getCorrectionApprovals()]);
    if (!pa.ok && pa.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }

    const failed = [pa, att, corr].find((result) => !result.ok);
    if (failed) { setError(failed.error || (locale === "de" ? "Anfragen konnten nicht geladen werden." : "Could not load requests.")); setLoading(false); return; }

    const out: Item[] = [];
    for (const l of (pa.ok && pa.leave) || []) {
      const lt = (l as any).leave_type ?? "vacation", de = locale === "de";
      const typeName = ({ vacation: t("approvals.timeOff"), sick: de ? "Krank" : "Sick leave", unpaid: de ? "Unbezahlt" : "Unpaid leave", special: de ? "Sonderurlaub" : "Special leave" } as Record<string, string>)[lt] ?? t("approvals.timeOff");
      out.push({ kind: "leave", id: l.id, icon: lt === "sick" ? "🤒" : "🌴", name: (l as any).users?.full_name || t("approvals.someone"), detail: `${typeName} · ${fmtD(l.from_date)} → ${fmtD(l.to_date)}${l.reason ? ` · ${l.reason}` : ""}`, note: !!(l as any).sick_note_url });
    }
    for (const s of (pa.ok && pa.swaps) || []) {
      const other = (s as any).other?.full_name;
      out.push({ kind: "swap", id: s.id, icon: "🔄", name: (s as any).requester?.full_name || t("approvals.someone"), detail: `${t("approvals.swap")} · ${dayLabel(s.my_day)} ↔ ${dayLabel(s.their_day)}${other ? ` ${t("approvals.with")} ${other}` : ""}` });
    }
    for (const r of (att.ok && att.rows) || []) {
      out.push({ kind: "attendance", id: r.id, icon: "🕐", name: r.name, detail: `${fmtD(r.work_date)} · ${fmtH(r.duration_mins)}${(r.late_mins || 0) > 0 ? ` · ${r.late_mins}${t("approvals.mLate")}` : ""}${r.autoClosed ? ` · ⚠ ${t("approvals.autoClosed")}` : r.suspect ? ` · ⚠ ${t("approvals.suspect")}` : r.overtime ? ` · ${t("approvals.overtime")}` : ""}${r.clockFlag?.kind === "early" ? ` · ⏰ ${t("approvals.early", { n: r.clockFlag.mins })}` : r.clockFlag?.kind === "unrostered" ? ` · ⏰ ${t("approvals.unrostered")}` : ""}` });
    }
    for (const c of (corr.ok && (corr as any).items) || []) {
      const req = `${fmtT(c.requested_clock_in)} → ${fmtT(c.requested_clock_out)}`;
      const orig = (c.origIn || c.origOut) ? ` (${t("corr.origWas")} ${fmtT(c.origIn)} → ${fmtT(c.origOut)})` : "";
      out.push({ kind: "correction", id: c.id, icon: "✏️", name: c.name, detail: `${corrLabel(c.type)} · ${fmtD(c.target_date)} · ${req}${orig} · ${c.reason}` });
    }
    setItems(out);
    } catch { setError(locale === "de" ? "Anfragen konnten nicht geladen werden." : "Could not load requests."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rejectItem) rejectDialog.current?.showModal(); }, [rejectItem]);

  function remove(item: Item) {
    setItems((cur) => cur.filter((x) => !(x.kind === item.kind && x.id === item.id)));
  }

  async function decide(item: Item, approve: boolean) {
    // corrections reject opens a reason modal first
    if (item.kind === "correction" && !approve) { setRejectItem(item); setRejectReason(""); return; }
    setBusyId(item.kind + item.id);
    let res: { ok: boolean; error?: string };
    if (item.kind === "leave") res = await decideLeave(item.id, approve ? "approved" : "denied");
    else if (item.kind === "swap") res = await decideSwap(item.id, approve ? "approved" : "denied");
    else if (item.kind === "correction") res = await decideCorrection(item.id, true);
    else res = await setAttendanceApproval(item.id, approve ? "approved" : "rejected");
    setBusyId(null);
    if (res.ok) { remove(item); toast(approve ? t("approvals.approved") : t("approvals.rejected"), "success"); }
    else toast(res.error || t("approvals.actionFailed"), "error");
  }

  async function confirmReject() {
    if (!rejectItem) return;
    const item = rejectItem;
    setBusyId(item.kind + item.id);
    const res = await decideCorrection(item.id, false, rejectReason.trim() || undefined);
    setBusyId(null);
    setRejectItem(null);
    if (res.ok) { remove(item); toast(t("approvals.rejected"), "success"); }
    else toast(res.error || t("approvals.actionFailed"), "error");
  }

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const shown = items.filter((i) => filter === "all" || i.kind === filter);
  const count = (k: Kind) => items.filter((i) => i.kind === k).length;

  return (
    <div className="fade-up">
      <PageHeader title={ <><Icon e="✅" size={22} /> {t("approvals.title")}</> } />

      <div className="hub-tabs" role="group" aria-label={t("approvals.title")}>
        <button aria-pressed={filter === "all"} className={`hub-tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>{t("approvals.tabAll")} {items.length > 0 ? `· ${items.length}` : ""}</button>
        <button aria-pressed={filter === "leave"} className={`hub-tab${filter === "leave" ? " active" : ""}`} onClick={() => setFilter("leave")}><Icon className="u-icon-inline" e="🌴" size={13} /> {t("approvals.tabLeave")} {count("leave") || ""}</button>
        <button aria-pressed={filter === "swap"} className={`hub-tab${filter === "swap" ? " active" : ""}`} onClick={() => setFilter("swap")}><Icon className="u-icon-inline" e="🔄" size={13} /> {t("approvals.tabSwaps")} {count("swap") || ""}</button>
        <button aria-pressed={filter === "attendance"} className={`hub-tab${filter === "attendance" ? " active" : ""}`} onClick={() => setFilter("attendance")}><Icon className="u-icon-inline" e="🕐" size={13} /> {t("approvals.tabTime")} {count("attendance") || ""}</button>
        <button aria-pressed={filter === "correction"} className={`hub-tab${filter === "correction" ? " active" : ""}`} onClick={() => setFilter("correction")}><Icon className="u-icon-inline" e="✏️" size={13} /> {t("corr.inbox")} {count("correction") || ""}</button>
      </div>

      {error ? (
        <div className="workspace-error" role="alert"><p>{error}</p><button className="workspace-button" onClick={() => load()}>{t("analytics.retry")}</button></div>
      ) : loading ? (
        <CardSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 34 }}>
          <div className="u-mb-2"><Icon e="🎉" size={32} color="var(--success)" /></div>
          <div className="tone-success t-lg fw-7">{t("approvals.nothing")}</div>
          <div className="u-muted t-xs mt-2">{t("approvals.caughtUp")}</div>
        </div>
      ) : (
        <div className="approval-list">
          {shown.map((item) => {
            const busy = busyId === item.kind + item.id;
            return (
              <div key={item.kind + item.id} className="approval-row">
                <Icon e={item.icon} size={20} />
                <div className="approval-detail"><strong>{item.name}</strong><p>{item.detail}</p>
                  {item.note && <button type="button" className="ui-link-btn" onClick={async () => { const r = await getSickNoteUrl(item.id); if (r.ok && r.url) window.open(r.url, "_blank", "noopener"); else setError(r.error ?? "—"); }}>{locale === "de" ? "Krankmeldung ansehen" : "View sick note"}</button>}</div>
                <div className="approval-actions">
                  <button className="workspace-button primary" onClick={() => decide(item, true)} disabled={!!busyId} aria-label={`${t("ahub.approve")} ${item.name}`}>{busy ? "…" : t("ahub.approve")}</button>
                  <button className="workspace-button danger" onClick={() => decide(item, false)} disabled={!!busyId} aria-label={`${t("ahub.reject")} ${item.name}`}>{t("ahub.reject")}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Reject-with-reason modal (corrections) */}
      {rejectItem && (
        <dialog ref={rejectDialog} className="workspace-dialog" aria-labelledby="reject-title" onCancel={() => setRejectItem(null)} onClose={() => setRejectItem(null)}>
          <h2 id="reject-title">{t("corr.rejectTitle")}</h2>
          <p>{rejectItem.name} · {rejectItem.detail}</p>
          <textarea autoFocus aria-label={t("corr.rejectPlaceholder")} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder={t("corr.rejectPlaceholder")} />
          <div className="approval-actions">
            <button className="workspace-button" disabled={!!busyId} onClick={() => setRejectItem(null)}>{t("corr.dismiss")}</button>
            <button className="workspace-button danger" disabled={!!busyId} onClick={confirmReject}>{t("corr.confirmReject")}</button>
          </div>
        </dialog>
      )}
    </div>
  );
}