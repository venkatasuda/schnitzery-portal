import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import ToastHost from "@/components/Toast";

// Protected layout — header (notifications + theme toggle) + content + nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users").select("full_name, role").eq("id", user.id).single();
    profile = data;
  }
  const role = profile?.role || "staff";
  const isManager = ["manager", "franchise_owner", "brand_owner"].includes(role);
  const roleLabel: Record<string, string> = {
    staff: "Staff", manager: "Manager",
    franchise_owner: "Franchise Owner", brand_owner: "Brand Owner",
  };

  return (
    <div>
      <header className="app-header">
        <div>
          <div className="brand">Schnitzery Portal</div>
          <div className="sub">{roleLabel[role]}</div>
        </div>
        <div className="header-right">
          <span className="header-name">{profile?.full_name || user?.email}</span>
          {isManager && <NotificationBell />}
          <ThemeToggle />
        </div>
      </header>

      <div className="screen-wrap fade-up">{children}</div>

      <ToastHost />

      <BottomNav role={role} />
    </div>
  );
}