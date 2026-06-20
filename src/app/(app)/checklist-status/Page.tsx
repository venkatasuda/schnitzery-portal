"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getTodayChecklist, addChecklistTask, toggleTask, deleteTask, saveTaskValue } from "@/lib/queries/operations";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

export default function ChecklistPage() {
  const { t } = useLang();
  const [tasks, setTasks] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // add task
  const [newTask, setNewTask] = useState("");
  const [newType, setNewType] = useState("opening");
  const [newKind, setNewKind] = useState("check");

  async function load() {
    setLoading(true);
    const res = await getTodayChecklist();
    if (res.ok) { setTasks(res.tasks); setCanManage(res.canManage); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(item: any) {
    setBusyId(item.id);
    await toggleTask(item.id, !item.done);
    setBusyId(null);
    load();
  }
  async function saveValue(item: any, value: string) {
    if ((value || "").trim() === (item.value || "")) return; // no change
    setBusyId(item.id);
    const res = await saveTaskValue(item.id, value);
    setBusyId(null);
    if (res.ok) load(); else toast(res.error || t("checklist.failAdd"), "error");
  }
  async function add() {
    if (!newTask.trim()) return;
    const res = await addChecklistTask(newType, newTask, newKind);
    if (res.ok) { setNewTask(""); load(); toast(t("checklist.taskAdded"), "success"); } else toast(res.error || t("checklist.failAdd"), "error");
  }
  async function del(id: string) {
    setBusyId(id);
    await deleteTask(id);
    setBusyId(null);
    load();
  }

  const opening = tasks.filter((it) => it.type === "opening");
  const closing = tasks.filter((it) => it.type === "closing");
  const doneCount = tasks.filter((it) => it.done).length;

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6f6565" }}>{t("checklist.noTasks")}</div>
      ) : items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {it.input_kind === "number" ? (
            <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: it.done ? "#27ae60" : "transparent", border: it.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff" }}>
              {it.done ? <Icon e="✓" size={14} /> : <Icon e="🔢" size={12} />}
            </div>
          ) : (
            <button onClick={() => toggle(it)} disabled={busyId === it.id} style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: "pointer",
              background: it.done ? "#27ae60" : "transparent", border: it.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 14 }}>
              {it.done ? <Icon e="✓" size={14} /> : ""}
            </button>
          )}
          <span style={{ flex: 1, fontSize: 14, color: it.done && it.input_kind !== "number" ? "#6f6565" : "#fff", textDecoration: it.done && it.input_kind !== "number" ? "line-through" : "none" }}>{it.task}</span>
          {it.input_kind === "number" && (
            <input type="text" inputMode="decimal" defaultValue={it.value || ""} placeholder={t("checklist.readingPlaceholder")}
              onBlur={(e) => saveValue(it, e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              disabled={busyId === it.id} style={{ ...input, width: 96, textAlign: "right", padding: "8px 10px" }} />
          )}
          {canManage && <button onClick={() => del(it.id)} disabled={busyId === it.id} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 16 }}>×</button>}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="✅" size={22} /> {t("checklist.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {loading ? t("checklist.subLoading") : t("checklist.doneToday", { done: doneCount, total: tasks.length })}
      </p>

      {loading && <CardSkeleton rows={4} />}

      {!loading && (
        <>
          <Section title={t("checklist.openingTasks")} items={opening} />
          <Section title={t("checklist.closingTasks")} items={closing} />

          {canManage && (
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("checklist.addTask")}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...input, flex: 1 }}>
                  <option value="opening">{t("checklist.opening")}</option>
                  <option value="closing">{t("checklist.closing")}</option>
                </select>
                <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={{ ...input, flex: 1 }}>
                  <option value="check">{t("checklist.kindCheck")}</option>
                  <option value="number">{t("checklist.kindNumber")}</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={t("checklist.taskPlaceholder")} style={{ ...input, flex: 1 }} />
                <button onClick={add} style={{ ...primaryBtn, width: "auto", padding: "0 18px" }}>{t("common.add")}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "10px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" };