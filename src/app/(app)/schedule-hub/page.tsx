"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getScheduleOverview } from "@/lib/queries/schedule-insights";
import { getWeekStart, getRoster, saveRoster } from "@/lib/queries/schedule";

type Tab = "roster" | "team" | "insights" | "conflicts" | "tools";

export default function ScheduleHubPage() {
  const [tab, setTab] = useState<Tab>("roster");
  const [ov, setOv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  async function loadOverview() {
    setLoading(true);
    const res = await getScheduleOverview();
    if (res.ok) setOv(res);
    else if (res.error?.includes("Managers")) setDenied(true);
    setLoading(false);
  }
  useEffect(() => { loadOverview(); }, []);

  async function copyForward() {
    setCopyBusy(true); setCopyMsg(null);
    try {
      const thisWk = await getWeekStart(0);
      const nextWk = await getWeekStart(1);
      const src = await getRoster(thisWk);
      if (!src.ok || !src.roster || Object.keys(src.roster).length === 0) {
        setCopyMsg("This week's roster is empty — nothing to copy.");
      } else {
        const res = await saveRoster(nextWk, src.roster);
        setCopyMsg(res.ok ? "✅ Copied this week's roster to next week." : (res.error || "Copy failed."));
        if (res.ok) loadOverview();
      }
    } catch {
      setCopyMsg("Copy failed.");
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
    return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>Managers only.</div>;
  }

  return (
    <div className="fade-up">
      <div className="page-title">📅 Schedule</div>
      <div className="page-sub">Plan · analyse · fix</div>

      {/* quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Link href="/announcements" style={quickBtn}>📣 Broadcast</Link>
        <Link href="/noshow" style={quickBtn}>🔔 Reminders</Link>
      </div>

      <div className="hub-tabs">
        <button className={`hub-tab${tab === "roster" ? " active" : ""}`} onClick={() => setTab("roster")}>📋 Roster</button>
        <button className={`hub-tab${tab === "team" ? " active" : ""}`} onClick={() => setTab("team")}>👥 Team</button>
        <button className={`hub-tab${tab === "insights" ? " active" : ""}`} onClick={() => setTab("insights")}>📊 Insights</button>
        <button className={`hub-tab${tab === "conflicts" ? " active" : ""}`} onClick={() => setTab("conflicts")}>⚖️ Conflicts</button>
        <button className={`hub-tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>🔧 Tools</button>
      </div>

      {loading ? (
        <div style={{ color: "var(--gray)", fontSize: 13, padding: 24, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…</div>
      ) : (
        <>
          {/* ───────── ROSTER ───────── */}
          {tab === "roster" && (
            <div className="hub-tab-panel active">
              <Link href="/roster" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}>📋</div>
                <div style={{ flex: 1 }}><div className="feature-title">Open Roster Editor</div><div className="feature-sub">Build &amp; publish next week&apos;s schedule</div></div>
                <span className="feature-chev">›</span>
              </Link>

              {/* This Week panel */}
              <div className="card">
                <div className="card-title">Upcoming Week</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <Mini label="Week" value={weekLabel} small color="var(--white)" />
                  <Mini label="Submissions" value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color={(ov?.submissionCount ?? 0) > 0 ? "#58d68d" : "#ec7063"} />
                  <Mini label="Status" value={ov?.rosterExists ? "Built" : "Open"} color={ov?.rosterExists ? "#58d68d" : "#e8a35a"} />
                </div>
              </div>

              <Link href="/approvals" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1e8449,#27ae60)" }}>✅</div>
                <div style={{ flex: 1 }}><div className="feature-title">Requests</div><div className="feature-sub">Leave &amp; shift-swap approvals</div></div>
                <span className="feature-chev">›</span>
              </Link>
            </div>
          )}

          {/* ───────── TEAM ───────── */}
          {tab === "team" && (
            <div className="hub-tab-panel active">
              <Link href="/staff" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}>👥</div>
                <div style={{ flex: 1 }}><div className="feature-title">Staff Management</div><div className="feature-sub">Profiles, contracts &amp; accounts</div></div>
                <span className="feature-chev">›</span>
              </Link>
              <Link href="/directory" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#2c3e50,#34495e)" }}>📇</div>
                <div style={{ flex: 1 }}><div className="feature-title">Team Directory</div><div className="feature-sub">Browse &amp; contact everyone</div></div>
                <span className="feature-chev">›</span>
              </Link>
              <Link href="/notes" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#922b21,#c0392b)" }}>📝</div>
                <div style={{ flex: 1 }}><div className="feature-title">Notes &amp; Recognition</div><div className="feature-sub">Performance notes &amp; shout-outs</div></div>
                <span className="feature-chev">›</span>
              </Link>
            </div>
          )}

          {/* ───────── INSIGHTS ───────── */}
          {tab === "insights" && (
            <div className="hub-tab-panel active">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <Mini label="Total Shifts" value={ov?.totalShifts ?? 0} color="var(--gold)" />
                <Mini label="Submissions" value={`${ov?.submissionCount ?? 0}/${ov?.staffCount ?? 0}`} color="#58d68d" />
              </div>

              {(ov?.totalShifts ?? 0) === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 28, fontSize: 13 }}>No roster built for next week yet.</div>
              ) : (
                <>
                  <div className="card">
                    <div className="card-title">Shifts by Team</div>
                    {(ov?.byTeamArr || []).map((t: any) => (
                      <BarRow key={t.team} label={t.team} count={t.count} max={ov.totalShifts} color="#3498db" />
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">Most Scheduled</div>
                    {(ov?.byPersonArr || []).slice(0, 6).map((p: any) => (
                      <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(128,128,128,0.1)", fontSize: 13 }}>
                        <span style={{ color: "var(--white)" }}>{p.name}</span>
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>{p.count} shift{p.count !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div className="card-title">By Day</div>
                    {(ov?.byDayArr || []).map((d: any) => (
                      <BarRow key={d.day} label={d.day} count={d.count} max={Math.max(1, ...(ov.byDayArr || []).map((x: any) => x.count))} color="#d4a847" />
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
                  <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>
                  <div style={{ color: "#58d68d", fontSize: 14, fontWeight: 600 }}>No conflicts</div>
                  <div style={{ color: "var(--gray)", fontSize: 12, marginTop: 4 }}>Everyone&apos;s scheduled within their availability, no double-bookings.</div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-title">{ov.conflicts.length} Conflict{ov.conflicts.length !== 1 ? "s" : ""} to Review</div>
                  {ov.conflicts.map((c: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < ov.conflicts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                      <span style={{ fontSize: 16 }}>{c.type === "Double-booked" ? "🔁" : "⚠️"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--white)" }}>{c.name} <span style={{ color: "var(--gray)", fontWeight: 400, fontSize: 12 }}>· {c.day}</span></div>
                        <div style={{ fontSize: 11, color: "#e8a35a" }}>{c.type} — {c.detail}</div>
                      </div>
                    </div>
                  ))}
                  <Link href="/roster" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 13, color: "var(--gold)", textDecoration: "none" }}>Open Roster Editor to fix →</Link>
                </div>
              )}
            </div>
          )}

          {/* ───────── TOOLS ───────── */}
          {tab === "tools" && (
            <div className="hub-tab-panel active">
              <Link href="/roster" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}>📋</div>
                <div style={{ flex: 1 }}><div className="feature-title">Open Roster Editor</div><div className="feature-sub">Full editing view</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <button onClick={copyForward} disabled={copyBusy} className="feature-card" style={{ width: "100%", textAlign: "left", cursor: copyBusy ? "default" : "pointer", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#6b2fa0,#9b59b6)" }}>📑</div>
                <div style={{ flex: 1 }}><div className="feature-title">{copyBusy ? "Copying…" : "Copy This Week → Next"}</div><div className="feature-sub">Duplicate the current roster forward</div></div>
                <span className="feature-chev">›</span>
              </button>
              {copyMsg && <div style={{ fontSize: 13, color: "var(--gold)", textAlign: "center", marginBottom: 10 }}>{copyMsg}</div>}

              <Link href="/export" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#117a65,#16a085)" }}>📤</div>
                <div style={{ flex: 1 }}><div className="feature-title">Payroll Export</div><div className="feature-sub">Monthly hours per staff — CSV</div></div>
                <span className="feature-chev">›</span>
              </Link>

              <Link href="/noshow" className="feature-card">
                <div className="feature-icon" style={{ background: "linear-gradient(135deg,#b9770e,#e67e22)" }}>📋</div>
                <div style={{ flex: 1 }}><div className="feature-title">Availability Check</div><div className="feature-sub">Who hasn&apos;t submitted for next week</div></div>
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