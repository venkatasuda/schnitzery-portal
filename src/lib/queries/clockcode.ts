"use server";

import { createClient } from "@/lib/supabase/server";
import { clockIn, clockOut } from "@/lib/queries/attendance";
import { createHash } from "crypto";

// ============================================================
// ROTATING CLOCK CODE — branch-specific 6-digit code that
// changes every 30s. Computed deterministically (no storage):
//   code = first 6 digits of sha256(branchId + secret + timeWindow)
// Manager displays it; staff type/scan it to clock in/out.
// ============================================================

const ROTATE_SECONDS = 30;
// A server-side secret so codes can't be guessed from the branch id alone.
// (In production, move to an env var. For now this is fine for the build.)
const CODE_SECRET = "schnitzery-clock-v1";

function codeForWindow(branchId: string, windowIndex: number): string {
  const hash = createHash("sha256")
    .update(`${branchId}|${CODE_SECRET}|${windowIndex}`)
    .digest("hex");
  // Convert first chunk of hex to a 6-digit number
  const num = parseInt(hash.slice(0, 8), 16) % 1000000;
  return String(num).padStart(6, "0");
}

async function getMyBranch() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, branchId: null };
  const { data } = await supabase.from("users").select("branch_id").eq("id", user.id).single();
  return { user, branchId: data?.branch_id ?? null };
}

// Manager: get the current code for their branch + seconds until it rotates.
export async function getCurrentClockCode() {
  const { user, branchId } = await getMyBranch();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  const nowSec = Math.floor(Date.now() / 1000);
  const windowIndex = Math.floor(nowSec / ROTATE_SECONDS);
  const code = codeForWindow(branchId, windowIndex);
  const secondsLeft = ROTATE_SECONDS - (nowSec % ROTATE_SECONDS);

  return {
    ok: true,
    code,
    rotateSeconds: ROTATE_SECONDS,
    secondsLeft,
    // The QR payload staff will scan
    qrPayload: `SCHNITZERY-CLOCK:${branchId}:${code}`,
  };
}

// Validate a submitted code against the current OR previous window (timing tolerance).
async function isValidCode(branchId: string, submitted: string): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const w = Math.floor(nowSec / ROTATE_SECONDS);
  // Accept current and previous window so a code entered right at rotation still works.
  return submitted === codeForWindow(branchId, w) || submitted === codeForWindow(branchId, w - 1);
}

// Staff: clock IN using a code.
export async function clockInWithCode(code: string) {
  const { user, branchId } = await getMyBranch();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  if (!(await isValidCode(branchId, clean))) {
    return { ok: false, error: "Invalid or expired code. Check the display and try again." };
  }
  return clockIn();
}

// Staff: clock OUT using a code.
export async function clockOutWithCode(code: string) {
  const { user, branchId } = await getMyBranch();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  if (!(await isValidCode(branchId, clean))) {
    return { ok: false, error: "Invalid or expired code." };
  }
  return clockOut();
}

// Validate a scanned QR payload, then clock in/out.
export async function clockWithQR(payload: string, mode: "in" | "out") {
  const { user, branchId } = await getMyBranch();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  // Expected: SCHNITZERY-CLOCK:<branchId>:<code>
  const parts = (payload || "").split(":");
  if (parts.length !== 3 || parts[0] !== "SCHNITZERY-CLOCK") {
    return { ok: false, error: "Not a valid Schnitzery clock QR." };
  }
  const [, qrBranch, qrCode] = parts;
  if (qrBranch !== branchId) return { ok: false, error: "This QR is for a different branch." };
  if (!(await isValidCode(branchId, qrCode))) return { ok: false, error: "QR code expired. Scan again." };

  return mode === "out" ? clockOut() : clockIn();
}