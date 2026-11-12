"use client";
// "Read delivery note": pick photos (several pages) or a PDF → structured lines for the delivery form.
// Photos are shrunk in the browser first (long side 1800 px, JPEG) so they upload fast and stay under the request limit.
import { useRef, useState } from "react";
import { useLang } from "@/components/LanguageProvider";
import type { ParsedNote } from "@/lib/inventory/delivery-note";

const b64 = (buf: ArrayBuffer) => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
async function shrink(file: File): Promise<{ type: string; data: string }> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("image"))), "image/jpeg", 0.82));
  return { type: "image/jpeg", data: b64(await blob.arrayBuffer()) };
}

export default function DeliveryNoteReader({ onNote, disabled }: { onNote: (note: ParsedNote) => void; disabled?: boolean }) {
  const { locale } = useLang();
  const s = (en: string, de: string) => (locale === "de" ? de : en);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");

  async function read(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, 6);
    if (input.current) input.current.value = "";
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const payload = await Promise.all(files.map(async (f) => f.type === "application/pdf" ? { type: f.type, data: b64(await f.arrayBuffer()) } : shrink(f)));
      const res = await fetch("/api/inventory/delivery-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: payload }) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { onNote(json.note as ParsedNote); return; }
      const code = json?.error ?? "";
      setError(code === "off" ? s("Reading delivery notes is not switched on yet.", "Das Lesen von Lieferscheinen ist noch nicht aktiviert.")
        : code === "limit" ? s("Daily limit reached. Enter this delivery by hand.", "Tageslimit erreicht. Diese Lieferung bitte von Hand erfassen.")
        : code === "unreadable" ? s("Could not read this note. Try a sharper photo, or enter it by hand.", "Lieferschein nicht lesbar. Schärferes Foto versuchen oder von Hand erfassen.")
        : code === "invalid" ? s("Use photos or one PDF, up to 6 pages.", "Fotos oder ein PDF verwenden, höchstens 6 Seiten.")
        : s("Reading failed. Enter this delivery by hand.", "Lesen fehlgeschlagen. Diese Lieferung bitte von Hand erfassen."));
    } catch { setError(s("Reading failed. Enter this delivery by hand.", "Lesen fehlgeschlagen. Diese Lieferung bitte von Hand erfassen.")); }
    finally { setBusy(false); }
  }

  return <div className="note-reader">
    <label className={`btn-secondary${busy || disabled ? " is-disabled" : ""}`}>
      {busy ? s("Reading…", "Wird gelesen…") : s("Read delivery note (photo / PDF)", "Lieferschein lesen (Foto / PDF)")}
      <input ref={input} type="file" className="sr-only" multiple accept="image/*,application/pdf" disabled={busy || disabled} onChange={(e) => void read(e.target.files)} />
    </label>
    {error && <span role="alert" className="tone-danger">{error}</span>}
  </div>;
}
