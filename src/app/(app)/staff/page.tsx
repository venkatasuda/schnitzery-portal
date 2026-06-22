"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStaffList, updateStaff } from "@/lib/queries/people";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier"];
const CONTRACTS = ["Working Student", "Part Time", "Full Time", "Mini Job"];
const ROLES = ["staff", "manager", "branch_owner", "brand_owner"];
const TEAM_COLORS: Record<string, string> = { Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60", Cashier: "#9b59b6" };

export default function StaffPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (TEAMS.includes(k) ? t("teams." + k) : k);
  const roleLabel = (k: string) => (ROLES.includes(k) ? t("roles." + k) : k);
  const contractLabel = (k: string) => (CONTRACTS.includes(k) ? t("contracts." + k) : k);
  const statusLabel = (k: string) => (["active", "inactive"].includes(k) ? t("status." + k) : k);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "former">("active");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

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
    if (res.ok) { setMsg(t("staff.saved")); setEditId(null); load(); }
    else setMsg(res.error || t("staff.failed"));
  }

  // Soft delete: mark as inactive. Keeps the row + all history in the database.
  async function remove(id: string) {
    setRemoving(true); setMsg(null);
    const res = await updateStaff(id, { status: "inactive" });
    setRemoving(false);
    if (res.ok) { setConfirmRemoveId(null); setMsg(t("staff.removed")); load(); }
    else setMsg(res.error || t("staff.failed"));
  }

  async function reactivate(id: string) {
    setMsg(null);
    const res = await updateStaff(id, { status: "active" });
    if (res.ok) { setMsg(t("staff.reactivated")); load(); }
    else setMsg(res.error || t("staff.failed"));
  }

  async function createStaff() {
    setAdding(true); setAddMsg(null);
    if (!addForm.email || !addForm.password) { setAddMsg(t("staff.emailReqMsg")); setAdding(false); return; }
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
        setAddMsg(t("staff.created"));
        setAddForm({ email: "", password: "", full_name: "", team: "", role: "staff", employee_code: "", contract_type: "", contract_hours: "", phone: "" });
        load();
        setTimeout(() => { setShowAdd(false); setAddMsg(null); }, 1500);
      } else {
        setAddMsg(data.error || t("staff.failCreate"));
      }
    } catch (e: any) {
      setAddMsg(t("staff.networkErr"));
    }
    setAdding(false);
  }

  const activeStaff = staff.filter((p) => (p.status || "active") === "active");
  const formerStaff = staff.filter((p) => (p.status || "active") !== "active");
  const visible = filter === "active" ? activeStaff : formerStaff;

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="👥" size={22} /> {t("staff.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>
        {loading ? t("common.loading") : t("staff.memberCount", { n: activeStaff.length })}
      </p>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}

      <button onClick={() => { setShowAdd(true); setAddMsg(null); }} style={{ ...primaryBtn, width: "100%", marginBottom: 14 }}>{t("staff.addNew")}</button>

      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, maxWidth: 460, width: "100%", marginTop: 30 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t("staff.addNewTitle")}</div>
            <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 14 }}>{t("staff.addNewSub")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={t("staff.emailReq")}><input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} style={input} placeholder="name@email.com" /></Field>
              <Field label={t("staff.tempPw")}><input value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} style={input} placeholder={t("staff.minChars")} /></Field>
              <Field label={t("profile.fullName")}><input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} style={input} /></Field>
              <Field label={t("profile.employeeCode")}><input value={addForm.employee_code} onChange={(e) => setAddForm({ ...addForm, employee_code: e.target.value })} style={input} placeholder="KIT-021" /></Field>
              <Field label={t("staff.team")}>
                <select value={addForm.team} onChange={(e) => setAddForm({ ...addForm, team: e.target.value })} style={input}>
                  <option value="">—</option>{TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                </select>
              </Field>
              <Field label={t("staff.role")}>
                <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} style={input}>
                  {ROLES.map((rl) => <option key={rl} value={rl}>{roleLabel(rl)}</option>)}
                </select>
              </Field>
              <Field label={t("profile.contract")}>
                <select value={addForm.contract_type} onChange={(e) => setAddForm({ ...addForm, contract_type: e.target.value })} style={input}>
                  <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{contractLabel(c)}</option>)}
                </select>
              </Field>
              <Field label={t("profile.contractHours")}><input type="number" value={addForm.contract_hours} onChange={(e) => setAddForm({ ...addForm, contract_hours: e.target.value })} style={input} /></Field>
            </div>
            <Field label={t("profile.phone")}><input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} style={input} /></Field>
            {addMsg && <div style={{ fontSize: 13, color: addMsg.startsWith("✅") ? "#58d68d" : "#ec7063", textAlign: "center", marginBottom: 10 }}>{addMsg}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>{t("common.cancel")}</button>
              <button onClick={createStaff} disabled={adding} style={primaryBtn}>{adding ? t("staff.creating") : t("staff.createStaff")}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <CardSkeleton rows={5} />}

      {!loading && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
          <FilterBtn active={filter === "active"} onClick={() => { setFilter("active"); setConfirmRemoveId(null); }}>{t("staff.filterActive")} ({activeStaff.length})</FilterBtn>
          <FilterBtn active={filter === "former"} onClick={() => { setFilter("former"); setConfirmRemoveId(null); }}>{t("staff.filterFormer")} ({formerStaff.length})</FilterBtn>
        </div>
      )}

      {visible.map((p) => (
        <div key={p.id} style={{ ...card, marginBottom: 8 }}>
          {editId !== p.id ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: TEAM_COLORS[p.team] || "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", opacity: filter === "former" ? 0.55 : 1 }}>
                  {(p.full_name || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.full_name || "—"} {p.employee_code && <span style={{ fontSize: 11, color: "#9a8f8f" }}>· {p.employee_code}</span>}{filter === "former" && <span style={{ fontSize: 11, color: "#9a8f8f" }}> · {t("staff.former")}</span>}</div>
                  <div style={{ fontSize: 12, color: "#9a8f8f" }}>{p.team ? teamLabel(p.team) : t("directory.noTeam")} · {roleLabel(p.role)} · {p.contract_type ? contractLabel(p.contract_type) : "—"}</div>
                </div>
              </div>

              {confirmRemoveId === p.id ? (
                <div style={{ marginTop: 12, padding: 12, background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>{t("staff.confirmRemove", { name: p.full_name || "—" })}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmRemoveId(null)} style={editBtn}>{t("common.cancel")}</button>
                    <button onClick={() => remove(p.id)} disabled={removing} style={{ ...editBtn, background: "rgba(192,57,43,0.25)", border: "1px solid rgba(192,57,43,0.5)", color: "#fff" }}>{removing ? t("common.saving") : t("staff.remove")}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link href={`/staff/${p.id}`} style={{ ...editBtn, textDecoration: "none" }}>{t("staff.view")}</Link>
                  {filter === "active" ? (
                    <>
                      <button onClick={() => startEdit(p)} style={editBtn}>{t("common.edit")}</button>
                      <button onClick={() => setConfirmRemoveId(p.id)} style={{ ...editBtn, color: "#e08283" }}>{t("staff.remove")}</button>
                    </>
                  ) : (
                    <button onClick={() => reactivate(p.id)} style={{ ...editBtn, color: "#58d68d" }}>{t("staff.reactivate")}</button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("staff.editName", { name: p.full_name })}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={t("profile.fullName")}><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={input} /></Field>
                <Field label={t("profile.employeeCode")}><input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} style={input} placeholder="KIT-020" /></Field>
                <Field label={t("staff.team")}>
                  <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} style={input}>
                    <option value="">—</option>{TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                  </select>
                </Field>
                <Field label={t("staff.role")}>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={input}>
                    {ROLES.map((rl) => <option key={rl} value={rl}>{roleLabel(rl)}</option>)}
                  </select>
                </Field>
                <Field label={t("profile.contract")}>
                  <select value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} style={input}>
                    <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{contractLabel(c)}</option>)}
                  </select>
                </Field>
                <Field label={t("profile.contractHours")}><input type="number" value={form.contract_hours} onChange={(e) => setForm({ ...form, contract_hours: e.target.value })} style={input} placeholder="20" /></Field>
                <Field label={t("profile.phone")}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} /></Field>
                <Field label={t("profile.status")}>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                    <option value="active">{t("status.active")}</option><option value="inactive">{t("status.inactive")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("profile.skillsLabel")}><input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} style={input} placeholder="Grill, Cashier, Opening" /></Field>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => setEditId(null)} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>{t("common.cancel")}</button>
                <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? t("common.saving") : t("common.save")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {!loading && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", fontSize: 13 }}>
          {filter === "active" ? t("staff.noActive") : t("staff.noFormer")}
        </div>
      )}

      <div style={{ ...card, marginTop: 10, textAlign: "center", fontSize: 12, color: "#6f6565" }}>
        {t("staff.footerNote")}
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 11, color: "#9a8f8f", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function FilterBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ flex: 1, padding: "9px", background: active ? "#d4a847" : "transparent", color: active ? "#1a0e0e" : "#9a8f8f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 };
const editBtn: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" };
const input: React.CSSProperties = { width: "100%", padding: "9px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };