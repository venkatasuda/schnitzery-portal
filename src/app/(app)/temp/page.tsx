"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getTempUnits, logTemp, getTempLog, getTempSummary,
  addTempUnit, removeTempUnit,
} from "@/lib/queries/temp";

const KINDS = ["fridge", "freezer", "hot_hold", "other"];
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

export default function TempPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"check" | "history" | "units">("check");
  const [loading, setLoading] = useState(true);
  const [isMgr, setIsMgr] = useState(false);

  const [units, setUnits] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const [val, setVal] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // add-unit form
  const [nu, setNu] = useState({ name: "", kind: "fridge", min: "", max: "" });

  async function loadCore() {
    const [u, s] = await Promise.all([getTempUnits(), getTempSummary()]);
    if (u.ok) { setUnits(u.units || []); setIsMgr(u.isManager); }
    if (s.ok) setSummary(s);
    setLoading(false);
  }
  async function loadHistory() { const r = await getTempLog(14); if (r.ok) setLogs(r.logs || []); }
  useEffect(() => { loadCore(); }, []);
  useEffect(() => { if (tab === "history") loadHistory(); /* eslint-disable-next-line */ }, [tab]);

  const outOfRange = (u: any, v: string) => { const n = Number(v); return v !== "" && !Number.isNaN(n) && (n < Number(u.min_temp) || n > Number(u.max_temp)); };

  async function doLog(u: any) {
    const v = val[u.id];
    if (v === undefined || v === "") { toast(t("temp.enterTemp"), "error"); return; }
    setBusy(u.id);
    const r = await logTemp(u.id, Number(v), "", action[u.id] || "");
    setBusy(null);
    if (r.ok) {
      toast(r.inRange ? t("temp.logged") : t("temp.loggedBreach"), r.inRange ? "success" : "error");
      setVal((s) => ({ ...s, [u.id]: "" })); setAction((s) => ({ ...s, [u.id]: "" }));
      loadCore();
    } else toast(r.error || t("temp.failed"), "error");
  }

  async function doAddUnit() {
    if (!nu.name || nu.min === "" || nu.max === "") { toast(t("temp.unitFields"), "error"); return; }
    setBusy("add");
    const r = await addTempUnit(nu.name, nu.kind, Number(nu.min), Number(nu.max));
    setBusy(null);
    if (r.ok) { toast(t("temp.unitAdded"), "success"); setNu({ name: "", kind: "fridge", min: "", max: "" }); loadCore(); }
    else toast(r.error || t("temp.failed"), "error");
  }
  async function doRemoveUnit(u: any) {
    if (!confirm(t("temp.confirmRemove", { name: u.name }))) return;
    setBusy(u.id);
    const r = await removeTempUnit(u.id); setBusy(null);
    if (r.ok) { toast(t("temp.unitRemoved"), "success"); loadCore(); } else toast(r.error || t("temp.failed"), "error");
  }

  const rangeStr = (u: any) => `${u.min_temp}°C … ${u.max_temp}°C`;

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="🌡️" size={22} /> {t("temp.title")}</div>
      <div className="page-sub">{t("temp.subtitle")}</div>

      {summary && (
        <div className="card" style={{ margin: "12px 0", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: summary.breachesToday > 0 ? "rgba(231,76,60,0.4)" : summary.pending > 0 ? "rgba(212,168,71,0.3)" : "rgba(39,174,96,0.3)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)" }}>{t("temp.todayCoverage", { done: summary.loggedUnits, total: summary.totalUnits })}</div>
            <div style={{ fontSize: 12, color: summary.breachesToday > 0 ? "#ec7063" : "var(--gray)" }}>
              {summary.breachesToday > 0 ? t("temp.breachesToday", { n: summary.breachesToday }) : summary.pending > 0 ? t("temp.pendingToday", { n: summary.pending }) : t("temp.allGood")}
            </div>
          </div>
          <div style={{ fontSize: 26 }}>{summary.breachesToday > 0 ? "⚠️" : summary.pending > 0 ? "🕒" : "✅"}</div>
        </div>
      )}

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "check" ? " active" : ""}`} onClick={() => setTab("check")}>{t("temp.tabCheck")}</button>
        <button className={`hub-tab${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>{t("temp.tabHistory")}</button>
        {isMgr && <button className={`hub-tab${tab === "units" ? " active" : ""}`} onClick={() => setTab("units")}>{t("temp.tabUnits")}</button>}
      </div>

      {loading ? <CardSkeleton rows={4} /> : (
        <>
          {/* CHECK / LOG */}
          {tab === "check" && (
            <div>
              {units.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{isMgr ? t("temp.noUnitsMgr") : t("temp.noUnits")}</div>
              ) : units.map((u) => {
                const oor = outOfRange(u, val[u.id] || "");
                const lt = u.latest;
                return (
                  <div key={u.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("temp.kind_" + u.kind)} · {rangeStr(u)}</div>
                      </div>
                      {lt ? (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: lt.in_range ? "#58d68d" : "#ec7063" }}>{lt.temp}°C</div>
                          <div style={{ fontSize: 10, color: "var(--gray)" }}>{u.todayCount}× {t("temp.today")}</div>
                        </div>
                      ) : <span style={{ fontSize: 11, color: "#d4a847" }}>{t("temp.pending")}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                      <input type="number" inputMode="decimal" value={val[u.id] ?? ""} onChange={(e) => setVal((s) => ({ ...s, [u.id]: e.target.value }))}
                        placeholder="°C" style={{ width: 90, padding: "9px 10px", borderRadius: 8, background: "var(--dark2)", color: oor ? "#ec7063" : "var(--white)", border: `1px solid ${oor ? "rgba(231,76,60,0.5)" : "rgba(255,255,255,0.12)"}`, fontSize: 14, textAlign: "center", fontWeight: 600 }} />
                      <button onClick={() => doLog(u)} disabled={busy === u.id} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "var(--gold)", color: "#1a1a1a", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy === u.id ? "…" : t("temp.log")}</button>
                    </div>
                    {oor && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: "#ec7063", marginBottom: 6 }}>⚠️ {t("temp.outOfRange")}</div>
                        <input value={action[u.id] ?? ""} onChange={(e) => setAction((s) => ({ ...s, [u.id]: e.target.value }))}
                          placeholder={t("temp.correctivePh")} style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(231,76,60,0.4)", fontSize: 13 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORY */}
          {tab === "history" && (
            <div>
              {logs.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("temp.noHistory")}</div>
              ) : logs.map((l) => (
                <div key={l.id} className="card" style={{ marginBottom: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--white)" }}>{l.unit?.name || "—"} <span style={{ fontWeight: 700, color: l.in_range ? "#58d68d" : "#ec7063" }}>{l.temp}°C</span></div>
                      <div style={{ fontSize: 11, color: "var(--gray)" }}>{fmtWhen(l.recorded_at)}{l.recorded_by_name ? ` · ${l.recorded_by_name}` : ""}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: l.in_range ? "#58d68d" : "#ec7063" }}>{l.in_range ? t("temp.ok") : t("temp.breach")}</span>
                  </div>
                  {l.corrective_action && <div style={{ fontSize: 12, color: "#d4a847", marginTop: 6 }}>↳ {l.corrective_action}</div>}
                </div>
              ))}
            </div>
          )}

          {/* UNITS (manager) */}
          {tab === "units" && isMgr && (
            <div>
              <div className="card" style={{ marginBottom: 12, padding: 14 }}>
                <div className="card-title">{t("temp.addUnit")}</div>
                <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder={t("temp.unitName")} style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, marginBottom: 8 }} />
                <select value={nu.kind} onChange={(e) => setNu({ ...nu, kind: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, marginBottom: 8 }}>
                  {KINDS.map((k) => <option key={k} value={k}>{t("temp.kind_" + k)}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="number" value={nu.min} onChange={(e) => setNu({ ...nu, min: e.target.value })} placeholder={t("temp.minC")} style={{ flex: 1, padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13 }} />
                  <input type="number" value={nu.max} onChange={(e) => setNu({ ...nu, max: e.target.value })} placeholder={t("temp.maxC")} style={{ flex: 1, padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13 }} />
                </div>
                <button onClick={doAddUnit} disabled={busy === "add"} style={{ width: "100%", padding: 11, borderRadius: 8, background: "var(--gold)", color: "#1a1a1a", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy === "add" ? "…" : t("temp.addUnit")}</button>
              </div>
              {units.map((u) => (
                <div key={u.id} className="card" style={{ marginBottom: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--white)" }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--gray)" }}>{t("temp.kind_" + u.kind)} · {rangeStr(u)}</div>
                  </div>
                  <button onClick={() => doRemoveUnit(u)} disabled={busy === u.id} title={t("temp.removeUnit")} style={{ background: "none", border: "none", color: "#9a8f8f", cursor: "pointer", fontSize: 16 }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}