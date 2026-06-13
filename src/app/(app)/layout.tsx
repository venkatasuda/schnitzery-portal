import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import ToastHost from "@/components/Toast";
import LanguageProvider from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n/server";

// Protected layout — header (notifications + theme toggle) + content + nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in → send to login (this layout is the auth gate; there is no middleware).
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, avatar_url, must_change_password")
    .eq("id", user.id)
    .single();

  // First login on a seeded/temporary password → force a password change.
  // /change-password lives outside the (app) group, so this can't loop.
  if (profile?.must_change_password) redirect("/change-password");

  const role = profile?.role || "staff";

  // A kiosk-tablet account belongs only on the kiosk screen, never in the app.
  if (role === "kiosk") redirect("/kiosk");

  const isManager = ["manager", "franchise_owner", "brand_owner"].includes(role);
  const roleLabel: Record<string, string> = {
    staff: "Staff", manager: "Manager",
    franchise_owner: "Franchise Owner", brand_owner: "Brand Owner",
  };

  return (
    <LanguageProvider initialLocale={locale}>
    <div>
      <header className="app-header">
        <div>
          <div className="brand">Schnitzery Portal</div>
          <div className="sub">{roleLabel[role]}</div>
        </div>
        <div className="header-right">
          <span className="header-name">{profile?.full_name || user?.email}</span>
          <NotificationBell />
          <LanguageToggle />
          <ThemeToggle />
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div className={`avatar${isManager ? " mgr" : ""}`} style={{ width: 32, height: 32, fontSize: 13 }}>{(profile?.full_name || user?.email || "?")[0].toUpperCase()}</div>
          )}
        </div>
      </header>

      <div className="screen-wrap fade-up">{children}</div>

      <ToastHost />

      <BottomNav role={role} />
    </div>
    </LanguageProvider>
  );
}