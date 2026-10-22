"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getWasteProducts, logWaste, getWasteLog, getWasteSummary, getWasteTrends, deleteWaste } from "@/lib/queries/waste";
import { PageHeader, Panel } from "@/components/ui";

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
      <PageHeader icon={<Icon e="🗑️" size={22} />} title={t("waste.title")} subtitle={t("waste.subtitle")} />

      {summary && summary.count > 0 && (
        <div className="card">
          <div className="u-between">
            <span className="ui-muted">{t("waste.thisWeek")}</span>
            {summary.hasPrices && <strong className="ui-figure-lg tone-danger">{eur(summary.totalValue)}</strong>}
          </div>
          <div className="ui-meta">{t("waste.entries", { n: summary.count })}</div>
          {summary.reasons.length > 0 && (
            <div className="ui-chips u-mt-3">
              {summary.reasons.map((r: any) => (
                <span key={r.reason} className="ui-chip muted">
                  <Icon e={REASON_EMOJI[r.reason] || "•"} size={14} /> {t("waste.r_" + r.reason)} {summary.hasPrices ? eur(r.value) : `×${r.count}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY TREND — managers only (getWasteTrends returns ok:false otherwise) */}
      {trends && trends.weeks && (
        <div className="card">
          <div className="u-between u-mb-3">
            <span className="ui-muted">{t("waste.trend6w")}</span>
            {trends.overallPct != null && (
              <span className={`ui-trend ${trends.overallPct > 5 ? "tone-danger" : "tone-success"}`}>
                {t("waste.pctOfSales", { p: trends.overallPct })}
              </span>
            )}
          </div>
          <div className="ui-mini-bars" role="img" aria-label={t("waste.trend6w")}>
            {(() => {
              const max = Math.max(1, ...trends.weeks.map((w: any) => w.wasteValue));
              return trends.weeks.map((w: any, i: number) => (
                <div key={i} className="ui-mini-bar">
                  <span title={eur(w.wasteValue)} style={{ height: `${Math.round((w.wasteValue / max) * 52)}px` }} />
                  <span className="ui-muted">{w.weekStart.slice(5)}</span>
                </div>
              ));
            })()}
          </div>
          {trends.hasPrices && (
            <div className="ui-note u-right">{t("waste.trendTotal", { v: eur(trends.totalWaste) })}</div>
          )}
        </div>
      )}

      {/* QUICK LOG */}
      <Panel title={t("waste.logWaste")}>
        {!sel ? (
          <>
            <input className="form-input u-mb-2" aria-label={t("waste.searchProduct")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("waste.searchProduct")}
              />
            {search && (filtered.length === 0 ? (
              <div className="ui-muted">{t("waste.noProduct")}</div>
            ) : filtered.map((p) => (
              <button className="ui-pick" key={p.product} onClick={() => { setSel(p); setSearch(""); }}
               >
                {p.product} <span className="ui-muted">({p.category})</span>
              </button>
            )))}
          </>
        ) : (
          <>
            <div className="u-between u-mb-3">
              <div>
                <div className="ui-strong">{sel.product}</div>
                <div className="ui-muted">{sel.category}</div>
              </div>
              <button className="ui-link-btn" onClick={() => setSel(null)}>{t("waste.change")}</button>
            </div>
            <div className="ui-chips u-mb-3" role="group" aria-label={t("waste.logWaste")}>
              {REASONS.map((r) => (
                <button key={r} type="button" className="ui-choice" aria-pressed={reason === r} onClick={() => setReason(r)}>
                  <Icon e={REASON_EMOJI[r]} size={14} /> {t("waste.r_" + r)}
                </button>
              ))}
            </div>
            <div className="u-row u-mb-3">
              <input aria-label={t("po.qty")} type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="form-input ui-qty-input" />
              <span className="ui-muted-md">{sel.unit || t("waste.units")}</span>
            </div>
            <input className="form-input u-mb-3" aria-label={t("waste.notePh")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("waste.notePh")}
              />
            <button className="btn-danger ui-block" onClick={submit} disabled={busy}>{busy ? "…" : t("waste.logIt")}</button>
          </>
        )}
      </Panel>

      {/* RECENT */}
      <h2 className="ui-section-title">{t("waste.recent")}</h2>
      {loading ? <CardSkeleton rows={3} /> : entries.length === 0 ? (
        <div className="card ui-empty-msg">{t("waste.none")}</div>
      ) : entries.map((e) => (
        <div key={e.id} className="card ui-item-card ui-item-head">
          <div className="u-grow">
            <div className="ui-body u-row"><Icon e={REASON_EMOJI[e.reason] || "•"} size={14} /> {e.product} <span className="ui-muted">· {e.qty}{e.unit ? " " + e.unit : ""}</span></div>
            <div className="ui-muted">{t("waste.r_" + e.reason)} · {fmtWhen(e.created_at)}{e.logged_by_name ? ` · ${e.logged_by_name}` : ""}</div>
            {e.note && <div className="ui-quote">“{e.note}”</div>}
          </div>
          <div className="u-row">
            {e.value != null && <span className="ui-figure tone-danger">{eur(e.value)}</span>}
            <button className="ui-icon-btn" type="button" aria-label={t("common.delete")} onClick={() => remove(e.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}