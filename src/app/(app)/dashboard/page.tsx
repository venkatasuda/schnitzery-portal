import { redirect } from "next/navigation";

// Legacy route — the role-based Home page replaced this dashboard.
// Kept as a redirect so any old links/bookmarks resolve instead of 404ing.
export default function DashboardRedirect() {
  redirect("/");
}