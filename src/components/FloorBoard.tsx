"use client";
// Floor board on /ops: today's routine work for the active branch, each line linking to where it is done.
// Refreshes with the ops page (key changes on every live refresh). Hidden when the user has no day-close access.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { getFloorBoard } from "@/lib/queries/floor-board";
import { fmtDay } from "@/lib/time/berlinDate";

type Board = Extract<Awaited<ReturnType<typeof getFloorBoard>>, { ok: true }>;

export default function FloorBoard({ tick = 0 }: { tick?: number }) {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const [b, setB] = useState<Board | null>(null);
  useEffect(() => {
    let live = true;
    getFloorBoard().then((r) => { if (live) setB(r.ok ? r : null); }, () => { if (live) setB(null); });
    return () => { live = false; };
  }, [tick]);
  if (!b) return null;

  const { temps, checklists, leftovers } = b.snapshot;
  const prep = { none: s("not planned", "nicht geplant"), draft: s("draft, not sent", "Entwurf, nicht gesendet"), sent: s("sent", "gesendet") };
  const rows: { label: string; value: string; done: boolean; href: string }[] = [
    { label: s("Temperatures", "Temperaturen"), value: `${temps.logged}/${temps.units}`, done: temps.logged >= temps.units, href: "/temp" },
    { label: s("Checklists", "Checklisten"), value: `${checklists.done}/${checklists.total}`, done: checklists.done >= checklists.total, href: "/checklist" },
    { label: s("Prep list today", "Vorbereitung heute"), value: prep[b.prepToday], done: b.prepToday === "sent", href: "/prep" },
    { label: s("Leftovers counted", "Reste gezählt"), value: `${leftovers.counted}/${leftovers.items}`, done: leftovers.counted >= leftovers.items, href: "/prep" },
    { label: s("Prep list tomorrow", "Vorbereitung morgen"), value: prep[b.snapshot.next_prep_list], done: b.snapshot.next_prep_list === "sent", href: "/prep/plan" },
    { label: s("Day close", "Tagesabschluss"), value: b.closedAt ? s("closed", "abgeschlossen") : s("open", "offen"), done: !!b.closedAt, href: "/day-close" },
  ];

  return (
    <section className="card u-mb-3 floor-board" aria-labelledby="floor-board-title">
      <div className="card-title" id="floor-board-title">{s("Floor board", "Tagesbrett")} · {b.branch.name}</div>
      <div className="dashboard-facts">
        {rows.map((r) => (
          <div key={r.label}><span><Link href={r.href} prefetch={false}>{r.label}</Link></span>
            <strong className={r.done ? "tone-success" : "tone-warn"}>{r.done ? "✓ " : ""}{r.value}</strong></div>
        ))}
        <div><span>{s("Deliveries due", "Lieferungen fällig")}</span><strong>{b.deliveries.length || "—"}</strong></div>
      </div>
      {b.deliveries.length > 0 && <ul className="ui-sub">
        {b.deliveries.map((d) => <li key={d.id}><Link href={`/inventory/purchasing?order=${d.id}`} prefetch={false}>{d.supplier}{d.reference ? ` · ${d.reference}` : ""}</Link>
          {d.overdue ? <span className="tone-danger"> · {s("overdue since", "überfällig seit")} {fmtDay(d.expected, locale)}</span> : ""}</li>)}
      </ul>}
    </section>
  );
}
