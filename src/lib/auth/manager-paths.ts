// Pages only managers use (manager menu). Plain staff are sent to /no-access by the proxy right away.
// Staff pages (home, my-day, schedule, attendance, availability, leave, hours, checklist, prep, shift,
// expiry, waste, temp, incidents, announcements, profile …) are deliberately not listed.
// Data is protected by the database regardless; this only avoids showing staff a manager screen.
export const MANAGER_ROLES = ["manager", "branch_owner", "brand_owner", "super_admin"];
const MANAGER_PREFIXES = ["/action", "/analytics", "/approvals", "/attendance-hub", "/audit", "/branches", "/checklist-status",
  "/compliance", "/expiring-docs", "/export", "/geofence", "/kiosks", "/labor", "/labels", "/my-branches", "/noshow", "/ops",
  "/overview", "/people-hub", "/roster", "/sales", "/schedule-hub", "/settings-hub", "/simulator", "/staff", "/stock-alerts",
  "/summary", "/targets", "/transfers", "/waste-branches", "/inventory"];

export function isManagerPath(path: string) {
  if (path === "/inventory/counts" || path.startsWith("/inventory/counts/")) return false; // shift-leader stocktake
  return MANAGER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
