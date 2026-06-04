import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe to use in client components.
// Uses the anon key — RLS on the database protects the actual data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
