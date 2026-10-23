"use client";

import { serverText } from "@/lib/i18n/serverMessages";
import { toast } from "@/components/Toast";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getMyShifts, getWeekStart, getStaffForSwap, submitSwap, getMySwaps,
} from "@/lib/queries/schedule";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TEAM_COLORS: Record<string, string> = {
  Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)",
};

export default function SchedulePage() {
  const { t, locale } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [tab, setTab] = useState<"my" | "request" | "mine">("my");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayName, setTodayName] = useState("");

  // swap form
  const [staff, setStaff] = useState<any[]>([]);
  const [myDay, setMyDay] = useState("");
  const [otherId, setOtherId] = useState("");
  const [otherDay, setOtherDay] = useState("");
  const [swapMsg, setSwapMsg] = useState<string | null>(null);
  const [mySwaps, setMySwaps] = useState<any[]>([]);

  async function loadShifts(offset: number) {
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    setLoading(true);
    const ws = await getWeekStart(offset);
    const res = await getMyShifts(ws);
    if (res.ok) { setShifts(res.shifts || []); setWeekStart(res.weekStart || ""); }
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const d = new Date();
    setTodayName(DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]);
    loadShifts(0);
    getStaffForSwap().then((r) => r.ok && setStaff(r.staff || []));
  }, []);

  function changeWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    loadShifts(next);
  }

  async function loadSwaps() {
    const r = await getMySwaps();
    if (r.ok) setMySwaps(r.swaps || []);
  }

  async function doSubmitSwap() {
    setSwapMsg(null);
    const r = await submitSwap(myDay, otherId, otherDay);
    if (r.ok) { setSwapMsg(t("shifts.swapSubmitted")); setMyDay(""); setOtherId(""); setOtherDay(""); }
    else setSwapMsg(serverText(r.error ?? "", locale) || t("shifts.swapFailed"));
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString([], { day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="📅" size={22} /> {t("shifts.title")}</h1>
      <div className="page-sub">{weekLabel || t("common.loading")}</div>

      <Link href="/cover" className="card" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", margin: "12px 0" }}>
        <Icon e="🔁" size={20} color="var(--action)" />
        <div className="u-flex1">
          <div className="ui-strong">{t("cover.title")}</div>
          <div className="ui-muted">{t("cover.navSub")}</div>
        </div>
        <span className="feature-chev">›</span>
      </Link>

      {/* TABS */}
      <div className="hub-tabs">
        <button className={`hub-tab${tab === "my" ? " active" : ""}`} onClick={() => setTab("my")}>{t("shifts.tabMy")}</button>
        <button className={`hub-tab${tab === "request" ? " active" : ""}`} onClick={() => setTab("request")}>{t("shifts.tabRequest")}</button>
        <button className={`hub-tab${tab === "mine" ? " active" : ""}`} onClick={() => { setTab("mine"); loadSwaps(); }}>{t("shifts.tabMine")}</button>
      </div>

      {/* MY SHIFTS */}
      {tab === "my" && (
        <div className="hub-tab-panel active">
          {/* week nav */}
          <div className="d-flex jc-sb ai-c mb-3">
            <button className="btn-secondary ui-btn-sm" onClick={() => changeWeek(-1)}>{t("shifts.prev")}</button>
            <span className="t-sm tone-action fw-6">{weekOffset === 0 ? t("shifts.thisWeek") : weekOffset > 0 ? t("shifts.weeksPlus", { n: weekOffset }) : t("shifts.weeksMinus", { n: weekOffset })}</span>
            <button className="btn-secondary ui-btn-sm" onClick={() => changeWeek(1)}>{t("shifts.next")}</button>
          </div>

          {/* week strip */}
          <div className="card mb-3">
            <div className="card-title">{t("shifts.thisWeekTitle")}</div>
            <div className="d-flex jc-sb gap-1">
              {DAYS.map((d) => {
                const has = shifts.some((s) => s.day === d);
                const isToday = d === todayName && weekOffset === 0;
                return (
                  <div key={d} style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRadius: 8, background: isToday ? "var(--accent-soft)" : "transparent" }}>
                    <div style={{ fontSize: 12, color: isToday ? "var(--action)" : "var(--gray)", fontWeight: isToday ? 700 : 400 }}>{dayLabel(d)[0]}</div>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", margin: "6px auto 0", background: has ? "#27ae60" : "rgba(128,128,128,0.25)" }} />
                  </div>
                );
              })}
            </div>
            <div className="t-xs u-muted mt-2 u-center">
              {t("shifts.shiftsAssigned", { n: shifts.length })}
            </div>
          </div>

          {/* shifts list */}
          {loading ? (
            <CardSkeleton rows={3} />
          ) : shifts.length === 0 ? (
            <div className="card ui-empty-msg">
              <div className="u-mb-2"><Icon e="🗓" size={28} color="var(--gray)" /></div>{t("shifts.noShifts")}
            </div>
          ) : (
            <div className="card">
              <div className="card-title">{t("shifts.yourShifts")}</div>
              {shifts.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < shifts.length - 1 ? "1px solid rgba(128,128,128,0.12)" : "none" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEAM_COLORS[s.team] || "#888", flexShrink: 0 }} />
                  <div className="u-flex1">
                    <div className="ui-strong">{dayLabel(s.day)}</div>
                    <div className="ui-muted">{teamLabel(s.team)} · {s.shift}</div>
                  </div>
                  <div className="t-sm tone-action fw-6">{s.time || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUEST SWAP */}
      {tab === "request" && (
        <div className="hub-tab-panel active">
          <div className="card">
            <div className="t-lg fw-7 mb-2 u-text">{t("shifts.requestSwapTitle")}</div>
            <div className="t-xs u-muted mb-4">{t("shifts.requestSwapSub")}</div>
            <Field label={t("shifts.yourDayGive")}>
              <select value={myDay} onChange={(e) => setMyDay(e.target.value)} style={select}>
                <option value="">{t("shifts.selectDay")}</option>
                {DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </Field>
            <Field label={t("shifts.swapWith")}>
              <select value={otherId} onChange={(e) => setOtherId(e.target.value)} style={select}>
                <option value="">{t("shifts.selectColleague")}</option>
                {staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
            <Field label={t("shifts.theirDay")}>
              <select value={otherDay} onChange={(e) => setOtherDay(e.target.value)} style={select}>
                <option value="">{t("shifts.selectDay")}</option>
                {DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </Field>
            <button className="btn-gold ui-block" onClick={doSubmitSwap}>{t("shifts.submitSwap")}</button>
            {swapMsg && <div className="mt-3 t-sm tone-action u-center">{swapMsg}</div>}
          </div>
        </div>
      )}

      {/* MY REQUESTS */}
      {tab === "mine" && (
        <div className="hub-tab-panel active">
          {mySwaps.length === 0 ? (
            <div className="card ui-empty-msg">{t("shifts.noSwaps")}</div>
          ) : (
            mySwaps.map((sw) => (
              <div key={sw.id} className="card u-mb-2">
                <div className="u-between">
                  <div className="t-md u-text">{t("shifts.give")} <b>{dayLabel(sw.my_day)}</b> → {t("shifts.get")} <b>{dayLabel(sw.their_day)}</b></div>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: sw.status === "approved" ? "rgba(39,174,96,0.15)" : sw.status === "denied" ? "rgba(231,76,60,0.15)" : "var(--accent-soft)", color: sw.status === "approved" ? "var(--success)" : sw.status === "denied" ? "var(--danger)" : "var(--action)" }}>
                    {t("shifts.status_" + sw.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const select: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };