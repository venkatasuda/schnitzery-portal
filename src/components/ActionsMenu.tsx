"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native disclosure for optional actions; primary workflow buttons stay visible. */
export default function ActionsMenu({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return <details ref={root} className="ui-action-menu" onToggle={event => {
    const details = event.currentTarget;
    if (!details.open) return;
    const items = details.querySelector<HTMLElement>(".ui-action-menu-items");
    if (!items) return;
    items.style.transform = "";
    const bounds = items.getBoundingClientRect();
    const shift = bounds.left < 12 ? 12 - bounds.left : Math.min(0, window.innerWidth - 12 - bounds.right);
    if (shift) items.style.transform = `translateX(${shift}px)`;
  }} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false;
  }} onKeyDown={event => {
    if (event.key === "Escape") {
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  }}>
    <summary className="btn-secondary">{label}</summary>
    <div className="ui-action-menu-items" onClick={event => {
      if ((event.target as HTMLElement).closest("button, a") && root.current) root.current.open = false;
    }}>{children}</div>
  </details>;
}
