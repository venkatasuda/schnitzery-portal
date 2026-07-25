import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe to use in client components.
// Uses the anon key — RLS on the database protects the actual data.
//
// NOTE: generated DB types live in src/lib/database.types.ts. We do NOT apply
// <Database> globally here — doing so surfaced 243 pre-existing nullable-column
// mismatches across the old query files at once. Adopt the types incrementally
// in new code instead: import { Database } and type individual queries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
