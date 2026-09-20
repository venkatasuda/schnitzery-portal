import Link from "next/link";

// Custom 404 — renders inside the root layout (so theme + fonts apply). Kept
// self-contained and bilingual-light (EN + DE) since it can appear before any
// locale context is available.
export default function NotFound() {
  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 64, fontWeight: 700, fontFamily: "var(--font-display, Georgia, serif)", color: "var(--gold-ink, #d4a847)", lineHeight: 1 }}>404</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--white, #fff)", marginTop: 12 }}>
          Page not found
        </div>
        <div style={{ fontSize: 13, color: "var(--gray, #888)", marginTop: 6 }}>
          This page doesn’t exist or has moved. · Diese Seite existiert nicht oder wurde verschoben.
        </div>
        <Link
          href="/"
          style={{ display: "inline-block", marginTop: 22, padding: "12px 22px", background: "var(--gold, #d4a847)", color: "#1a0e0e", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
        >
          Back to home · Zur Startseite
        </Link>
      </div>
    </div>
  );
}
