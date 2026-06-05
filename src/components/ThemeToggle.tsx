"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. Persists to localStorage and flips the `light` class on <html>.
// A tiny inline script in the root layout applies the saved theme before paint
// (no flash), so this component just keeps the button in sync and handles taps.
export default function ThemeToggle() {
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
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle light or dark mode"
    >
      {light ? "🌙" : "☀️"}
    </button>
  );
}