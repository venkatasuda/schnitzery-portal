"use client";

import { useEffect, useState } from "react";
import { getTodayChecklist, addChecklistTask, toggleTask, deleteTask } from "@/lib/queries/operations";

export default function ChecklistPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // add task
  const [newTask, setNewTask] = useState("");
  const [newType, setNewType] = useState("opening");

  async function load() {
    setLoading(true);
    const res = await getTodayChecklist();
    if (res.ok) { setTasks(res.tasks); setCanManage(res.canManage); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(t: any) {
    setBusyId(t.id);
    await toggleTask(t.id, !t.done);
    setBusyId(null);
    load();
  }
  async function add() {
    if (!newTask.trim()) return;
    const res = await addChecklistTask(newType, newTask);
    if (res.ok) { setNewTask(""); load(); } else setMsg(res.error || "Failed.");
  }
  async function del(id: string) {
    setBusyId(id);
    await deleteTask(id);
    setBusyId(null);
    load();
  }

  const opening = tasks.filter((t) => t.type === "opening");
  const closing = tasks.filter((t) => t.type === "closing");
  const doneCount = tasks.filter((t) => t.done).length;

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6f6565" }}>No tasks.</div>
      ) : items.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => toggle(t)} disabled={busyId === t.id} style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: "pointer",
            background: t.done ? "#27ae60" : "transparent", border: t.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 14 }}>
            {t.done ? "✓" : ""}
          </button>
          <span style={{ flex: 1, fontSize: 14, color: t.done ? "#6f6565" : "#fff", textDecoration: t.done ? "line-through" : "none" }}>{t.task}</span>
          {canManage && <button onClick={() => del(t.id)} disabled={busyId === t.id} style={{ background: "none", border: "none", color: "#ec7063", cursor: "pointer", fontSize: 16 }}>×</button>}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>✅ Daily Checklist</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {loading ? "Loading…" : `${doneCount}/${tasks.length} done today`}
      </p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      {!loading && (
        <>
          <Section title="🌅 Opening Tasks" items={opening} />
          <Section title="🌙 Closing Tasks" items={closing} />

          {canManage && (
            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Add a task for today</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...input, width: 120 }}>
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                </select>
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Check fridge temps" style={{ ...input, flex: 1 }} />
                <button onClick={add} style={{ ...primaryBtn, width: "auto", padding: "0 18px" }}>Add</button>
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