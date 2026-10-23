"use client";

import { useLang } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

// Light/dark toggle. Persists to localStorage and flips the `light` class on <html>.
// A tiny inline script in the root layout applies the saved theme before paint
// (no flash), so this component just keeps the button in sync and handles taps.
export default function ThemeToggle() {
  const { t } = useLang();
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("sch_theme", next ? "light" : "dark");
    } catch {
      /* storage unavailable — ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      className="theme-btn"
      aria-label={t("misc.themeToggle")}
      aria-pressed={light}
    >
      <Icon e={light ? "🌙" : "☀️"} size={18} />
    </button>
  );
}
