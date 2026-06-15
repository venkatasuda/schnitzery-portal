"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/lib/queries/global-search";

export default function SearchPage() {
  const { t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ employees: any[]; branches: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const timer = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setRes(null); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const r = await globalSearch(q);
      if (!r.ok && r.error?.includes("Managers")) { setDenied(true); setLoading(false); return; }
      setRes({ employees: r.employees || [], branches: r.branches || [] });
      setLoading(false);
    }, 250);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  if (denied) return <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }}>{t("common.managersOnly")}</div>;

  const total = (res?.employees.length || 0) + (res?.branches.length || 0);

  return (
    <div className="fade-up">
      <div className="page-title">🔍 {t("search.title")}</div>

      <div className="card" style={{ padding: 8, marginBottom: 14 }}>
        <input
          ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")}
          style={{ width: "100%", padding: "12px 14px", background: "transparent", color: "var(--white)", border: "none", outline: "none", fontSize: 16 }}
        />
      </div>

      {q.trim().length < 2 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, fontSize: 14 }}>{t("search.hint")}</div>
      ) : loading ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 24 }}>…</div>
      ) : total === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30 }}>{t("search.none")}</div>
      ) : (
        <>
          {res!.employees.length > 0 && (
            <>
              <div className="section-label">👥 {t("search.employees")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {res!.employees.map((e) => (
                  <Link key={e.id} href={`/staff/${e.id}`} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{(e.name || "?")[0].toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name} {e.code && <span style={{ fontSize: 11, color: "var(--gray)" }}>· {e.code}</span>}</div>
                      {e.sub && <div style={{ fontSize: 12, color: "var(--gray)" }}>{e.sub}</div>}
                    </div>
                    <span style={{ color: "var(--gray)" }}>›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
          {res!.branches.length > 0 && (
            <>
              <div className="section-label">🏢 {t("search.branches")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {res!.branches.map((b) => (
                  <Link key={b.id} href="/branches" className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <span style={{ fontSize: 18 }}>🏢</span>
                    <div style={{ flex: 1, fontWeight: 600 }}>{b.name}</div>
                    <span style={{ color: "var(--gray)" }}>›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>{t("approvals.back")}</Link>
    </div>
  );
}