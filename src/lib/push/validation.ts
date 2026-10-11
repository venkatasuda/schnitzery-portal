export function allowedPushEndpoint(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.port && !url.username && !url.password && (
      host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") || host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}
