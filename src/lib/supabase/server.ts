import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Server-side Supabase client for Server Components, Route Handlers, and Actions.
// Reads/writes the session cookie so auth persists across requests.
//
// NOTE: generated DB types live in src/lib/database.types.ts. We do NOT apply
// <Database> globally here — doing so surfaced 243 pre-existing nullable-column
// mismatches across the old query files at once. Adopt the types incrementally
// in new code instead. See DB-TYPES-ADOPTION.md.
// One page render calls many query helpers in parallel, each asking "who is signed
// in?". Without this every helper made its own round trip to Supabase Auth
// (~15 per manager home view). React cache() shares one answer per request; outside
// a render (server actions) it simply calls through. A jwt argument is never cached.
const userOnce = cache(async () => (await makeClient()).auth.getUser());

export async function createClient() {
  const client = await makeClient();
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = ((jwt?: string) => (jwt ? getUser(jwt) : userOnce())) as typeof client.auth.getUser;
  return client;
}

async function makeClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes the session.
          }
        },
      },
    }
  );
}
