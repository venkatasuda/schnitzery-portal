"use client";
// Sales by channel for managers and owners: till vs Lieferando / Uber Eats / Wolt over the last 7 closed days,
// from the figures entered at the day close. Hidden when no day has been closed with a till figure yet.
import { useQuery } from "@tanstack/react-query";
import { getChannelSales } from "@/lib/queries/day-close";
import { channelSplit, CHANNEL_LABEL } from "@/lib/sales/channels";
import { formatEur } from "@/lib/format";

export default function ChannelSplit({ locale }: { locale: string }) {
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const { data: split } = useQuery({ queryKey: ["channel-sales", 7], queryFn: async () => { const r = await getChannelSales(7); return r.ok ? channelSplit(r.rows) : null; } });
  if (!split || split.days === 0) return null;

  return (
    <section className="card u-mb-3" aria-labelledby="channel-split-title">
      <div className="card-title" id="channel-split-title">{s("Sales by channel", "Umsatz nach Kanal")} · {s(`last ${split.days} closed days`, `letzte ${split.days} abgeschlossene Tage`)}</div>
      <div className="table-scroll"><table className="data-table channel-split">
        <thead><tr>
          <th scope="col">{s("Channel", "Kanal")}</th><th scope="col">{s("Sales", "Umsatz")}</th><th scope="col">{s("Share", "Anteil")}</th>
          <th scope="col">{s("Orders", "Bestellungen")}</th><th scope="col">{s("Avg. order", "Ø Bestellung")}</th>
        </tr></thead>
        <tbody>{split.rows.map((r) => <tr key={r.key}>
          <th scope="row">{r.key === "till" ? s("Till (in-house + takeaway)", "Kasse (Haus + Mitnahme)") : CHANNEL_LABEL[r.key]}</th>
          <td>{formatEur(r.sales, locale, 0)}</td><td>{r.share.toLocaleString(locale === "de" ? "de-DE" : "en-GB")} %</td>
          <td>{r.orders ?? "—"}</td><td>{r.avg == null ? "—" : formatEur(r.avg, locale, 2)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row">{s("Total", "Gesamt")}</th><td>{formatEur(split.total, locale, 0)}</td><td>100 %</td><td /><td /></tr></tfoot>
      </table></div>
    </section>
  );
}
