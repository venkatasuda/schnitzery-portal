"use client";

// TEMPORARY verification page — delete after you confirm Sentry works.
// Visit /sentry-test on the DEPLOYED site and tap a button; the error
// should appear in your Sentry dashboard within a minute.
export default function SentryTest() {
  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", background: "***REMOVED***1a0e0e", color: "***REMOVED***fff", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      <h2 style={{ color: "***REMOVED***d4a847" }}>Sentry test</h2>
      <p style={{ color: "***REMOVED***9a8f8f", fontSize: 13, maxWidth: 320, textAlign: "center" }}>Tap a button to trigger a test error. It should show up in your Sentry dashboard shortly. Delete this page once confirmed.</p>
      <button
        onClick={() => { throw new Error("Sentry test — client error from /sentry-test"); }}
        style={{ padding: "12px 20px", borderRadius: 8, background: "***REMOVED***e74c3c", color: "***REMOVED***fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
      >
        Throw a test error
      </button>
    </div>
  );
}