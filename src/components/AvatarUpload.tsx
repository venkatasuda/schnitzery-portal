"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAvatarUrl } from "@/lib/queries/profile-uploads";

// Shows the user's avatar (uploaded photo or initials) with a small camera
// button to pick + upload a new image to the 'avatars' storage bucket.
export default function AvatarUpload({ currentUrl, name, isManager }: { currentUrl: string | null; name: string | null; isManager: boolean }) {
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = (name || "?")[0].toUpperCase();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const res = await setAvatarUrl(publicUrl);
      if (!res.ok) throw new Error(res.error || "Save failed");
      setUrl(publicUrl + "?t=" + Date.now()); // cache-bust
    } catch (err: any) {
      alert("Upload failed: " + (err?.message || "unknown error"));
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" }} />
      ) : (
        <div className={`avatar${isManager ? " mgr" : ""}`} style={{ width: 64, height: 64, fontSize: 26 }}>{initial}</div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Change photo"
        style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: "var(--gold)", border: "2px solid var(--dark)", color: "#1a0e0e", fontSize: 11, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
      >
        {busy ? "…" : "📷"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
    </div>
  );
}