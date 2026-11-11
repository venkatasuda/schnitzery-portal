"use client";
// Staffing targets grid: people needed per team · shift (rows) and weekday (columns). Used by Smart Automate.
import { useEffect, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import { toast } from "@/components/Toast";
import { SHIFT_MODEL, TEAMS } from "@/lib/queries/schedule-constants";
import { getStaffingTargets, saveStaffingTargets } from "@/lib/queries/staffing";

const ROWS = TEAMS.flatMap((team) => (SHIFT_MODEL[team] || []).map((s) => ({ team, shift: s.shift })));
const key = (team: string, shift: string, d: number) => `${team}|${shift}|${d}`;

export default function StaffingTargets() {
  const { t, locale } = useLang();
  const de = locale === "de";
  const days = de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const shiftLabel = (k: string) => (["Morning", "Mid", "Evening", "Night"].includes(k) ? t("shiftNames." + k) : k);
  const [grid, setGrid] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStaffingTargets().then((r) => {
      if (!r.ok) return setGrid(null);
      const g: Record<string, string> = {};
      for (const row of r.targets) g[key(row.team, row.shift, row.weekday)] = String(row.needed);
      setGrid(g);
    }).catch(() => setGrid(null));
  }, []);
  if (!grid) return null;

  async function save() {
    const targets = ROWS.flatMap((r) => days.map((_, d) => ({ team: r.team, shift: r.shift, weekday: d, needed: Number(grid![key(r.team, r.shift, d)] || 0) })));
    if (targets.some((x) => !Number.isInteger(x.needed) || x.needed < 0 || x.needed > 30)) { toast(de ? "0–30 Personen je Feld." : "0–30 people per field.", "error"); return; }
    setBusy(true);
    try { const r = await saveStaffingTargets(targets); toast(r.ok ? (de ? "Besetzung gespeichert" : "Staffing saved") : r.error, r.ok ? "success" : "error"); }
    finally { setBusy(false); }
  }

  return (
    <section className="mb-5">
      <div className="section-label">{de ? "Besetzung je Schicht (für Smart Automate)" : "Staffing per shift (for Smart Automate)"}</div>
      <div className="card table-scroll" role="region" aria-label={de ? "Besetzung" : "Staffing"} tabIndex={0}>
        <table className="data-table staffing-table">
          <thead><tr><th scope="col">{de ? "Team · Schicht" : "Team · shift"}</th>{days.map((d) => <th scope="col" key={d}>{d}</th>)}</tr></thead>
          <tbody>{ROWS.map((r) => (
            <tr key={r.team + r.shift}>
              <th scope="row">{t("teams." + r.team)} · {r.team === "Preparation" ? (de ? "Vorbereitung" : "Prep") : shiftLabel(r.shift)}</th>
              {days.map((d, i) => <td key={d}><input className="form-input" type="number" min={0} max={30} inputMode="numeric" placeholder="0"
                aria-label={`${t("teams." + r.team)} ${shiftLabel(r.shift)} ${d}`} value={grid[key(r.team, r.shift, i)] ?? ""}
                onChange={(e) => setGrid({ ...grid, [key(r.team, r.shift, i)]: e.target.value })} /></td>)}
            </tr>))}</tbody>
        </table>
        <div className="row-actions mt-2"><button className="btn-gold" disabled={busy} onClick={() => void save()}>{t("common.save")}</button></div>
      </div>
    </section>
  );
}
