"use server";

import { createClient } from "@/lib/supabase/server";

// Saves the uploaded avatar's public URL onto the user's row.
// (The actual file upload happens client-side via the browser storage client.)
export async function setAvatarUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  const { error } = await supabase
    .from("users").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}