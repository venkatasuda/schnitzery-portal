"use client";

import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/lib/queries/people";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillsText, setSkillsText] = useState("");

  async function load() {
    setLoading(true);
    const res = await getMyProfile();
    if (res.ok && res.profile) {
      setProfile(res.profile);
      setFullName(res.profile.full_name || "");
      setPhone(res.profile.phone || "");
      setSkillsText((res.profile.skills || []).join(", "));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setMsg(null);
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await updateMyProfile({ full_name: fullName, phone, skills });
    setSaving(false);
    if (res.ok) { setMsg("✅ Profile updated!"); setEditing(false); load(); }
    else setMsg(res.error || "Failed.");
  }

  if (loading) return (
    <div style={{ color: "var(--gray)", padding: 40, textAlign: "center" }}>
      <div className="spinner" style={{ margin: "0 auto 10px" }} />Loading…
    </div>
  );
  if (!profile) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>Could not load profile.</div>;

  const roleLabel: Record<string, string> = {
    brand_owner: "Brand Owner", franchise_owner: "Franchise Owner", manager: "Manager", staff: "Staff",
  };
  const isManager = ["manager", "franchise_owner", "brand_owner"].includes(profile.role);
  const skillsArr: string[] = profile.skills || [];

  return (
    <div className="fade-up">
      <div className="page-title">👤 My Profile</div>
      <div className="page-sub">Your details and skills</div>

      <div className="card" style={{ padding: 24 }}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div className={`avatar${isManager ? " mgr" : ""}`} style={{ width: 64, height: 64, fontSize: 26 }}>
            {(profile.full_name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--white)" }}>
              {profile.full_name || "—"}
              {isManager && <span className="mgr-badge">{roleLabel[profile.role]}</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--gold)", marginTop: 2 }}>
              {!isManager && `${roleLabel[profile.role] || profile.role} · `}{profile.team || "No team"}
            </div>
          </div>
        </div>

        {!editing ? (
          <>
            <Row label="Employee code" value={profile.employee_code || "—"} />
            <Row label="Email" value={profile.email || "—"} />
            <Row label="Phone" value={profile.phone || "—"} />
            <Row label="Contract" value={profile.contract_type || "—"} />
            <Row label="Contract hours" value={profile.contract_hours != null ? `${profile.contract_hours}h` : "—"} />
            <Row label="Status" value={profile.status || "active"} />

            {/* skills as chips */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>Skills</div>
              {skillsArr.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {skillsArr.map((s, i) => (
                    <span key={i} style={{ display: "inline-block", padding: "5px 12px", background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.25)", borderRadius: 20, fontSize: 12, color: "var(--white)" }}>{s}</span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--gray)" }}>No skills listed.</div>
              )}
            </div>

            <button onClick={() => setEditing(true)} style={{ ...primaryBtn, marginTop: 20 }}>Edit Profile</button>
          </>
        ) : (
          <>
            <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" style={input} /></Field>
            <Field label="Skills (comma-separated)"><input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Grill, Cashier, Opening" style={input} /></Field>
            <div style={{ fontSize: 11, color: "var(--gray)", marginBottom: 12 }}>Team, contract & role are set by your manager.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); load(); }} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(128,128,128,0.3)", color: "var(--white)" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </>
        )}
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: "var(--gold)", textAlign: "center" }}>{msg}</div>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(128,128,128,0.12)", fontSize: 13 }}>
      <span style={{ color: "var(--gray)" }}>{label}</span>
      <span style={{ color: "var(--white)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark3)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, width: "100%", padding: "13px", background: "var(--gold)", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };