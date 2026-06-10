import { cookies } from "next/headers";
import { translate, DEFAULT_LOCALE, LOCALES, type Locale } from "./index";

// Server-side locale, read from the `lang` cookie set by the toggle.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get("lang")?.value as Locale | undefined;
  return v && LOCALES.includes(v) ? v : DEFAULT_LOCALE;
}

// For server components: const t = await getT(); t("nav.home")
export async function getT() {
  const locale = await getLocale();
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
}