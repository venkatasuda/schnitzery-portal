"use client";

// ============================================================================
// DASHBOARD CHARTS — one small, theme-aware recharts wrapper reused by every
// role dashboard. recharts is already a dependency; nothing new is added.
//
// All colours come from the app's CSS variables (read at runtime) so the charts
// track light/dark mode automatically — no hardcoded palette to drift from the
// theme. Four primitives cover every dashboard need:
//   ProgressRing — one % (target, checklist, labour/food cost)
//   DonutStat    — parts of a whole with a centre label (today's attendance)
//   MiniBars     — a short vertical series (waste per week, hours)
//   RankBars     — a ranked horizontal list (waste by branch)
// ============================================================================

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

type Tone = "gold" | "green" | "red" | "warn" | "blue";

function useTheme() {
  const [c, setC] = useState({
    gold: "#d4a847", goldLight: "#f0c860", red: "#e74c3c", green: "#27ae60",
    warn: "#e67e22", blue: "#3498db", gray: "#888", text: "#ffffff",
    grid: "rgba(255,255,255,0.08)", card: "#2a2a2a",
  });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const g = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
      const light = document.documentElement.classList.contains("light");
      setC({
        gold: g("--gold", "#d4a847"), goldLight: g("--gold-light", "#f0c860"),
        red: g("--red-light", "#e74c3c"), green: g("--success", "#27ae60"),
        warn: g("--warn", "#e67e22"), blue: "#3498db",
        gray: g("--gray", "#888"), text: g("--white", "#ffffff"),
        grid: light ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.08)",
        card: g("--dark3", "#2a2a2a"),
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return c;
}

function toneColor(c: ReturnType<typeof useTheme>, tone: Tone) {
  return tone === "green" ? c.green : tone === "red" ? c.red
    : tone === "warn" ? c.warn : tone === "blue" ? c.blue : c.gold;
}

function tip(c: ReturnType<typeof useTheme>) {
  return {
    contentStyle: {
      background: c.card, border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10, fontSize: 12, color: c.text, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    },
    labelStyle: { color: c.gray, fontSize: 11 },
    itemStyle: { color: c.text },
  };
}

// ── One percentage as a ring, with the number in the middle ──────────────────
export function ProgressRing({ pct, label, tone = "gold", size = 118 }: {
  pct: number; label?: string; tone?: Tone; size?: number;
}) {
  const c = useTheme();
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const color = toneColor(c, tone);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: v }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: c.grid }} dataKey="value" cornerRadius={12} fill={color} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.2, fontWeight: 700, fontFamily: "var(--font-display)", color, lineHeight: 1 }}>{v}%</div>
        {label && <div style={{ fontSize: 9, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--gray)", marginTop: 4, textAlign: "center", padding: "0 6px" }}>{label}</div>}
      </div>
    </div>
  );
}

// ── Parts of a whole, with a big centre value ────────────────────────────────
export function DonutStat({ segments, centerValue, centerLabel, size = 140 }: {
  segments: { name: string; value: number; tone: Tone }[];
  centerValue: string | number; centerLabel?: string; size?: number;
}) {
  const c = useTheme();
  const data = segments.map((s) => ({ ...s, fill: toneColor(c, s.tone) })).filter((s) => s.value > 0);
  const empty = data.length === 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={empty ? [{ name: "none", value: 1, fill: c.grid }] : data}
            dataKey="value" innerRadius="66%" outerRadius="100%"
            paddingAngle={data.length > 1 ? 3 : 0} stroke="none" startAngle={90} endAngle={-270}
          >
            {(empty ? [{ fill: c.grid }] : data).map((s, i) => <Cell key={i} fill={(s as any).fill} />)}
          </Pie>
          {!empty && <Tooltip {...tip(c)} />}
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.24, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--white)", lineHeight: 1 }}>{centerValue}</div>
        {centerLabel && <div style={{ fontSize: 9, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--gray)", marginTop: 4 }}>{centerLabel}</div>}
      </div>
    </div>
  );
}

// small legend row to pair with a donut
export function Legend({ items }: { items: { name: string; tone: Tone; value?: string | number }[] }) {
  const c = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: toneColor(c, it.tone), flexShrink: 0 }} />
          <span style={{ color: "var(--gray-light)", flex: 1 }}>{it.name}</span>
          {it.value != null && <span style={{ color: "var(--white)", fontWeight: 600 }}>{it.value}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Short vertical series (e.g. waste € per week) ────────────────────────────
export function MiniBars({ data, tone = "gold", height = 130, unit = "" }: {
  data: { label: string; value: number }[]; tone?: Tone; height?: number; unit?: string;
}) {
  const c = useTheme();
  const color = toneColor(c, tone);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: c.gray }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: c.gray }} axisLine={false} tickLine={false} width={38} />
          <Tooltip {...tip(c)} cursor={{ fill: "rgba(128,128,128,0.10)" }} formatter={(v: any) => [`${unit}${v}`, ""]} />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Ranked horizontal list (e.g. waste by branch) ────────────────────────────
export function RankBars({ data, tone = "red", unit = "", rowHeight = 34 }: {
  data: { label: string; value: number }[]; tone?: Tone; unit?: string; rowHeight?: number;
}) {
  const c = useTheme();
  const color = toneColor(c, tone);
  const height = Math.max(60, data.length * rowHeight + 10);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: c.text }} axisLine={false} tickLine={false} width={92} />
          <Tooltip {...tip(c)} cursor={{ fill: "rgba(128,128,128,0.10)" }} formatter={(v: any) => [`${unit}${v}`, ""]} />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
