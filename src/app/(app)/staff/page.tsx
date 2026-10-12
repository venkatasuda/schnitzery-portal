"use client";

import { useEffect, useRef, useState } from "react";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "former">("active");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ name: string; temp: string } | null>(null);

  // add new staff
  const [showAdd, setShowAdd] = useState(false);
  const addDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (showAdd) addDialog.current?.showModal(); }, [showAdd]);
  const [addForm, setAddForm] = useState<any>({ email: "", password: "", full_name: "", team: "", role: "staff", employee_code: "", contract_type: "", contract_hours: "", phone: "" });
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true); setLoadError(null); setDenied(false);
    try {
      const res = await getStaffList();
      if (!res.ok) { if (res.error?.includes("Managers")) setDenied(true); else setLoadError(res.error || t("staff.failed")); return; }
      setStaff(res.staff);
    } catch { setLoadError(t("staff.networkErr")); }
    finally { setLoading(false); }
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
    try {
    const res = await updateStaff(editId!, {
      full_name: form.full_name, employee_code: form.employee_code,
      team: form.team, contract_type: form.contract_type,
      contract_hours: form.contract_hours === "" ? null : Number(form.contract_hours),
      phone: form.phone, role: form.role,
      skills: form.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
    });
    if (res.ok) { setMsg(t("staff.saved")); setEditId(null); load(); }
    else setMsg(res.error || t("staff.failed"));
    } catch { setMsg(t("staff.networkErr")); }
    finally { setSaving(false); }
  }

  // Remove = deactivate + disable login; Reactivate = restore both. Data is always kept.
  async function setActive(id: string, active: boolean) {
    try {
    const res = await fetch("/api/set-staff-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, active }),
    });
    return res.json().catch(() => ({ ok: false, error: t("staff.networkErr") }));
    } catch { return { ok: false, error: t("staff.networkErr") }; }
  }

  async function remove(id: string) {
    setRemoving(true); setMsg(null);
    const res = await setActive(id, false);
    setRemoving(false);
    if (res.ok) { setConfirmRemoveId(null); setMsg(t("staff.removed")); load(); }
    else setMsg(res.error || t("staff.failed"));
  }

  async function reactivate(id: string) {
    setMsg(null);
    const res = await setActive(id, true);
    if (res.ok) { setMsg(t("staff.reactivated")); load(); }
    else setMsg(res.error || t("staff.failed"));
  }

  async function unlock(id: string) {
    setMsg(null);
    const res = await fetch("/api/unlock-login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: t("staff.networkErr") }));
    if (res.ok) { setMsg(t("staff.unlocked")); load(); }
    else setMsg(res.error || t("staff.unlockFailed"));
  }

  async function resetPassword(id: string) {
    setMsg(null); setResetInfo(null);
    const res = await fetch("/api/reset-staff-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: t("staff.networkErr") }));
    if (res.ok) { setResetInfo({ name: res.name || "", temp: res.tempPassword }); load(); }
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
  const query = search.trim().toLocaleLowerCase();
  const visible = loading || loadError ? [] : (filter === "active" ? activeStaff : formerStaff).filter(p =>
    [p.full_name, p.employee_code, p.team, teamLabel(p.team || "")].some(value => String(value || "").toLocaleLowerCase().includes(query)));

  if (denied) return <div style={{ ...card, textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  return (
    <div className="workspace-page">
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="👥" size={22} /> {t("staff.title")}</h1>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        {loading ? t("common.loading") : t("staff.memberCount", { n: activeStaff.length })}
      </p>

      {msg && <div role="status" style={{ marginBottom: 14, fontSize: 14, color: "var(--white)" }}>{msg}</div>}

      {resetInfo && (
        <div style={{ ...card, marginBottom: 14, borderColor: "rgba(212,168,71,0.5)", background: "rgba(212,168,71,0.08)" }}>
          <div style={{ fontSize: 13, color: "#d4a847", fontWeight: 600, marginBottom: 6 }}>{t("staff.resetPwFor", { name: resetInfo.name })}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: 8, color: "#fff", userSelect: "all" }}>{resetInfo.temp}</code>
            <button onClick={() => { navigator.clipboard?.writeText(resetInfo.temp).catch(() => {}); }} style={editBtn}>⧉ Copy</button>
            <button onClick={() => setResetInfo(null)} style={editBtn}>{t("common.cancel")}</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 8 }}>{t("staff.resetPwHint")}</div>
        </div>
      )}

      <div className="workspace-toolbar">
        <button className="workspace-button primary" onClick={() => { setShowAdd(true); setAddMsg(null); }}>{t("staff.addNew")}</button>
        <Link className="workspace-button" href="/directory">{t("directory.title")}</Link>
        <Link className="workspace-button" href="/notes">{t("schedhub.notes")}</Link>
      </div>

      {showAdd && (
        <dialog ref={addDialog} className="workspace-dialog" aria-labelledby="add-staff-title" onCancel={(e) => { if (adding) e.preventDefault(); else setShowAdd(false); }} onClose={() => setShowAdd(false)}>
          <div>
            <h2 id="add-staff-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("staff.addNewTitle")}</h2>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>{t("staff.addNewSub")}</div>
            <div className="workspace-form-grid">
              <Field label={t("staff.emailReq")}><input autoFocus type="email" autoComplete="off" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} style={input} placeholder="name@email.com" /></Field>
              <Field label={t("staff.tempPw")}><input type="password" autoComplete="new-password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} style={input} placeholder={t("staff.minChars")} /></Field>
              <Field label={t("profile.fullName")}><input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} style={input} /></Field>
              <Field label={t("profile.employeeCode")}><input value={addForm.employee_code} onChange={(e) => setAddForm({ ...addForm, employee_code: e.target.value })} style={input} placeholder={t("staff.codeAuto")} /></Field>
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
            {addMsg && <div style={{ fontSize: 13, color: addMsg.startsWith("✅") ? "var(--success)" : "var(--danger)", textAlign: "center", marginBottom: 10 }}>{addMsg}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={adding} onClick={() => setShowAdd(false)} style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--border)", color: "var(--white)" }}>{t("common.cancel")}</button>
              <button onClick={createStaff} disabled={adding} style={primaryBtn}>{adding ? t("staff.creating") : t("staff.createStaff")}</button>
            </div>
          </div>
        </dialog>
      )}

      {loading && <CardSkeleton rows={5} />}
      {loadError && <div className="card" role="alert"><p>{loadError}</p><button className="workspace-button" onClick={load}>{t("business.retry")}</button></div>}

      {!loading && !loadError && (
        <div className="workspace-toolbar" role="group" aria-label={t("staff.filters")}>
          <input type="search" aria-label={t("staff.search")} style={{ ...input, flex: "1 1 260px", width: "auto" }} placeholder={t("staff.search")} value={search} onChange={e => { setSearch(e.target.value); setConfirmRemoveId(null); }} />
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
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.full_name || "—"} {p.employee_code && <span style={{ fontSize: 12, color: "var(--gray)" }}>· {p.employee_code}</span>}{filter === "former" && <span style={{ fontSize: 12, color: "var(--gray)" }}> · {t("staff.former")}</span>}{p.login_locked && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", background: "rgba(231,76,60,0.15)", border: "1px solid rgba(231,76,60,0.35)", borderRadius: 5, padding: "1px 6px", marginLeft: 6 }}>🔒 {t("staff.locked")}</span>}</div>
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>{p.team ? teamLabel(p.team) : t("directory.noTeam")} · {roleLabel(p.role)} · {p.contract_type ? contractLabel(p.contract_type) : "—"}</div>
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
                <div className="workspace-toolbar" style={{ marginTop: 16 }}>
                  <Link href={`/staff/${p.id}`} style={{ ...editBtn, textDecoration: "none" }}>{t("staff.view")}</Link>
                  {filter === "active" ? (
                    <>
                      <button onClick={() => startEdit(p)} style={editBtn}>{t("common.edit")}</button>
                      <button onClick={() => resetPassword(p.id)} style={editBtn}>🔑 {t("staff.resetPw")}</button>
                      {p.login_locked && <button onClick={() => unlock(p.id)} style={{ ...editBtn, color: "var(--success)" }}>🔓 {t("staff.unlock")}</button>}
                      <button onClick={() => setConfirmRemoveId(p.id)} style={{ ...editBtn, color: "var(--danger)" }}>{t("staff.remove")}</button>
                    </>
                  ) : (
                    <button onClick={() => reactivate(p.id)} style={{ ...editBtn, color: "var(--success)" }}>{t("staff.reactivate")}</button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("staff.editName", { name: p.full_name })}</div>
              <div className="workspace-form-grid">
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
              </div>
              <Field label={t("profile.skillsLabel")}><input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} style={input} placeholder="Grill, Cashier, Opening" /></Field>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => setEditId(null)} style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--border)", color: "var(--white)" }}>{t("common.cancel")}</button>
                <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? t("common.saving") : t("common.save")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {!loading && !loadError && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>
          {query ? t("staff.noMatches") : filter === "active" ? t("staff.noActive") : t("staff.noFormer")}
        </div>
      )}


    </div>
  );
}

function Field({ label, children }: any) {
  return <label style={{ display: "block", marginBottom: 10 }}><span style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 4 }}>{label}</span>{children}</label>;
}
function FilterBtn({ active, onClick, children }: any) {
  return <button aria-pressed={active} onClick={onClick} style={{ minHeight: 44, padding: "9px 16px", background: active ? "var(--action)" : "transparent", color: active ? "var(--on-action)" : "var(--gray)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 };
const editBtn: React.CSSProperties = { padding: "8px 16px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 13, cursor: "pointer" };
const input: React.CSSProperties = { width: "100%", padding: "9px", background: "var(--dark2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 13, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, padding: "12px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
