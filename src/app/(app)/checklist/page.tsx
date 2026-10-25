"use client";

import { appLocale } from "@/lib/format";
import { toast } from "@/components/Toast";
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
    // A failed request must end the skeleton and say so, not spin forever.
    try {
    setLoading(true); setErr(null);
    const res = await getChecklistOversight(d);
    if (res.ok) { setTasks(res.tasks); setSummary({ done: res.done, total: res.total }); }
    else { setTasks([]); setSummary({ done: 0, total: 0 }); setErr(res.error || ""); }
    setLoading(false);
    } catch { toast(t("common.loadFailed"), "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(date); }, [date]);

  const opening = tasks.filter((it) => it.type === "opening");
  const closing = tasks.filter((it) => it.type === "closing");

  const fmtTime = (ts: string | null) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString(appLocale(), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); } catch { return ""; }
  };

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
            <div className={`t-xs mt-h ${it.done ? "u-muted" : "tone-danger"}`.trim()}>
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
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
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