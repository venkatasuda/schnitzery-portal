"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getStockAlerts, setAlertLevel, notifyLowStock } from "@/lib/queries/inventory";

export default function StockAlertsPage() {
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [lowCount, setLowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);

  async function load() {
    const r = await getStockAlerts();
    if (r.ok) { setItems(r.items || []); setLowCount(r.lowCount || 0); }
    else if (r.error?.includes("Managers")) setDenied(true);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function saveLevel(id: string) {
    const raw = edits[id];
    if (raw === undefined || raw === "") return;
    const val = Number(raw);
    if (!(val >= 0)) { toast(t("salert.badLevel"), "error"); return; }
    setSavingId(id);
    const r = await setAlertLevel(id, val);
    setSavingId(null);
    if (r.ok) {
      toast(t("salert.saved"), "success");
      setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      load();
    } else toast(r.error || t("salert.failed"), "error");
  }

  async function alertMe() {
    setNotifying(true);
    const r = await notifyLowStock();
    setNotifying(false);
    if (!r.ok) { toast(r.error || t("salert.failed"), "error"); return; }
    if (r.count === 0) toast(t("salert.allGood"), "success");
    else toast(t("salert.sent", { n: r.count ?? 0 }), "success");
  }

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("salert.managersOnly")}</div>;
  }

  const input: React.CSSProperties = { width: 66, padding: "7px 8px", borderRadius: 7, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.14)", fontSize: 13, textAlign: "center" };

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📦" size={22} /> {t("salert.title")}</div>
      <div className="page-sub">{t("salert.subtitle")}</div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "12px 0", padding: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: lowCount > 0 ? "#ec7063" : "#58d68d" }}>{lowCount}</div>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>{t("salert.lowNow")}</div>
        </div>
        <button onClick={alertMe} disabled={notifying}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", cursor: notifying ? "default" : "pointer", background: "var(--gold)", color: "#1a0e0e", fontSize: 13, fontWeight: 700 }}>
          {notifying ? t("salert.sending") : `🔔 ${t("salert.alertMe")}`}
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--gray)", margin: "0 2px 10px" }}>{t("salert.hint")}</div>

      {loading ? <CardSkeleton /> : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("salert.noItems")}</div>
      ) : (
        items.map((it) => (
          <div key={it.id} className="card" style={{ padding: 12, marginBottom: 8, borderColor: it.low ? "rgba(231,76,60,0.4)" : undefined, background: it.low ? "rgba(231,76,60,0.06)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>
                  {it.low && <span style={{ color: "#ec7063", marginRight: 5 }}>●</span>}{it.product}
                </div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>
                  {it.category}{it.unit ? ` · ${it.unit}` : ""} · {it.counted ? t("salert.now", { n: it.ist }) : t("salert.notCounted")}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--gray)", marginBottom: 3 }}>{t("salert.alertBelow")}</div>
                <input
                  type="number" inputMode="decimal" style={input}
                  value={edits[it.id] ?? String(it.level)}
                  onChange={(e) => setEdits((s) => ({ ...s, [it.id]: e.target.value }))}
                />
              </div>
              {edits[it.id] !== undefined && edits[it.id] !== String(it.level) && (
                <button onClick={() => saveLevel(it.id)} disabled={savingId === it.id}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--gold)", color: "#1a0e0e", fontSize: 12, fontWeight: 700 }}>
                  {savingId === it.id ? "…" : t("common.save")}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
