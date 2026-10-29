import Link from "next/link";
import type { SetupStep } from "@/lib/owner/insights";

type Tf = (k: string, v?: Record<string, string | number>) => string;

// "Get your branch ready" (owner home): the routine data every owner figure depends on.
// Each open step links to where it is done; the card is not rendered once all are done.
export default function SetupCard({ steps, t }: { steps: SetupStep[]; t: Tf }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section className="dashboard-panel setup-card" aria-labelledby="setup-title">
      <div className="dashboard-panel-heading">
        <h2 id="setup-title">{t("setup.title")}</h2>
        <span className="setup-count">{t("setup.progress", { done, total: steps.length })}</span>
      </div>
      <p className="dashboard-muted">{t("setup.hint")}</p>
      <div className="ins-bar setup-bar" aria-hidden><i className="good" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></div>
      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "done" : ""}>
            <span className="setup-mark" aria-hidden>{s.done ? "✓" : ""}</span>
            {s.done ? (
              <span>{t(`setup.${s.key}`)}</span>
            ) : (
              <Link href={s.href}>{t(`setup.${s.key}`)}{s.missing ? ` · ${t("setup.missing", { n: s.missing })}` : ""} ›</Link>
            )}
            <span className="sr-only">{s.done ? t("setup.isDone") : t("setup.isOpen")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
