"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getProducts } from "@/lib/queries/inventory";

export default function LabelsPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getProducts();
      const list = res.ok ? (res.products || []) : [];
      setProducts(list);
      try {
        const QRCode = (await import("qrcode")).default;
        const map: Record<string, string> = {};
        for (const p of list) {
          map[p.id] = await QRCode.toDataURL(`sq:${p.id}`, { width: 220, margin: 1 });
        }
        setQr(map);
      } catch { /* qr lib missing — names still print */ }
      setLoading(false);
    })();
  }, []);

  function printLabels() {
    const cells = products.map((p) => `
      <div class="lbl">
        ${qr[p.id] ? `<img src="${qr[p.id]}" />` : ""}
        <div class="nm">${escapeHtml(p.product)}</div>
        <div class="cat">${escapeHtml(p.category || "")}</div>
      </div>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schnitzery labels</title><style>
      *{box-sizing:border-box;font-family:system-ui,Arial,sans-serif}
      body{margin:0;padding:10mm}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
      .lbl{border:1px solid #ccc;border-radius:6px;padding:6mm;text-align:center;page-break-inside:avoid}
      .lbl img{width:34mm;height:34mm}
      .nm{font-weight:700;font-size:12pt;margin-top:3mm}
      .cat{color:#666;font-size:9pt}
      @media print{.lbl{border:1px solid #ddd}}
    </style></head><body><div class="grid">${cells}</div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="fade-up">
      <Link href="/inventory" style={{ color: "var(--gray)", fontSize: 13, textDecoration: "none" }}>‹ {t("labels.back")}</Link>
      <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><Icon e="🏷️" size={22} /> {t("labels.title")}</div>
      <div className="page-sub">{t("labels.subtitle")}</div>

      <button onClick={printLabels} disabled={loading || products.length === 0}
        style={{ width: "100%", padding: 12, margin: "14px 0", borderRadius: 10, background: "var(--gold)", color: "#1a1a1a", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        🖨 {t("labels.print")}
      </button>

      {loading ? <CardSkeleton rows={4} /> : products.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }}>{t("labels.none")}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {products.map((p) => (
            <div key={p.id} className="card" style={{ textAlign: "center", padding: 12 }}>
              {qr[p.id] ? <img src={qr[p.id]} alt="" style={{ width: "70%", maxWidth: 120 }} /> : <div style={{ height: 100, color: "var(--gray)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{t("labels.qrPending")}</div>}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)", marginTop: 6 }}>{p.product}</div>
              <div style={{ fontSize: 11, color: "var(--gray)" }}>{p.category}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}