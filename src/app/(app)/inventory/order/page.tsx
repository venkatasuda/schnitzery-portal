"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getPurchaseOrderDraft } from "@/lib/queries/inventory";

const eur = (n: number) => "€" + (Math.round((n || 0) * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function OrderPage() {
  const { t } = useLang();
  const [groups, setGroups] = useState<any[]>([]);
  const [coverDays, setCoverDays] = useState(7);
  const [hasPrices, setHasPrices] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(cd: number) {
    setLoading(true);
    const r = await getPurchaseOrderDraft(cd);
    if (r.ok) { setGroups((r.groups || []).map((g: any) => ({ ...g, items: g.items.map((it: any) => ({ ...it })) }))); setHasPrices(r.hasPrices); }
    setLoading(false);
  }
  useEffect(() => { load(coverDays); /* eslint-disable-next-line */ }, []);

  function setQty(gi: number, ii: number, v: string) {
    setGroups((gs) => gs.map((g, gx) => gx !== gi ? g : {
      ...g,
      items: g.items.map((it: any, ix: number) => ix !== ii ? it : {
        ...it, qty: v, lineCost: it.unitPrice != null ? Math.round(it.unitPrice * Number(v || 0) * 100) / 100 : null,
      }),
    }));
  }
  function removeItem(gi: number, ii: number) {
    setGroups((gs) => gs.map((g, gx) => gx !== gi ? g : { ...g, items: g.items.filter((_: any, ix: number) => ix !== ii) }).filter((g) => g.items.length > 0));
  }

  const subtotal = (g: any) => g.items.reduce((s: number, it: any) => s + (it.lineCost || 0), 0);
  const grandTotal = groups.reduce((s, g) => s + subtotal(g), 0);

  function groupText(g: any) {
    const lines = g.items.filter((it: any) => Number(it.qty) > 0).map((it: any) =>
      `• ${it.product}: ${it.qty}${it.unit ? " " + it.unit : ""}${it.lineCost != null ? ` (${eur(it.lineCost)})` : ""}`);
    const head = `Schnitzery — ${t("po.title")} · ${today()}`;
    const sup = g.supplier ? `\n${t("po.supplier")}: ${g.supplier}` : "";
    const tot = hasPrices ? `\n${t("po.subtotal")}: ${eur(subtotal(g))}` : "";
    return `${head}${sup}\n\n${lines.join("\n")}${tot}`;
  }
  function copyGroup(g: any) {
    const txt = groupText(g);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast(t("po.copied"), "success")).catch(() => toast(t("po.failed"), "error"));
    else toast(t("po.failed"), "error");
  }
  function emailGroup(g: any) {
    const subject = encodeURIComponent(`Schnitzery ${t("po.title")} — ${g.supplier || ""} ${today()}`);
    const body = encodeURIComponent(groupText(g));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function printAll() {
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const sections = groups.map((g) => {
      const rows = g.items.filter((it: any) => Number(it.qty) > 0).map((it: any) => `
        <tr><td>${esc(it.product)}</td><td class="r">${esc(it.qty)} ${esc(it.unit)}</td>
        <td class="r">${it.unitPrice != null ? eur(it.unitPrice) : "—"}</td>
        <td class="r">${it.lineCost != null ? eur(it.lineCost) : "—"}</td></tr>`).join("");
      return `<div class="po"><h2>${esc(g.supplier || t("po.noSupplier"))}</h2>
        <table><thead><tr><th>${t("po.product")}</th><th class="r">${t("po.qty")}</th><th class="r">${t("po.unitPrice")}</th><th class="r">${t("po.lineTotal")}</th></tr></thead>
        <tbody>${rows}</tbody></table>
        ${hasPrices ? `<div class="sub">${t("po.subtotal")}: <b>${eur(subtotal(g))}</b></div>` : ""}</div>`;
    }).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schnitzery Purchase Order</title><style>
      *{box-sizing:border-box;font-family:system-ui,Arial,sans-serif}body{margin:0;padding:16mm;color:***REMOVED***111}
      h1{margin:0 0 2mm}.meta{color:***REMOVED***666;margin-bottom:8mm;font-size:11pt}
      .po{margin-bottom:10mm;page-break-inside:avoid}h2{font-size:13pt;border-bottom:2px solid ***REMOVED***333;padding-bottom:2mm}
      table{width:100%;border-collapse:collapse;font-size:11pt}th,td{padding:2mm 3mm;border-bottom:1px solid ***REMOVED***ddd;text-align:left}
      .r{text-align:right}.sub{text-align:right;margin-top:3mm;font-size:12pt}
      .grand{text-align:right;font-size:14pt;font-weight:700;border-top:2px solid ***REMOVED***333;padding-top:3mm;margin-top:6mm}
    </style></head><body>
      <h1>Schnitzery — ${t("po.title")}</h1><div class="meta">${today()}</div>
      ${sections}
      ${hasPrices ? `<div class="grand">${t("po.total")}: ${eur(grandTotal)}</div>` : ""}
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="fade-up">
      <Link href="/inventory" style={{ color: "var(--gray)", fontSize: 13, textDecoration: "none" }}>‹ {t("po.back")}</Link>
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><Icon e="🧾" size={22} /> {t("po.title")}</div>
      <div className="page-sub">{t("po.subtitle")}</div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "14px 0" }}>
        <span style={{ fontSize: 12, color: "var(--gray)" }}>{t("po.coverFor")}</span>
        {[7, 14, 30].map((cd) => (
          <button key={cd} onClick={() => { setCoverDays(cd); load(cd); }}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer", background: coverDays === cd ? "rgba(212,168,71,0.15)" : "rgba(255,255,255,0.05)", color: coverDays === cd ? "var(--gold)" : "var(--gray)", border: `1px solid ${coverDays === cd ? "rgba(212,168,71,0.3)" : "rgba(255,255,255,0.1)"}` }}>{cd}d</button>
        ))}
        <button onClick={printAll} disabled={loading || groups.length === 0} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "var(--gold)", color: "***REMOVED***1a1a1a", border: "none", cursor: "pointer" }}>🖨 {t("po.printPdf")}</button>
      </div>

      {loading ? <CardSkeleton rows={4} /> : groups.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 26, fontSize: 13 }}>{t("po.nothing")}</div>
      ) : (
        <>
          {!hasPrices && <div className="card" style={{ marginBottom: 12, fontSize: 12, color: "***REMOVED***d4a847", borderColor: "rgba(212,168,71,0.3)" }}>{t("po.noPrices")}</div>}
          {groups.map((g, gi) => (
            <div key={gi} className="card" style={{ marginBottom: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>{g.supplier || t("po.noSupplier")}</div>
                {hasPrices && <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>{eur(subtotal(g))}</div>}
              </div>
              {g.items.map((it: any, ii: number) => (
                <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.product}</div>
                    <div style={{ fontSize: 11, color: "var(--gray)" }}>{it.unitPrice != null ? `${eur(it.unitPrice)}/${it.unit || t("po.unit")}` : t("po.noPrice")}</div>
                  </div>
                  <input type="number" inputMode="decimal" value={it.qty} onChange={(e) => setQty(gi, ii, e.target.value)}
                    style={{ width: 66, padding: "8px", textAlign: "center", borderRadius: 8, background: "var(--dark2)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, fontWeight: 600 }} />
                  <span style={{ fontSize: 11, color: "var(--gray)", width: 26 }}>{it.unit}</span>
                  <span style={{ fontSize: 12, color: "var(--white)", width: 58, textAlign: "right" }}>{it.lineCost != null ? eur(it.lineCost) : "—"}</span>
                  <button onClick={() => removeItem(gi, ii)} style={{ background: "none", border: "none", color: "***REMOVED***7a7070", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => copyGroup(g)} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 13, cursor: "pointer" }}>📋 {t("po.copy")}</button>
                <button onClick={() => emailGroup(g)} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(212,168,71,0.12)", color: "var(--gold)", border: "1px solid rgba(212,168,71,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✉ {t("po.email")}</button>
              </div>
            </div>
          ))}
          {hasPrices && (
            <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "var(--white)", fontWeight: 700 }}>{t("po.total")}</span>
              <span style={{ fontSize: 18, color: "var(--gold)", fontWeight: 700 }}>{eur(grandTotal)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}