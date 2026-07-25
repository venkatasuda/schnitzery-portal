import { describe, it, expect, vi } from "vitest";
import { wageMapForBranches, wageMapForUsers, setWage } from "./wages";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Tests for the wage helpers (audit item 18).
//
// The one thing that MUST hold: these read and write `user_pay`, never `users`.
// If someone ever repoints them back at `users`, the row-level exposure that
// item 18 closed comes straight back — and it would be invisible in the UI.
// These tests fail loudly if that happens.
// ============================================================================

// Minimal chainable stand-in for the Supabase client. Records which table and
// columns were touched, and returns whatever data we prime it with.
function mockClient(rows: any[] = [], captured: any = {}) {
  const client = {
    from(table: string) {
      captured.table = table;
      return {
        select(cols: string) {
          captured.select = cols;
          return {
            in(col: string, ids: any[]) {
              captured.inColumn = col;
              captured.inIds = ids;
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
        upsert(obj: any) {
          captured.upsert = obj;
          return Promise.resolve({ error: captured.upsertError ?? null });
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}

describe("wageMapForBranches", () => {
  it("reads from user_pay, never users", async () => {
    const cap: any = {};
    await wageMapForBranches(mockClient([], cap), ["branch-a"]);
    expect(cap.table).toBe("user_pay");
    expect(cap.table).not.toBe("users");
    expect(cap.inColumn).toBe("branch_id");
  });

  it("maps user_id -> numeric wage", async () => {
    const rows = [
      { user_id: "u1", hourly_wage: 15 },
      { user_id: "u2", hourly_wage: "12.5" }, // numeric can arrive as string
      { user_id: "u3", hourly_wage: null },
    ];
    const map = await wageMapForBranches(mockClient(rows), ["b1"]);
    expect(map).toEqual({ u1: 15, u2: 12.5, u3: null });
  });

  it("returns {} and makes no query when given no branches", async () => {
    const cap: any = {};
    const map = await wageMapForBranches(mockClient([], cap), []);
    expect(map).toEqual({});
    expect(cap.table).toBeUndefined(); // never hit the DB
  });

  it("drops null/undefined branch ids", async () => {
    const cap: any = {};
    await wageMapForBranches(mockClient([], cap), [null, undefined, "b1"]);
    expect(cap.inIds).toEqual(["b1"]);
  });
});

describe("wageMapForUsers", () => {
  it("reads from user_pay and filters by user_id", async () => {
    const cap: any = {};
    await wageMapForUsers(mockClient([], cap), ["u1", "u2"]);
    expect(cap.table).toBe("user_pay");
    expect(cap.inColumn).toBe("user_id");
    expect(cap.inIds).toEqual(["u1", "u2"]);
  });

  it("returns {} for an empty id list without querying", async () => {
    const cap: any = {};
    const map = await wageMapForUsers(mockClient([], cap), []);
    expect(map).toEqual({});
    expect(cap.table).toBeUndefined();
  });
});

describe("setWage", () => {
  it("writes to user_pay with the caller as updated_by", async () => {
    const cap: any = {};
    const res = await setWage(mockClient([], cap), "u1", "b1", 14, "mgr-id");
    expect(res.ok).toBe(true);
    expect(cap.table).toBe("user_pay");
    expect(cap.upsert).toMatchObject({ user_id: "u1", branch_id: "b1", hourly_wage: 14, updated_by: "mgr-id" });
  });

  it("surfaces a DB error instead of silently succeeding", async () => {
    const cap: any = { upsertError: { message: "denied by RLS" } };
    const res = await setWage(mockClient([], cap), "u1", "b1", 14, "mgr-id");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("denied by RLS");
  });

  it("allows clearing a wage to null", async () => {
    const cap: any = {};
    const res = await setWage(mockClient([], cap), "u1", "b1", null, "mgr-id");
    expect(res.ok).toBe(true);
    expect(cap.upsert.hourly_wage).toBeNull();
  });
});
