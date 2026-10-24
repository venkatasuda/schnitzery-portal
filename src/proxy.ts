import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Single gatekeeper for auth. Runs on every request.
// Avoids redirect loops by carefully checking the path BEFORE redirecting.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  // Pages that must be viewable without signing in (legal pages are often
  // required to be reachable pre-login).
  const isPublic = isLoginPage || path === "/privacy" || path === "/terms";

  // Not logged in + trying to view a protected page → go to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in + sitting on the login page → go home. GET only: the login form's
  // own server action (finishLogin) POSTs to /login right after sign-in, and a
  // redirect there makes the client throw "unexpected response" and hang.
  if (user && isLoginPage && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Everything else: let it through
  return response;
}

export const config = {
  matcher: [
    // Run on all routes EXCEPT static files and Next internals. The service
    // worker, its public offline page and the web manifest must load signed-out:
    // a redirect here breaks SW registration and leaves no offline fallback.
    // /api/cron/* is called by Vercel Cron with a secret (checked in the route), never a user.
    // /monitoring is the Sentry tunnel: errors on the login page (signed out)
    // must still reach Sentry, so it bypasses the login redirect.
    "/((?!_next/static|_next/image|favicon.ico|monitoring$|api/cron/|sw\\.js$|offline\\.html$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};