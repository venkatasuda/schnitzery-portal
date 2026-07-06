"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getBatchProducts, addBatch, getBatches, getExpirySummary, markBatchUsed, discardBatch } from "@/lib/queries/expiry";

const fmtDate = (d: string) => { try { return new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

export default function ExpiryPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    const [p, b, s] = await Promise.all([getBatchProducts(), getBatches(), getExpirySummary()]);
    if (p.ok) setProducts(p.products || []);
    if (b.ok) setBatches(b.batches || []);
    if (s.ok) setSummary(s);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  function resetForm() { setSel(null); setSearch(""); setQty("1"); setExpiry(""); setNote(""); setAdding(false); }

  async function submit() {
    if (!sel) { toast(t("expiry.pickProduct"), "error"); return; }
    if (!(Number(qty) > 0)) { toast(t("expiry.enterQty"), "error"); return; }
    if (!expiry) { toast(t("expiry.pickDate"), "error"); return; }
    setBusy("add");
    const r = await addBatch(sel.product, sel.category, Number(qty), sel.unit, expiry, note);
    setBusy(null);
    if (r.ok) { toast(t("expiry.added"), "success"); resetForm(); loadAll(); }
    else toast(r.error || t("expiry.failed"), "error");
  }
  async function used(id: string) {
    setBusy(id);
    const r = await markBatchUsed(id); setBusy(null);
    if (r.ok) { toast(t("expiry.markedUsed"), "success"); loadAll(); } else toast(r.error || t("expiry.failed"), "error");
  }
  async function discard(id: string) {
    if (!confirm(t("expiry.confirmDiscard"))) return;
    setBusy(id);
    const r = await discardBatch(id); setBusy(null);
    if (r.ok) { toast(t("expiry.discarded"), "success"); loadAll(); } else toast(r.error || t("expiry.failed"), "error");
  }

  const filtered = products.filter((p) => p.product.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const badge = (b: any) => {
    if (b.flag === "expired") return { c: "***REMOVED***ec7063", label: b.daysToExpiry === 0 ? t("expiry.today") : t("expiry.expiredAgo", { n: Math.abs(b.daysToExpiry) }) };
    if (b.flag === "soon") return { c: "***REMOVED***d4a847", label: b.daysToExpiry === 0 ? t("expiry.today") : t("expiry.inDays", { n: b.daysToExpiry }) };
    return { c: "***REMOVED***58d68d", label: t("expiry.inDays", { n: b.daysToExpiry }) };
  };

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📅" size={22} /> {t("expiry.title")}</div>
      <div className="page-sub">{t("expiry.subtitle")}</div>

      {summary && (summary.expired > 0 || summary.soon > 0) && (
        <div className="card" style={{ margin: "12px 0", padding: 14, borderColor: summary.expired > 0 ? "rgba(231,76,60,0.4)" : "rgba(212,168,71,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: summary.expired > 0 ? "***REMOVED***ec7063" : "***REMOVED***d4a847" }}>
            {summary.expired > 0 ? t("expiry.expiredCount", { n: summary.expired }) : t("expiry.soonCount", { n: summary.soon })}
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 2 }}>{t("expiry.useFirst")}</div>
        </div>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ width: "100%", padding: 12, margin: "6px 0 14px", borderRadius: 10, background: "rgba(212,168,71,0.12)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {t("expiry.addBatch")}</button>
      ) : (
        <div className="card" style={{ marginBottom: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>{t("expiry.addBatch")}</div>
            <button onClick={resetForm} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>
          {!sel ? (
            <>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("expiry.searchProduct")}
                style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, marginBottom: 8 }} />
              {search && (filtered.length === 0 ? <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("expiry.noProduct")}</div> : filtered.map((p) => (
                <button key={p.product} onClick={() => { setSel(p); setSearch(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "var(--white)", fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
                  {p.product} <span style={{ color: "var(--gray)", fontSize: 11 }}>({p.category})</span>
                </button>
              )))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>{sel.product}</div>
                <button onClick={() => setSel(null)} style={{ fontSize: 12, color: "var(--gray)", background: "none", border: "none", cursor: "pointer" }}>{t("expiry.change")}</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 84, padding: 11, textAlign: "center", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 15, fontWeight: 600 }} />
                <span style={{ fontSize: 13, color: "var(--gray)" }}>{sel.unit || ""}</span>
              </div>
              <label style={{ fontSize: 12, color: "var(--gray)", display: "block", marginBottom: 4 }}>{t("expiry.expiryDate")}</label>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, marginBottom: 10 }} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("expiry.notePh")}
                style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, marginBottom: 12 }} />
              <button onClick={submit} disabled={busy === "add"} style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--gold)", color: "***REMOVED***1a1a1a", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{busy === "add" ? "…" : t("expiry.addBatch")}</button>
            </>
          )}
        </div>
      )}

      <div className="card-title" style={{ marginBottom: 8 }}>{t("expiry.batches")}</div>
      {loading ? <CardSkeleton rows={3} /> : batches.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("expiry.none")}</div>
      ) : batches.map((b) => {
        const bg = badge(b);
        return (
          <div key={b.id} className="card" style={{ marginBottom: 8, padding: 14, borderColor: b.flag === "expired" ? "rgba(231,76,60,0.35)" : b.flag === "soon" ? "rgba(212,168,71,0.25)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{b.product} <span style={{ color: "var(--gray)", fontSize: 12 }}>· {b.qty}{b.unit ? " " + b.unit : ""}</span></div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("expiry.expires")} {fmtDate(b.expiry_date)}{b.note ? ` · ${b.note}` : ""}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: bg.c, whiteSpace: "nowrap" }}>{bg.label}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => used(b.id)} disabled={busy === b.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(39,174,96,0.12)", color: "***REMOVED***58d68d", border: "1px solid rgba(39,174,96,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("expiry.used")}</button>
              <button onClick={() => discard(b.id)} disabled={busy === b.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(231,76,60,0.1)", color: "***REMOVED***ec7063", border: "1px solid rgba(231,76,60,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("expiry.discard")}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}