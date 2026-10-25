import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ManagementNav, { ManagementLocation } from "@/components/ManagementNav";
import ThemeToggle from "@/components/ThemeToggle";
import AgentWidget from "@/components/AgentWidget";
import NotificationBell from "@/components/NotificationBell";
import AttendanceSync from "@/components/AttendanceSync";
import ToastHost from "@/components/Toast";
import LanguageProvider from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import LanguageToggle from "@/components/LanguageToggle";
import BranchPicker from "@/components/BranchPicker";
import { activeBranchFor, branchChoices } from "@/lib/activeBranch";
import { getLocale, getT } from "@/lib/i18n/server";
import { getViewMode } from "@/lib/viewMode";

// Protected layout — header (notifications + theme toggle) + content + nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in → send to login (this layout is the auth gate; there is no middleware).
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, branch_id, avatar_url, must_change_password")
    .eq("id", user.id)
    .single();

  // First login on a seeded/temporary password → force a password change.
  // /change-password lives outside the (app) group, so this can't loop.
  if (profile?.must_change_password) redirect("/change-password");

  const role = profile?.role || "staff";

  // A kiosk-tablet account belongs only on the kiosk screen, never in the app.
  if (role === "kiosk") redirect("/kiosk");

  const isManager = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role);
  const isHQ = ["brand_owner", "super_admin"].includes(role);
  const viewMode = await getViewMode();
  // A brand owner in "branch" mode navigates as a manager; otherwise as owner.
  // Non-HQ roles ignore viewMode entirely.
  const navRole = isHQ && viewMode === "branch" ? "manager" : role;
  // Branch picker: brand owners always (HQ + branches); managers/owners with 2+ branches.
  const branches = isManager ? await branchChoices(supabase) : [];
  const showPicker = isHQ || branches.length > 1;
  const activeBranch = showPicker ? (isHQ && viewMode === "hq" ? "hq" : await activeBranchFor(supabase, { role, branch_id: profile?.branch_id })) : null;

  return (
    <LanguageProvider initialLocale={locale}>
    <div className={isManager ? "management-shell" : "employee-shell"}>
      <a href="#main-content" className="skip-link">{locale === "de" ? "Zum Inhalt" : "Skip to content"}</a>
      {isManager && <ManagementNav role={navRole} />}
      <header className="app-header">
        <div className="header-leading">
          {isManager && <ManagementNav role={navRole} mobile />}
          <div className="header-context">
          {isManager ? <ManagementLocation role={navRole} /> : <div className="brand">Schnitzery Portal</div>}
          <div className="sub">{t(`roles.${role}`)}</div>
          </div>
        </div>
        {/* key: remount when the active branch changes elsewhere (e.g. "Open" on All my branches) */}
        {showPicker && <div className="header-branch"><BranchPicker key={activeBranch ?? ""} branches={branches} current={activeBranch ?? ""} hq={isHQ} /></div>}
        <div className="header-right">
          <span className="header-name">{profile?.full_name || user?.email}</span>
          {isManager && <Link href="/search" aria-label={locale === "de" ? "Suchen" : "Search"} className="header-search"><Icon e="🔍" size={18} /></Link>}
          <NotificationBell />
          <button type="button" className="header-control" popoverTarget="display-preferences" aria-label={locale === "de" ? "Sprache und Darstellung" : "Language and appearance"} title={locale === "de" ? "Sprache und Darstellung" : "Language and appearance"}><Icon e="⚙️" size={20} /></button>
          <div id="display-preferences" popover="auto" className="header-preferences-panel">
            <strong>{locale === "de" ? "Sprache und Darstellung" : "Language and appearance"}</strong>
            <div className="header-preference-row"><span>{t("misc.language")}</span><LanguageToggle /></div>
            <div className="header-preference-row"><span>{locale === "de" ? "Hell / Dunkel" : "Light / dark"}</span><ThemeToggle /></div>
          </div>
          <Link href="/profile" className="header-profile" aria-label={locale === "de" ? "Mein Profil" : "My profile"}>
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div className={`avatar${isManager ? " mgr" : ""}`} style={{ width: 32, height: 32, fontSize: 13 }}>{(profile?.full_name || user?.email || "?")[0].toUpperCase()}</div>
          )}
          </Link>
        </div>
      </header>

      <main key={user.id} id="main-content" className="screen-wrap fade-up" tabIndex={-1}>{children}</main>

      <ToastHost />
      <AttendanceSync userId={user.id} />

      {process.env.AGENT_CHAT_ENABLED === "true" && isManager && <AgentWidget />}

      {!isManager && <BottomNav role={navRole} />}
    </div>
    </LanguageProvider>
  );
}
