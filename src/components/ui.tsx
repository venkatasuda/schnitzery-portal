// Schnitzery UI kit (Release F) — the shared building blocks. See docs/DESIGN-SYSTEM.md.
// Styling lives in globals.css (.ui-*, .page-title, .card, .hub-tabs, .btn-*); these
// components only add structure and accessibility. No local copies in pages.
import type { ReactNode } from "react";

export type Tone = "default" | "success" | "warn" | "danger" | "info" | "action";
const toneClass = (tone?: Tone) => (tone && tone !== "default" ? ` tone-${tone}` : "");

/** Page title + subtitle + optional actions. One per page; renders the page's <h1>. */
export function PageHeader({ title, subtitle, icon, actions }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return <div className="ui-page-header">
    <div><h1 className="page-title">{icon}{title}</h1>{subtitle && <p className="page-sub">{subtitle}</p>}</div>
    {actions && <div className="ui-page-actions">{actions}</div>}
  </div>;
}

/** Card with a heading row. */
export function Panel({ title, icon, actions, children, className = "" }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>
    {(title || actions) && <div className="ui-panel-head">{title && <h2>{icon}{title}</h2>}{actions}</div>}
    {children}
  </section>;
}

/**
 * KPI tile. `tone` colours the value from the theme. `color` is a migration escape
 * hatch for pages that still compute colours — prefer `tone`.
 * variant: "tile" (default), "compact" (smaller value), "row" (label left, value right).
 */
export function Stat({ label, value, sub, tone, color, variant = "tile" }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; color?: string; variant?: "tile" | "compact" | "row" }) {
  return <div className={`ui-stat${variant === "tile" ? "" : ` ${variant}`}`}>
    <span className="ui-stat-label">{label}</span>
    <strong className={`ui-stat-value${toneClass(tone)}`} style={color ? { color } : undefined}>{value}</strong>
    {sub && <span className="ui-stat-sub">{sub}</span>}
  </div>;
}
export function StatGrid({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="ui-stat-grid" role={label ? "group" : undefined} aria-label={label}>{children}</div>;
}

/** Label + control (+ hint / error). Wraps the control in a <label> so clicks focus it. */
export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return <label className="ui-field">
    <span className="ui-field-label">{label}</span>
    {children}
    {hint && !error && <span className="ui-field-hint">{hint}</span>}
    {error && <span className="ui-field-error" role="alert">{error}</span>}
  </label>;
}

/** Page-level tab button (inside a `.hub-tabs` group). */
export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`hub-tab${active ? " active" : ""}`}>{children}</button>;
}

/** Small in-card switch (e.g. "Requests / History" on employee screens). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return <div className="ui-segmented" role="group" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

export function Badge({ tone = "default", children }: { tone?: "default" | "success" | "warn" | "danger"; children: ReactNode }) {
  const cls = { default: "", success: " good", warn: " warn", danger: " low" }[tone];
  return <span className={`status-badge${cls}`}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <div className="ui-empty" role="status"><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}

export function ErrorState({ message, onRetry, retryLabel }: { message: ReactNode; onRetry?: () => void; retryLabel?: ReactNode }) {
  return <div className="ui-error" role="alert"><span>{message}</span>{onRetry && <button type="button" className="btn-secondary" onClick={onRetry}>{retryLabel}</button>}</div>;
}
