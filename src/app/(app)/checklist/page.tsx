"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getChecklistOversight } from "@/lib/queries/operations";
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

  async function load(d: string) {
    setLoading(true); setErr(null);
    const res = await getChecklistOversight(d);
    if (res.ok) { setTasks(res.tasks); setSummary({ done: res.done, total: res.total }); }
    else { setTasks([]); setSummary({ done: 0, total: 0 }); setErr(res.error || ""); }
    setLoading(false);
  }
  useEffect(() => { load(date); }, [date]);

  const opening = tasks.filter((it) => it.type === "opening");
  const closing = tasks.filter((it) => it.type === "closing");

  const fmtTime = (ts: string | null) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); } catch { return ""; }
  };

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6f6565" }}>{t("checklist.noTasks")}</div>
      ) : items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: it.done ? "#27ae60" : "transparent", border: it.done ? "none" : "2px solid rgba(236,112,99,0.55)" }}>
            {it.done && <Icon e="✓" size={13} color="#fff" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "#fff" }}>{it.task}</div>
            <div style={{ fontSize: 11, color: it.done ? "#9a8f8f" : "#ec7063", marginTop: 2 }}>
              {it.done
                ? `${it.completed_by_name ? `${t("checklist.by")} ${it.completed_by_name}` : ""}${it.completed_at ? ` · ${fmtTime(it.completed_at)}` : ""}`.trim()
                : t("checklist.notDone")}
            </div>
          </div>
          {it.input_kind === "number" && (
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "Georgia, serif", color: it.value ? "#d4a847" : "#6f6565", flexShrink: 0 }}>
              {it.value || "—"}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="✅" size={22} /> {t("checklist.statusTitle")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 14 }}>{t("checklist.statusSub")}</p>

      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: "#9a8f8f", flexShrink: 0 }}>{t("checklist.pickDate")}</label>
        <input type="date" value={date} max={berlinTodayStr()} onChange={(e) => setDate(e.target.value || berlinTodayStr())} style={{ ...input, flex: 1 }} />
        {!loading && summary.total > 0 && (
          <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: summary.done === summary.total ? "#58d68d" : "#d4a847" }}>
            {summary.done}/{summary.total}
          </span>
        )}
      </div>

      {loading && <CardSkeleton rows={4} />}
      {!loading && err && <div style={{ ...card, color: "#ec7063", fontSize: 13 }}>{err}</div>}
      {!loading && !err && tasks.length === 0 && <div style={{ ...card, color: "#9a8f8f", fontSize: 13 }}>{t("checklist.noTasksDate")}</div>}
      {!loading && !err && tasks.length > 0 && (
        <>
          <Section title={t("checklist.openingTasks")} items={opening} />
          <Section title={t("checklist.closingTasks")} items={closing} />
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };