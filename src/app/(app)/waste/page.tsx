"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getWasteProducts, logWaste, getWasteLog, getWasteSummary, getWasteTrends, deleteWaste } from "@/lib/queries/waste";

const REASONS = ["spoiled", "dropped", "overcooked", "expired", "other"];
const REASON_EMOJI: Record<string, string> = { spoiled: "🦠", dropped: "💥", overcooked: "🔥", expired: "📅", other: "🗑️" };
const eur = (n: number) => "€" + (Math.round((n || 0) * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

export default function WastePage() {
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("spoiled");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [p, e, s, tr] = await Promise.all([getWasteProducts(), getWasteLog(14), getWasteSummary(7), getWasteTrends(6)]);
    if (p.ok) setProducts(p.products || []);
    if (e.ok) setEntries(e.entries || []);
    if (s.ok) setSummary(s);
    setTrends(tr.ok ? tr : null); // ok:false for non-managers — card simply won't render
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function submit() {
    if (!sel) { toast(t("waste.pickProduct"), "error"); return; }
    if (!(Number(qty) > 0)) { toast(t("waste.enterQty"), "error"); return; }
    setBusy(true);
    const r = await logWaste(sel.product, sel.category, Number(qty), sel.unit, reason, note);
    setBusy(false);
    if (r.ok) {
      toast(t("waste.logged"), "success");
      setSel(null); setSearch(""); setQty("1"); setNote(""); setReason("spoiled");
      loadAll();
    } else toast(r.error || t("waste.failed"), "error");
  }
  async function remove(id: string) {
    if (!confirm(t("waste.confirmDelete"))) return;
    const r = await deleteWaste(id);
    if (r.ok) { toast(t("waste.deleted"), "success"); loadAll(); } else toast(r.error || t("waste.failed"), "error");
  }

  const filtered = products.filter((p) => p.product.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🗑️" size={22} /> {t("waste.title")}</div>
      <div className="page-sub">{t("waste.subtitle")}</div>

      {summary && summary.count > 0 && (
        <div className="card" style={{ margin: "12px 0", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "var(--gray)" }}>{t("waste.thisWeek")}</span>
            {summary.hasPrices && <span style={{ fontSize: 18, fontWeight: 700, color: "#ec7063" }}>{eur(summary.totalValue)}</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 2 }}>{t("waste.entries", { n: summary.count })}</div>
          {summary.reasons.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {summary.reasons.map((r: any) => (
                <span key={r.reason} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "var(--gray)" }}>
                  {REASON_EMOJI[r.reason] || "•"} {t("waste.r_" + r.reason)} {summary.hasPrices ? eur(r.value) : `×${r.count}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY TREND — managers only (getWasteTrends returns ok:false otherwise) */}
      {trends && trends.weeks && (
        <div className="card" style={{ margin: "12px 0", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--gray)" }}>{t("waste.trend6w")}</span>
            {trends.overallPct != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: trends.overallPct > 5 ? "#ec7063" : "#58d68d" }}>
                {t("waste.pctOfSales", { p: trends.overallPct })}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
            {(() => {
              const max = Math.max(1, ...trends.weeks.map((w: any) => w.wasteValue));
              return trends.weeks.map((w: any, i: number) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div title={eur(w.wasteValue)} style={{ width: "100%", height: `${Math.round((w.wasteValue / max) * 52)}px`, minHeight: 3, borderRadius: 4, background: "linear-gradient(180deg,#e67e22,#c0392b)" }} />
                  <span style={{ fontSize: 9, color: "var(--gray)" }}>{w.weekStart.slice(5)}</span>
                </div>
              ));
            })()}
          </div>
          {trends.hasPrices && (
            <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8, textAlign: "right" }}>{t("waste.trendTotal", { v: eur(trends.totalWaste) })}</div>
          )}
        </div>
      )}

      {/* QUICK LOG */}
      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div className="card-title">{t("waste.logWaste")}</div>
        {!sel ? (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("waste.searchProduct")}
              style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, marginBottom: 8 }} />
            {search && (filtered.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--gray)", padding: "4px 2px" }}>{t("waste.noProduct")}</div>
            ) : filtered.map((p) => (
              <button key={p.product} onClick={() => { setSel(p); setSearch(""); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "var(--white)", fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
                {p.product} <span style={{ color: "var(--gray)", fontSize: 11 }}>({p.category})</span>
              </button>
            )))}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--white)" }}>{sel.product}</div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>{sel.category}</div>
              </div>
              <button onClick={() => setSel(null)} style={{ fontSize: 12, color: "var(--gray)", background: "none", border: "none", cursor: "pointer" }}>{t("waste.change")}</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  style={{ fontSize: 12, padding: "7px 11px", borderRadius: 8, cursor: "pointer", background: reason === r ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.05)", color: reason === r ? "#ec7063" : "var(--gray)", border: `1px solid ${reason === r ? "rgba(231,76,60,0.35)" : "rgba(255,255,255,0.1)"}` }}>
                  {REASON_EMOJI[r]} {t("waste.r_" + r)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)}
                style={{ width: 90, padding: 11, textAlign: "center", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 15, fontWeight: 600 }} />
              <span style={{ fontSize: 13, color: "var(--gray)" }}>{sel.unit || t("waste.units")}</span>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("waste.notePh")}
              style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, marginBottom: 12 }} />
            <button onClick={submit} disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 10, background: "#e74c3c", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{busy ? "…" : t("waste.logIt")}</button>
          </>
        )}
      </div>

      {/* RECENT */}
      <div className="card-title" style={{ marginBottom: 8 }}>{t("waste.recent")}</div>
      {loading ? <CardSkeleton rows={3} /> : entries.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("waste.none")}</div>
      ) : entries.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--white)" }}>{REASON_EMOJI[e.reason] || "•"} {e.product} <span style={{ color: "var(--gray)", fontSize: 11 }}>· {e.qty}{e.unit ? " " + e.unit : ""}</span></div>
            <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("waste.r_" + e.reason)} · {fmtWhen(e.created_at)}{e.logged_by_name ? ` · ${e.logged_by_name}` : ""}</div>
            {e.note && <div style={{ fontSize: 11, color: "#9a8f8f", fontStyle: "italic" }}>“{e.note}”</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
            {e.value != null && <span style={{ fontSize: 13, color: "#ec7063", fontWeight: 600 }}>{eur(e.value)}</span>}
            <button onClick={() => remove(e.id)} style={{ background: "none", border: "none", color: "#7a7070", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}