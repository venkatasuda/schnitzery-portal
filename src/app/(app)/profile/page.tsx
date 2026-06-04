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

  if (loading) return <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>;
  if (!profile) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>Could not load profile.</div>;

  const roleLabel: Record<string, string> = {
    brand_owner: "Brand Owner", franchise_owner: "Franchise Owner", manager: "Manager", staff: "Staff",
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 16 }}>👤 My Profile</h1>

      <div style={card}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#d4a847", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#1a0e0e" }}>
            {(profile.full_name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.full_name || "—"}</div>
            <div style={{ fontSize: 13, color: "#d4a847" }}>{roleLabel[profile.role] || profile.role} · {profile.team || "No team"}</div>
          </div>
        </div>

        {!editing ? (
          <>
            <Row label="Employee code" value={profile.employee_code || "—"} />
            <Row label="Email" value={profile.email || "—"} />
            <Row label="Phone" value={profile.phone || "—"} />
            <Row label="Contract" value={profile.contract_type || "—"} />
            <Row label="Contract hours" value={profile.contract_hours != null ? `${profile.contract_hours}h` : "—"} />
            <Row label="Skills" value={(profile.skills || []).length ? profile.skills.join(", ") : "—"} />
            <Row label="Status" value={profile.status || "active"} />
            <button onClick={() => setEditing(true)} style={{ ...primaryBtn, marginTop: 16 }}>Edit Profile</button>
          </>
        ) : (
          <>
            <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" style={input} /></Field>
            <Field label="Skills (comma-separated)"><input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Grill, Cashier, Opening" style={input} /></Field>
            <div style={{ fontSize: 11, color: "#6f6565", marginBottom: 12 }}>Team, contract & role are set by your manager.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); load(); }} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </>
        )}
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: "#d4a847", textAlign: "center" }}>{msg}</div>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
      <span style={{ color: "#9a8f8f" }}>{label}</span>
      <span style={{ color: "#fff", textAlign: "right" }}>{value}</span>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, color: "#9a8f8f", marginBottom: 6 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 };
const input: React.CSSProperties = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, width: "100%", padding: "13px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };