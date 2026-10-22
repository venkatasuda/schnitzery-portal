"use client";

import { useEffect, useState } from "react";
import { CardSkeleton } from "@/components/Skeleton";
import { getDirectory } from "@/lib/queries/people";
import { useLang } from "@/components/LanguageProvider";
import Icon from "@/components/Icon";

const TEAM_COLORS: Record<string, string> = {
  Manager: "var(--info)", Preparation: "var(--gold-ink)", Kitchen: "var(--success)", Cashier: "#9b59b6",
};

export default function DirectoryPage() {
  const { t } = useLang();
  const teamLabel = (k: string) => (["Manager", "Preparation", "Kitchen", "Cashier"].includes(k) ? t("teams." + k) : k);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const res = await getDirectory();
      if (res.ok) setPeople(res.people);
      setLoading(false);
    })();
  }, []);

  const filtered = people.filter((p) =>
    (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.team || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="workspace-page">
      <h1 className="page-title u-row"><Icon e="📇" size={22} /> {t("directory.title")}</h1>
      <p className="ui-lede">{t("directory.subtitle")}</p>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("directory.searchPlaceholder")}
        style={{ width: "100%", padding: "12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box", marginBottom: 14 }} />

      {loading ? (
        <CardSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <div className="card ui-empty-msg">{t("directory.empty")}</div>
      ) : (
        filtered.map((p) => (
          <div key={p.id} style={{ ...card, marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: TEAM_COLORS[p.team] || "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(p.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="u-grow">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.full_name || "—"}{p.status === "inactive" && <span className="ui-muted"> ({t("directory.inactive")})</span>}</div>
              <div className="ui-muted">{p.team ? teamLabel(p.team) : t("directory.noTeam")}</div>
            </div>
            <div className="u-hstack">
              {p.phone && <a href={`tel:${p.phone}`} style={iconBtn} title={t("directory.call")}><Icon e="📞" size={16} /></a>}
              {p.phone && <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" style={iconBtn} title="WhatsApp"><Icon e="💬" size={16} /></a>}
              {p.email && <a href={`mailto:${p.email}`} style={iconBtn} title={t("directory.email")}><Icon e="✉️" size={16} /></a>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--dark)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 };
const iconBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 9, background: "var(--dark2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none", color: "var(--gold-ink)" };