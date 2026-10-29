"use client";

import { formatPct, formatEur, appLocale } from "@/lib/format";
import { berlinToday } from "@/lib/time/berlinDate";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getLaborSummary, setDailySales, getRecentSales, getStaffWages, setStaffWage, setWageForMissing } from "@/lib/queries/labor";
import SalesImport from "@/components/SalesImport";
import { toast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const today = () => berlinToday();

export default function LaborPage() {
  const { t, locale } = useLang();
  const eur = (n: number) => formatEur((n || 0), locale, "auto");
  const [sum, setSum] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingWage, setSavingWage] = useState<string | null>(null);

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [savingSale, setSavingSale] = useState(false);
  const [wageEdits, setWageEdits] = useState<Record<string, string>>({});
  const [wageDates, setWageDates] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true); setLoadError(null); setDenied(false);
    try {
    const [s, rs, sw] = await Promise.all([getLaborSummary(), getRecentSales(), getStaffWages()]);
    const failed = [s, rs, sw].find(result => !result.ok);
    if (failed) { if (failed.error?.includes("Managers")) setDenied(true); else setLoadError(failed.error || t("lab.couldNotSave")); return; }
    setSum(s); setSales(rs.sales || []); setStaff(sw.staff || []);
    } catch { setLoadError(t("staff.networkErr")); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  async function saveSale() {
    const amt = parseFloat(amount);
    if (!date || !Number.isFinite(amt) || amt < 0) { toast(t("lab.validDateAmount"), "error"); return; }
    setSavingSale(true);
    try {
    const res = await setDailySales(date, amt);
    if (res.ok) { toast(t("lab.salesSaved"), "success"); setAmount(""); loadAll(); }
    else toast(res.error || t("lab.couldNotSave"), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setSavingSale(false); }
  }

  const [bulkWage, setBulkWage] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  async function saveBulkWage() {
    const w = parseFloat(bulkWage.replace(",", "."));
    if (!Number.isFinite(w) || w < 0 || !bulkDate || bulkSaving) { toast(t("lab.validWage"), "error"); return; }
    setBulkSaving(true);
    try {
      const res = await setWageForMissing(w, bulkDate);
      if (res.ok) { toast(t("lab.bulkDone", { n: res.count }), "success"); setBulkWage(""); setBulkDate(""); loadAll(); }
      else toast(res.error || t("lab.couldNotSave"), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setBulkSaving(false); }
  }

  async function saveWage(userId: string) {
    const raw = wageEdits[userId] ?? String(staff.find(p => p.id === userId)?.hourly_wage ?? "");
    const w = parseFloat(raw);
    if (!Number.isFinite(w) || w < 0 || !wageDates[userId] || savingWage) { toast(t("lab.validWage"), "error"); return; }
    setSavingWage(userId);
    try {
    const res = await setStaffWage(userId, w, wageDates[userId]);
    if (res.ok) {
      toast(t("lab.wageSaved"), "success");
      setStaff((cur) => cur.map((p) => (p.id === userId ? { ...p, hourly_wage: w } : p)));
      setWageEdits((cur) => { const c = { ...cur }; delete c[userId]; return c; });
      setWageDates((cur) => { const c = { ...cur }; delete c[userId]; return c; });
      loadAll();
    } else toast(res.error || t("lab.couldNotSave"), "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setSavingWage(null); }
  }

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;
  if (loadError) return <div className="card" role="alert"><p>{loadError}</p><button className="workspace-button" onClick={loadAll}>{t("business.retry")}</button></div>;

  const pct = sum?.laborPct;
  const pctColor = pct == null ? "var(--white)" : pct <= 30 ? "var(--success)" : pct <= 35 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="💶" size={22} /> {t("lab.title")}</h1>
      <div className="page-sub">{t("lab.subtitle")}</div>

      {/* KPI */}
      {loading ? (
        <Skeleton height={120} radius={14} style={{ marginBottom: 14 }} />
      ) : (
        <div className="card u-center mb-4">
          <div style={{ fontSize: 12, color: "var(--gray)", letterSpacing: 1, textTransform: "uppercase" }}>{t("lab.laborPct")}</div>
          <div style={{ fontSize: 46, fontWeight: 800, fontFamily: "var(--font-display)", color: pctColor, lineHeight: 1.1 }}>
            {formatPct(pct, locale)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 8, fontSize: 13, color: "var(--gray)" }}>
            <span>{t("lab.labor")} <b className="u-text">{sum?.missingWageStaff ? "—" : eur(sum?.laborCost || 0)}</b></span>
            <span>{t("lab.sales")} <b className="u-text">{sum?.recordedSalesDays ? eur(sum.monthSales ?? 0) : "—"}</b></span>
          </div>
          {pct == null && !sum?.missingWageStaff && <div className="ui-note">{t("lab.enterToCalc")}</div>}
          {!!sum?.missingWageStaff && <p className="tone-warn" role="status">{t("lab.missingWageCost")}</p>}
          {pct != null && <div style={{ fontSize: 12, color: pctColor, marginTop: 8 }}>{pct <= 30 ? t("lab.healthy") : pct <= 35 ? t("lab.watchIt") : t("lab.high")} · {t("lab.typicalTarget")}</div>}
        </div>
      )}

      {/* enter sales */}
      <div className="section-label">{t("lab.enterDailySales")}</div>
      <div className="card u-mb-2">
        <div className="d-flex gap-2 ai-e f-wrap">
          <div className="u-flex1">
            <div style={lbl}>{t("lab.date")}</div>
            <input className="form-input" type="date" aria-label={t("lab.date")} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="u-flex1">
            <div style={lbl}>{t("lab.revenue")}</div>
            <input className="form-input" type="number" min="0" step="0.01" aria-label={t("lab.revenue")} inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button onClick={saveSale} disabled={savingSale || loading} style={{ padding: "11px 16px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: savingSale ? "default" : "pointer", whiteSpace: "nowrap" }}>
            {savingSale ? "…" : t("common.save")}
          </button>
        </div>
      </div>

      <SalesImport onDone={loadAll} />

      {sales.length > 0 && (
        <div className="card p-2 mb-2">
          {sales.map((s, i) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 6px", borderBottom: i < sales.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none", fontSize: 13 }}>
              <span className="u-muted">{new Date(s.sale_date).toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "short" })}</span>
              <span className="ui-strong-inline">{eur(Number(s.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {/* staff wages */}
      <div className="section-label">{t("lab.staffWages")}</div>
      <p className="u-muted t-md">{t("lab.wageBasis")}</p>
      {loading ? (
        <Skeleton height={120} radius={14} />
      ) : (
        <div className="card p-2">
          {staff.some((p) => p.hourly_wage == null) && (
            <div className="labor-bulk">
              <strong>{t("lab.bulkTitle", { n: staff.filter((p) => p.hourly_wage == null).length })}</strong>
              <div className="labor-bulk-row">
                <input type="number" inputMode="decimal" min="0" step="0.01" aria-label={t("lab.bulkWage")} placeholder="14.92" value={bulkWage} disabled={bulkSaving} onChange={(e) => setBulkWage(e.target.value)} style={{ ...input, width: 96, textAlign: "right" }} />
                <label className="ui-muted">{t("lab.effectiveFrom")}<input type="date" aria-label={t("lab.effectiveFrom")} min="2000-01-01" max={today()} value={bulkDate} disabled={bulkSaving} onChange={(e) => setBulkDate(e.target.value)} style={{ ...input, display: "block", width: 160 }} /></label>
                <button className="btn-gold" onClick={saveBulkWage} disabled={!bulkWage || !bulkDate || bulkSaving}>{bulkSaving ? t("common.saving") : t("lab.bulkApply")}</button>
              </div>
              <p className="ui-sub">{t("lab.bulkHint")}</p>
            </div>
          )}
          {staff.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "9px 6px", borderBottom: i < staff.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none" }}>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--white)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.full_name}</div>
                <div className="ui-muted">{p.team || "—"}</div>
                {!p.history?.some((h: any) => h.effective_from) && <div className="tone-warn t-xs">{t("lab.unconfirmedDate")}</div>}
              </div>
              <input
                type="number" inputMode="decimal" min="0" step="0.01" disabled={!!savingWage}
                aria-label={`${t("lab.staffWages")} · ${p.full_name}`}
                placeholder={p.hourly_wage != null ? String(p.hourly_wage) : "—"}
                value={wageEdits[p.id] ?? ""}
                onChange={(e) => setWageEdits((c) => ({ ...c, [p.id]: e.target.value }))}
                style={{ ...input, width: 72, padding: "8px 10px", textAlign: "right" }}
              />
              <label className="ui-muted">{t("lab.effectiveFrom")}<input type="date" aria-label={`${t("lab.effectiveFrom")} · ${p.full_name}`} min="2000-01-01" max={today()} disabled={!!savingWage} value={wageDates[p.id] || ""} onChange={e => setWageDates(cur => ({ ...cur, [p.id]: e.target.value }))} style={{ ...input, display: "block", width: 160 }} /></label>
              <button onClick={() => saveWage(p.id)} disabled={!wageDates[p.id] || !!savingWage} style={{ padding: "8px 12px", minHeight: 44, background: !wageDates[p.id] ? "var(--dark3)" : "var(--action)", color: !wageDates[p.id] ? "var(--gray)" : "var(--on-action)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: !wageDates[p.id] ? "default" : "pointer" }}>
                {savingWage === p.id ? t("common.saving") : t("lab.set")}
              </button>
              {!!p.history?.length && <details style={{ flexBasis: "100%", fontSize: 14 }}><summary>{t("lab.history")}</summary><ul>{p.history.map((h: any) => <li key={h.id}>{h.effective_from || t("lab.unconfirmedDate")} · {h.hourly_wage == null ? "—" : eur(Number(h.hourly_wage))} · {t("lab.recorded")} {new Date(h.recorded_at).toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin" })}</li>)}</ul></details>}
            </div>
          ))}
          {sum && sum.withWage < sum.staffCount && (
            <div style={{ fontSize: 12, color: "var(--gray)", textAlign: "center", padding: "8px 0 2px" }}>
              {t("lab.wagesSet", { a: sum.withWage, b: sum.staffCount })}
            </div>
          )}
        </div>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--action)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", background: "var(--dark3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--white)", fontSize: 14 };
