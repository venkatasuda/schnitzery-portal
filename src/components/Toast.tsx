"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/LanguageProvider";
import { serverText } from "@/lib/i18n/serverMessages";

const LEADING_EMOJI = new RegExp("^\\p{Extended_Pictographic}", "u"); // ES2017 target: no regex literal

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

// Call toast("Saved!") from any client component — no provider wiring needed.
export function toast(message: string, type: ToastType = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sch:toast", { detail: { message, type } }));
  }
}

// Mounted once in the app layout (inside LanguageProvider); renders stacked toasts
// above the bottom nav. Server-action errors arrive in English and are translated here.
// Also defines the shared keyframes used by the Skeleton loaders.
export default function ToastHost() {
  const { locale } = useLang();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = Date.now() + Math.random();
      setItems((cur) => [...cur, { id, message: detail.message, type: detail.type }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), detail.type === "error" ? 6000 : 3200);
    }
    window.addEventListener("sch:toast", onToast);
    return () => window.removeEventListener("sch:toast", onToast);
  }, []);

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => {
        const text = serverText(t.message, locale);
        // Many messages already start with ✅/⚠️; don't print the icon twice.
        const icon = LEADING_EMOJI.test(text) ? "" : t.type === "error" ? "⚠️ " : t.type === "success" ? "✅ " : "";
        return <div key={t.id} className={`toast ${t.type}`} role={t.type === "error" ? "alert" : undefined}>{icon}{text}</div>;
      })}
      <style>{`@keyframes schToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes schShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
    </div>
  );
}
