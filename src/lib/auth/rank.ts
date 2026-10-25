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

const CREATE_ROLES: Record<string, readonly string[]> = {
  manager: ["staff", "kiosk"],
  branch_owner: ["staff", "kiosk", "manager"],
  brand_owner: ["staff", "kiosk", "manager", "branch_owner"], // a second brand owner only via super admin
  super_admin: Object.keys(RANK),
};

export function canCreateRole(actor: string | null, requested: string): boolean {
  return (CREATE_ROLES[actor || ""] || []).includes(requested);
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
//   3. The target must rank STRICTLY BELOW you (super admin excepted). Equal rank
//      is refused on purpose: otherwise one compromised manager account could
//      deactivate every other manager, and one brand owner could reset another
//      brand owner's password and take the account over.
export function canActOnUser({ meRole, meBranchId, targetRole, targetBranchId }: ActorCheck): ActorResult {
  if (!isManagerRole(meRole)) {
    return { ok: false, error: "Managers only.", status: 403 };
  }

  if (!Object.prototype.hasOwnProperty.call(RANK, targetRole || "") || rankOf(targetRole) > rankOf(meRole)) {
    return { ok: false, error: "You can't act on a higher or unknown role.", status: 403 };
  }
  if (meRole !== "super_admin" && rankOf(targetRole) >= rankOf(meRole)) {
    return { ok: false, error: "You can't remove someone at or above your role.", status: 403 };
  }
  const isOwner = CROSS_BRANCH_ROLES.includes(meRole || "");
  if (isOwner) return { ok: true };

  if (!meBranchId || targetBranchId !== meBranchId) {
    return { ok: false, error: "You can only manage staff in your own branch.", status: 403 };
  }
  return { ok: true };
}
