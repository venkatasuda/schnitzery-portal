import { BASE_URL } from "./local";

// Fail once with a clear message instead of five connection-refused traces.
export default async function preflight() {
  const down: string[] = [];
  await fetch("http://127.0.0.1:55321/auth/v1/health").catch(() => down.push("Supabase (127.0.0.1:55321) — start Docker Desktop, then: supabase start --workdir .audit-db/local-staging"));
  await fetch(BASE_URL + "/login").catch(() => down.push(`Portal (${BASE_URL}) — run: node scripts/ops/start-local-staging.mjs --fast  and wait for "Ready"`));
  if (down.length) throw new Error("Local staging is not running:\n  - " + down.join("\n  - "));
}
