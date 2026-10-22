"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getChecklistOversight, getChecklistHistory } from "@/lib/queries/operations";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

// YYYY-MM-DD in Europe/Berlin (business day)
function berlinTodayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function ChecklistStatusPage() {
  const { t } = useLang();
  const [date, setDate] = useState(berlinTodayStr());
  const [tasks, setTasks] = useState<any[]>([]);
  const [summary, setSummary] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<{ date: string; total: number; done: number }[]>([]);

  async function load(d: string) {
    setLoading(true); setErr(null);
    const res = await getChecklistOversight(d);
    if (res.ok) { setTasks(res.tasks); setSummary({ done: res.done, total: res.total }); }
    else { setTasks([]); setSummary({ done: 0, total: 0 }); setErr(res.error || ""); }
    setLoading(false);
  }
  useEffect(() => { load(date); }, [date]);
  useEffect(() => {
    getChecklistHistory(30).then((res) => { if (res.ok) setHistory(res.days); });
  }, []);

  const opening = tasks.filter((it) => it.type === "opening");
  const closing = tasks.filter((it) => it.type === "closing");

  const fmtTime = (ts: string | null) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); } catch { return ""; }
  };
  const fmtDate = (d: string) => {
    try { return new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "Europe/Berlin" }); } catch { return d; }
  };
  const dayColor = (done: number, total: number) =>
    total === 0 ? "var(--gray)" : done === total ? "var(--success)" : done === 0 ? "var(--danger)" : "#d4a847";

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div style={{ ...card, marginBottom: 12 }}>
      <div className="ui-title spaced">{title}</div>
      {items.length === 0 ? (
        <div className="ui-muted-md">{t("checklist.noTasks")}</div>
      ) : items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: it.done ? "#27ae60" : "transparent", border: it.done ? "none" : "2px solid rgba(236,112,99,0.55)" }}>
            {it.done && <Icon e="✓" size={13} color="#fff" />}
          </div>
          <div className="u-grow">
            <div style={{ fontSize: 14, color: "var(--text)" }}>{it.task}</div>
            <div style={{ fontSize: 12, color: it.done ? "var(--gray)" : "var(--danger)", marginTop: 2 }}>
              {it.done
                ? `${it.completed_by_name ? `${t("checklist.by")} ${it.completed_by_name}` : ""}${it.completed_at ? ` · ${fmtTime(it.completed_at)}` : ""}`.trim()
                : t("checklist.notDone")}
            </div>
          </div>
          {it.input_kind === "number" && (
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-body)", color: it.value ? "#d4a847" : "var(--gray)", flexShrink: 0 }}>
              {it.value || "—"}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="✅" size={22} /> {t("checklist.statusTitle")}</h1>
      <p className="u-muted t-sm mb-4">{t("checklist.statusSub")}</p>

      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <label className="t-sm u-muted fs-0">{t("checklist.pickDate")}</label>
        <input aria-label={t("checklist.pickDate")} type="date" value={date} max={berlinTodayStr()} onChange={(e) => setDate(e.target.value || berlinTodayStr())} style={{ ...input, flex: 1 }} />
        {!loading && summary.total > 0 && (
          <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: summary.done === summary.total ? "var(--success)" : "#d4a847" }}>
            {summary.done}/{summary.total}
          </span>
        )}
      </div>

      {/* HISTORY — recent days, tap to open */}
      {history.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div className="t-sm fw-7 mb-h">{t("checklist.history")}</div>
          <div className="t-xs u-muted mb-2">{t("checklist.historySub")}</div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {history.map((d) => {
              const sel = d.date === date;
              const c = dayColor(d.done, d.total);
              return (
                <button key={d.date} onClick={() => setDate(d.date)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", cursor: "pointer",
                  background: sel ? "var(--accent-soft)" : "transparent", border: "none", borderRadius: 8,
                  borderBottom: "1px solid var(--border)", textAlign: "left",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: sel ? "#fff" : "#cfc5c5", fontWeight: sel ? 700 : 400 }}>{fmtDate(d.date)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c }}>
                    {d.done === d.total ? t("checklist.allDone") : `${d.done}/${d.total}`}
                  </span>
                  <span className="u-muted t-md">›</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && <CardSkeleton rows={4} />}
      {!loading && err && <div style={{ ...card, color: "var(--danger)", fontSize: 13 }}>{err}</div>}
      {!loading && !err && tasks.length === 0 && <div style={{ ...card, color: "var(--gray)", fontSize: 13 }}>{t("checklist.noTasksDate")}</div>}
      {!loading && !err && tasks.length > 0 && (
        <>
          <Section title={t("checklist.openingTasks")} items={opening} />
          <Section title={t("checklist.closingTasks")} items={closing} />
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { padding: "10px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };