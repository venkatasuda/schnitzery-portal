"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getTransferBranches, getTransferProducts, requestTransfer, getMyRequests, getFulfillQueue,
  sendTransfer, rejectTransfer, cancelTransfer, receiveTransfer,
} from "@/lib/queries/transfer";

const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch { return iso; } };

export default function TransfersPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"request" | "fulfill">("request");
  const [loading, setLoading] = useState(true);
  const [isMgr, setIsMgr] = useState(true);

  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [src, setSrc] = useState("");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    const [b, p, r, q] = await Promise.all([getTransferBranches(), getTransferProducts(), getMyRequests(), getFulfillQueue()]);
    if (b.ok) { setBranches(b.branches || []); setIsMgr(true); } else if (b.error?.includes("Managers")) setIsMgr(false);
    if (p.ok) setProducts(p.products || []);
    if (r.ok) setRequests(r.requests || []);
    if (q.ok) setQueue(q.requests || []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  function resetForm() { setShowForm(false); setSrc(""); setSel(null); setSearch(""); setQty("1"); setNote(""); }

  async function submit() {
    if (!src) { toast(t("xfer.pickBranch"), "error"); return; }
    if (!sel) { toast(t("xfer.pickProduct"), "error"); return; }
    if (!(Number(qty) > 0)) { toast(t("xfer.enterQty"), "error"); return; }
    setBusy("req");
    const r = await requestTransfer(src, sel.product, sel.category, Number(qty), sel.unit, note);
    setBusy(null);
    if (r.ok) { toast(t("xfer.requested"), "success"); resetForm(); loadAll(); } else toast(r.error || t("xfer.failed"), "error");
  }
  async function act(fn: (id: string) => Promise<any>, id: string, okMsg: string) {
    setBusy(id);
    const r = await fn(id); setBusy(null);
    if (r.ok) { toast(t(okMsg), "success"); loadAll(); } else toast(r.error || t("xfer.failed"), "error");
  }

  const stColor = (s: string) => s === "received" ? "#58d68d" : s === "sent" ? "#d4a847" : s === "requested" ? "#5dade2" : "#9a8f8f";
  const filtered = products.filter((p) => p.product.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const pending = queue.filter((q) => q.status === "requested").length;

  if (!isMgr) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("xfer.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🔄" size={22} /> {t("xfer.title")}</div>
      <div className="page-sub">{t("xfer.subtitle")}</div>

      <div className="hub-tabs" style={{ marginTop: 12 }}>
        <button className={`hub-tab${tab === "request" ? " active" : ""}`} onClick={() => setTab("request")}>{t("xfer.tabRequest")}</button>
        <button className={`hub-tab${tab === "fulfill" ? " active" : ""}`} onClick={() => setTab("fulfill")}>{t("xfer.tabFulfill")}{pending ? ` (${pending})` : ""}</button>
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {tab === "request" && (
            <div>
              {!showForm ? (
                <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: 12, margin: "6px 0 14px", borderRadius: 10, background: "rgba(212,168,71,0.12)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {t("xfer.newRequest")}</button>
              ) : (
                <div className="card" style={{ marginBottom: 14, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div className="card-title" style={{ margin: 0 }}>{t("xfer.newRequest")}</div>
                    <button onClick={resetForm} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: 18, cursor: "pointer" }}>✕</button>
                  </div>
                  <label style={{ fontSize: 12, color: "var(--gray)" }}>{t("xfer.fromBranch")}</label>
                  <select value={src} onChange={(e) => setSrc(e.target.value)} style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, margin: "4px 0 12px" }}>
                    <option value="">{t("xfer.selectBranch")}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {!sel ? (
                    <>
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("xfer.searchProduct")} style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, marginBottom: 8 }} />
                      {search && (filtered.length === 0 ? <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("xfer.noProduct")}</div> : filtered.map((p) => (
                        <button key={p.product} onClick={() => { setSel(p); setSearch(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "var(--white)", fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
                          {p.product} <span style={{ color: "var(--gray)", fontSize: 11 }}>({p.category})</span>
                        </button>
                      )))}
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{sel.product}</span>
                        <button onClick={() => setSel(null)} style={{ fontSize: 12, color: "var(--gray)", background: "none", border: "none", cursor: "pointer" }}>{t("xfer.change")}</button>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 84, padding: 11, textAlign: "center", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 15, fontWeight: 600 }} />
                        <span style={{ fontSize: 13, color: "var(--gray)" }}>{sel.unit || ""}</span>
                      </div>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("xfer.notePh")} style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, marginBottom: 12 }} />
                      <button onClick={submit} disabled={busy === "req"} style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--gold)", color: "#1a1a1a", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{busy === "req" ? "…" : t("xfer.sendRequest")}</button>
                    </>
                  )}
                </div>
              )}

              <div className="card-title" style={{ marginBottom: 8 }}>{t("xfer.myRequests")}</div>
              {requests.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("xfer.noRequests")}</div>
              ) : requests.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{r.product} <span style={{ color: "var(--gray)", fontSize: 12 }}>· {r.qty}{r.unit ? " " + r.unit : ""}</span></div>
                      <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("xfer.from")} {r.from_branch_name || "—"} · {fmtWhen(r.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stColor(r.status) }}>{t("xfer.st_" + r.status)}</span>
                  </div>
                  {(r.status === "requested" || r.status === "sent") && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {r.status === "sent" && <button onClick={() => act(receiveTransfer, r.id, "xfer.received")} disabled={busy === r.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(39,174,96,0.15)", color: "#58d68d", border: "1px solid rgba(39,174,96,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("xfer.confirmReceived")}</button>}
                      {r.status === "requested" && <button onClick={() => act(cancelTransfer, r.id, "xfer.cancelled")} disabled={busy === r.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "transparent", color: "#ec7063", border: "1px solid rgba(231,76,60,0.3)", fontSize: 13, cursor: "pointer" }}>{t("xfer.cancel")}</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "fulfill" && (
            <div>
              {queue.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("xfer.noQueue")}</div>
              ) : queue.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{r.product} <span style={{ color: "var(--gray)", fontSize: 12 }}>· {r.qty}{r.unit ? " " + r.unit : ""}</span></div>
                      <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("xfer.for")} {r.to_branch_name || "—"}{r.requested_by_name ? ` · ${r.requested_by_name}` : ""}</div>
                      {r.note && <div style={{ fontSize: 12, color: "#9a8f8f", fontStyle: "italic", marginTop: 3 }}>“{r.note}”</div>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stColor(r.status) }}>{t("xfer.st_" + r.status)}</span>
                  </div>
                  {r.status === "requested" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => act(sendTransfer, r.id, "xfer.sent")} disabled={busy === r.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(212,168,71,0.15)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("xfer.markSent")}</button>
                      <button onClick={() => act(rejectTransfer, r.id, "xfer.rejected")} disabled={busy === r.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "transparent", color: "#ec7063", border: "1px solid rgba(231,76,60,0.3)", fontSize: 13, cursor: "pointer" }}>{t("xfer.reject")}</button>
                    </div>
                  )}
                  {r.status === "sent" && <div style={{ fontSize: 11, color: "#d4a847", marginTop: 8 }}>{t("xfer.awaitingReceipt")}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}