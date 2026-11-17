"use client";
// Employee Home, first card: today's (or the next) shift and the clock button right on it.
// Clocking uses the same implementation as the Attendance page (useClock); QR / code and history stay there.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { Skeleton } from "@/components/Skeleton";
import { useClock, computeBreakMs } from "@/components/attendance/useClock";
import ClockPick from "@/components/attendance/ClockPick";
import { getMyUpcomingShifts } from "@/lib/queries/cover";
import { berlinToday, fmtDay } from "@/lib/time/berlinDate";

type Shift = { work_date: string; team: string; shift: string; time: string };

export default function ShiftHero() {
  const { t, locale } = useLang();
  const de = locale === "de";
  const clock = useClock();
  const [pick, setPick] = useState<null | "in" | "out">(null); // clock in / out via the kiosk QR or code
  const [shifts, setShifts] = useState<Shift[] | null>(null), [shiftsFailed, setShiftsFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getMyUpcomingShifts().then((r) => { if (!live) return; if (r.ok) setShifts(r.shifts as Shift[]); else setShiftsFailed(true); }, () => { if (live) setShiftsFailed(true); });
    return () => { live = false; };
  }, []);

  const today = berlinToday();
  const todays = shifts?.filter((s) => s.work_date === today) ?? [], next = shifts?.find((s) => s.work_date > today);
  // A custom shift is stored as "HH:MM–HH:MM" and is its own time; presets carry their time separately.
  const label = (s: Shift) => /\d{1,2}:\d{2}/.test(s.shift) ? `${s.shift} · ${s.team}` : `${s.time || s.shift} · ${s.team}${s.time ? ` · ${s.shift}` : ""}`;
  const h = Math.floor(clock.elapsed / 3600), m = Math.floor((clock.elapsed % 3600) / 60), sec = clock.elapsed % 60;
  const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(de ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "—");
  const breakMin = Math.round(computeBreakMs(clock.session?.breaks) / 60000);
  const status = clock.onBreak ? t("att.statusOnBreak") : clock.clockedIn ? t("att.statusWorking") : t("att.statusNotIn");


  return (
    <section className={`card shift-hero${clock.onBreak ? " is-break" : clock.clockedIn ? " is-working" : ""}`} aria-labelledby="shift-hero-title">
      <div className="shift-hero-head">
        <div>
          <span className="shift-hero-day">{todays.length ? (de ? "Heute" : "Today") : shifts && next ? (de ? "Nächste Schicht" : "Next shift") : fmtDay(today, locale)}</span>
          <h2 id="shift-hero-title">
            {shifts == null && !shiftsFailed ? <Skeleton height={22} width={180} />
              : todays.length ? todays.map(label).join(" + ")
              : next ? `${fmtDay(next.work_date, locale)} · ${label(next)}`
              : shiftsFailed ? (de ? "Schichten nicht geladen" : "Shifts could not be loaded")
              : (de ? "Keine Schicht geplant" : "No shift planned")}
          </h2>
        </div>
        <span className="clock-status shift-hero-status" role="status">
          <span className="clock-dot" aria-hidden="true" />{status}
        </span>
      </div>

      {/* While working: the running time and In / Break / Out / Total, as on the Attendance page. */}
      {clock.clockedIn && <>
        <div className="clock-timer">
          <div className="clock-timer-value">
            {h}<span className="t-2xl u-muted">h </span>{String(m).padStart(2, "0")}<span className="t-2xl u-muted">m </span>{String(sec).padStart(2, "0")}<span className="t-2xl u-muted">s</span>
          </div>
          <div className="clock-caption">{t("att.totalTimeToday")}</div>
        </div>
        <div className="clock-cells">
          <StatCell label={t("att.in")} value={time(clock.session?.clock_in)} color="var(--success)" />
          <StatCell label={t("att.break")} value={breakMin > 0 ? `${breakMin}m` : "—"} color="var(--warn)" />
          <StatCell label={t("att.out")} value="—" color="var(--danger)" />
          <StatCell label={t("att.total")} value={`${h}h ${String(m).padStart(2, "0")}m`} color="var(--gold)" />
        </div>
      </>}

      {clock.statusError ? (
        <div role="alert" className="shift-hero-error"><span>{t("att.couldNotLoad")}</span><button className="btn-secondary ui-btn-sm" onClick={() => void clock.refresh()}>{t("business.retry")}</button></div>
      ) : clock.loading ? <Skeleton height={48} radius={12} /> : (
        <div className="shift-hero-actions">
          {!clock.clockedIn
            ? <button className="clock-btn in" disabled={clock.working} aria-busy={clock.working} onClick={() => setPick("in")}>{t("att.clockInNow")}</button>
            : <>
              {clock.onBreak
                ? <button className="clock-btn resume" disabled={clock.working} aria-busy={clock.working} onClick={() => void clock.endBreak()}>{t("att.endBreak")}</button>
                : <button className="clock-btn break" disabled={clock.working} aria-busy={clock.working} onClick={() => void clock.startBreak()}>{t("att.startBreak")}</button>}
              <button className="clock-btn out" disabled={clock.working || clock.onBreak} onClick={() => setPick("out")}>{t("att.clockOut")}</button>
            </>}
        </div>
      )}
      {clock.message && <p className="shift-hero-msg" role="status">{clock.message}</p>}
      {pick && <ClockPick mode={pick} clock={clock} onClose={() => setPick(null)} />}
      <Link className="shift-hero-more" href="/attendance" prefetch={false}>{de ? "Verlauf" : "History"} ›</Link>
    </section>
  );
}

// At-a-glance status cell (also used by the Attendance page).
export function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="clock-cell"><strong style={{ color }}>{value}</strong><span>{label}</span></div>;
}
