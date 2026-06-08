"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getManagerAlerts } from "@/lib/queries/alerts";

// Header notification bell for managers/owners — a badge + dropdown feed that
// pulls together approvals, incidents, low stock and missing availability.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getManagerAlerts().then((r) => {
      if (r.ok) { setItems(r.items || []); setTotal(r.total || 0); }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="theme-btn" aria-label="Notifications" style={{ position: "relative" }}>
        🔔
        {total > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: "#e74c3c", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: "0 0 0 2px var(--dark)" }}>
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 290, background: "var(--dark2)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 200, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(128,128,128,0.15)", fontSize: 13, fontWeight: 700, color: "var(--white)" }}>
            Notifications{total > 0 ? ` · ${total}` : ""}
          </div>
          {!loaded ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 26, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>🎉 You&apos;re all caught up</div>
          ) : (
            items.map((it, i) => (
              <Link
                key={i}
                href={it.href}
                onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderBottom: i < items.length - 1 ? "1px solid rgba(128,128,128,0.1)" : "none", textDecoration: "none" }}
              >
                <span style={{ fontSize: 16 }}>{it.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--white)" }}>{it.label}</span>
                <span style={{ color: "var(--gray)", fontSize: 16 }}>›</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}