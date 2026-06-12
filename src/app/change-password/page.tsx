import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import LanguageProvider from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import ChangePasswordForm from "./ChangePasswordForm";

// Lives OUTSIDE the (app) group (like /login), so the app layout's
// must_change_password redirect can't loop back onto this page.
// Still requires a session — a flagged user is sent here right after login.
export default async function ChangePasswordPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <LanguageProvider initialLocale={locale}>
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 20 }}>
        <LanguageToggle />
      </div>
      <ChangePasswordForm />
    </LanguageProvider>
  );
}