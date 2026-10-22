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
import { Field, Stat } from "@/components/ui";

export default function ProfilePage() {
  const { t } = useLang();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillsText, setSkillsText] = useState("");

  async function load() {
    setLoading(true); setLoadError(null);
    try {
    const res = await getMyProfile();
    if (res.ok && res.profile) {
      setProfile(res.profile);
      setFullName(res.profile.full_name || "");
      setPhone(res.profile.phone || "");
      setSkillsText((res.profile.skills || []).join(", "));
    } else { setLoadError(t("profile.couldNotLoad")); }
    } catch { setLoadError(t("staff.networkErr")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await updateMyProfile({ full_name: fullName, phone, skills });
    if (res.ok) { toast("Profile updated", "success"); setEditing(false); load(); }
    else toast(res.error || "Failed to update.", "error");
    } catch { toast(t("staff.networkErr"), "error"); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="👤" size={22} /> {t("profile.title")}</h1>
      <div className="page-sub">{t("profile.subtitle")}</div>
      <CardSkeleton rows={5} />
    </div>
  );
  if (loadError || !profile) return <div className="card" role="alert"><p>{loadError || t("profile.couldNotLoad")}</p><button className="workspace-button" onClick={load}>{t("business.retry")}</button></div>;

  const isManager = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile.role);
  const skillsArr: string[] = profile.skills || [];

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="👤" size={22} /> {t("profile.title")}</h1>
      <div className="page-sub">{t("profile.subtitle")}</div>

      <div className="card p-6">
        {/* avatar + name */}
        <div className="d-flex ai-c gap-4 mb-5">
          <AvatarUpload currentUrl={profile.avatar_url} name={profile.full_name} isManager={isManager} />
          <div>
            <div className="t-xl fw-7 u-text">
              {profile.full_name || "—"}
              {isManager && <span className="mgr-badge">{t("roles." + profile.role)}</span>}
            </div>
            <div className="t-sm tone-action mt-h">
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
            <div className="mt-4">
              <div className="t-xs u-muted mb-2">{t("profile.skills")}</div>
              {skillsArr.length ? (
                <div className="d-flex f-wrap gap-2">
                  {skillsArr.map((s, i) => (
                    <span key={i} style={{ display: "inline-block", padding: "5px 12px", background: "var(--dark3)", border: "1px solid var(--accent-line)", borderRadius: 20, fontSize: 12, color: "var(--white)" }}>{s}</span>
                  ))}
                </div>
              ) : (
                <div className="ui-muted-md">{t("profile.noSkills")}</div>
              )}
            </div>

            <button onClick={() => setEditing(true)} style={{ ...primaryBtn, marginTop: 20 }}>{t("profile.editProfile")}</button>
          </>
        ) : (
          <>
            <Field label={t("profile.fullName")}><input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label={t("profile.phone")}><input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" /></Field>
            <Field label={t("profile.skillsLabel")}><input className="form-input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder={t("profile.skillsPlaceholder")} /></Field>
            <div className="ui-sub">{t("profile.managerNote")}</div>
            <div className="u-hstack">
              <button onClick={() => { setEditing(false); load(); }} style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--border)", color: "var(--white)" }}>{t("common.cancel")}</button>
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
          <div className="workspace-grid profile-admin">
          <Link href="/settings" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#555,#777)" }}><Icon e="⚙️" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("profile.branchSettings")}</div><div className="feature-sub">{t("profile.branchSettingsSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/export" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#117a65,#16a085)" }}><Icon e="📤" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("profile.payrollExport")}</div><div className="feature-sub">{t("profile.payrollExportSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/audit" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#2c3e50,#34495e)" }}><Icon e="🔒" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("profile.auditLog")}</div><div className="feature-sub">{t("profile.auditLogSub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          <Link href="/clock-display" className="feature-card">
            <div className="feature-icon" style={{ background: "linear-gradient(135deg,#1a6b8a,#3498db)" }}><Icon e="📲" size={22} color="#fff" /></div>
            <div className="u-flex1"><div className="feature-title">{t("sh.clockDisplay")}</div><div className="feature-sub">{t("sh.clockDisplaySub")}</div></div>
            <span className="feature-chev">›</span>
          </Link>
          </div>
        </>
      )}

      {/* Preferences + Account — shared across all roles */}
      <ProfileSettings />

      <LogoutButton />
    </div>
  );
}

const input: React.CSSProperties = { width: "100%", padding: "11px", background: "var(--dark3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--white)", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { flex: 1, width: "100%", padding: "13px", background: "var(--action)", color: "var(--on-action)", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" };

function Row({ label, value }: { label: string; value: string }) {
  return <Stat variant="row" label={label} value={value} />;
}
