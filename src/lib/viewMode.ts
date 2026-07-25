import { cookies } from "next/headers";

// ============================================================================
// VIEW MODE — for brand owners / super admins only.
//
// A brand owner both oversees all branches (HQ) and, today, runs the flagship
// branch hands-on. Rather than cram both onto one screen, they pick a mode:
//   "hq"     → cross-branch oversight (org rollup, all branches, analytics)
//   "branch" → the full single-branch manager toolkit (roster, temp, waste…)
//
// Stored in the sz_view cookie so both the server (home page, layout, nav) and
// the client toggle agree without a round-trip. Defaults to "hq" — an owner
// lands on oversight and opts into the branch floor.
//
// This is purely a UI switch. It changes NOTHING about permissions: RLS and the
// role checks in every query are unaffected. A staff or manager account ignores
// it entirely.
// ============================================================================

export type ViewMode = "hq" | "branch";

export async function getViewMode(): Promise<ViewMode> {
  try {
    const c = await cookies();
    return c.get("sz_view")?.value === "branch" ? "branch" : "hq";
  } catch {
    return "hq";
  }
}
