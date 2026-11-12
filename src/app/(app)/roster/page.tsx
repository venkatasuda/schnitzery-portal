"use client";
import ActionsMenu from "@/components/ActionsMenu";

import { appLocale } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import { getRoster, saveRoster, getWeekStart, publishRoster, discardRosterDraft } from "@/lib/queries/schedule";
import { SHIFT_MODEL, TEAMS } from "@/lib/queries/schedule-constants";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { PageHeader,  Field } from "@/components/ui";
import RosterLabourPanel from "@/components/RosterLabourPanel";
import { getRosterPlanning } from "@/lib/queries/owner-insights";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { draftRoster } from "@/lib/roster/draft";
import { smartSchedule, swapOptions, type SwapOption } from "@/lib/roster/smart";
import type { RosterIssue } from "@/lib/roster/check";
import { createClient } from "@/lib/supabase/client";
import { getStaffingTargets } from "@/lib/queries/staffing";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// Every team a manager can roster — not only the ones that happen to have preset
// shift times. Teams without presets simply use a custom start/end time.
const TEAM_COLORS: Record<string, string> = { Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)", Cashier: "#9b59b6", Dishwashing: "var(--info)" };
const CUSTOM = "__custom__";
const presetsFor = (team: string) => SHIFT_MODEL[team] || [];

type Entry = { user_id: string; name: string; team: string; shift: string };
type Roster = Record<string, Entry[]>;

