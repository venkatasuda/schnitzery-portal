"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { translate, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type LangCtx = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
};

const Ctx = createContext<LangCtx>({
  locale: DEFAULT_LOCALE,
  t: (k) => k,
  setLocale: () => {},
});

export function useLang() {
  return useContext(Ctx);
}

// Wrap the app once (in the (app) layout). `initialLocale` comes from the server
// cookie read, so the first render matches and there's no hydration mismatch.
export default function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLoc] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    setLoc(l);
    // reload so server components (layout, home) also pick up the new language
    window.location.reload();
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  return <Ctx.Provider value={{ locale, t, setLocale }}>{children}</Ctx.Provider>;
}