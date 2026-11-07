"use client";
import InventoryNav from "@/components/InventoryNav";

import { useEffect, useRef, useState } from "react";
import {PageHeader,ErrorState} from "@/components/ui";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import { CardSkeleton } from "@/components/Skeleton";
import { getProducts } from "@/lib/queries/inventory";

export default function LabelsPage() {
  const { t, locale } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [error,setError]=useState(false);
  const request=useRef(0);
  async function load(){
    const seq=++request.current;setLoading(true);setError(false);
    try{
      const result=await getProducts();
      if(!result.ok)throw new Error("Products unavailable");
      const list=result.products||[],map:Record<string,string>={};
      if(list.length){
        const QRCode=(await import("qrcode")).default;
        for(const product of list)map[product.id]=await QRCode.toDataURL(`sq:${product.id}`,{width:220,margin:1});
      }
      if(seq!==request.current)return;
      setProducts(list);setQr(map);
    }catch{if(seq===request.current)setError(true);}
    finally{if(seq===request.current)setLoading(false);}
  }
  useEffect(()=>{void load();return()=>{request.current++;};},[]);

  function printLabels() {
    if(loading||error||!products.length)return;
    const cells = products.map((p) => `
      <div class="lbl">
        ${qr[p.id] ? `<img src="${qr[p.id]}" />` : ""}
        <div class="nm">${escapeHtml(p.product)}</div>
        <div class="cat">${escapeHtml(p.category || "")}</div>
      </div>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Schnitzery — ${t("misc.labelsTitle")}</title><style>
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
    <div className="inventory-page">
      <InventoryNav active="stock" />
      <PageHeader title={t("labels.title")} subtitle={t("labels.subtitle")} icon={<Icon e="🏷️" size={22}/>} actions={<button className="btn-gold" onClick={printLabels} disabled={loading||error||products.length===0}>{t("labels.print")}</button>}/>


      {loading ? <CardSkeleton rows={4} /> : error ? <ErrorState message={locale==="de"?"Etiketten konnten nicht vorbereitet werden. Vor dem Drucken erneut versuchen.":"Labels could not be prepared. Retry before printing."} onRetry={load} retryLabel={t("business.retry")}/> : products.length === 0 ? (
        <div className="card ui-empty-msg">{t("labels.none")}</div>
      ) : (
        <div className="inventory-label-grid">
          {products.map((p) => (
            <div key={p.id} className="card u-center p-3">
              {qr[p.id] ? <img src={qr[p.id]} alt="" style={{ width: "70%", maxWidth: 120 }} /> : <div style={{ height: 100, color: "var(--gray)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{t("labels.qrPending")}</div>}
              <div className="t-sm fw-6 u-text mt-2">{p.product}</div>
              <div className="ui-muted">{p.category}</div>
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