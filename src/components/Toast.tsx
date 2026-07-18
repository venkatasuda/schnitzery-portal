"use client";

import { useState, useEffect } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

// Call toast("Saved!") from any client component — no provider wiring needed.
export function toast(message: string, type: ToastType = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sch:toast", { detail: { message, type } }));
  }
}

// Mounted once in the app layout; renders stacked toasts above the bottom nav.
// Also defines the shared keyframes used by the Skeleton loaders.
export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur, { id, message: detail.message, type: detail.type }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3200);
    }
    window.addEventListener("sch:toast", onToast);
    return () => window.removeEventListener("sch:toast", onToast);
  }, []);

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 84, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 300, pointerEvents: "none", padding: "0 16px" }}>
      {items.map((t) => (
        <div key={t.id} style={{
          pointerEvents: "auto", width: "fit-content", maxWidth: 440,
          background: t.type === "error" ? "#7d2820" : t.type === "info" ? "var(--dark2)" : "#1e6b3f",
          color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: "0 8px 30px rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)",
          animation: "schToastIn .25s ease",
        }}>
          {t.type === "error" ? "⚠️ " : t.type === "success" ? "✅ " : ""}{t.message}
        </div>
      ))}
      <style>{`@keyframes schToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes schShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
    </div>
  );
}