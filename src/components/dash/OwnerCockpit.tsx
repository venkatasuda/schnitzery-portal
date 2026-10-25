import Link from "next/link";
import { formatPct } from "@/lib/format";
import type { Targets } from "@/lib/queries/targets";

type Tf = (k: string, v?: Record<string, string | number>) => string;
type Cov = { complete: boolean; missing: Record<string, number> };
export type CockpitCost = { monthSales?: number; laborPct: number | null; foodCostPct: number | null; coverage?: Record<"sales" | "labor" | "spend", Cov> } | null;
type Day = { date: string; sales: number | null; hours: number };

// Owner home, top band (docs/OWNER-COCKPIT.md): month-to-date money against the
// owner's targets, plus yesterday's flash. Incomplete inputs show "—", never 0%.
// Each tile links to where the number is explained or fixed (SAP overview-card rule:
// cards inform, pages act).
export default function OwnerCockpit({ cost, targets, canEdit, flash, t, locale }: { cost: CockpitCost; targets: Targets | null; canEdit: boolean; flash: { yesterday: Day; lastWeek: Day } | null; t: Tf; locale: string }) {
  const money = (v: number) => new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const prime = cost?.laborPct != null && cost?.foodCostPct != null ? Math.round((cost.laborPct + cost.foodCostPct) * 10) / 10 : null;
  const salesComplete = cost?.coverage?.sales.complete !== false;
  const pctText = (v: number | null) => formatPct(v, locale);
  const tiles: { key: string; label: string; display: string; pct: number | null; target: number | null; href: string }[] = [
    { key: "sales", label: t("cockpit.sales"), display: cost?.monthSales == null ? "—" : `${salesComplete ? "" : "≥ "}${money(cost.monthSales)}`, pct: null, target: null, href: "/labor" },
    { key: "labour", label: t("cockpit.labour"), display: pctText(cost?.laborPct ?? null), pct: cost?.laborPct ?? null, target: targets?.labourPct ?? null, href: "/labor" },
    { key: "purchase", label: t("cockpit.purchase"), display: pctText(cost?.foodCostPct ?? null), pct: cost?.foodCostPct ?? null, target: targets?.purchasePct ?? null, href: "/analytics" },
    { key: "prime", label: t("cockpit.prime"), display: pctText(prime), pct: prime, target: targets?.primePct ?? null, href: "/summary" },
  ];
  const tone = (pct: number | null, target: number | null) => pct == null || target == null ? "" : pct <= target ? " good" : pct <= target + 3 ? " warn" : " bad";
  const eur = (v: number | null) => (v == null ? "—" : money(v));
  const delta = flash && flash.yesterday.sales != null && flash.lastWeek.sales ? Math.round(((flash.yesterday.sales - flash.lastWeek.sales) / flash.lastWeek.sales) * 100) : null;

  return (
    <section className="cockpit" aria-labelledby="cockpit-title">
      <div className="dashboard-panel-heading">
        <h2 id="cockpit-title">{t("cockpit.title")}</h2>
        {canEdit && <Link href="/targets">{targets && (targets.labourPct || targets.purchasePct || targets.primePct) ? t("cockpit.editTargets") : t("cockpit.setTargets")} ›</Link>}
      </div>
      <div className="cockpit-tiles">
        {tiles.map((x) => (
          <Link key={x.key} href={x.href} className={`cockpit-tile${tone(x.pct, x.target)}`}>
            <span className="cockpit-label">{x.label}</span>
            <strong>{x.display}</strong>
            <span className="cockpit-sub">{x.key === "sales" ? (salesComplete ? t("cockpit.monthToDate") : t("cockpit.salesMissing", { n: cost?.coverage?.sales.missing.salesDays ?? 0 }))
              : x.pct == null ? t("cockpit.incomplete") : x.target == null ? t("cockpit.noTarget") : t("cockpit.target", { n: x.target })}</span>
          </Link>
        ))}
      </div>
      {flash && (
        <div className="cockpit-flash">
          <span className="cockpit-label">{t("cockpit.flash")}</span>
          <span>{t("cockpit.flashSales")}: <strong>{eur(flash.yesterday.sales)}</strong>
            {delta != null && <span className={delta >= 0 ? "tone-success" : "tone-danger"}> {delta >= 0 ? "▲" : "▼"} {formatPct(Math.abs(delta), locale)} {t("cockpit.vsLastWeek")}</span>}
            {flash.yesterday.sales == null && <Link className="ui-text-link" href="/labor"> · {t("cockpit.enterSales")}</Link>}
          </span>
          <span>{t("cockpit.flashHours")}: <strong>{flash.yesterday.hours}h</strong> <span className="ui-muted">({flash.lastWeek.hours}h {t("cockpit.vsLastWeek")})</span></span>
        </div>
      )}
    </section>
  );
}
