import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import LanguageProvider from "@/components/LanguageProvider";
import KioskScreen from "./KioskScreen";

// Standalone in-store kiosk — lives OUTSIDE the (app) group, so no header/nav.
// Open this on a shared tablet and pin it with the device's kiosk mode
// (iOS Guided Access / Android screen-pinning). Sign the tablet in once with a
// dedicated per-branch "kiosk" account; that account can read nothing but its
// own branch's rotating clock code.
export default async function KioskPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <LanguageProvider initialLocale={locale}>
      <KioskScreen />
    </LanguageProvider>
  );
}