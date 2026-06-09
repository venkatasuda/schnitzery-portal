"use client";

// Shimmer placeholders for loading states. The schShimmer keyframes are defined
// once in ToastHost (mounted in the app layout), so these animate on app pages.

export function Skeleton({ height = 16, width = "100%", radius = 8, style }: { height?: number | string; width?: number | string; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ height, width, borderRadius: radius, background: "linear-gradient(90deg, rgba(128,128,128,0.10) 25%, rgba(128,128,128,0.22) 37%, rgba(128,128,128,0.10) 63%)", backgroundSize: "400% 100%", animation: "schShimmer 1.4s ease infinite", ...style }} />
  );
}

// A card with N shimmering rows — good for list loading states.
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
          <Skeleton height={38} width={38} radius={19} />
          <div style={{ flex: 1 }}>
            <Skeleton height={13} width="55%" />
            <div style={{ height: 7 }} />
            <Skeleton height={10} width="35%" />
          </div>
        </div>
      ))}
    </div>
  );
}

// A row of N shimmering stat tiles.
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={66} radius={12} />
      ))}
    </div>
  );
}