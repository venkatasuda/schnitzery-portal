"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getMyUpcomingShifts, requestCover, getOpenCovers, claimCover,
  cancelCover, getMyCovers, getManagerCovers, decideCover,
} from "@/lib/queries/cover";

const fmtDate = (wd: string) => {
  try { return new Date(wd + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
  catch { return wd; }
};

export default function CoverPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"my" | "open" | "review">("my");
  const [loading, setLoading] = useState(true);
  const [isMgr, setIsMgr] = useState(false);

  const [shifts, setShifts] = useState<any[]>([]);
  const [openCovers, setOpenCovers] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [claimedByMe, setClaimedByMe] = useState<any[]>([]);
  const [mgrCovers, setMgrCovers] = useState<any[]>([]);

  const [reqFor, setReqFor] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    const [s, o, m, mg] = await Promise.all([getMyUpcomingShifts(), getOpenCovers(), getMyCovers(), getManagerCovers()]);
    if (s.ok) setShifts(s.shifts || []);
    if (o.ok) setOpenCovers(o.covers || []);
    if (m.ok) { setMine(m.mine || []); setClaimedByMe(m.claimed || []); }
    if (mg.ok) { setIsMgr(true); setMgrCovers(mg.covers || []); } else setIsMgr(false);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function doRequest() {
    if (!reqFor) return;
    setBusy("req");
    const r = await requestCover(reqFor.work_date, reqFor.day, reqFor.team, reqFor.shift, reason);
    setBusy(null);
    if (r.ok) { toast(t("cover.requested"), "success"); setReqFor(null); setReason(""); loadAll(); }
    else toast(r.error || t("cover.failed"), "error");
  }
  async function doClaim(id: string) {
    setBusy(id);
    const r = await claimCover(id); setBusy(null);
    if (r.ok) { toast(t("cover.claimed"), "success"); loadAll(); }
    else toast(r.error || t("cover.failed"), "error");
  }
  async function doCancel(id: string) {
    if (!confirm(t("cover.confirmCancel"))) return;
    setBusy(id);
    const r = await cancelCover(id); setBusy(null);
    if (r.ok) { toast(t("cover.cancelled"), "success"); loadAll(); }
    else toast(r.error || t("cover.failed"), "error");
  }
  async function doDecide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    const r = await decideCover(id, decision); setBusy(null);
    if (r.ok) {
      if (decision === "approved") toast(r.reassigned ? t("cover.approvedReassigned") : t("cover.approvedNoEntry"), "success");
      else toast(t("cover.rejected"), "success");
      loadAll();
    } else toast(r.error || t("cover.failed"), "error");
  }

  const statusColor = (s: string) => s === "approved" ? "var(--success)" : s === "rejected" || s === "cancelled" ? "var(--gray)" : s === "claimed" ? "#d4a847" : "#5dade2";

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🔁" size={22} /> {t("cover.title")}</h1>
      <div className="page-sub">{t("cover.subtitle")}</div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "my" ? " active" : ""}`} onClick={() => setTab("my")}>{t("cover.tabMy")}</button>
        <button className={`hub-tab${tab === "open" ? " active" : ""}`} onClick={() => setTab("open")}>{t("cover.tabOpen")}{openCovers.length ? ` (${openCovers.length})` : ""}</button>
        {isMgr && <button className={`hub-tab${tab === "review" ? " active" : ""}`} onClick={() => setTab("review")}>{t("cover.tabReview")}{mgrCovers.filter((c) => c.status === "claimed").length ? ` (${mgrCovers.filter((c) => c.status === "claimed").length})` : ""}</button>}
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {/* MY SHIFTS + MY REQUESTS */}
          {tab === "my" && (
            <div>
              <div className="card-title u-mb-2">{t("cover.myShifts")}</div>
              {shifts.length === 0 ? (
                <div className="card ui-empty-msg">{t("cover.noShifts")}</div>
              ) : shifts.map((s, i) => (
                <div key={i} className="card ui-item-card">
                  <div className="ui-item-head">
                    <div>
                      <div className="ui-strong">{fmtDate(s.work_date)} · {s.shift}</div>
                      <div className="ui-muted">{s.team}{s.time ? ` · ${s.time}` : ""}</div>
                    </div>
                    {s.requestStatus ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(s.requestStatus) }}>{t("cover.st_" + s.requestStatus)}</span>
                    ) : (
                      <button className="btn-secondary" onClick={() => { setReqFor(s); setReason(""); }}>{t("cover.requestCover")}</button>
                    )}
                  </div>
                  {reqFor && reqFor.work_date === s.work_date && reqFor.team === s.team && reqFor.shift === s.shift && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <textarea className="form-input" aria-label={t("cover.reasonPh")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("cover.reasonPh")} rows={2}
                        />
                      <div className="ui-row-actions">
                        <button className="btn-gold" onClick={doRequest} disabled={busy === "req"}>{busy === "req" ? "…" : t("cover.postRequest")}</button>
                        <button className="btn-secondary" onClick={() => setReqFor(null)}>{t("cover.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {mine.filter((r) => r.status !== "cancelled").length > 0 && (
                <>
                  <div className="card-title ui-section-title u-m0top">{t("cover.myRequests")}</div>
                  {mine.filter((r) => r.status !== "cancelled").map((r) => (
                    <div key={r.id} className="card ui-item-card ui-item-head">
                      <div>
                        <div className="ui-body">{fmtDate(r.work_date)} · {r.shift} <span className="ui-muted">({r.team})</span></div>
                        <div style={{ fontSize: 12, color: statusColor(r.status) }}>
                          {t("cover.st_" + r.status)}{r.claimer?.full_name && r.status !== "rejected" ? ` · ${r.claimer.full_name}` : ""}
                        </div>
                      </div>
                      {(r.status === "open" || r.status === "claimed") && (
                        <button className="ui-link-btn" onClick={() => doCancel(r.id)} disabled={busy === r.id}>{t("cover.cancel")}</button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* OPEN REQUESTS TO CLAIM */}
          {tab === "open" && (
            <div>
              {openCovers.length === 0 ? (
                <div className="card ui-empty-msg">{t("cover.noOpen")}</div>
              ) : openCovers.map((c) => (
                <div key={c.id} className="card ui-item-card">
                  <div className="ui-item-head">
                    <div>
                      <div className="ui-strong">{fmtDate(c.work_date)} · {c.shift}</div>
                      <div className="ui-muted">{c.team} · {c.requester?.full_name || "—"}</div>
                      {c.reason && <div className="ui-quote">“{c.reason}”</div>}
                    </div>
                    <button className="btn-gold" onClick={() => doClaim(c.id)} disabled={busy === c.id}>{busy === c.id ? "…" : t("cover.claim")}</button>
                  </div>
                </div>
              ))}

              {claimedByMe.filter((r) => r.status === "claimed" || r.status === "approved").length > 0 && (
                <>
                  <div className="card-title ui-section-title u-m0top">{t("cover.imCovering")}</div>
                  {claimedByMe.filter((r) => r.status === "claimed" || r.status === "approved").map((r) => (
                    <div key={r.id} className="card ui-item-card">
                      <div className="ui-body">{fmtDate(r.work_date)} · {r.shift} <span className="ui-muted">({r.team})</span></div>
                      <div style={{ fontSize: 12, color: statusColor(r.status) }}>{t("cover.st_" + r.status)} · {r.requester?.full_name}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* MANAGER REVIEW */}
          {tab === "review" && isMgr && (
            <div>
              {mgrCovers.length === 0 ? (
                <div className="card ui-empty-msg">{t("cover.noReview")}</div>
              ) : mgrCovers.map((c) => (
                <div key={c.id} className="card ui-item-card">
                  <div className="ui-strong">{fmtDate(c.work_date)} · {c.shift} <span className="ui-muted">({c.team})</span></div>
                  <div className="ui-meta">
                    {c.requester?.full_name} → {c.claimer?.full_name || <span style={{ color: "var(--info)" }}>{t("cover.awaitingClaim")}</span>}
                  </div>
                  {c.reason && <div className="ui-quote">“{c.reason}”</div>}
                  {c.status === "claimed" ? (
                    <div className="ui-row-actions">
                      <button className="btn-gold" onClick={() => doDecide(c.id, "approved")} disabled={busy === c.id}>{busy === c.id ? "…" : t("cover.approve")}</button>
                      <button className="btn-quiet-danger" onClick={() => doDecide(c.id, "rejected")} disabled={busy === c.id}>{t("cover.reject")}</button>
                    </div>
                  ) : (
                    <div className="ui-note tone-info">{t("cover.waitingForClaim")}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}