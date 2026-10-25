"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BRANCH_COOKIE, MULTI_BRANCH_ROLES, accessibleBranchIds } from "@/lib/activeBranch";

const HQ = ["brand_owner", "super_admin"];
const YEAR = 60 * 60 * 24 * 365;

// Header picker: "hq" (brand owner oversight) or a branch id the caller may access.
// The cookie is re-validated on every request by activeBranchFor(); this check only
// gives a clear error instead of a silent fallback.
export async function setActiveBranch(choice: string) {
  if (typeof choice !== "string" || (choice !== "hq" && !/^[0-9a-f-]{36}$/i.test(choice))) return { ok: false as const, error: "Invalid decision." };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: me } = await db.from("users").select("role").eq("id", user.id).single();
  if (!MULTI_BRANCH_ROLES.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only." };
  const store = await cookies();
  // Secure only over HTTPS (Vercel sets x-forwarded-proto). A Secure cookie sent over plain
  // http (local staging) is silently dropped by the browser and the switch would do nothing.
  const https = ((await headers()).get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  const opts = { path: "/", maxAge: YEAR, sameSite: "lax" as const, secure: https };
  if (choice === "hq") {
    if (!HQ.includes(me!.role)) return { ok: false as const, error: "Owners only." };
    store.set("sz_view", "hq", opts);
    return { ok: true as const };
  }
  if (!(await accessibleBranchIds(db)).includes(choice)) return { ok: false as const, error: "Branch access denied." };
  store.set(BRANCH_COOKIE, choice, { ...opts, httpOnly: true });
  if (HQ.includes(me!.role)) store.set("sz_view", "branch", opts);
  return { ok: true as const };
}
