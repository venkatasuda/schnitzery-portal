"use server";

import { createClient } from "@/lib/supabase/server";
import { clockIn, clockOut } from "@/lib/queries/attendance";

// ============================================================
// ROTATING CLOCK CODE
// The code algorithm + secret now live in the database
// (clock_code_for / current_clock_code / code_valid). This file is just
// a thin wrapper: it fetches the code for display devices and forwards
// submitted codes to the clock_in / clock_out functions, which validate
// them server-side. No secret or hashing remains in the app source.
// ============================================================

// Display devices (managers / kiosk) fetch the current code to show on-screen.
// Staff accounts are rejected by the database (they must read it in-store).
export async function getCurrentClockCode() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_clock_code");
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    code: data?.code ?? "------",
    rotateSeconds: data?.rotateSeconds ?? 30,
    secondsLeft: data?.secondsLeft ?? 30,
    qrPayload: data?.qrPayload ?? "",
  };
}

// Display devices fetch a batch of upcoming codes to pre-cache, so the kiosk
// keeps showing valid codes during an outage (Emergency Attendance Mode).
export async function getClockCodeBatch(count = 240) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clock_code_batch", { p_count: count });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    branchId: data?.branchId as string,
    rotateSeconds: data?.rotateSeconds ?? 30,
    startWindow: Number(data?.startWindow),
    codes: (data?.codes || []) as { w: number; code: string }[],
  };
}

// Staff: clock IN with the 6-digit code (validated in the database).
export async function clockInWithCode(code: string) {
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  return clockIn(clean);
}

// Staff: clock OUT with the 6-digit code.
export async function clockOutWithCode(code: string) {
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  return clockOut(clean);
}

// Staff: scan the QR (SCHNITZERY-CLOCK:<branchId>:<code>) then clock in/out.
// The database validates the code against the caller's own branch, so a QR
// from a different branch simply won't match.
export async function clockWithQR(payload: string, mode: "in" | "out") {
  const parts = (payload || "").split(":");
  if (parts.length !== 3 || parts[0] !== "SCHNITZERY-CLOCK") {
    return { ok: false, error: "Not a valid Schnitzery clock QR." };
  }
  const code = parts[2];
  return mode === "out" ? clockOut(code) : clockIn(code);
}