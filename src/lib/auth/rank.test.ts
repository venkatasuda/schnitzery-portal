import { describe, it, expect } from "vitest";
import { canActOnUser, rankOf, isManagerRole } from "./rank";

const A = "branch-a";
const B = "branch-b";

function check(meRole: string, targetRole: string, meBranchId = A, targetBranchId = A) {
  return canActOnUser({ meRole, meBranchId, targetRole, targetBranchId });
}

describe("rankOf", () => {
  it("orders the roles", () => {
    expect(rankOf("super_admin")).toBeGreaterThan(rankOf("brand_owner"));
    expect(rankOf("brand_owner")).toBeGreaterThan(rankOf("branch_owner"));
    expect(rankOf("branch_owner")).toBeGreaterThan(rankOf("manager"));
    expect(rankOf("manager")).toBeGreaterThan(rankOf("staff"));
    expect(rankOf("staff")).toBeGreaterThan(rankOf("kiosk"));
  });

  it("treats unknown and missing roles as the bottom rank", () => {
    expect(rankOf("wizard")).toBe(0);
    expect(rankOf(null)).toBe(0);
    expect(rankOf(undefined)).toBe(0);
    expect(rankOf("")).toBe(0);
  });
});

describe("isManagerRole", () => {
  it("accepts manager and above, rejects everything else", () => {
    expect(isManagerRole("manager")).toBe(true);
    expect(isManagerRole("branch_owner")).toBe(true);
    expect(isManagerRole("brand_owner")).toBe(true);
    expect(isManagerRole("super_admin")).toBe(true);
    expect(isManagerRole("staff")).toBe(false);
    expect(isManagerRole("kiosk")).toBe(false);
    expect(isManagerRole(null)).toBe(false);
  });
});

describe("canActOnUser", () => {
  it("refuses non-managers outright", () => {
    expect(check("staff", "staff").ok).toBe(false);
    expect(check("kiosk", "staff").ok).toBe(false);
    expect(check("", "staff").ok).toBe(false);
  });

  it("lets a manager act on staff in their own branch", () => {
    expect(check("manager", "staff").ok).toBe(true);
    expect(check("manager", "kiosk").ok).toBe(true);
  });

  // The rule the equal-rank decision turns on.
  it("does NOT let a manager act on another manager", () => {
    const r = check("manager", "manager");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at or above your role/);
  });

  it("does not let a branch owner act on another branch owner", () => {
    expect(check("branch_owner", "branch_owner").ok).toBe(false);
  });

  it("lets a branch owner act on a manager", () => {
    expect(check("branch_owner", "manager").ok).toBe(true);
  });

  it("never lets someone act on a higher rank", () => {
    expect(check("manager", "branch_owner").ok).toBe(false);
    expect(check("manager", "brand_owner").ok).toBe(false);
    expect(check("branch_owner", "super_admin").ok).toBe(false);
  });

  it("confines a manager to their own branch", () => {
    const r = check("manager", "staff", A, B);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/own branch/);
  });

  it("lets owners reach across branches, including equal rank", () => {
    expect(check("brand_owner", "staff", A, B).ok).toBe(true);
    expect(check("brand_owner", "branch_owner", A, B).ok).toBe(true);
    expect(check("brand_owner", "brand_owner", A, B).ok).toBe(true);
    expect(check("super_admin", "super_admin", A, B).ok).toBe(true);
  });

  it("treats an unknown target role as bottom rank rather than failing open", () => {
    // A junk role must not accidentally outrank a manager.
    expect(check("manager", "wizard").ok).toBe(true);
    // ...and must not let a junk-role actor do anything.
    expect(check("wizard", "staff").ok).toBe(false);
  });

  it("blocks a manager whose branch is null from reaching a real branch", () => {
    expect(canActOnUser({
      meRole: "manager", meBranchId: null, targetRole: "staff", targetBranchId: A,
    }).ok).toBe(false);
  });
});
