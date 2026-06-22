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
  const [ov, setOv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [copyBusy, setCopyBusy] = useState(false);

  async function loadOverview() {
    setLoading(true);
    const res = await getScheduleOverview();
    if (res.ok) setOv(res);
    else if (res.error?.includes("Managers")) setDenied(true);
    setLoading(false);
  }
  useEffect(() => { loadOverview(); }, []);

  async function copyForward() {
    setCopyBusy(true);
    try {
      const thisWk = await getWeekStart(0);
      const nextWk = await getWeekStart(1);
      const src = await getRoster(thisWk);
      if (!src.ok || !src.roster || Object.keys(src.roster).length === 0) {
        toast(t("schedhub.emptyCopy"), "error");
      } else {
        const res = await saveRoster(nextWk, src.roster);
        if (res.ok) { toast(t("schedhub.copied"), "success"); loadOverview(); }
        else toast(res.error || t("schedhub.copyFailed"), "error");
      }
    } catch {
      toast(t("schedhub.copyFailed"), "error");
    }
    setCopyBusy(false);
  }

  const weekLabel = (() => {
    if (!ov?.weekStart) return "";
    const start = new Date(ov.weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  if (denied) {
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("common.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="📅" size={22} /> {t("schedhub.title")}</div>
      <div className="page-sub">{t("schedhub.subtitle")}</div>

      {/* quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Link href="/announcements" style={quickBtn}>{t("schedhub.broadcast")}</Link>
        <Link href="/noshow" style={quickBtn}>{t("schedhub.reminders")}</Link>
      </div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "roster" ? " active" : ""}`} onClick={() => setTab("roster")}>{t("schedhub.tabRoster")}</button>
        <button className={`hub-tab${tab === "insights" ? " active" : ""}`} onClick={() => setTab("insights")}>{t("schedhub.tabInsights")}</button>
        <button className={`hub-tab${tab === "conflicts" ? " active" : ""}`} onClick={() => setTab("conflicts")}>{t("schedhub.tabConflicts")}</button>
        <button className={`hub-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>{t("schedhub.tabTools")}</button>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* ───────── ROSTER ───────── */}
          {tab === "roster" && (
            <div className="hub-tab-panel active">
              <Link href="/roster" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}><Icon e="📋" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{t("schedhub.openEditor")}</div><div className="feature-sub">{t("schedhub.openEditorSub")}</div></div>
                <span className="feature-chev">›</span>
              </Link>

              {/* This Week panel */}
              <div className="card">
                <div className="card-title">{t("schedhub.upcomingWeek")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <Mini label={t("schedhub.week")} value={weekLabel} small color="var(--white)" />
                  <Mini label={t("schedhub.submissions")} value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color={(ov?.submissionCount ?? 0) > 0 ? "#58d68d" : "#ec7063"} />
                  <Mini label={t("schedhub.statusLabel")} value={ov?.rosterExists ? t("schedhub.built") : t("schedhub.open")} color={ov?.rosterExists ? "#58d68d" : "#e8a35a"} />
                </div>
              </div>

              <Link href="/approvals" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1e8449,#27ae60)" }}><Icon e="✅" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{t("schedhub.requests")}</div><div className="feature-sub">{t("schedhub.requestsSub")}</div></div>
                <span className="feature-chev">›</span>
              </Link>
            </div>
          )}

          {/* ───────── INSIGHTS ───────── */}
          {tab === "insights" && (
            <div className="hub-tab-panel active">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <Mini label={t("schedhub.totalShifts")} value={ov?.totalShifts ?? 0} color="var(--gold)" />
                <Mini label={t("schedhub.submissions")} value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color="#58d68d" />
              </div>

              {(ov?.totalShifts ?? 0) === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>{t("schedhub.noRoster")}</div>
              ) : (
                <>
                  <div className="card">
                    <div className="card-title">{t("schedhub.shiftsByTeam")}</div>
                    {(ov?.byTeamArr || []).map((tm: any) => (
                      <BarRow key={tm.team} label={teamLabel(tm.team)} count={tm.count} max={ov.totalShifts} color="#3498db" />
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">{t("schedhub.mostScheduled")}</div>
                    {(ov?.byPersonArr || []).slice(0, 6).map((p: any) => (
                      <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(128,128,128,0.1)", fontSize: 13 }}>
                        <span style={{ color: "var(--white)" }}>{p.name}</span>
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>{t("schedhub.shiftsCount", { n: p.count })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">{t("schedhub.byDay")}</div>
                    {(ov?.byDayArr || []).map((d: any) => (
                      <BarRow key={d.day} label={dayLabel(d.day)} count={d.count} max={Math.max(1, ...(ov.byDayArr || []).map((x: any) => x.count))} color="#d4a847" />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ───────── CONFLICTS ───────── */}
          {tab === "conflicts" && (
            <div className="hub-tab-panel active">
              {(ov?.conflicts || []).length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 28 }}>
                  <div style={{ marginBottom: 6 }}><Icon e="✅" size={28} color="#58d68d" /></div>
                  <div style={{ color: "#58d68d", fontSize: 14, fontWeight: 600 }}>{t("schedhub.noConflicts")}</div>
                  <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 4 }}>{t("schedhub.noConflictsSub")}</div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-title">{t("schedhub.conflictsToReview", { n: ov.conflicts.length })}</div>
                  {ov.conflicts.map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < ov.conflicts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                      <span style={{ fontSize: 16 }}><Icon e={c.type === "Double-booked" ? "🔁" : "⚠️"} size={15} /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{c.name} <span style={{ color: "var(--gray)", fontWeight: 400, fontSize: 12 }}>· {dayLabel(c.day)}</span></div>
                        <div style={{ fontSize: 11, color: "#e8a35a" }}>{c.type} — {c.detail}</div>
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
            <div className="hub-tab-panel active">
              <Link href="/schedule/compare" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#7d3c98,#af7ac5)" }}><Icon e="📊" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{t("cmp.title")}</div><div className="feature-sub">{t("cmp.subtitle")}</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <Link href="/schedule/shift-times" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1f6f54,#27ae60)" }}><Icon e="⏱️" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{t("shiftcfg.title")}</div><div className="feature-sub">{t("shiftcfg.subtitle")}</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <button onClick={copyForward} disabled={copyBusy} className="feature-card" style={{ width: "100%", textAlign: "left", cursor: copyBusy ? "default" : "pointer", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}><Icon e="📑" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{copyBusy ? t("schedhub.copying") : t("schedhub.copyWeek")}</div><div className="feature-sub">{t("schedhub.copyWeekSub")}</div></div>
                <span className="feature-chev">›</span>
              </button>

              <Link href="/noshow" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#b9770e,#e67e22)" }}><Icon e="📋" size={22} color="#fff" /></div>
                <div style={{ flex: 1 }}><div className="feature-title">{t("schedhub.availCheck")}</div><div className="feature-sub">{t("schedhub.availCheckSub")}</div></div>
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
    <div style={{ background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.12)", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
      <div style={{ fontSize: small ? 14 : 22, fontWeight: 700, fontFamily: "var(--font-display)", color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--gray)", marginTop: 5, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ padding: "7px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: "var(--white)" }}>{label}</span>
        <span style={{ color: "var(--gray)" }}>{count}</span>
      </div>
      <div style={{ height: 6, background: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

const quickBtn: React.CSSProperties = { flex: 1, textAlign: "center", padding: "12px", background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.18)", borderRadius: 12, color: "var(--white)", fontSize: 13, fontWeight: 600, textDecoration: "none" };