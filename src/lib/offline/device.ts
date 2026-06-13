// A stable identifier for this physical device/browser, used to tag attendance
// events (audit trail) and persisted so it survives reloads.
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem("sz_device_id");
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem("sz_device_id", id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
}