"use client";
import { inventoryKey } from "@/lib/inventory/identity";

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
    if (b.flag === "expired") return { c: "var(--danger)", label: b.daysToExpiry === 0 ? t("expiry.today") : t("expiry.expiredAgo", { n: Math.abs(b.daysToExpiry) }) };
    if (b.flag === "soon") return { c: "var(--gold-ink)", label: b.daysToExpiry === 0 ? t("expiry.today") : t("expiry.inDays", { n: b.daysToExpiry }) };
    return { c: "var(--success)", label: t("expiry.inDays", { n: b.daysToExpiry }) };
  };

  // group batches by product (batches arrive soonest-expiry first, so items[0] is the most urgent)
  const groups = (() => {
    const map: Record<string, any> = {};
    for (const b of batches) {
      if (!map[inventoryKey(b)]) map[inventoryKey(b)] = { product: b.product, unit: b.unit, items: [], total: 0 };
      map[inventoryKey(b)].items.push(b);
      map[inventoryKey(b)].total += Number(b.qty) || 0;
    }
    return Object.values(map).sort((a: any, z: any) => a.items[0].expiry_date.localeCompare(z.items[0].expiry_date));
  })();

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📅" size={22} /> {t("expiry.title")}</h1>
      <div className="page-sub">{t("expiry.subtitle")}</div>

      {summary && (summary.expired > 0 || summary.soon > 0) && (
        <div className="card" style={{ margin: "12px 0", padding: 14, borderColor: summary.expired > 0 ? "rgba(231,76,60,0.4)" : "var(--accent-line)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: summary.expired > 0 ? "var(--danger)" : "#d4a847" }}>
            {summary.expired > 0 ? t("expiry.expiredCount", { n: summary.expired }) : t("expiry.soonCount", { n: summary.soon })}
          </div>
          <div className="ui-meta">{t("expiry.useFirst")}</div>
        </div>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ width: "100%", padding: 12, margin: "6px 0 14px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--gold)", border: "1px solid var(--accent-line)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ {t("expiry.addBatch")}</button>
      ) : (
        <div className="card" style={{ marginBottom: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="card-title u-m0">{t("expiry.addBatch")}</div>
            <button className="ui-icon-btn" type="button" aria-label={t("common.close")} onClick={resetForm}>✕</button>
          </div>
          {!sel ? (
            <>
              <input className="form-input u-mb-2" aria-label={t("expiry.searchProduct")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("expiry.searchProduct")}
                />
              {search && (filtered.length === 0 ? <div className="ui-muted">{t("expiry.noProduct")}</div> : filtered.map((p) => (
                <button className="ui-pick" key={p.product} onClick={() => { setSel(p); setSearch(""); }}>
                  {p.product} <span className="ui-muted">({p.category})</span>
                </button>
              )))}
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>{sel.product}</div>
                <button className="ui-link-btn" onClick={() => setSel(null)}>{t("expiry.change")}</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <input aria-label={t("po.qty")} type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 84, padding: 11, textAlign: "center", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid var(--border)", fontSize: 15, fontWeight: 600 }} />
                <span className="ui-muted-md">{sel.unit || ""}</span>
              </div>
              <label style={{ fontSize: 12, color: "var(--gray)", display: "block", marginBottom: 4 }}>{t("expiry.expiryDate")}</label>
              <input className="form-input u-mb-3" aria-label={t("expiry.expiryDate")} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                />
              <input className="form-input u-mb-3" aria-label={t("expiry.notePh")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("expiry.notePh")}
                />
              <button className="btn-gold ui-block" onClick={submit} disabled={busy === "add"}>{busy === "add" ? "…" : t("expiry.addBatch")}</button>
            </>
          )}
        </div>
      )}

      <div className="card-title u-mb-2">{t("expiry.batches")}</div>
      {loading ? <CardSkeleton rows={3} /> : batches.length === 0 ? (
        <div className="card ui-empty-msg">{t("expiry.none")}</div>
      ) : groups.map((g: any) => {
        const soonest = g.items[0];
        const head = badge(soonest);
        const multi = g.items.length > 1;
        return (
          <div key={g.product} className="card" style={{ marginBottom: 10, padding: 14, borderColor: soonest.flag === "expired" ? "rgba(231,76,60,0.35)" : soonest.flag === "soon" ? "var(--accent-line)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: multi ? 10 : 6, marginBottom: multi ? 4 : 0, borderBottom: multi ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>{g.product}</div>
                <div className="ui-muted">{t("expiry.totalOnHand", { qty: Math.round(g.total * 10) / 10, unit: g.unit || "" })}{multi ? ` · ${g.items.length} ${t("expiry.batchesShort")}` : ""}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: head.c, whiteSpace: "nowrap" }}>{head.label}</span>
            </div>
            {g.items.map((b: any) => {
              const bg = badge(b);
              return (
                <div key={b.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="u-between">
                    <div>
                      <div className="ui-body">{b.qty}{b.unit ? " " + b.unit : ""} <span className="ui-muted">· {t("expiry.expires")} {fmtDate(b.expiry_date)}</span></div>
                      {b.note && <div style={{ fontSize: 12, color: "var(--gray)", fontStyle: "italic" }}>{b.note}</div>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: bg.c, whiteSpace: "nowrap" }}>{bg.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => used(b.id)} disabled={busy === b.id} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "rgba(39,174,96,0.12)", color: "var(--success)", border: "1px solid rgba(39,174,96,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t("expiry.used")}</button>
                    <button onClick={() => discard(b.id)} disabled={busy === b.id} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "rgba(231,76,60,0.1)", color: "var(--danger)", border: "1px solid rgba(231,76,60,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t("expiry.discard")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}