export default function RosterPage() {
  const { t, locale } = useLang();
  const dayLabel = (k: string) => (DAYS.includes(k) ? t("days." + k.toLowerCase()) : k);
  const teamLabel = (k: string) => (TEAMS.includes(k) ? t("teams." + k) : k);
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [roster, setRoster] = useState<Roster>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [avail, setAvail] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expected,setExpected] = useState<{draft:any}|null>(null);
  // What is on screen vs. what is saved: saved = the draft if one exists, else the published roster.
  const [savedRoster, setSavedRoster] = useState<Roster>({});
  const [branchId, setBranchId] = useState(""), [prevSunday, setPrevSunday] = useState<any[]>([]), [remoteChange, setRemoteChange] = useState(false);
  const live = useRef({ dirty: false, busy: false, offset: 0, own: 0 }); // latest state for the realtime handler
  const [status, setStatus] = useState<{ hasDraft: boolean; draftStale: boolean; publishedAt: string | null; hasPublished: boolean }>({ hasDraft: false, draftStale: false, publishedAt: null, hasPublished: false });
  const [publishing, setPublishing] = useState(false);
  const loadSerial=useRef(0);
  const [drafting, setDrafting] = useState(false);
  const [openSlots, setOpenSlots] = useState<{ day: string; team: string; shift: string }[]>([]);

  // add-shift form (per selected day)
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [selStaff, setSelStaff] = useState("");
  const [selTeam, setSelTeam] = useState(TEAMS[0]);
  const [selShift, setSelShift] = useState(presetsFor(TEAMS[0])[0]?.shift ?? CUSTOM);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("17:00");

  async function load(offset: number) {
    setIssues([]);
    const serial=++loadSerial.current;
    setLoading(true);
    setLoadError("");
    try {
      const ws = await getWeekStart(offset);
      const res = await getRoster(ws);
      if(serial!==loadSerial.current)return;
      if (!res.ok) { if (res.error?.includes("managers")) setDenied(true); throw Error(res.error); }
      setWeekStart(res.weekStart || ""); setRoster(res.roster || {}); setSavedRoster(res.roster || {}); setExpected(res.expected || null); setOpenSlots([]);
      setStatus({ hasDraft: !!(res as any).hasDraft, draftStale: !!(res as any).draftStale, publishedAt: (res as any).publishedAt ?? null, hasPublished: (res as any).published != null });
      setStaff(res.staff || []); setAvail((res as any).avail || {}); setSwapAt(null); setSwapCtx(null);
      setBranchId((res as any).branchId ?? ""); setPrevSunday((res as any).prevSunday || []); setRemoteChange(false);
    } catch { if(serial===loadSerial.current)setLoadError(t("roster.loadFailed")); }
    finally { if(serial===loadSerial.current)setLoading(false); }
  }

  // ?offset=N opens N weeks from now (used by "Edit in roster" on the Shifts page).
  useEffect(() => { const o = Math.max(-52, Math.min(52, Number(new URLSearchParams(window.location.search).get("offset")) || 0)); setWeekOffset(o); load(o); return()=>{loadSerial.current++;}; }, []);

  function changeWeek(delta: number) {
    if(saving || loading)return;
    if(dirty && !confirm(t("roster.discardChanges")))return;
    const next = weekOffset + delta;
    setWeekOffset(next);
    load(next);
  }

  function addEntry() {
    if(saving || loadError)return;
    if (!activeDay || !selStaff) { toast(t("roster.pickStaff"), "error"); return; }
    const person = staff.find((p) => p.id === selStaff);
    if (!person) return;
    // Custom time → store the actual "HH:MM–HH:MM" range as the shift value.
    let shiftVal = selShift;
    if (selShift === CUSTOM) {
      if (!customStart || !customEnd) { toast(t("roster.badTime"), "error"); return; }
      shiftVal = `${customStart}–${customEnd}`;
    }
    const entry: Entry = { user_id: person.id, name: person.full_name, team: selTeam, shift: shiftVal };
    setRoster((r) => {
      const day = r[activeDay] ? [...r[activeDay]] : [];
      // prevent exact duplicate
      if (day.some((e) => e.user_id === entry.user_id && e.team === entry.team && e.shift === entry.shift)) return r;
      day.push(entry);
      return { ...r, [activeDay]: day };
    });
    setSelStaff("");
  }

  function removeEntry(day: string, idx: number) {
    setRoster((r) => {
      const arr = [...(r[day] || [])];
      arr.splice(idx, 1);
      return { ...r, [day]: arr };
    });
  }

  // Auto-draft from last week's roster (src/lib/roster/draft.ts). Fills the screen only;
  // nothing is saved until the manager presses Save.
  async function autoDraft() {
    if (drafting || saving || loading || loadError || !weekStart) return;
    if (totalAssigned > 0 && !confirm(t("roster.draftReplace"))) return;
    setDrafting(true);
    try {
      const prev = new Date(`${weekStart}T12:00:00Z`); prev.setUTCDate(prev.getUTCDate() - 7);
      const [last, st, plan] = await Promise.all([getRoster(prev.toISOString().slice(0, 10)), getShiftTimes(), getRosterPlanning(weekStart)]);
      const template = (last.ok && (last as { roster?: Roster }).roster) || {};
      if (!Object.values(template).some((d) => (d as Entry[]).length)) { toast(t("roster.draftNoTemplate"), "error"); return; }
      const d = draftRoster({
        weekStart, template, avail,
        staff: staff.map((p) => ({ id: p.id, name: p.full_name, team: p.team ?? null, contractHours: p.contractHours ?? null })),
        times: new Map((st.ok ? st.items : []).map((x) => [`${x.team}|${x.shift}`, x])),
        minijobbers: plan.ok ? plan.minijobbers : [],
      });
      setRoster(d.roster); setOpenSlots(d.open);
      toast(t("roster.draftDone", { n: d.assigned, r: d.replaced, o: d.open.length }), d.open.length ? "error" : "success");
    } catch { toast(t("roster.loadFailed"), "error"); }
    finally { setDrafting(false); }
  }

  // Smart automate: fills the week from the staffing targets (src/lib/roster/smart.ts) — 11 h rest, contract and
  // Minijob caps, Tier 1 weekend bonus, furthest-behind-hours first. Screen only; Save draft / Publish as usual.
  async function smartAutomate() {
    if (drafting || saving || loading || loadError || !weekStart) return;
    if (totalAssigned > 0 && !confirm(t("roster.smartReplace"))) return;
    setDrafting(true);
    try {
      const [tg, st, plan] = await Promise.all([getStaffingTargets(), getShiftTimes(), getRosterPlanning(weekStart)]);
      if (!tg.ok || !tg.targets.some((x) => x.needed > 0)) { toast(t("roster.smartNoTargets"), "error"); return; }
      const res = smartSchedule({
        weekStart, targets: tg.targets, avail, prevSunday,
        staff: staff.map((p) => ({ id: p.id, name: p.full_name, team: p.team ?? null, contractHours: p.contractHours ?? null, tier: p.tier ?? null, workedH: p.workedH ?? 0, teams: p.teams })),
        times: new Map((st.ok ? st.items : []).map((x) => [`${x.team}|${x.shift}`, x])),
        minijobbers: plan.ok ? plan.minijobbers : [],
      });
      setRoster(res.roster as Roster); setOpenSlots(res.open.map(({ day, team, shift }) => ({ day, team, shift })));
      const missing = res.open.reduce((n, o) => n + o.missing, 0);
      toast(t("roster.smartDone", { n: res.assigned, o: missing }), missing ? "error" : "success");
    } catch { toast(t("roster.loadFailed"), "error"); }
    finally { setDrafting(false); }
  }

  // ── Manual override: tap-to-swap list and desktop drag & drop (same day) ──
  const [swapAt, setSwapAt] = useState<{ day: string; i: number } | null>(null);
  const [swapCtx, setSwapCtx] = useState<{ times: Map<string, any>; minijobbers: any[] } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ day: string; i: number } | null>(null);
  async function openSwap(day: string, i: number) {
    if (swapAt?.day === day && swapAt.i === i) { setSwapAt(null); return; }
    setSwapAt({ day, i });
    if (!swapCtx && weekStart) {
      const [st, plan] = await Promise.all([getShiftTimes(), getRosterPlanning(weekStart)]);
      setSwapCtx({ times: new Map((st.ok ? st.items : []).map((x) => [`${x.team}|${x.shift}`, x])), minijobbers: plan.ok ? plan.minijobbers : [] });
    }
  }
  const swapList = (day: string, i: number): SwapOption[] => !swapCtx ? [] : swapOptions({
    weekStart, roster: roster as any, day, index: i, avail, times: swapCtx.times, minijobbers: swapCtx.minijobbers,
    staff: staff.map((p) => ({ id: p.id, name: p.full_name, team: p.team ?? null, contractHours: p.contractHours ?? null, tier: p.tier ?? null, workedH: p.workedH ?? 0, teams: p.teams })),
  });
  function assignTo(day: string, i: number, o: SwapOption) {
    setRoster((rs) => { const arr = [...(rs[day] || [])]; arr[i] = { ...arr[i], user_id: o.id, name: o.name }; return { ...rs, [day]: arr }; });
    setSwapAt(null);
  }
  // Drop entry A on entry B (same day): the two people exchange their shifts.
  function swapEntries(day: string, a: number, b: number) {
    if (a === b) return;
    setRoster((rs) => { const arr = [...(rs[day] || [])], x = arr[a], y = arr[b]; arr[a] = { ...x, user_id: y.user_id, name: y.name }; arr[b] = { ...y, user_id: x.user_id, name: x.name }; return { ...rs, [day]: arr }; });
  }
  // Drop a shift on another day's card: the shift moves there (same person, team and shift).
  function moveEntry(from: { day: string; i: number }, toDay: string) {
    setRoster((rs) => {
      const src = [...(rs[from.day] || [])], e = src[from.i];
      if (!e || (rs[toDay] || []).some((x) => x.user_id === e.user_id && x.team === e.team && x.shift === e.shift)) return rs;
      src.splice(from.i, 1);
      return { ...rs, [from.day]: src, [toDay]: [...(rs[toDay] || []), e] };
    });
    setSwapAt(null);
  }
  // Copy a day's shifts to another day ("*" = every other day). People already on the target day are skipped,
  // so nobody ends up with two shifts on one day by accident.
  function copyDay(from: string, to: string) {
    let added = 0;
    const next: Roster = { ...roster };
    for (const d of to === "*" ? DAYS.filter((x) => x !== from) : [to]) {
      const have = new Set((next[d] || []).map((x) => x.user_id));
      const extra = (roster[from] || []).filter((e) => !have.has(e.user_id));
      if (extra.length) { next[d] = [...(next[d] || []), ...extra.map((e) => ({ ...e }))]; added += extra.length; }
    }
    if (added) setRoster(next);
    toast(t("roster.copied", { n: added }), added ? "success" : "error");
  }
  const reasonText = (k: string) => t(`roster.why_${k}`);

  async function doSave() {
    if(saving || loading || loadError)return;
    setSaving(true);
    try {
      const res = await saveRoster(weekStart, roster, expected);
      if (res.ok && res.expected) { setExpected(res.expected); setRoster(res.expected.draft); setSavedRoster(res.expected.draft); setStatus((st) => ({ ...st, hasDraft: true })); toast(t("roster.saved"), "success"); }
      else { const code = (res as { code?: string }).code; toast(code ? t(`roster.${code}`) : (res.error || t("roster.saveFailed")), "error"); }
    } catch { toast(t("roster.saveFailed"),"error"); }
    finally { setSaving(false); }
  }

  const [issues, setIssues] = useState<RosterIssue[]>([]);
  const issueText = (i: RosterIssue) => t(i.kind === "rest" ? "roster.issRest" : i.kind === "overlap" ? "roster.issOverlap" : i.kind === "hours" ? "roster.issHours" : "roster.issMinijob", { name: i.name, day: i.day ? dayLabel(i.day) : "", h: i.value });
  // Publish: saves pending edits first, then makes the draft live and notifies the staff on it.
  async function doPublish() {
    if (publishing || saving || loading || loadError || !weekStart) return;
    if (!confirm(t("roster.publishConfirm"))) return;
    setPublishing(true);
    try {
      if (dirty || !status.hasDraft) {
        const saved = await saveRoster(weekStart, roster, expected);
        if (!saved.ok) { const code = (saved as { code?: string }).code; toast(code ? t(`roster.${code}`) : (saved.error || t("roster.saveFailed")), "error"); return; }
      }
      let res = await publishRoster(weekStart);
      // Contract-hours / Minijob warnings: the manager may publish anyway. Rest and overlaps always block.
      if (!res.ok && res.code === "warnRules" && confirm(`${(res.issues || []).map(issueText).join("\n")}\n\n${t("roster.warnRules")}`)) res = await publishRoster(weekStart, true);
      if (res.ok) toast(t("roster.published", { n: res.notified }), "success");
      else if (res.code !== "warnRules") toast(res.code ? t(`roster.${res.code}`) : (res.error || t("roster.saveFailed")), "error");
      await load(weekOffset); // the draft was saved above: pick up its new state either way
      setIssues(!res.ok && res.code === "errRules" ? res.issues || [] : []);
    } catch { toast(t("roster.saveFailed"), "error"); }
    finally { setPublishing(false); }
  }
  async function doDiscard() {
    if (!status.hasDraft || !confirm(t("roster.discardDraftConfirm"))) return;
    const res = await discardRosterDraft(weekStart, expected);
    if (res.ok) toast(t("roster.draftDiscarded"), "success"); else toast(res.code ? t(`roster.${res.code}`) : (res.error || t("roster.saveFailed")), "error");
    await load(weekOffset); // also after a refusal: show the newer draft someone else saved
  }

  const weekLabel = (() => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString(appLocale(), { timeZone: "Europe/Berlin", day: "2-digit", month: "short" });
    return `${f(start)} – ${f(end)}`;
  })();

  const totalAssigned = DAYS.reduce((sum, d) => sum + (roster[d]?.length || 0), 0);
  const dirty = JSON.stringify(roster) !== JSON.stringify(savedRoster);

  // Live sync: when this week's draft or published roster changes in the database (another manager, an approved
  // cover), reload if nothing is unsaved here; otherwise show a notice and let the manager decide.
  // Needs migration 20261112090000_roster_realtime.sql; without it nothing arrives and the page works as before.
  live.current = { ...live.current, dirty, busy: saving || publishing || loading || drafting, offset: weekOffset };
  if (saving || publishing) live.current.own = Date.now(); // our own save echoes back: ignore it for a moment
  useEffect(() => {
    if (!branchId || !weekStart) return;
    const sb = createClient();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const onChange = (payload: { new?: { week_start?: string }; old?: { week_start?: string } }) => {
      const s = live.current, week = payload.new?.week_start ?? payload.old?.week_start;
      if (week && week !== weekStart) return;
      // Busy, or possibly the echo of our own save: look again shortly instead of dropping the event, so another
      // manager's change in that moment is not missed. (Reloading after our own save is harmless.)
      if (s.busy || Date.now() - s.own < 4000) { clearTimeout(retry); retry = setTimeout(() => onChange(payload), 4500); return; }
      if (s.dirty) setRemoteChange(true); else void load(s.offset);
    };
    const ch = (sb.channel(`roster:${branchId}:${weekStart}`) as any)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_drafts", filter: `branch_id=eq.${branchId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_roster", filter: `branch_id=eq.${branchId}` }, onChange)
      .subscribe();
    return () => { clearTimeout(retry); void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, weekStart]);
  const statusText = status.hasDraft || dirty ? (dirty ? t("roster.stUnsaved") : t("roster.stDraft")) : status.hasPublished ? t("roster.stPublished") : t("roster.stEmpty");

  // availability helpers for this week
  const submitted = (uid: string) => !!avail[uid];
  const availableDay = (uid: string, day: string) => Array.isArray(avail[uid]?.[day]) && avail[uid][day].length > 0;

  if (denied) {
    return <div className="card ui-denied">{t("roster.managersOnly")}</div>;
  }

  return (
    <div className="fade-up">
      <PageHeader title={ <><Icon e="📋" size={22} /> {t("roster.title")}</> } subtitle={ <>{weekLabel || "…"} <span className={`roster-status${status.hasDraft || dirty ? " is-draft" : status.hasPublished ? " is-live" : ""}`}>{statusText}</span></> } />
      {status.draftStale && <p role="alert" className="roster-stale">{t("roster.errStale")}</p>}
      {remoteChange && <p role="alert" className="roster-stale">{t("roster.remoteChange")} <button className="btn-secondary ui-btn-sm" onClick={() => { if (confirm(t("roster.discardChanges"))) void load(weekOffset); }}>{t("roster.reload")}</button></p>}
      {issues.length > 0 && <div role="alert" className="card roster-stale"><strong>{t("roster.errRules")}</strong><ul>{issues.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></div>}
      {loadError && <div role="alert" className="card"><p>{loadError}</p><button className="btn-secondary" onClick={()=>load(weekOffset)}>{t("business.retry")}</button></div>}

      {/* week nav + save */}
      <div className="roster-bar">
        <div className="u-hstack">
          <button className="btn-secondary ui-btn-sm" disabled={loading||saving||publishing} onClick={() => changeWeek(-1)}>{t("shifts.prev")}</button>
          <span className="roster-week" aria-live="polite">
            {weekOffset === 0 ? t("roster.thisWeek") : weekOffset > 0 ? t("roster.weeksPlus", { n: weekOffset }) : t("roster.weeksMinus", { n: weekOffset })}
          </span>
          <button className="btn-secondary ui-btn-sm" disabled={loading||saving||publishing} onClick={() => changeWeek(1)}>{t("shifts.next")}</button>
        </div>
        <div className="roster-bar-actions">
          <ActionsMenu label={locale === "de" ? "Planungswerkzeuge" : "Planning tools"}>

        <button className="btn-secondary" onClick={smartAutomate} disabled={drafting||saving||publishing||loading||!!loadError}>
          {drafting ? t("common.loading") : t("roster.smart")}
        </button>
        <button className="btn-secondary" onClick={autoDraft} disabled={drafting||saving||publishing||loading||!!loadError} title={t("roster.draftHint")}>
          {drafting ? t("common.loading") : t("roster.draft")}
        </button>

        {status.hasDraft && <button className="btn-secondary" onClick={doDiscard} disabled={saving||publishing||loading}>{t("roster.discardDraft")}</button>}
          </ActionsMenu>
        <button className="btn-secondary" onClick={doSave} disabled={saving||publishing||loading||!!loadError||!dirty}>
          {saving ? t("common.saving") : t("roster.saveRoster")}
        </button>
        <button className="btn-gold" onClick={doPublish} disabled={saving||publishing||loading||!!loadError||status.draftStale||(!dirty&&!status.hasDraft)}>
          {publishing ? t("common.saving") : t("roster.publish")}
        </button>
        </div>
      </div>

      {loadError ? null : loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          <RosterLabourPanel weekStart={weekStart} roster={roster} />
          {openSlots.length > 0 && (
            <div className="card u-mb-3" role="status">
              <div className="card-title">{t("roster.draftOpen", { n: openSlots.length })}</div>
              <ul className="t-sm">{openSlots.map((o, i) => <li key={i}>{dayLabel(o.day)} · {teamLabel(o.team)} · {shiftLabel(o.shift)}</li>)}</ul>
              <p className="ui-sub">{t("roster.draftOpenHint")}</p>
            </div>
          )}

          {/* WEEK OVERVIEW STRIP (at-a-glance counts per day) */}
          <div className="card u-mb-3 roster-glance">
            <div className="card-title">{t("roster.weekGlance", { n: totalAssigned })}</div>
            <div className="roster-strip">
              {DAYS.map((d) => {
                const count = roster[d]?.length || 0;
                const isActive = activeDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(isActive ? null : d)}
                    className={`${count > 0 ? "has" : ""}${isActive ? " active" : ""}`}
                    aria-pressed={isActive}
                    aria-label={`${dayLabel(d)}: ${t("roster.assigned", { n: count })}`}
                  >
                    <span>{dayLabel(d).slice(0, 2)}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TEAM HOURS BOARD — month-to-date worked vs monthly contract */}
          <div className="card u-mb-3">
            <button className="ui-disclosure" onClick={() => setShowHours(!showHours)} aria-expanded={showHours}>
              <span className="card-title u-m0">{t("roster.teamHours")}</span>
              <span className="u-muted t-sm" aria-hidden="true">{showHours ? "▾" : "▸"}</span>
            </button>
            {showHours && (
              <div className="u-mt-3">
                <div className="ui-sub">{t("roster.teamHoursSub")}</div>
                {[...staff]
                  .filter((p) => p.contractHours != null || (p.workedH || 0) > 0)
                  .map((p) => ({ ...p, pct: p.contractHours ? Math.round(((p.workedH || 0) / p.contractHours) * 100) : null }))
                  .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
                  .map((p) => {
                    const over = p.pct != null && p.pct > 100;
                    const near = p.pct != null && p.pct >= 85 && p.pct <= 100;
                    const left = p.contractHours != null ? Math.round((p.contractHours - (p.workedH || 0)) * 10) / 10 : null;
                    return (
                      <div className="mb-3" key={p.id}>
                        <div className="d-flex jc-sb t-sm mb-1">
                          <span className="u-text">{p.full_name}</span>
                          <span className={over ? "tone-danger fw-7" : "u-muted"}>
                            {p.contractHours != null ? `${p.workedH || 0}/${p.contractHours}h` : `${p.workedH || 0}h`}
                            {left != null && (over ? ` · ${t("roster.over")}` : ` · ${left}${t("roster.leftShort")}`)}
                          </span>
                        </div>
                        {p.pct != null && (
                          <div className={`ui-bar${over ? " over" : near ? " near" : ""}`} role="img" aria-label={`${p.pct}%`}>
                            <span style={{ width: `${Math.min(100, p.pct)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          {/* While saving or publishing nothing may be edited: the reload afterwards would silently drop it. */}
          <div className={`roster-days${saving || publishing ? " is-locked" : ""}`} aria-busy={saving || publishing}>
          {DAYS.map((day) => {
            const entries = roster[day] || [];
            const isActive = activeDay === day;
            const dropHere = !!dragFrom && dragFrom.day !== day; // a shift dragged from another day can be moved here
            return (
              <div key={day} className={`card roster-day${isActive ? " active" : ""}${dropHere ? " is-drop-day" : ""}`}
                onDragOver={(ev) => { if (dropHere) ev.preventDefault(); }}
                onDrop={(ev) => { if (dropHere && dragFrom) { ev.preventDefault(); moveEntry(dragFrom, day); setDragFrom(null); } }}>
                <div className="roster-day-head">
                  <div className="t-lg fw-7 u-text">
                    {dayLabel(day)}
                    {entries.length > 0 && (
                      <span className="t-xs fw-6 tone-action ml-2">{t("roster.assigned", { n: entries.length })}</span>
                    )}
                  </div>
                  <div className="u-hstack">
                    {entries.length > 0 && (
                      <select className="form-input roster-copy" value="" disabled={saving} aria-label={`${dayLabel(day)}: ${t("roster.copyTo")}`} onChange={(e) => { if (e.target.value) copyDay(day, e.target.value); }}>
                        <option value="">{t("roster.copyTo")}</option>
                        {DAYS.filter((d) => d !== day).map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                        <option value="*">{t("roster.copyAllDays")}</option>
                      </select>
                    )}
                    <button className={`${isActive ? "btn-gold" : "btn-secondary"} ui-btn-sm`} onClick={() => setActiveDay(isActive ? null : day)} aria-expanded={isActive}>
                      {isActive ? t("common.close") : t("roster.add")}
                    </button>
                  </div>
                </div>

                {/* entries */}
                {entries.map((e, i) => (<div key={i}>
                  <div className={`roster-entry${dragFrom?.day === day && dragFrom.i !== i ? " is-drop" : ""}`} draggable={!saving}
                    onDragStart={() => setDragFrom({ day, i })} onDragEnd={() => setDragFrom(null)}
                    onDragOver={(ev) => { if (dragFrom?.day === day) ev.preventDefault(); }}
                    onDrop={(ev) => { ev.preventDefault(); if (dragFrom?.day === day) swapEntries(day, dragFrom.i, i); setDragFrom(null); }}>
                    <span className="clock-dot" style={{ color: TEAM_COLORS[e.team] || "#888" }} aria-hidden="true" />
                    <div className="u-flex1 t-sm u-text">
                      <button type="button" className="roster-swap-btn" aria-expanded={swapAt?.day === day && swapAt.i === i} onClick={() => void openSwap(day, i)}
                        title={t("roster.swapHint")}><b>{e.name}</b> ⇄</button> <span className="u-muted">· {teamLabel(e.team)} · {shiftLabel(e.shift)}</span>
                    </div>
                    {submitted(e.user_id) && !availableDay(e.user_id, day) && (
                      <span className="ui-tag-warn u-nowrap">⚠ {t("roster.notAvail")}</span>
                    )}
                    <button disabled={saving} aria-label={t("roster.removeShift",{name:e.name})} onClick={() => removeEntry(day, i)} className="ui-remove-btn">×</button>
                  </div>
                  {swapAt?.day === day && swapAt.i === i && (
                    <ul className="roster-swap-list" aria-label={t("roster.swapWith", { name: e.name })}>
                      {!swapCtx ? <li>{t("common.loading")}</li> : swapList(day, i).map((o) => (
                        <li key={o.id}><button type="button" className={`swap-opt is-${o.status}`} onClick={() => assignTo(day, i, o)}>
                          <span className="swap-dot" aria-hidden="true" /><b>{o.name}</b>
                          {o.reasons.map((k) => <span key={k} className="swap-why">{o.status === "ok" ? "" : "⚠ "}{reasonText(k)}</span>)}
                        </button></li>))}
                    </ul>)}
                </div>))}

                {/* add form */}
                {isActive && (
                  <div className="roster-form">
                    <Field label={t("roster.staff")}>
                      <select className="form-input" value={selStaff} onChange={(e) => setSelStaff(e.target.value)}>
                        <option value="">{t("roster.select")}</option>
                        {[...staff].sort((a, b) => (availableDay(a.id, day) ? 0 : 1) - (availableDay(b.id, day) ? 0 : 1) || (a.full_name || "").localeCompare(b.full_name || "")).map((p) => {
                          const tag = availableDay(p.id, day) ? t("roster.avAvailable") : submitted(p.id) ? t("roster.avNot") : t("roster.avNone");
                          const wh = (p as any).workedH ?? 0; const ch = (p as any).contractHours;
                          const hrs = ch != null
                            ? ` · ${wh}/${ch}h${ch - wh > 0 ? ` (${Math.round((ch - wh) * 10) / 10} ${t("roster.leftWord")})` : ch - wh < 0 ? ` (${t("roster.over")})` : ""}`
                            : ` · ${wh}h`;
                          return <option key={p.id} value={p.id}>{p.full_name} — {tag}{hrs}</option>;
                        })}
                      </select>
                    </Field>
                    <Field label={t("roster.team")}>
                      <select className="form-input" value={selTeam} onChange={(e) => { const tm = e.target.value; setSelTeam(tm); setSelShift(presetsFor(tm)[0]?.shift ?? CUSTOM); }}>
                        {TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                      </select>
                    </Field>
                    <Field label={t("roster.shift")}>
                      <select className="form-input" value={selShift} onChange={(e) => setSelShift(e.target.value)}>
                        {presetsFor(selTeam).map((s) => <option key={s.shift} value={s.shift}>{shiftLabel(s.shift)} ({s.time || t("roster.timePending")})</option>)}
                        <option value={CUSTOM}>{t("roster.customTime")}</option>
                      </select>
                    </Field>
                    {selShift === CUSTOM && (
                      <div className="roster-times">
                        <Field label={t("roster.from")}><input className="form-input" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></Field>
                        <Field label={t("roster.to")}><input className="form-input" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></Field>
                      </div>
                    )}
                    <button className="btn-gold" onClick={addEntry}>{t("common.add")}</button>
                  </div>
                )}

                {entries.length === 0 && !isActive && (
                  <div className="t-xs u-muted mt-2">{t("roster.noOne")}</div>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
