"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStaffList, updateStaff } from "@/lib/queries/people";
import { CardSkeleton } from "@/components/Skeleton";

const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier"];
const CONTRACTS = ["Working Student", "Part Time", "Full Time", "Mini Job"];
const ROLES = ["staff", "manager", "franchise_owner", "brand_owner"];
const TEAM_COLORS: Record<string, string> = { Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60", Cashier: "#9b59b6" };

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // add new staff
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<any>({ email: "", password: "", full_name: "", team: "", role: "staff", employee_code: "", contract_type: "", contract_hours: "", phone: "" });
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await getStaffList();
    if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); setLoading(false); return; }
    setStaff(res.staff);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEdit(p: any) {
    setEditId(p.id);
    setForm({
      full_name: p.full_name || "", employee_code: p.employee_code || "",
      team: p.team || "", contract_type: p.contract_type || "",
      contract_hours: p.contract_hours ?? "", phone: p.phone || "",
      role: p.role || "staff", status: p.status || "active",
      skills: (p.skills || []).join(", "),
    });
    setMsg(null);
  }

  async function save() {
    setSaving(true); setMsg(null);
    const res = await updateStaff(editId!, {
      full_name: form.full_name, employee_code: form.employee_code,
      team: form.team, contract_type: form.contract_type,
      contract_hours: form.contract_hours === "" ? null : Number(form.contract_hours),
      phone: form.phone, role: form.role, status: form.status,
      skills: form.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
    });
    setSaving(false);
    if (res.ok) { setMsg("✅ Saved!"); setEditId(null); load(); }
    else setMsg(res.error || "Failed.");
  }

  async function createStaff() {
    setAdding(true); setAddMsg(null);
    if (!addForm.email || !addForm.password) { setAddMsg("Email and password required."); setAdding(false); return; }
    try {
      const res = await fetch("/api/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          contract_hours: addForm.contract_hours === "" ? null : Number(addForm.contract_hours),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAddMsg("✅ Staff created! They can log in with that email + password.");
        setAddForm({ email: "", password: "", full_name: "", team: "", role: "staff", employee_code: "", contract_type: "", contract_hours: "", phone: "" });
        load();
        setTimeout(() => { setShowAdd(false); setAddMsg(null); }, 1500);
      } else {
        setAddMsg(data.error || "Failed to create staff.");
      }
    } catch (e: any) {
      setAddMsg("Network error. Try again.");
    }
    setAdding(false);
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Managers only.</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>👥 Staff Management</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {loading ? "Loading…" : `${staff.length} team member${staff.length !== 1 ? "s" : ""}`}
      </p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      <button onClick={() => { setShowAdd(true); setAddMsg(null); }} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>➕ Add New Staff</button>

      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, maxWidth: 460, width: "100%", marginTop: 30 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add New Staff</div>
            <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 14 }}>They&apos;ll log in with this email + temporary password.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Email *"><input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} style={input} placeholder="name@email.com" /></Field>
              <Field label="Temp password *"><input value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} style={input} placeholder="min 6 chars" /></Field>
              <Field label="Full name"><input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} style={input} /></Field>
              <Field label="Employee code"><input value={addForm.employee_code} onChange={(e) => setAddForm({ ...addForm, employee_code: e.target.value })} style={input} placeholder="KIT-021" /></Field>
              <Field label="Team">
                <select value={addForm.team} onChange={(e) => setAddForm({ ...addForm, team: e.target.value })} style={input}>
                  <option value="">—</option>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Role">
                <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} style={input}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Contract">
                <select value={addForm.contract_type} onChange={(e) => setAddForm({ ...addForm, contract_type: e.target.value })} style={input}>
                  <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Contract hours"><input type="number" value={addForm.contract_hours} onChange={(e) => setAddForm({ ...addForm, contract_hours: e.target.value })} style={input} /></Field>
            </div>
            <Field label="Phone"><input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} style={input} /></Field>
            {addMsg && <div style={{ fontSize: 13, color: addMsg.startsWith("✅") ? "#58d68d" : "#ec7063", textAlign: "center", marginBottom: 10 }}>{addMsg}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>Cancel</button>
              <button onClick={createStaff} disabled={adding} style={primaryBtn}>{adding ? "Creating…" : "Create Staff"}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <CardSkeleton rows={5} />}

      {staff.map((p) => (
        <div key={p.id} style={{ ...card, marginBottom: 8 }}>
          {editId !== p.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: TEAM_COLORS[p.team] || "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                {(p.full_name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.full_name || "—"} {p.employee_code && <span style={{ fontSize: 11, color: "#9a8f8f" }}>· {p.employee_code}</span>}</div>
                <div style={{ fontSize: 12, color: "#9a8f8f" }}>{p.team || "No team"} · {p.role} · {p.contract_type || "—"}</div>
              </div>
              <Link href={`/staff/${p.id}`} style={{ ...editBtn, textDecoration: "none" }}>View</Link>
              <button onClick={() => startEdit(p)} style={editBtn}>Edit</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit {p.full_name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={input} /></Field>
                <Field label="Employee code"><input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} style={input} placeholder="KIT-020" /></Field>
                <Field label="Team">
                  <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} style={input}>
                    <option value="">—</option>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Role">
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={input}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Contract">
                  <select value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} style={input}>
                    <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Contract hours"><input type="number" value={form.contract_hours} onChange={(e) => setForm({ ...form, contract_hours: e.target.value })} style={input} placeholder="20" /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                    <option value="active">active</option><option value="inactive">inactive</option>
                  </select>
                </Field>
              </div>
              <Field label="Skills (comma-separated)"><input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} style={input} placeholder="Grill, Cashier, Opening" /></Field>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => setEditId(null)} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>Cancel</button>
                <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div style={{ ...card, marginTop: 10, textAlign: "center", fontSize: 12, color: "#6f6565" }}>
        ➕ Adding new staff with login accounts is coming as the next step.
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 11, color: "#9a8f8f", marginBottom: 4 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 };
const editBtn: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };
const input: React.CSSProperties = { width: "100%", padding: "9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };