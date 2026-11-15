"use client";
// A dashboard section that folds away. The first screen keeps what needs action now; the rest lives in
// sections like this one. Open/closed is remembered per person on this device.
import { useEffect, useState, type ReactNode } from "react";

export default function DashSection({ id, title, hint, defaultOpen = false, children }: { id: string; title: ReactNode; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const key = `dash:${id}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { try { const v = localStorage.getItem(key); if (v != null) setOpen(v === "1"); } catch { /* storage unavailable: keep the default */ } }, [key]);
  return (
    <details className="dash-section" open={open} onToggle={(e) => {
      const next = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(next);
      try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* not remembered, still works */ }
    }}>
      <summary><span className="dash-section-title">{title}</span>{hint != null && <span className="dash-section-hint">{hint}</span>}<span className="dash-section-chev" aria-hidden="true" /></summary>
      <div className="dash-section-body">{children}</div>
    </details>
  );
}
