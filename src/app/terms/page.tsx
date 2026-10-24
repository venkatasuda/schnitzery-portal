import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { termsText } from "@/lib/legal";
import { getLocale } from "@/lib/i18n/server";

// Text lives in src/lib/legal.ts (German + English); company details are filled in there once.
export async function generateMetadata(): Promise<Metadata> {
  const de = (await getLocale()) === "de";
  return { title: de ? "Nutzungsbedingungen · Schnitzery Portal" : "Terms of Use · Schnitzery Portal" };
}

export default async function TermsPage() {
  const lang = (await getLocale()) === "de" ? "de" : "en";
  return <LegalPage doc={termsText(lang)} lang={lang} other={{ href: "/privacy", label: lang === "de" ? "Datenschutzerklärung" : "Privacy Policy" }} />;
}
