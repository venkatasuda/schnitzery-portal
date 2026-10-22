"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/lib/queries/global-search";

export default function SearchPage() {
  const { t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ employees: any[]; branches: any[]; documents: any[] } | null>(null);
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
      setRes({ employees: r.employees || [], branches: r.branches || [], documents: r.documents || [] });
      setLoading(false);
    }, 250);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  if (denied) return <div className="card ui-denied">{t("common.managersOnly")}</div>;

  const total = (res?.employees.length || 0) + (res?.branches.length || 0) + (res?.documents.length || 0);

  return (
    <div className="fade-up">
      <h1 className="page-title u-row"><Icon e="🔍" size={22} /> {t("search.title")}</h1>

      <div className="card p-2 mb-4">
        <input aria-label={t("search.title")}
          ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")}
          style={{ width: "100%", padding: "12px 14px", background: "transparent", color: "var(--white)", border: "none", outline: "none", fontSize: 16 }}
        />
      </div>

      {q.trim().length < 2 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--gray)", padding: 30, fontSize: 14 }}>{t("search.hint")}</div>
      ) : loading ? (
        <div className="card u-center u-muted p-6">…</div>
      ) : total === 0 ? (
        <div className="card ui-empty-msg">{t("search.none")}</div>
      ) : (
        <>
          {res!.employees.length > 0 && (
            <>
              <div className="section-label d-flex ai-c gap-2"><Icon e="👥" size={13} /> {t("search.employees")}</div>
              <div className="d-flex f-col gap-2 mb-4">
                {res!.employees.map((e) => (
                  <Link key={e.id} href={`/staff/${e.id}`} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{(e.name || "?")[0].toUpperCase()}</div>
                    <div className="u-grow">
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name} {e.code && <span className="ui-muted">· {e.code}</span>}</div>
                      {e.sub && <div className="ui-muted">{e.sub}</div>}
                    </div>
                    <span className="u-muted">›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
          {res!.branches.length > 0 && (
            <>
              <div className="section-label d-flex ai-c gap-2"><Icon e="🏢" size={13} /> {t("search.branches")}</div>
              <div className="u-stack tight">
                {res!.branches.map((b) => (
                  <Link key={b.id} href="/branches" className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <Icon e="🏢" size={18} color="var(--gold)" />
                    <div className="u-flex1 fw-6">{b.name}</div>
                    <span className="u-muted">›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
          {res!.documents.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: res!.branches.length ? 14 : 0, display: "flex", alignItems: "center", gap: 6 }}><Icon e="📄" size={13} /> {t("search.documents")}</div>
              <div className="u-stack tight">
                {res!.documents.map((d) => (
                  <Link key={d.id} href={`/staff/${d.userId}`} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                    <Icon e="📄" size={18} color="var(--gold)" />
                    <div className="u-grow">
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.docType}</div>
                      <div className="ui-muted">{d.owner}{d.expiry ? ` · ${t("search.expires")} ${d.expiry}` : ""}</div>
                    </div>
                    <span className="u-muted">›</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Link className="ui-back-link" href="/">{t("approvals.back")}</Link>
    </div>
  );
}