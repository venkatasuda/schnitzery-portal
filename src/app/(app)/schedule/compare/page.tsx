"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { getScheduleComparison } from "@/lib/queries/schedule-compare";
import { CardSkeleton } from "@/components/Skeleton";
import { Stat as UiStat } from "@/components/ui";

function mondayOf(offset: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmtMins = (m: number) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h ${mm}m` : `${mm}m`; };
const fmtClock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
const pctColor = (p: number) => (p >= 95 ? "var(--success)" : p >= 80 ? "var(--warn)" : "var(--danger)");

export default function ComparePage() {
  const { t } = useLang();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  async function load(off: number) {
    setLoading(true);
    const res = await getScheduleComparison(mondayOf(off));
    if (!res.ok && res.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
    if (res.ok) setData(res);
    setLoading(false);
  }
  useEffect(() => { load(offset); }, [offset]);

  const statusMeta: Record<string, { key: string; color: string }> = {
    ontime: { key: "cmp.ontime", color: "var(--success)" },
    late: { key: "cmp.lateStatus", color: "var(--warn)" },
    left_early: { key: "cmp.leftEarly", color: "var(--warn)" },
    no_show: { key: "cmp.noShow", color: "var(--danger)" },
    unscheduled: { key: "cmp.unscheduled", color: "var(--info)" },
    active: { key: "cmp.active", color: "#48c9b0" },
  };
  const weekLabel = (() => {
    const s = new Date(mondayOf(offset) + "T12:00:00"); const e = new Date(s); e.setDate(e.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(s)} – ${f(e)}`;
  })();

  if (denied) return <div className="card ui-denied">{t("cmp.denied")}</div>;

  const sum = data?.summary;
  const rows: any[] = data?.rows || [];
  const byEmp: any[] = data?.byEmployee || [];

  // group detail rows by date
  const byDate: Record<string, any[]> = {};
  for (const r of rows) (byDate[r.date] ||= []).push(r);
  const dates = Object.keys(byDate).sort();

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📊" size={22} /> {t("cmp.title")}</h1>
      <div className="page-sub">{t("cmp.subtitle")}</div>

      {/* week nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px" }}>
        <button className="btn-secondary ui-btn-sm" onClick={() => setOffset((o) => o - 1)}>{t("cmp.prevWeek")}</button>
        <div className="u-flex1 u-center">
          <div className="t-sm fw-7 u-text">{weekLabel}</div>
          {offset !== 0 && <button onClick={() => setOffset(0)} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, cursor: "pointer", marginTop: 2 }}>{t("cmp.thisWeek")}</button>}
        </div>
        <button className="btn-secondary ui-btn-sm" onClick={() => setOffset((o) => o + 1)}>{t("cmp.nextWeek")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : !sum || (sum.shifts === 0 && sum.unscheduled === 0) ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, fontSize: 13 }}>{t("cmp.noData")}</div>
      ) : (
        <>
          {/* SUMMARY */}
          <div className="card p-4 mb-4">
            <div className="d-flex ai-c gap-4">
              <div style={{ textAlign: "center", minWidth: 92 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: pctColor(sum.pct), lineHeight: 1 }}>{sum.pct}%</div>
                <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{t("cmp.overall")}</div>
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 12px", fontSize: 12 }}>
                <Stat label={t("cmp.shifts")} value={String(sum.shifts)} />
                <Stat label={t("cmp.noShows")} value={String(sum.noShows)} color={sum.noShows ? "var(--danger)" : undefined} />
                <Stat label={t("cmp.late")} value={fmtMins(sum.lateMins)} />
                <Stat label={t("cmp.overtime")} value={fmtMins(sum.otMins)} />
                <Stat label={t("cmp.missing")} value={fmtMins(sum.missingMins)} color={sum.missingMins ? "var(--warn)" : undefined} />
                <Stat label={t("cmp.unscheduled")} value={String(sum.unscheduled)} />
              </div>
            </div>
          </div>

          {/* BY EMPLOYEE */}
          {byEmp.length > 0 && (
            <>
              <div className="section-label">{t("cmp.perEmployee")}</div>
              <div className="d-flex f-col gap-2 mb-4">
                {byEmp.map((e) => (
                  <div key={e.userId} className="card p-3">
                    <div className="d-flex ai-c gap-3 mb-2">
                      <div className="u-flex1 t-sm fw-6 u-text">{e.name}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: pctColor(e.pct) }}>{e.pct}%</div>
                    </div>
                    <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ width: `${e.pct}%`, height: "100%", background: pctColor(e.pct) }} />
                    </div>
                    <div className="d-flex f-wrap gap-2 t-xs">
                      <Chip label={`${e.shifts} ${t("cmp.shifts")}`} />
                      {e.noShows > 0 && <Chip label={`${e.noShows} ${t("cmp.noShow")}`} color="var(--danger)" />}
                      {e.lateMins > 0 && <Chip label={`${t("cmp.late")} ${fmtMins(e.lateMins)}`} color="var(--warn)" />}
                      {e.otMins > 0 && <Chip label={`${t("cmp.overtime")} ${fmtMins(e.otMins)}`} color="var(--info)" />}
                      {e.missingMins > 0 && <Chip label={`${t("cmp.missing")} ${fmtMins(e.missingMins)}`} color="var(--warn)" />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* DETAIL BY DAY */}
          {dates.map((date) => (
            <div className="u-mb-3" key={date}>
              <div className="section-label">{fmtDay(date)}</div>
              <div className="u-stack tight">
                {byDate[date].map((r, i) => {
                  const m = statusMeta[r.status] || statusMeta.ontime;
                  return (
                    <div key={i} className="card" style={{ padding: 12, borderLeft: `3px solid ${m.color}` }}>
                      <div className="u-row">
                        <div className="u-grow">
                          <div className="t-sm fw-6 u-text">{r.name}</div>
                          <div className="ui-muted">{r.team && r.shift ? `${r.team} · ${r.shift}` : t("cmp.unscheduled")}</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{t(m.key)}</span>
                      </div>
                      <div className="d-flex gap-4 mt-2 t-xs">
                        {r.schedStart && (
                          <div><span style={{ color: "var(--gray)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("cmp.scheduled")}</span><br /><span className="u-text">{fmtClock(r.schedStart)} – {fmtClock(r.schedEnd)}</span></div>
                        )}
                        <div><span style={{ color: "var(--gray)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("cmp.actual")}</span><br /><span className="u-text">{fmtClock(r.actIn)} – {fmtClock(r.actOut)}</span></div>
                      </div>
                      {(r.lateMins > 0 || r.earlyMins > 0 || r.otMins > 0 || r.missingMins > 0) && (
                        <div className="d-flex f-wrap gap-2 mt-2 t-xs">
                          {r.lateMins > 0 && <Chip label={`${t("cmp.late")} ${fmtMins(r.lateMins)}`} color="var(--warn)" />}
                          {r.earlyMins > 0 && <Chip label={`${t("cmp.early")} ${fmtMins(r.earlyMins)}`} color="var(--warn)" />}
                          {r.otMins > 0 && <Chip label={`${t("cmp.overtime")} ${fmtMins(r.otMins)}`} color="var(--info)" />}
                          {r.missingMins > 0 && <Chip label={`${t("cmp.missing")} ${fmtMins(r.missingMins)}`} color="var(--danger)" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <Link href="/schedule-hub" style={{ display: "block", textAlign: "center", marginTop: 8, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← {t("schedhub.title")}</Link>
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return <span style={{ color: color || "var(--gray)", background: color ? `color-mix(in srgb, ${color} 14%, transparent)` : "rgba(128,128,128,0.12)", padding: "2px 8px", borderRadius: 14, fontWeight: 600 }}>{label}</span>;
}


function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <UiStat variant="row" label={label} value={value} color={color} />;
}
