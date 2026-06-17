"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import { getProducts, getCounts, saveCount, addProduct, removeProduct, getOrderAlert } from "@/lib/queries/inventory";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

export default function InventoryPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, any>>({});
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");

  // count entry: product -> typed value
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [savingP, setSavingP] = useState<string | null>(null);

  // add product
  const [showAdd, setShowAdd] = useState(false);
  const [np, setNp] = useState({ category: "", product: "", soll: "", unit: "" });

  async function load() {
    setLoading(true);
    const pRes = await getProducts();
    if (!pRes.ok) { setLoading(false); return; }
    setProducts(pRes.products);

    const cRes = await getCounts();
    const cMap: Record<string, any> = {};
    for (const c of (cRes.counts || [])) cMap[c.product] = c;
    setCounts(cMap);

    const aRes = await getOrderAlert();
    if (aRes.ok) setLowStock(aRes.lowStock);

    // default active category
    const cats = [...new Set(pRes.products.map((p: any) => p.category))];
    if (cats.length && !activeCat) setActiveCat(cats[0] as string);

    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function doSaveCount(p: any) {
    const val = entry[p.product];
    if (val === undefined || val === "") { toast(t("inv.enterCount"), "error"); return; }
    setSavingP(p.product);
    const res = await saveCount(p.product, p.category, Number(val), Number(p.soll), p.unit);
    setSavingP(null);
    if (res.ok) { toast(`${p.product} ${t("inv.countedToast")}`, "success"); setEntry((e) => ({ ...e, [p.product]: "" })); load(); }
    else { toast(res.error || t("inv.failed"), "error"); if (res.error?.includes("Managers")) setDenied(true); }
  }

  async function doAddProduct() {
    if (!np.category || !np.product) { toast(t("inv.catProductRequired"), "error"); return; }
    const res = await addProduct(np.category, np.product, Number(np.soll) || 0, np.unit);
    if (res.ok) { toast(t("inv.productAdded"), "success"); setNp({ category: "", product: "", soll: "", unit: "" }); setShowAdd(false); load(); }
    else toast(res.error || t("inv.failed"), "error");
  }

  if (denied) return <div style={{ ...card, textAlign: "center", color: "#9a8f8f", maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const categories = [...new Set(products.map((p) => p.category))];
  const shownProducts = products.filter((p) => p.category === activeCat);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}><Icon e="📦" size={22} /> {t("inv.title")}</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>{t("inv.subtitle")}</p>


      {loading ? (
        <CardSkeleton rows={4} />
      ) : (
        <>
          {/* ORDER ALERT */}
          <div style={{ ...card, marginBottom: 14, borderColor: lowStock.length ? "rgba(231,76,60,0.3)" : "rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: lowStock.length ? 10 : 0 }}>
              {lowStock.length ? t("inv.belowTarget", { n: lowStock.length }) : t("inv.allAtTarget")}
            </div>
            {lowStock.map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <span>{l.product} <span style={{ color: "#9a8f8f", fontSize: 11 }}>({l.category})</span></span>
                <span style={{ color: "#ec7063" }}>{l.ist}/{l.soll} {l.unit || ""} · {t("inv.short")} {l.short}</span>
              </div>
            ))}
          </div>

          {/* ADD PRODUCT */}
          <button onClick={() => setShowAdd(!showAdd)} style={{ ...primaryBtn, width: "100%", marginBottom: 12, background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
            {showAdd ? t("common.close") : t("inv.addToCatalog")}
          </button>
          {showAdd && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={t("inv.category")}><input value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} style={input} placeholder={t("inv.phCategory")} /></Field>
                <Field label={t("inv.product")}><input value={np.product} onChange={(e) => setNp({ ...np, product: e.target.value })} style={input} placeholder={t("inv.phProduct")} /></Field>
                <Field label={t("inv.target")}><input type="number" value={np.soll} onChange={(e) => setNp({ ...np, soll: e.target.value })} style={input} placeholder="20" /></Field>
                <Field label={t("inv.unit")}><input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} style={input} placeholder={t("inv.phUnit")} /></Field>
              </div>
              <button onClick={doAddProduct} style={primaryBtn}>{t("inv.addProduct")}</button>
            </div>
          )}

          {/* CATEGORY TABS */}
          {categories.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>{t("inv.noProducts")}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {categories.map((c) => (
                  <button key={c} onClick={() => setActiveCat(c)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: activeCat === c ? "#d4a847" : "rgba(255,255,255,0.04)", color: activeCat === c ? "#1a0e0e" : "#9a8f8f", border: "1px solid rgba(255,255,255,0.1)" }}>{c}</button>
                ))}
              </div>

              {/* PRODUCTS in active category */}
              {shownProducts.map((p) => {
                const counted = counts[p.product];
                const isLow = counted && Number(counted.ist) < Number(p.soll);
                return (
                  <div key={p.id} style={{ ...card, marginBottom: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.product}</div>
                        <div style={{ fontSize: 12, color: "#9a8f8f" }}>
                          {t("inv.targetShort")} {p.soll} {p.unit || ""}
                          {counted && <span style={{ color: isLow ? "#ec7063" : "#58d68d" }}> · {t("inv.counted")} {counted.ist}</span>}
                        </div>
                      </div>
                      <input type="number" value={entry[p.product] ?? ""} onChange={(e) => setEntry({ ...entry, [p.product]: e.target.value })}
                        placeholder={counted ? String(counted.ist) : "0"} style={{ ...input, width: 70, textAlign: "center" }} />
                      <button onClick={() => doSaveCount(p)} disabled={savingP === p.product} style={{ ...primaryBtn, width: "auto", padding: "10px 16px", flex: "0 0 auto" }}>
                        {savingP === p.product ? "…" : t("inv.count")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: any) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 11, color: "#9a8f8f", marginBottom: 4 }}>{label}</label>{children}</div>;
}
const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "12px", background: "#d4a847", color: "#1a0e0e", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };