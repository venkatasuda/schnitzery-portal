"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, Arial, sans-serif", background: "#1a0e0e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, padding: 24, textAlign: "center" }}>
        <div>
          <h2 style={{ color: "#d4a847", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#9a8f8f", marginBottom: 20, maxWidth: 340 }}>The error has been logged and we&apos;ll look into it. Please try again.</p>
          <button onClick={() => reset()} style={{ padding: "11px 20px", borderRadius: 8, background: "#d4a847", color: "#1a1a1a", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}