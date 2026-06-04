"use client";

import { useEffect, useState } from "react";
import { getDirectory } from "@/lib/queries/people";

const TEAM_COLORS: Record<string, string> = {
  Manager: "#3498db", Preparation: "#d4a847", Kitchen: "#27ae60", Cashier: "#9b59b6",
};

export default function DirectoryPage() {
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
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif", marginBottom: 2 }}>📇 Team Directory</h1>
      <p style={{ color: "#9a8f8f", fontSize: 13, marginBottom: 16 }}>Find and contact colleagues.</p>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by name or team…"
        style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontSize: 14, boxSizing: "border-box", marginBottom: 14 }} />

      {loading ? (
        <div style={{ color: "#9a8f8f", padding: 30, textAlign: "center" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#9a8f8f", padding: 30 }}>No colleagues found.</div>
      ) : (
        filtered.map((p) => (
          <div key={p.id} style={{ ...card, marginBottom: 8, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: TEAM_COLORS[p.team] || "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(p.full_name || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.full_name || "—"}{p.status === "inactive" && <span style={{ fontSize: 11, color: "#9a8f8f" }}> (inactive)</span>}</div>
              <div style={{ fontSize: 12, color: "#9a8f8f" }}>{p.team || "No team"}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {p.phone && <a href={`tel:${p.phone}`} style={iconBtn} title="Call">📞</a>}
              {p.phone && <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" style={iconBtn} title="WhatsApp">💬</a>}
              {p.email && <a href={`mailto:${p.email}`} style={iconBtn} title="Email">✉️</a>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14 };
const iconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none" };