"use server";

import { createClient } from "@/lib/supabase/server";

// ── AVATAR ──
// Saves the uploaded avatar's public URL onto the user's row.
export async function setAvatarUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── DOCUMENTS ──
// Record a freshly-uploaded document (file already in the 'documents' bucket).
export async function addDocument(docType: string, filePath: string, fileName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  const { data: prof } = await supabase.from("users").select("branch_id").eq("id", user.id).single();
  const { error } = await supabase.from("user_documents").insert({
    user_id: user.id,
    branch_id: prof?.branch_id ?? null,
    doc_type: docType,
    file_path: filePath,
    file_name: fileName,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMyDocuments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  const { data, error } = await supabase
    .from("user_documents")
    .select("id, doc_type, file_path, file_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, docs: data || [] };
}

// Private bucket → generate a short-lived signed URL to view/download.
export async function getDocumentUrl(filePath: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data.signedUrl };
}

export async function deleteDocument(id: string, filePath: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };

  await supabase.storage.from("documents").remove([filePath]);
  const { error } = await supabase
    .from("user_documents").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}