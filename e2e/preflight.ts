import { BASE_URL } from "./local";

// Fail once with a clear message instead of five connection-refused traces.
export default async function preflight() {
  const down: string[] = [];
  async function check(url: string, recovery: string) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) down.push(`${recovery} (HTTP ${response.status})`);
    } catch { down.push(recovery); }
  }
  await Promise.all([
    check("http://127.0.0.1:55321/auth/v1/health", "Supabase (127.0.0.1:55321) — start Docker Desktop, then: supabase start --workdir .audit-db/local-staging"),
    // Readiness must not trigger a cold login compilation; each workflow tests its actual pages.
    check(BASE_URL + "/offline.html", `Portal (${BASE_URL}) — start the local candidate and wait for "Ready"`),
  ]);
  if (down.length) throw new Error("Local staging is not running:\n  - " + down.join("\n  - "));
}
