"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import { getWeekStart, getRoster, saveRoster } from "@/lib/queries/schedule";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

type Tab = "roster" | "insights" | "conflicts" | "tools";

export default function ScheduleHubPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const dayLabel = (k: string) => (k && ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].includes(String(k).toLowerCase()) ? t("days." + String(k).toLowerCase()) : k);
  const [tab, setTab] = useState<Tab>("roster");
  const [error, setError] = useState<string | null>(null);
  const [ov, setOv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [copyBusy, setCopyBusy] = useState(false);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
    const res = await getScheduleOverview();
    if (res.ok) setOv(res);
    else if (res.error?.includes("Managers")) setDenied(true);
    else setError(res.error || t("common.error"));
    } catch { setError(t("common.error")); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadOverview(); }, []);

  async function copyForward() {
    setCopyBusy(true);
    try {
      const thisWk = await getWeekStart(0);
      const nextWk = await getWeekStart(1);
      const [src,target] = await Promise.all([getRoster(thisWk),getRoster(nextWk)]);
      if(!target.ok)throw Error(target.error);
      if(Object.values(target.roster||{}).some(rows=>Array.isArray(rows)&&rows.length>0)) { toast(t("schedhub.copyExists"),"error"); return; }
      if (!src.ok || !src.roster || !Object.values(src.roster).some(rows=>Array.isArray(rows)&&rows.length>0)) {
        toast(t("schedhub.emptyCopy"), "error");
      } else {
        const res = await saveRoster(nextWk, src.roster, target.expected || null);
        if (res.ok) { toast(t("schedhub.copied"), "success"); loadOverview(); }
        else toast(res.error || t("schedhub.copyFailed"), "error");
      }
    } catch {
      toast(t("schedhub.copyFailed"), "error");
    }
    finally { setCopyBusy(false); }
  }

  const weekLabel = (() => {
    if (!ov?.weekStart) return "";
    const start = new Date(ov.weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  if (denied) {
    return <div className="card ui-denied">{t("common.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📅" size={22} /> {t("schedhub.title")}</h1>
      <div className="page-sub">{t("schedhub.subtitle")}</div>

      {/* quick actions */}
      <div className="workspace-toolbar">
        <Link href="/roster" className="workspace-button primary">{t("schedhub.openEditor")}</Link>
        <Link href="/announcements" style={quickBtn}>{t("schedhub.broadcast")}</Link>
        <Link href="/cover" style={quickBtn}>{t("schedhub.covers")}</Link>
        <Link href="/noshow" style={quickBtn}>{t("schedhub.reminders")}</Link>
      </div>

      <div className="hub-tabs" role="group" aria-label={t("schedhub.title")}>
        <button aria-pressed={tab === "roster"} className={`hub-tab${tab === "roster" ? " active" : ""}`} onClick={() => setTab("roster")}>{t("schedhub.tabRoster")}</button>
        <button aria-pressed={tab === "insights"} className={`hub-tab${tab === "insights" ? " active" : ""}`} onClick={() => setTab("insights")}>{t("schedhub.tabInsights")}</button>
        <button aria-pressed={tab === "conflicts"} className={`hub-tab${tab === "conflicts" ? " active" : ""}`} onClick={() => setTab("conflicts")}>{t("schedhub.tabConflicts")}</button>
        <button aria-pressed={tab === "tools"} className={`hub-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>{t("schedhub.tabTools")}</button>
      </div>

      {error ? (<div className="workspace-error" role="alert"><p>{error}</p><button className="workspace-button" onClick={loadOverview}>{t("analytics.retry")}</button></div>) : loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* ───────── ROSTER ───────── */}
          {tab === "roster" && (
            <div className="hub-tab-panel active">
              <h2 className="card-title">{t("schedhub.upcomingWeek")}</h2>
              <div className="workspace-stats">
                <Mini label={t("schedhub.week")} value={weekLabel} small color="var(--white)" />
                <Mini label={t("schedhub.submissions")} value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color="var(--white)" />
                <Mini label={t("schedhub.statusLabel")} value={ov?.rosterExists ? t("schedhub.built") : t("schedhub.open")} color={ov?.rosterExists ? "var(--success)" : "var(--warn)"} />
              </div>
            </div>
          )}

          {/* ───────── INSIGHTS ───────── */}
          {tab === "insights" && (
            <div className="hub-tab-panel active workspace-grid">
              <div className="workspace-stats">
                <Mini label={t("schedhub.totalShifts")} value={ov?.totalShifts ?? 0} color="var(--gold)" />
                <Mini label={t("schedhub.submissions")} value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color="var(--success)" />
              </div>

              {(ov?.totalShifts ?? 0) === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>{t("schedhub.noRoster")}</div>
              ) : (
                <>
                  <div className="card">
                    <div className="card-title">{t("schedhub.shiftsByTeam")}</div>
                    {(ov?.byTeamArr || []).map((tm: any) => (
                      <BarRow key={tm.team} label={teamLabel(tm.team)} count={tm.count} max={ov.totalShifts} color="var(--gold)" />
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">{t("schedhub.mostScheduled")}</div>
                    {(ov?.byPersonArr || []).slice(0, 6).map((p: any) => (
                      <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                        <span className="u-text">{p.name}</span>
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>{t("schedhub.shiftsCount", { n: p.count })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">{t("schedhub.byDay")}</div>
                    {(ov?.byDayArr || []).map((d: any) => (
                      <BarRow key={d.day} label={dayLabel(d.day)} count={d.count} max={Math.max(1, ...(ov.byDayArr || []).map((x: any) => x.count))} color="var(--gold)" />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ───────── CONFLICTS ───────── */}
          {tab === "conflicts" && (
            <div className="hub-tab-panel active workspace-grid">
              {(ov?.conflicts || []).length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 28 }}>
                  <div className="u-mb-2"><Icon e="✅" size={28} color="var(--success)" /></div>
                  <div style={{ color: "var(--success)", fontSize: 14, fontWeight: 600 }}>{t("schedhub.noConflicts")}</div>
                  <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 4 }}>{t("schedhub.noConflictsSub")}</div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-title">{t("schedhub.conflictsToReview", { n: ov.conflicts.length })}</div>
                  {ov.conflicts.map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < ov.conflicts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                      <span style={{ fontSize: 16 }}><Icon e={c.type === "Double-booked" ? "🔁" : "⚠️"} size={15} /></span>
                      <div className="u-flex1">
                        <div className="ui-strong">{c.name} <span style={{ color: "var(--gray)", fontWeight: 400, fontSize: 12 }}>· {dayLabel(c.day)}</span></div>
                        <div style={{ fontSize: 12, color: "var(--warn)" }}>{c.type} — {c.detail}</div>
                      </div>
                    </div>
                  ))}
                  <Link href="/roster" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 13, color: "var(--gold)", textDecoration: "none" }}>{t("schedhub.openEditorFix")}</Link>
                </div>
              )}
            </div>
          )}

          {/* ───────── TOOLS ───────── */}
          {tab === "tools" && (
            <div className="hub-tab-panel active workspace-grid">
              <Link href="/schedule/compare" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#7d3c98,#af7ac5)" }}><Icon e="📊" size={22} color="#fff" /></div>
                <div className="u-flex1"><div className="feature-title">{t("cmp.title")}</div><div className="feature-sub">{t("cmp.subtitle")}</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <Link href="/schedule/shift-times" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1f6f54,#27ae60)" }}><Icon e="⏱️" size={22} color="#fff" /></div>
                <div className="u-flex1"><div className="feature-title">{t("shiftcfg.title")}</div><div className="feature-sub">{t("shiftcfg.subtitle")}</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <button onClick={copyForward} disabled={copyBusy} className="feature-card" style={{ width: "100%", textAlign: "left", cursor: copyBusy ? "default" : "pointer", border: "1px solid var(--border)" }}>
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}><Icon e="📑" size={22} color="#fff" /></div>
                <div className="u-flex1"><div className="feature-title">{copyBusy ? t("schedhub.copying") : t("schedhub.copyWeek")}</div><div className="feature-sub">{t("schedhub.copyWeekSub")}</div></div>
                <span className="feature-chev">›</span>
              </button>

              <Link href="/noshow?tab=missing" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#b9770e,#e67e22)" }}><Icon e="📋" size={22} color="#fff" /></div>
                <div className="u-flex1"><div className="feature-title">{t("schedhub.availCheck")}</div><div className="feature-sub">{t("schedhub.availCheckSub")}</div></div>
                <span className="feature-chev">›</span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Mini({ label, value, color, small }: { label: string; value: string | number; color: string; small?: boolean }) {
  return (
    <div className="workspace-stat">
      <strong style={{ color, fontSize: small ? 20 : undefined }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ padding: "7px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span className="u-text">{label}</span>
        <span className="u-muted">{count}</span>
      </div>
      <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

const quickBtn: React.CSSProperties = { flex: 1, textAlign: "center", padding: "12px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--white)", fontSize: 13, fontWeight: 600, textDecoration: "none" };
