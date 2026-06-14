"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getScheduleComparison } from "@/lib/queries/schedule-compare";
import { CardSkeleton } from "@/components/Skeleton";

function mondayOf(offset: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmtMins = (m: number) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h ${mm}m` : `${mm}m`; };
const fmtClock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
const pctColor = (p: number) => (p >= 95 ? "#58d68d" : p >= 80 ? "#e8a35a" : "#ec7063");

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
    ontime: { key: "cmp.ontime", color: "#58d68d" },
    late: { key: "cmp.lateStatus", color: "#e8a35a" },
    left_early: { key: "cmp.leftEarly", color: "#e67e22" },
    no_show: { key: "cmp.noShow", color: "#ec7063" },
    unscheduled: { key: "cmp.unscheduled", color: "#5dade2" },
    active: { key: "cmp.active", color: "#48c9b0" },
  };
  const weekLabel = (() => {
    const s = new Date(mondayOf(offset) + "T12:00:00"); const e = new Date(s); e.setDate(e.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(s)} – ${f(e)}`;
  })();

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("cmp.denied")}</div>;

  const sum = data?.summary;
  const rows: any[] = data?.rows || [];
  const byEmp: any[] = data?.byEmployee || [];

  // group detail rows by date
  const byDate: Record<string, any[]> = {};
  for (const r of rows) (byDate[r.date] ||= []).push(r);
  const dates = Object.keys(byDate).sort();

  return (
    <div className="fade-up">
      <div className="page-title">📊 {t("cmp.title")}</div>
      <div className="page-sub">{t("cmp.subtitle")}</div>

      {/* week nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 14px" }}>
        <button onClick={() => setOffset((o) => o - 1)} style={navBtn}>{t("cmp.prevWeek")}</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)" }}>{weekLabel}</div>
          {offset !== 0 && <button onClick={() => setOffset(0)} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, cursor: "pointer", marginTop: 2 }}>{t("cmp.thisWeek")}</button>}
        </div>
        <button onClick={() => setOffset((o) => o + 1)} style={navBtn}>{t("cmp.nextWeek")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : !sum || (sum.shifts === 0 && sum.unscheduled === 0) ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, fontSize: 13 }}>{t("cmp.noData")}</div>
      ) : (
        <>
          {/* SUMMARY */}
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center", minWidth: 92 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: pctColor(sum.pct), lineHeight: 1 }}>{sum.pct}%</div>
                <div style={{ fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{t("cmp.overall")}</div>
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 12 }}>
                <Stat label={t("cmp.shifts")} value={String(sum.shifts)} />
                <Stat label={t("cmp.noShows")} value={String(sum.noShows)} color={sum.noShows ? "#ec7063" : undefined} />
                <Stat label={t("cmp.late")} value={fmtMins(sum.lateMins)} />
                <Stat label={t("cmp.overtime")} value={fmtMins(sum.otMins)} />
                <Stat label={t("cmp.missing")} value={fmtMins(sum.missingMins)} color={sum.missingMins ? "#e8a35a" : undefined} />
                <Stat label={t("cmp.unscheduled")} value={String(sum.unscheduled)} />
              </div>
            </div>
          </div>

          {/* BY EMPLOYEE */}
          {byEmp.length > 0 && (
            <>
              <div className="section-label">{t("cmp.perEmployee")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {byEmp.map((e) => (
                  <div key={e.userId} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{e.name}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: pctColor(e.pct) }}>{e.pct}%</div>
                    </div>
                    <div style={{ height: 6, background: "rgba(128,128,128,0.18)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ width: `${e.pct}%`, height: "100%", background: pctColor(e.pct) }} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
                      <Chip label={`${e.shifts} ${t("cmp.shifts")}`} />
                      {e.noShows > 0 && <Chip label={`${e.noShows} ${t("cmp.noShow")}`} color="#ec7063" />}
                      {e.lateMins > 0 && <Chip label={`${t("cmp.late")} ${fmtMins(e.lateMins)}`} color="#e8a35a" />}
                      {e.otMins > 0 && <Chip label={`${t("cmp.overtime")} ${fmtMins(e.otMins)}`} color="#5dade2" />}
                      {e.missingMins > 0 && <Chip label={`${t("cmp.missing")} ${fmtMins(e.missingMins)}`} color="#e67e22" />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* DETAIL BY DAY */}
          {dates.map((date) => (
            <div key={date} style={{ marginBottom: 12 }}>
              <div className="section-label">{fmtDay(date)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byDate[date].map((r, i) => {
                  const m = statusMeta[r.status] || statusMeta.ontime;
                  return (
                    <div key={i} className="card" style={{ padding: 12, borderLeft: `3px solid ${m.color}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "var(--gray)" }}>{r.team && r.shift ? `${r.team} · ${r.shift}` : t("cmp.unscheduled")}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: `${m.color}22`, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{t(m.key)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12 }}>
                        {r.schedStart && (
                          <div><span style={{ color: "var(--gray)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("cmp.scheduled")}</span><br /><span style={{ color: "var(--white)" }}>{fmtClock(r.schedStart)} – {fmtClock(r.schedEnd)}</span></div>
                        )}
                        <div><span style={{ color: "var(--gray)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("cmp.actual")}</span><br /><span style={{ color: "var(--white)" }}>{fmtClock(r.actIn)} – {fmtClock(r.actOut)}</span></div>
                      </div>
                      {(r.lateMins > 0 || r.earlyMins > 0 || r.otMins > 0 || r.missingMins > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, fontSize: 11 }}>
                          {r.lateMins > 0 && <Chip label={`${t("cmp.late")} ${fmtMins(r.lateMins)}`} color="#e8a35a" />}
                          {r.earlyMins > 0 && <Chip label={`${t("cmp.early")} ${fmtMins(r.earlyMins)}`} color="#e67e22" />}
                          {r.otMins > 0 && <Chip label={`${t("cmp.overtime")} ${fmtMins(r.otMins)}`} color="#5dade2" />}
                          {r.missingMins > 0 && <Chip label={`${t("cmp.missing")} ${fmtMins(r.missingMins)}`} color="#ec7063" />}
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ color: "var(--gray)" }}>{label}</span>
      <span style={{ color: color || "var(--white)", fontWeight: 700 }}>{value}</span>
    </div>
  );
}
function Chip({ label, color }: { label: string; color?: string }) {
  return <span style={{ color: color || "var(--gray)", background: color ? `${color}22` : "rgba(128,128,128,0.12)", padding: "2px 8px", borderRadius: 14, fontWeight: 600 }}>{label}</span>;
}

const navBtn: React.CSSProperties = { padding: "8px 12px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.18)", borderRadius: 10, color: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer" };