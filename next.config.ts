import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");

// ── CONTENT SECURITY POLICY ─────────────────────────────────────────────────
// Shipped in REPORT-ONLY mode on purpose. Enforcing a CSP blind is a reliable
// way to break a live app, and this codebase uses inline style={{...}} almost
// everywhere, so style-src in particular needs real-world data first.
//
// TO ENFORCE: watch Sentry / the browser console for violations for a week or
// two, tighten whatever legitimately trips, then rename the header below from
// Content-Security-Policy-Report-Only to Content-Security-Policy.
//
// 'unsafe-inline' on style-src is required by React's inline styles.
// 'unsafe-eval' is NOT included — add it only if a dependency genuinely needs it.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `font-src 'self' data:`,
  // Supabase REST/auth/realtime + Sentry ingest.
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.ingest.de.sentry.io`,
  `media-src 'self' blob:`,      // QR scanner camera stream
  `worker-src 'self' blob:`,     // service worker + html5-qrcode
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The QR scanner needs the camera and the geofence needs location —
          // both scoped to our own origin. Do not tighten these to () or you
          // will silently break clock-in.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
      {
        // Pages behind the auth gate must never be stored by a browser or a
        // shared-device cache. Pairs with the service-worker allowlist in
        // public/sw.js — see item 3 in PRODUCTION-AUDIT.md.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // keep the build quiet; Sentry logs only on CI
  silent: !process.env.CI,
  // Route Sentry traffic through our own origin so ad/tracker blockers — common
  // on staff phones — don't silently swallow error reports from exactly the
  // devices most likely to be having problems.
  tunnelRoute: "/monitoring",
});
