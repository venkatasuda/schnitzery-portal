"use client";

import { useEffect, useRef, useState } from "react";

// Camera QR scanner. Uses html5-qrcode (loaded dynamically so it never
// runs on the server). Calls onScan(decodedText) once a QR is read.
export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef<any>(null);
  const elementId = "qr-reader-region";
  const scannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        // Dynamic import — only loads in the browser.
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" }, // rear camera
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (scannedRef.current) return; // only fire once
            scannedRef.current = true;
            onScan(decodedText);
          },
          () => {} // ignore per-frame decode errors
        );
        if (!cancelled) setStarting(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message?.includes("Permission") || e?.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access, or use the code instead."
              : "Could not start camera. Use the 6-digit code instead."
          );
          setStarting(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#241414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, maxWidth: 340, width: "100%", textAlign: "center" }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#fff" }}>Scan Clock QR</div>
        <div style={{ fontSize: 12, color: "#9a8f8f", marginBottom: 14 }}>
          Point your camera at the display screen.
        </div>

        <div
          id={elementId}
          style={{ width: "100%", minHeight: 240, borderRadius: 12, overflow: "hidden", background: "#000" }}
        />

        {starting && !error && (
          <div style={{ color: "#9a8f8f", fontSize: 13, marginTop: 12 }}>Starting camera…</div>
        )}
        {error && <div style={{ color: "#ec7063", fontSize: 13, marginTop: 12 }}>{error}</div>}

        <button
          onClick={onClose}
          style={{ width: "100%", marginTop: 16, padding: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", fontSize: 14, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}