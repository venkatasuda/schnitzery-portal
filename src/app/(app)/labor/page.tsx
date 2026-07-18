"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { getLaborSummary, setDailySales, getRecentSales, getStaffWages, setStaffWage } from "@/lib/queries/labor";
import { toast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const eur = (n: number) => "€" + (n || 0).toLocaleString("de-DE");
const today = () => new Date().toISOString().slice(0, 10);

export default function LaborPage() {
  const { t } = useLang();
  const [sum, setSum] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [savingSale, setSavingSale] = useState(false);
  const [wageEdits, setWageEdits] = useState<Record<string, string>>({});

  async function loadAll() {
    const [s, rs, sw] = await Promise.all([getLaborSummary(), getRecentSales(), getStaffWages()]);
    if (s.ok) setSum(s);
    else if (s.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    if (rs.ok) setSales(rs.sales || []);
    if (sw.ok) setStaff(sw.staff || []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function saveSale() {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt < 0) { toast(t("lab.validDateAmount"), "error"); return; }
    setSavingSale(true);
    const res = await setDailySales(date, amt);
    setSavingSale(false);
    if (res.ok) { toast(t("lab.salesSaved"), "success"); setAmount(""); loadAll(); }
    else toast(res.error || t("lab.couldNotSave"), "error");
  }

  async function saveWage(userId: string) {
    const raw = wageEdits[userId];
    const w = parseFloat(raw);
    if (isNaN(w) || w < 0) { toast(t("lab.validWage"), "error"); return; }
    const res = await setStaffWage(userId, w);
    if (res.ok) {
      toast(t("lab.wageSaved"), "success");
      setStaff((cur) => cur.map((p) => (p.id === userId ? { ...p, hourly_wage: w } : p)));
      setWageEdits((cur) => { const c = { ...cur }; delete c[userId]; return c; });
      getLaborSummary().then((s) => { if (s.ok) setSum(s); });
    } else toast(res.error || t("lab.couldNotSave"), "error");
  }

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const pct = sum?.laborPct;
  const pctColor = pct == null ? "var(--white)" : pct <= 30 ? "#58d68d" : pct <= 35 ? "#e8a35a" : "#ec7063";

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="💶" size={22} /> {t("lab.title")}</div>
      <div className="page-sub">{t("lab.subtitle")}</div>

      {/* KPI */}
      {loading ? (
        <Skeleton height={120} radius={14} style={{ marginBottom: 14 }} />
      ) : (
        <div className="card" style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--gray)", letterSpacing: 1, textTransform: "uppercase" }}>{t("lab.laborPct")}</div>
          <div style={{ fontSize: 46, fontWeight: 800, fontFamily: "var(--font-display)", color: pctColor, lineHeight: 1.1 }}>
            {pct == null ? "—" : `${pct}%`}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 8, fontSize: 13, color: "var(--gray)" }}>
            <span>{t("lab.labor")} <b style={{ color: "var(--white)" }}>{eur(sum?.laborCost || 0)}</b></span>
            <span>{t("lab.sales")} <b style={{ color: "var(--white)" }}>{eur(sum?.monthSales || 0)}</b></span>
          </div>
          {pct == null && <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>{t("lab.enterToCalc")}</div>}
          {pct != null && <div style={{ fontSize: 11, color: pctColor, marginTop: 8 }}>{pct <= 30 ? t("lab.healthy") : pct <= 35 ? t("lab.watchIt") : t("lab.high")} · {t("lab.typicalTarget")}</div>}
        </div>
      )}

      {/* enter sales */}
      <div className="section-label">{t("lab.enterDailySales")}</div>
      <div className="card" style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={lbl}>{t("lab.date")}</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={lbl}>{t("lab.revenue")}</div>
            <input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
          </div>
          <button onClick={saveSale} disabled={savingSale} style={{ padding: "11px 16px", background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: savingSale ? "default" : "pointer", whiteSpace: "nowrap" }}>
            {savingSale ? "…" : t("common.save")}
          </button>
        </div>
      </div>

      {sales.length > 0 && (
        <div className="card" style={{ padding: 8, marginBottom: 6 }}>
          {sales.map((s, i) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 6px", borderBottom: i < sales.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--gray)" }}>{new Date(s.sale_date).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" })}</span>
              <span style={{ color: "var(--white)", fontWeight: 600 }}>{eur(Number(s.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {/* staff wages */}
      <div className="section-label">{t("lab.staffWages")}</div>
      {loading ? (
        <Skeleton height={120} radius={14} />
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {staff.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px", borderBottom: i < staff.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--white)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.full_name}</div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>{p.team || "—"}</div>
              </div>
              <input
                type="number" inputMode="decimal"
                placeholder={p.hourly_wage != null ? String(p.hourly_wage) : "—"}
                value={wageEdits[p.id] ?? ""}
                onChange={(e) => setWageEdits((c) => ({ ...c, [p.id]: e.target.value }))}
                style={{ ...input, width: 72, padding: "8px 10px", textAlign: "right" }}
              />
              <button onClick={() => saveWage(p.id)} disabled={wageEdits[p.id] === undefined} style={{ padding: "8px 12px", background: wageEdits[p.id] === undefined ? "var(--dark3)" : "var(--gold)", color: wageEdits[p.id] === undefined ? "var(--gray)" : "#1a0e0e", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: wageEdits[p.id] === undefined ? "default" : "pointer" }}>
                {t("lab.set")}
              </button>
            </div>
          ))}
          {sum && sum.withWage < sum.staffCount && (
            <div style={{ fontSize: 11, color: "var(--gray)", textAlign: "center", padding: "8px 0 2px" }}>
              {t("lab.wagesSet", { a: sum.withWage, b: sum.staffCount })}
            </div>
          )}
        </div>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, color: "var(--white)", fontSize: 14 };