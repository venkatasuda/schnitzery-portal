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

  const statusColor = (s: string) => s === "approved" ? "#58d68d" : s === "rejected" || s === "cancelled" ? "#9a8f8f" : s === "claimed" ? "#d4a847" : "#5dade2";

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🔁" size={22} /> {t("cover.title")}</div>
      <div className="page-sub">{t("cover.subtitle")}</div>

      <div className="hub-tabs" style={{ marginTop: 12 }}>
        <button className={`hub-tab${tab === "my" ? " active" : ""}`} onClick={() => setTab("my")}>{t("cover.tabMy")}</button>
        <button className={`hub-tab${tab === "open" ? " active" : ""}`} onClick={() => setTab("open")}>{t("cover.tabOpen")}{openCovers.length ? ` (${openCovers.length})` : ""}</button>
        {isMgr && <button className={`hub-tab${tab === "review" ? " active" : ""}`} onClick={() => setTab("review")}>{t("cover.tabReview")}{mgrCovers.filter((c) => c.status === "claimed").length ? ` (${mgrCovers.filter((c) => c.status === "claimed").length})` : ""}</button>}
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {/* MY SHIFTS + MY REQUESTS */}
          {tab === "my" && (
            <div>
              <div className="card-title" style={{ marginBottom: 8 }}>{t("cover.myShifts")}</div>
              {shifts.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("cover.noShifts")}</div>
              ) : shifts.map((s, i) => (
                <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{fmtDate(s.work_date)} · {s.shift}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>{s.team}{s.time ? ` · ${s.time}` : ""}</div>
                    </div>
                    {s.requestStatus ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(s.requestStatus) }}>{t("cover.st_" + s.requestStatus)}</span>
                    ) : (
                      <button onClick={() => { setReqFor(s); setReason(""); }} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(212,168,71,0.12)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", flex: "0 0 auto" }}>{t("cover.requestCover")}</button>
                    )}
                  </div>
                  {reqFor && reqFor.work_date === s.work_date && reqFor.team === s.team && reqFor.shift === s.shift && (
                    <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("cover.reasonPh")} rows={2}
                        style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={doRequest} disabled={busy === "req"} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "var(--gold)", color: "#1a1a1a", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy === "req" ? "…" : t("cover.postRequest")}</button>
                        <button onClick={() => setReqFor(null)} style={{ padding: "9px 14px", borderRadius: 8, background: "transparent", color: "var(--gray)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, cursor: "pointer" }}>{t("cover.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {mine.filter((r) => r.status !== "cancelled").length > 0 && (
                <>
                  <div className="card-title" style={{ margin: "18px 0 8px" }}>{t("cover.myRequests")}</div>
                  {mine.filter((r) => r.status !== "cancelled").map((r) => (
                    <div key={r.id} className="card" style={{ marginBottom: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--white)" }}>{fmtDate(r.work_date)} · {r.shift} <span style={{ color: "var(--gray)", fontSize: 11 }}>({r.team})</span></div>
                        <div style={{ fontSize: 11, color: statusColor(r.status) }}>
                          {t("cover.st_" + r.status)}{r.claimer?.full_name && r.status !== "rejected" ? ` · ${r.claimer.full_name}` : ""}
                        </div>
                      </div>
                      {(r.status === "open" || r.status === "claimed") && (
                        <button onClick={() => doCancel(r.id)} disabled={busy === r.id} style={{ fontSize: 12, color: "#ec7063", background: "none", border: "none", cursor: "pointer" }}>{t("cover.cancel")}</button>
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
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("cover.noOpen")}</div>
              ) : openCovers.map((c) => (
                <div key={c.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{fmtDate(c.work_date)} · {c.shift}</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>{c.team} · {c.requester?.full_name || "—"}</div>
                      {c.reason && <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 4, fontStyle: "italic" }}>“{c.reason}”</div>}
                    </div>
                    <button onClick={() => doClaim(c.id)} disabled={busy === c.id} style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(39,174,96,0.15)", color: "#58d68d", border: "1px solid rgba(39,174,96,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", flex: "0 0 auto" }}>{busy === c.id ? "…" : t("cover.claim")}</button>
                  </div>
                </div>
              ))}

              {claimedByMe.filter((r) => r.status === "claimed" || r.status === "approved").length > 0 && (
                <>
                  <div className="card-title" style={{ margin: "18px 0 8px" }}>{t("cover.imCovering")}</div>
                  {claimedByMe.filter((r) => r.status === "claimed" || r.status === "approved").map((r) => (
                    <div key={r.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
                      <div style={{ fontSize: 13, color: "var(--white)" }}>{fmtDate(r.work_date)} · {r.shift} <span style={{ color: "var(--gray)", fontSize: 11 }}>({r.team})</span></div>
                      <div style={{ fontSize: 11, color: statusColor(r.status) }}>{t("cover.st_" + r.status)} · {r.requester?.full_name}</div>
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
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("cover.noReview")}</div>
              ) : mgrCovers.map((c) => (
                <div key={c.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{fmtDate(c.work_date)} · {c.shift} <span style={{ color: "var(--gray)", fontSize: 12 }}>({c.team})</span></div>
                  <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 3 }}>
                    {c.requester?.full_name} → {c.claimer?.full_name || <span style={{ color: "#5dade2" }}>{t("cover.awaitingClaim")}</span>}
                  </div>
                  {c.reason && <div style={{ fontSize: 12, color: "#9a8f8f", marginTop: 4, fontStyle: "italic" }}>“{c.reason}”</div>}
                  {c.status === "claimed" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => doDecide(c.id, "approved")} disabled={busy === c.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(39,174,96,0.15)", color: "#58d68d", border: "1px solid rgba(39,174,96,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{busy === c.id ? "…" : t("cover.approve")}</button>
                      <button onClick={() => doDecide(c.id, "rejected")} disabled={busy === c.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "transparent", color: "#ec7063", border: "1px solid rgba(231,76,60,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("cover.reject")}</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#5dade2", marginTop: 8 }}>{t("cover.waitingForClaim")}</div>
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