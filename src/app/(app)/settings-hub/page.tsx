import { redirect } from "next/navigation";

// Settings & admin now live under Profile — this hub was a duplicate.
// Kept as a redirect so old links/bookmarks resolve instead of 404ing.
export default function SettingsHubRedirect() {
  redirect("/profile");
}