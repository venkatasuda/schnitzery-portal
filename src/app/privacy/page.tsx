import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { privacyText } from "@/lib/legal";
import { getLocale } from "@/lib/i18n/server";

// Text lives in src/lib/legal.ts (German + English); company details are filled in there once.
export async function generateMetadata(): Promise<Metadata> {
  const de = (await getLocale()) === "de";
  return { title: de ? "Datenschutzerklärung · Schnitzery Portal" : "Privacy Policy · Schnitzery Portal" };
}

export default async function PrivacyPage() {
  const lang = (await getLocale()) === "de" ? "de" : "en";
  return <LegalPage doc={privacyText(lang)} lang={lang} other={{ href: "/terms", label: lang === "de" ? "Nutzungsbedingungen" : "Terms of Use" }} />;
}
