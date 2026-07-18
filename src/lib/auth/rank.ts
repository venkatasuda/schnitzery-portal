// ============================================================================
// ROLE RANKING + "may I act on this person?" rule.
//
// Extracted from the API route so it is a pure function that can be tested.
// This encodes a real security boundary — see rank.test.ts.
// ============================================================================

export const RANK: Record<string, number> = {
  super_admin: 5,
  brand_owner: 4,
  branch_owner: 3,
  manager: 2,
  staff: 1,
  kiosk: 0,
};

export const MANAGER_ROLES = ["manager", "branch_owner", "brand_owner", "super_admin"];

// Owners reach across branches; everyone else is confined to their own.
export const CROSS_BRANCH_ROLES = ["brand_owner", "super_admin"];

export function rankOf(role?: string | null): number {
  return RANK[role || ""] ?? 0;
}

export function isManagerRole(role?: string | null): boolean {
  return MANAGER_ROLES.includes(role || "");
}

export type ActorCheck = {
  meRole: string | null;
  meBranchId: string | null;
  targetRole: string | null;
  targetBranchId: string | null;
};

export type ActorResult = { ok: true } | { ok: false; error: string; status: 403 };

// Can `me` deactivate/reactivate `target`?
//
// Rules, in order:
//   1. You must be a manager or above.
//   2. Unless you are a brand owner / super admin, the target must be in your branch.
//   3. Unless you are a brand owner / super admin, the target must rank STRICTLY
//      BELOW you. Equal rank is refused on purpose: otherwise one compromised
//      manager account could deactivate every other manager and lock a branch's
//      entire management team out.
export function canActOnUser({ meRole, meBranchId, targetRole, targetBranchId }: ActorCheck): ActorResult {
  if (!isManagerRole(meRole)) {
    return { ok: false, error: "Managers only.", status: 403 };
  }

  const isOwner = CROSS_BRANCH_ROLES.includes(meRole || "");
  if (isOwner) return { ok: true };

  if (targetBranchId !== meBranchId) {
    return { ok: false, error: "You can only manage staff in your own branch.", status: 403 };
  }
  if (rankOf(targetRole) >= rankOf(meRole)) {
    return { ok: false, error: "You can't remove someone at or above your role.", status: 403 };
  }
  return { ok: true };
}
