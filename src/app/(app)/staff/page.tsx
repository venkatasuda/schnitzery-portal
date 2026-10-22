"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getStaffList, updateStaff } from "@/lib/queries/people";
import { CardSkeleton } from "@/components/Skeleton";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { Field } from "@/components/ui";

const TEAMS = ["Manager", "Preparation", "Kitchen", "Cashier"];
const CONTRACTS = ["Working Student", "Part Time", "Full Time", "Mini Job"];
const ROLES = ["staff", "manager", "branch_owner", "brand_owner"];
const TEAM_COLORS: Record<string, string> = { Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)", Cashier: "#9b59b6" };

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

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="👥" size={22} /> {t("staff.title")}</h1>
      <p className="ui-lede">
        {loading ? t("common.loading") : t("staff.memberCount", { n: activeStaff.length })}
      </p>

      {msg && <div className="mb-4 t-md u-text" role="status">{msg}</div>}

      {resetInfo && (
        <div className="card ui-callout" role="status">
          <div className="t-sm tone-action fw-6 mb-2">{t("staff.resetPwFor", { name: resetInfo.name })}</div>
          <div className="d-flex ai-c gap-2 f-wrap">
            <code className="ui-secret">{resetInfo.temp}</code>
            <button onClick={() => { navigator.clipboard?.writeText(resetInfo.temp).catch(() => {}); }} className="workspace-button">⧉ {t("common.copy")}</button>
            <button onClick={() => setResetInfo(null)} className="workspace-button">{t("common.cancel")}</button>
          </div>
          <div className="ui-note">{t("staff.resetPwHint")}</div>
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
            <h2 id="add-staff-title" className="ui-dialog-title">{t("staff.addNewTitle")}</h2>
            <div className="t-xs u-muted mb-4">{t("staff.addNewSub")}</div>
            <div className="workspace-form-grid">
              <Field label={t("staff.emailReq")}><input className="form-input" autoFocus type="email" autoComplete="off" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@email.com" /></Field>
              <Field label={t("staff.tempPw")}><input className="form-input" type="password" autoComplete="new-password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder={t("staff.minChars")} /></Field>
              <Field label={t("profile.fullName")}><input className="form-input" value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} /></Field>
              <Field label={t("profile.employeeCode")}><input className="form-input" value={addForm.employee_code} onChange={(e) => setAddForm({ ...addForm, employee_code: e.target.value })} placeholder={t("staff.codeAuto")} /></Field>
              <Field label={t("staff.team")}>
                <select className="form-input" value={addForm.team} onChange={(e) => setAddForm({ ...addForm, team: e.target.value })}>
                  <option value="">—</option>{TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                </select>
              </Field>
              <Field label={t("staff.role")}>
                <select className="form-input" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                  {ROLES.map((rl) => <option key={rl} value={rl}>{roleLabel(rl)}</option>)}
                </select>
              </Field>
              <Field label={t("profile.contract")}>
                <select className="form-input" value={addForm.contract_type} onChange={(e) => setAddForm({ ...addForm, contract_type: e.target.value })}>
                  <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{contractLabel(c)}</option>)}
                </select>
              </Field>
              <Field label={t("profile.contractHours")}><input className="form-input" type="number" value={addForm.contract_hours} onChange={(e) => setAddForm({ ...addForm, contract_hours: e.target.value })} /></Field>
            </div>
            <Field label={t("profile.phone")}><input className="form-input" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} /></Field>
            {addMsg && <div className={`t-sm u-center mb-3 ${addMsg.startsWith("✅") ? "ui-msg-ok" : "ui-msg-err"}`} role="status">{addMsg}</div>}
            <div className="u-hstack">
              <button disabled={adding} onClick={() => setShowAdd(false)} className="btn-secondary u-flex1">{t("common.cancel")}</button>
              <button className="btn-gold u-flex1" onClick={createStaff} disabled={adding}>{adding ? t("staff.creating") : t("staff.createStaff")}</button>
            </div>
          </div>
        </dialog>
      )}

      {loading && <CardSkeleton rows={5} />}
      {loadError && <div className="card" role="alert"><p>{loadError}</p><button className="workspace-button" onClick={load}>{t("business.retry")}</button></div>}

      {!loading && !loadError && (
        <div className="workspace-toolbar" role="group" aria-label={t("staff.filters")}>
          <input type="search" className="form-input" aria-label={t("staff.search")} placeholder={t("staff.search")} value={search} onChange={e => { setSearch(e.target.value); setConfirmRemoveId(null); }} />
          <FilterBtn active={filter === "active"} onClick={() => { setFilter("active"); setConfirmRemoveId(null); }}>{t("staff.filterActive")} ({activeStaff.length})</FilterBtn>
          <FilterBtn active={filter === "former"} onClick={() => { setFilter("former"); setConfirmRemoveId(null); }}>{t("staff.filterFormer")} ({formerStaff.length})</FilterBtn>
        </div>
      )}

      {visible.map((p) => (
        <div key={p.id} className="card mb-2">
          {editId !== p.id ? (
            <div>
              <div className="d-flex ai-c gap-4">
                <div className={`ui-avatar${filter === "former" ? " muted" : ""}`} style={{ background: TEAM_COLORS[p.team] || "#666" }} aria-hidden="true">
                  {(p.full_name || "?")[0].toUpperCase()}
                </div>
                <div className="u-flex1">
                  <div className="t-lg fw-6">{p.full_name || "—"} {p.employee_code && <span className="ui-muted">· {p.employee_code}</span>}{filter === "former" && <span className="ui-muted"> · {t("staff.former")}</span>}{p.login_locked && <span className="ui-tag-danger">🔒 {t("staff.locked")}</span>}</div>
                  <div className="ui-muted">{p.team ? teamLabel(p.team) : t("directory.noTeam")} · {roleLabel(p.role)} · {p.contract_type ? contractLabel(p.contract_type) : "—"}</div>
                </div>
              </div>

              {confirmRemoveId === p.id ? (
                <div className="ui-confirm" role="alertdialog" aria-label={t("staff.remove")}>
                  <div className="t-sm mb-3">{t("staff.confirmRemove", { name: p.full_name || "—" })}</div>
                  <div className="u-hstack">
                    <button onClick={() => setConfirmRemoveId(null)} className="workspace-button">{t("common.cancel")}</button>
                    <button onClick={() => remove(p.id)} disabled={removing} className="workspace-button danger">{removing ? t("common.saving") : t("staff.remove")}</button>
                  </div>
                </div>
              ) : (
                <div className="workspace-toolbar mt-4">
                  <Link href={`/staff/${p.id}`} className="workspace-button">{t("staff.view")}</Link>
                  {filter === "active" ? (
                    <>
                      <button onClick={() => startEdit(p)} className="workspace-button">{t("common.edit")}</button>
                      <button onClick={() => resetPassword(p.id)} className="workspace-button">🔑 {t("staff.resetPw")}</button>
                      {p.login_locked && <button onClick={() => unlock(p.id)} className="workspace-button success">🔓 {t("staff.unlock")}</button>}
                      <button onClick={() => setConfirmRemoveId(p.id)} className="workspace-button danger">{t("staff.remove")}</button>
                    </>
                  ) : (
                    <button onClick={() => reactivate(p.id)} className="workspace-button success">{t("staff.reactivate")}</button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="t-md fw-7 mb-3">{t("staff.editName", { name: p.full_name })}</div>
              <div className="workspace-form-grid">
                <Field label={t("profile.fullName")}><input className="form-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
                <Field label={t("profile.employeeCode")}><input className="form-input" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="KIT-020" /></Field>
                <Field label={t("staff.team")}>
                  <select className="form-input" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                    <option value="">—</option>{TEAMS.map((tm) => <option key={tm} value={tm}>{teamLabel(tm)}</option>)}
                  </select>
                </Field>
                <Field label={t("staff.role")}>
                  <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map((rl) => <option key={rl} value={rl}>{roleLabel(rl)}</option>)}
                  </select>
                </Field>
                <Field label={t("profile.contract")}>
                  <select className="form-input" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                    <option value="">—</option>{CONTRACTS.map((c) => <option key={c} value={c}>{contractLabel(c)}</option>)}
                  </select>
                </Field>
                <Field label={t("profile.contractHours")}><input className="form-input" type="number" value={form.contract_hours} onChange={(e) => setForm({ ...form, contract_hours: e.target.value })} placeholder="20" /></Field>
                <Field label={t("profile.phone")}><input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              </div>
              <Field label={t("profile.skillsLabel")}><input className="form-input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Grill, Cashier, Opening" /></Field>
              <div className="d-flex gap-2 mt-2">
                <button onClick={() => setEditId(null)} className="btn-secondary u-flex1">{t("common.cancel")}</button>
                <button className="btn-gold u-flex1" onClick={save} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {!loading && !loadError && visible.length === 0 && (
        <div className="card ui-empty-msg">
          {query ? t("staff.noMatches") : filter === "active" ? t("staff.noActive") : t("staff.noFormer")}
        </div>
      )}


    </div>
  );
}

function FilterBtn({ active, onClick, children }: any) {
  return <button aria-pressed={active} onClick={onClick} className="workspace-button">{children}</button>;
}
