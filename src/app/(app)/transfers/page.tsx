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
import { Badge, Field, PageHeader, Panel, TabButton } from "@/components/ui";

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

  const stTone = (s: string) => (s === "received" ? "success" : s === "sent" ? "warn" : s === "rejected" || s === "cancelled" ? "danger" : "default") as "success" | "warn" | "danger" | "default";
  const filtered = products.filter((p) => p.product.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const pending = queue.filter((q) => q.status === "requested").length;

  if (!isMgr) {
    return <div className="card ui-denied">{t("xfer.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <PageHeader icon={<Icon e="🔄" size={22} />} title={t("xfer.title")} subtitle={t("xfer.subtitle")} />

      <div className="hub-tabs" role="group" aria-label={t("xfer.title")}>
        <TabButton active={tab === "request"} onClick={() => setTab("request")}>{t("xfer.tabRequest")}</TabButton>
        <TabButton active={tab === "fulfill"} onClick={() => setTab("fulfill")}>{t("xfer.tabFulfill")}{pending ? ` (${pending})` : ""}</TabButton>
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {tab === "request" && (
            <div>
              {!showForm ? (
                <button type="button" className="btn-secondary ui-block u-mb-4" onClick={() => setShowForm(true)}>+ {t("xfer.newRequest")}</button>
              ) : (
                <Panel title={t("xfer.newRequest")} actions={<button className="ui-icon-btn" type="button" aria-label={t("common.close")} onClick={resetForm}>✕</button>}>
                  <Field label={t("xfer.fromBranch")}>
                  <select className="form-select" value={src} onChange={(e) => setSrc(e.target.value)}>
                    <option value="">{t("xfer.selectBranch")}</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  </Field>
                  {!sel ? (
                    <>
                      <input className="form-input u-mb-2" aria-label={t("xfer.searchProduct")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("xfer.searchProduct")} />
                      {search && (filtered.length === 0 ? <div className="ui-muted">{t("xfer.noProduct")}</div> : filtered.map((p) => (
                        <button className="ui-pick" key={p.product} onClick={() => { setSel(p); setSearch(""); }}>
                          {p.product} <span className="ui-muted">({p.category})</span>
                        </button>
                      )))}
                    </>
                  ) : (
                    <>
                      <div className="u-between u-mb-3">
                        <span className="ui-strong">{sel.product}</span>
                        <button className="ui-link-btn" onClick={() => setSel(null)}>{t("xfer.change")}</button>
                      </div>
                      <div className="u-row u-mb-3">
                        <input aria-label={t("po.qty")} type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="form-input ui-qty-input" />
                        <span className="ui-muted-md">{sel.unit || ""}</span>
                      </div>
                      <input className="form-input u-mb-3" aria-label={t("xfer.notePh")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("xfer.notePh")} />
                      <button className="btn-gold ui-block" onClick={submit} disabled={busy === "req"}>{busy === "req" ? "…" : t("xfer.sendRequest")}</button>
                    </>
                  )}
                </Panel>
              )}

              <h2 className="ui-section-title">{t("xfer.myRequests")}</h2>
              {requests.length === 0 ? (
                <div className="card ui-empty-msg">{t("xfer.noRequests")}</div>
              ) : requests.map((r) => (
                <div key={r.id} className="card ui-item-card">
                  <div className="ui-item-head">
                    <div>
                      <div className="ui-strong">{r.product} <span className="ui-muted">· {r.qty}{r.unit ? " " + r.unit : ""}</span></div>
                      <div className="ui-muted">{t("xfer.from")} {r.from_branch_name || "—"} · {fmtWhen(r.created_at)}</div>
                    </div>
                    <Badge tone={stTone(r.status)}>{t("xfer.st_" + r.status)}</Badge>
                  </div>
                  {(r.status === "requested" || r.status === "sent") && (
                    <div className="ui-row-actions">
                      {r.status === "sent" && <button type="button" className="btn-gold" onClick={() => act(receiveTransfer, r.id, "xfer.received")} disabled={busy === r.id}>{t("xfer.confirmReceived")}</button>}
                      {r.status === "requested" && <button type="button" className="btn-quiet-danger" onClick={() => act(cancelTransfer, r.id, "xfer.cancelled")} disabled={busy === r.id}>{t("xfer.cancel")}</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "fulfill" && (
            <div>
              {queue.length === 0 ? (
                <div className="card ui-empty-msg">{t("xfer.noQueue")}</div>
              ) : queue.map((r) => (
                <div key={r.id} className="card ui-item-card">
                  <div className="ui-item-head">
                    <div>
                      <div className="ui-strong">{r.product} <span className="ui-muted">· {r.qty}{r.unit ? " " + r.unit : ""}</span></div>
                      <div className="ui-muted">{t("xfer.for")} {r.to_branch_name || "—"}{r.requested_by_name ? ` · ${r.requested_by_name}` : ""}</div>
                      {r.note && <div className="ui-quote">“{r.note}”</div>}
                    </div>
                    <Badge tone={stTone(r.status)}>{t("xfer.st_" + r.status)}</Badge>
                  </div>
                  {r.status === "requested" && (
                    <div className="ui-row-actions">
                      <button type="button" className="btn-gold" onClick={() => act(sendTransfer, r.id, "xfer.sent")} disabled={busy === r.id}>{t("xfer.markSent")}</button>
                      <button type="button" className="btn-quiet-danger" onClick={() => act(rejectTransfer, r.id, "xfer.rejected")} disabled={busy === r.id}>{t("xfer.reject")}</button>
                    </div>
                  )}
                  {r.status === "sent" && <div className="ui-note tone-warn">{t("xfer.awaitingReceipt")}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}