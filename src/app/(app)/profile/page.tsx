"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyProfile, updateMyProfile } from "@/lib/queries/people";
import LogoutButton from "@/components/LogoutButton";
import AvatarUpload from "@/components/AvatarUpload";
import DocumentsSection from "@/components/DocumentsSection";
import ProfileSettings from "@/components/ProfileSettings";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";

export default function ProfilePage() {
  const { t } = useLang();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await updateMyProfile({ full_name: fullName, phone, skills });
    setSaving(false);
    if (res.ok) { toast("Profile updated", "success"); setEditing(false); load(); }
    else toast(res.error || "Failed to update.", "error");
  }

  if (loading) return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="👤" size={22} /> {t("profile.title")}</div>
      <div className="page-sub">{t("profile.subtitle")}</div>
      <CardSkeleton rows={5} />
    </div>
  );
  if (!profile) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }}>{t("profile.couldNotLoad")}</div>;

  const isManager = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile.role);
  const skillsArr: string[] = profile.skills || [];

  return (
    <div className="fade-up">
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon e="👤" size={22} /> {t("profile.title")}</div>
      <div className="page-sub">{t("profile.subtitle")}</div>

      <div className="card" style={{ padding: 24 }}>
        {/* avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <AvatarUpload currentUrl={profile.avatar_url} name={profile.full_name} isManager={isManager} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--white)" }}>
              {profile.full_name || "—"}
              {isManager && <span className="mgr-badge">{t("roles." + profile.role)}</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--gold)", marginTop: 2 }}>
              {!isManager && `${t("roles." + profile.role)} · `}{profile.team || "—"}
            </div>
          </div>
        </div>

        {!editing ? (
          <>
            <Row label={t("profile.employeeCode")} value={profile.employee_code || "—"} />
            <Row label={t("profile.email")} value={profile.email || "—"} />
            <Row label={t("profile.phone")} value={profile.phone || "—"} />
            <Row label={t("profile.contract")} value={profile.contract_type || "—"} />
            <Row label={t("profile.contractHours")} value={profile.contract_hours != null ? `${profile.contract_hours}h` : "—"} />
            <Row label={t("profile.status")} value={profile.status || "active"} />

            {/* skills as chips */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>{t("profile.skills")}</div>
              {skillsArr.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {skillsArr.map((s, i) => (
                    <span key={i} style={{ display: "inline-block", padding: "5px 12px", background: "var(--dark3)", border: "1px solid rgba(212,168,71,0.25)", borderRadius: 20, fontSize: 12, color: "var(--white)" }}>{s}</span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--gray)" }}>{t("profile.noSkills")}</div>
              )}
            </div>

            <button onClick={() => setEditing(true)} style={{ ...primaryBtn, marginTop: 20 }}>{t("profile.editProfile")}</button>
          </>
        ) : (
          <>
            <Field label={t("profile.fullName")}><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} /></Field>
            <Field label={t("profile.phone")}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" style={input} /></Field>
            <Field label={t("profile.skillsLabel")}><input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder={t("profile.skillsPlaceholder")} style={input} /></Field>
            <div style={{ fontSize: 11, color: "var(--gray)", marginBottom: 12 }}>{t("profile.managerNote")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); load(); }} style={{ ...primaryBtn, background: "transparent", border: "1px solid rgba(128,128,128,0.3)", color: "var(--white)" }}>{t("common.cancel")}</button>
              <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </>
        )}
      </div>

      {/* Documents — everyone (upload visa, ID, contract, certificates) */}
      <DocumentsSection />

      {/* Settings & Admin — managers & owners only */}
      {isManager && (
        <>
          <div className="section-label">{t("profile.settingsAdmin")}</div>
          <Link href="/settings" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#555,#777)" }}><Icon e="⚙️" size={22} color="#fff" /></div>
            <div style={{ flex: 1 }}><div className="feature-title">{t("profile.branchSettings")}</div><div className="feature-sub">{t("profile.branchSettingsSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/export" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#117a65,#16a085)" }}><Icon e="📤" size={22} color="#fff" /></div>
            <div style={{ flex: 1 }}><div className="feature-title">{t("profile.payrollExport")}</div><div className="feature-sub">{t("profile.payrollExportSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/audit" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#2c3e50,#34495e)" }}><Icon e="🔒" size={22} color="#fff" /></div>
            <div style={{ flex: 1 }}><div className="feature-title">{t("profile.auditLog")}</div><div className="feature-sub">{t("profile.auditLogSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
        </>
      )}

      {/* Preferences + Account — shared across all roles */}
      <ProfileSettings />

      <LogoutButton />
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