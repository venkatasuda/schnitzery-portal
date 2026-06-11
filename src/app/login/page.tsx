import { getLocale } from "@/lib/i18n/server";
import LanguageProvider from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import LoginForm from "./loginForm";

// Login lives outside the (app) group, so it has no LanguageProvider from the
// app layout. We add a minimal one here (reading the same `lang` cookie) plus a
// corner toggle, so a first-time visitor can choose EN/DE before signing in.
export default async function LoginPage() {
  const locale = await getLocale();
  return (
    <LanguageProvider initialLocale={locale}>
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 20 }}>
        <LanguageToggle />
      </div>
      <LoginForm />
    </LanguageProvider>
  );
}