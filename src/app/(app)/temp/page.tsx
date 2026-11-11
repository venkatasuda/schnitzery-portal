"use client";

import { appLocale } from "@/lib/format";
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
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString(appLocale(), { timeZone: "Europe/Berlin", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

export default function TempPage() {
  const { t, locale } = useLang();
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
  const [nu, setNu] = useState({ room: "", name: "", kind: "fridge", min: "", max: "" });

  async function loadCore() {
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    const [u, s] = await Promise.all([getTempUnits(), getTempSummary()]);
    if (u.ok) { setUnits(u.units || []); setIsMgr(u.isManager); }
    if (s.ok) setSummary(s);
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
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
    const r = await addTempUnit(nu.name, nu.kind, Number(nu.min), Number(nu.max), nu.room);
    setBusy(null);
    if (r.ok) { toast(t("temp.unitAdded"), "success"); setNu({ room: nu.room, name: "", kind: "fridge", min: "", max: "" }); loadCore(); }
    else toast(r.error || t("temp.failed"), "error");
  }
  async function doRemoveUnit(u: any) {
    if (!confirm(t("temp.confirmRemove", { name: u.name }))) return;
    setBusy(u.id);
    const r = await removeTempUnit(u.id); setBusy(null);
    if (r.ok) { toast(t("temp.unitRemoved"), "success"); loadCore(); } else toast(r.error || t("temp.failed"), "error");
  }

  const rangeStr = (u: any) => `${u.min_temp}°C … ${u.max_temp}°C`;
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const ROOM_DE: Record<string, string> = { Preparation: "Vorbereitung", Kitchen: "Küche", Storage: "Lager" };
  const roomLabel = (r: string) => (r === "" ? s("Other", "Sonstige") : locale === "de" ? ROOM_DE[r] ?? r : r);
  // Units grouped by room, in the units' own order (sort, name); units without a room last.
  const rooms: [string, any[]][] = [];
  for (const u of units) { const r = u.room ?? ""; const g = rooms.find(([k]) => k === r); if (g) g[1].push(u); else rooms.push([r, [u]]); }
  rooms.sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🌡️" size={22} /> {t("temp.title")}</h1>

      {summary && summary.totalUnits > 0 && (
        <div className={`temp-summary${summary.breachesToday > 0 ? " is-bad" : summary.pending > 0 ? "" : " is-done"}`}>
          <strong>{s("Today", "Heute")}: {summary.doneChecks} / {summary.totalChecks} {s("checks", "Kontrollen")}</strong>
          {summary.breachesToday > 0 && <span className="tone-danger">{t("temp.breachesToday", { n: summary.breachesToday })}</span>}
          <span aria-hidden="true">{summary.breachesToday > 0 ? "⚠️" : summary.pending > 0 ? "🕒" : "✅"}</span>
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
                <div className="card ui-empty-msg">{isMgr ? t("temp.noUnitsMgr") : t("temp.noUnits")}</div>
              ) : rooms.map(([room, list]) => <section key={room} className="temp-room">
                <h2 className="temp-room-title">{roomLabel(room)} <span>{list.filter((u) => u.opening && u.closing).length} / {list.length}</span></h2>
                {list.map((u) => {
                const oor = outOfRange(u, val[u.id] || "");
                const lt = u.latest;
                return (
                  <div key={u.id} className="card ui-item-card">
                    <div className="d-flex jc-sb ai-s gap-3">
                      <div>
                        <div className="ui-strong">{u.name}</div>
                        <div className="ui-muted">{rangeStr(u)}{lt ? <> · <span className={lt.in_range ? "tone-success" : "tone-danger"}>{lt.temp}°C</span></> : null}</div>
                      </div>
                      <div className="temp-slots">
                        <span className={u.opening ? "is-done" : ""}>{u.opening ? "✓ " : ""}{s("Opening", "Öffnung")}</span>
                        <span className={u.closing ? "is-done" : ""}>{u.closing ? "✓ " : ""}{s("Closing", "Schluss")}</span>
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3 ai-c">
                      <input aria-label={`${u.name} °C`} type="number" inputMode="decimal" value={val[u.id] ?? ""} onChange={(e) => setVal((s) => ({ ...s, [u.id]: e.target.value }))}
                        placeholder="°C" style={{ width: 90, padding: "9px 10px", borderRadius: 8, background: "var(--dark2)", color: oor ? "var(--danger)" : "var(--white)", border: `1px solid ${oor ? "rgba(231,76,60,0.5)" : "rgba(255,255,255,0.12)"}`, fontSize: 14, textAlign: "center", fontWeight: 600 }} />
                      <button className="btn-gold" onClick={() => doLog(u)} disabled={busy === u.id}>{busy === u.id ? "…" : t("temp.log")}</button>
                    </div>
                    {oor && (
                      <div className="u-mt-3">
                        <div className="t-xs tone-danger mb-2">⚠️ {t("temp.outOfRange")}</div>
                        <input className="form-input" aria-label={t("temp.correctivePh")} value={action[u.id] ?? ""} onChange={(e) => setAction((s) => ({ ...s, [u.id]: e.target.value }))}
                          placeholder={t("temp.correctivePh")} />
                      </div>
                    )}
                  </div>
                );
              })}</section>)}
            </div>
          )}

          {/* HISTORY */}
          {tab === "history" && (
            <div>
              {logs.length === 0 ? (
                <div className="card ui-empty-msg">{t("temp.noHistory")}</div>
              ) : logs.map((l) => (
                <div key={l.id} className="card ui-item-card">
                  <div className="u-between">
                    <div>
                      <div className="ui-body">{l.unit?.name || "—"} <span className={`fw-7 ${l.in_range ? "tone-success" : "tone-danger"}`.trim()}>{l.temp}°C</span></div>
                      <div className="ui-muted">{fmtWhen(l.recorded_at)}{l.recorded_by_name ? ` · ${l.recorded_by_name}` : ""}</div>
                    </div>
                    <span className={`t-xs fw-6 ${l.in_range ? "tone-success" : "tone-danger"}`.trim()}>{l.in_range ? t("temp.ok") : t("temp.breach")}</span>
                  </div>
                  {l.corrective_action && <div className="t-xs tone-action mt-2">↳ {l.corrective_action}</div>}
                </div>
              ))}
            </div>
          )}

          {/* UNITS (manager) */}
          {tab === "units" && isMgr && (
            <div>
              <div className="card mb-3 p-4">
                <div className="card-title">{t("temp.addUnit")}</div>
                <input className="form-input u-mb-2" aria-label={s("Room", "Raum")} list="temp-rooms" maxLength={40} value={nu.room} onChange={(e) => setNu({ ...nu, room: e.target.value })} placeholder={s("Room", "Raum")} />
                <datalist id="temp-rooms">{["Preparation", "Kitchen", "Storage", ...rooms.map(([r]) => r)].filter((r, i, a) => r && a.indexOf(r) === i).map((r) => <option key={r} value={r} />)}</datalist>
                <input className="form-input u-mb-2" aria-label={t("temp.unitName")} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder={t("temp.unitName")} />
                <select className="form-input u-mb-2" aria-label={t("temp.addUnit")} value={nu.kind} onChange={(e) => setNu({ ...nu, kind: e.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{t("temp.kind_" + k)}</option>)}
                </select>
                <div className="d-flex gap-2 mb-2">
                  <input aria-label={t("temp.minC")} type="number" value={nu.min} onChange={(e) => setNu({ ...nu, min: e.target.value })} placeholder={t("temp.minC")} style={{ flex: 1, padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid var(--border)", fontSize: 13 }} />
                  <input aria-label={t("temp.maxC")} type="number" value={nu.max} onChange={(e) => setNu({ ...nu, max: e.target.value })} placeholder={t("temp.maxC")} style={{ flex: 1, padding: 10, borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid var(--border)", fontSize: 13 }} />
                </div>
                <button className="btn-gold ui-block" onClick={doAddUnit} disabled={busy === "add"}>{busy === "add" ? "…" : t("temp.addUnit")}</button>
              </div>
              {units.map((u) => (
                <div key={u.id} className="card ui-item-card ui-item-head">
                  <div>
                    <div className="ui-body">{u.name}</div>
                    <div className="ui-muted">{u.room ? `${roomLabel(u.room)} · ` : ""}{t("temp.kind_" + u.kind)} · {rangeStr(u)}</div>
                  </div>
                  <button className="ui-icon-btn" type="button" aria-label={`${t("temp.removeUnit")}: ${u.name}`} onClick={() => doRemoveUnit(u)} disabled={busy === u.id} title={t("temp.removeUnit")}><Icon e="🗑" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}