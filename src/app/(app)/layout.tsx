import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

// Protected layout — header + content + role-aware bottom nav.
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
        <span style={{ fontSize: 12, color: "#9a8f8f" }}>{profile?.full_name || user?.email}</span>
      </header>

      <div className="screen-wrap fade-up">{children}</div>

      <BottomNav role={role} />
    </div>
  );
}