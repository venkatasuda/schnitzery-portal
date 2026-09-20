import type { MetadataRoute } from "next";

// This is a private, login-gated staff portal — there is nothing here meant for
// public search. Tell every crawler to stay out entirely, so the app never shows
// up in Google/Bing results. (A public marketing site would do the opposite; this
// is deliberately the reverse.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
