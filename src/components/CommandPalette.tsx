"use client";
// Ctrl/Cmd+K for managers: jump to any page or person. Pages come from the sidebar definition plus the
// most-used sub-pages; people come from the existing globalSearch (managers only, branch-scoped there).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/LanguageProvider";
import { navigationGroups } from "@/components/ManagementNav";
import { globalSearch } from "@/lib/queries/global-search";

type Item = { href: string; label: string; group: string };
const PAGES: [string, string, string][] = [ // href, English, German
  ["/roster", "Weekly roster", "Wochenplan"], ["/approvals", "Approvals", "Genehmigungen"], ["/team-today", "Today's team", "Team heute"],
  ["/inventory/counts", "Stocktake", "Inventur"], ["/inventory/purchasing", "Purchase orders", "Bestellungen"], ["/inventory/purchasing?receive=1", "Receive goods", "Wareneingang"],
  ["/inventory/insights", "Inventory insights", "Bestandsauswertung"], ["/waste", "Waste log", "Ausschuss"], ["/expiry", "Batches & expiry", "Chargen und Ablauf"],
  ["/transfers", "Transfers", "Umbuchungen"], ["/labor", "Sales & labour", "Umsatz und Personalkosten"], ["/leave", "Time off", "Urlaub"],
  ["/availability", "Availability", "Verfügbarkeit"], ["/cover", "Shift cover", "Schichtübernahme"], ["/noshow", "No-shows", "Nichterscheinen"],
  ["/day-close", "Day close", "Tagesabschluss"], ["/temp", "Temperatures", "Temperaturen"], ["/checklist-status", "Checklists", "Checklisten"],
  ["/targets", "Targets", "Ziele"], ["/export", "Payroll export", "Lohnexport"], ["/profile", "My profile", "Mein Profil"],
];

export default function CommandPalette({ role }: { role: string }) {
  const { t, locale } = useLang();
  const router = useRouter();
  const de = locale === "de";
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [active, setActive] = useState(0);
  const [people, setPeople] = useState<Item[]>([]);
  const dialog = useRef<HTMLDialogElement>(null), seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) { setQ(""); setPeople([]); setActive(0); dialog.current?.showModal(); } else dialog.current?.close();
  }, [open]);
  useEffect(() => { // people: debounced, latest answer wins, failures just show no people
    const n = ++seq.current, text = q.trim();
    if (text.length < 2) { setPeople([]); return; }
    const timer = setTimeout(() => {
      globalSearch(text).then((r) => {
        if (n !== seq.current) return;
        setPeople(r.ok ? r.employees.slice(0, 6).map((e) => ({ href: `/staff/${e.id}`, label: e.sub ? `${e.name} · ${e.sub}` : e.name, group: de ? "Personen" : "People" })) : []);
      }, () => { if (n === seq.current) setPeople([]); });
    }, 200);
    return () => clearTimeout(timer);
  }, [q, de]);

  const owner = role === "branch_owner" || role === "brand_owner" || role === "super_admin";
  const pages: Item[] = [
    ...navigationGroups(owner).flatMap((g) => g.items.map((i) => ({ href: i.href, label: t(i.label), group: de ? "Bereiche" : "Areas" }))),
    ...PAGES.map(([href, en, ger]) => ({ href, label: de ? ger : en, group: de ? "Seiten" : "Pages" })),
  ];
  const needle = q.trim().toLocaleLowerCase();
  const items = [...(needle ? pages.filter((p) => p.label.toLocaleLowerCase().includes(needle)) : pages).slice(0, 12), ...people];
  const go = (item?: Item) => { if (!item) return; setOpen(false); router.push(item.href); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
  };

  return (
    <dialog ref={dialog} className="workspace-dialog cmdk" aria-label={de ? "Springen zu" : "Jump to"} onClose={() => setOpen(false)}
      onClick={(e) => { if (e.target === dialog.current) setOpen(false); }}>
      {open && <>
        <input className="form-input cmdk-input" autoFocus value={q} placeholder={de ? "Seite oder Person suchen…" : "Search a page or person…"}
          aria-label={de ? "Seite oder Person suchen" : "Search a page or person"} role="combobox" aria-expanded="true" aria-controls="cmdk-list"
          aria-activedescendant={items[active] ? `cmdk-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown} />
        <ul id="cmdk-list" role="listbox" className="cmdk-list">
          {items.map((item, i) => (
            <li key={`${item.group}${item.href}`} id={`cmdk-${i}`} role="option" aria-selected={i === active}
              className={i === active ? "active" : undefined} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
              <span>{item.label}</span><small>{item.group}</small>
            </li>
          ))}
          {!items.length && <li className="cmdk-empty">{de ? "Nichts gefunden" : "No matches"}</li>}
        </ul>
      </>}
    </dialog>
  );
}
