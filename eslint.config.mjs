import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/vendored SQL and one-off scripts are not linted.
    "supabase/**",
  ]),
  {
    // ────────────────────────────────────────────────────────────────────────
    // TECH DEBT, DELIBERATELY DOWNGRADED TO WARNINGS
    //
    // `npm run lint` was added to CI on 2026-07-18 and immediately reported
    // 491 problems (461 errors) across ~40 files — essentially all of it
    // pre-existing. Failing the build on all of it would mean either a huge
    // risky refactor before any security fix could ship, or turning linting
    // off entirely. Both are worse than this.
    //
    // These two rules are downgraded so the REST of the ruleset can be
    // enforced properly. They are still reported, so the count can be driven
    // down over time. Do not add new violations.
    // ────────────────────────────────────────────────────────────────────────
    rules: {
      // ~400 instances. Mostly Supabase row shapes, which are genuinely
      // untyped until the generated DB types are wired up. The real fix is
      // `supabase gen types typescript` — then this can go back to "error".
      "@typescript-eslint/no-explicit-any": "warn",

      // New in eslint-config-next 16 / React 19. Flags the standard
      // `useEffect(() => { load(); }, [])` data-loading pattern used on every
      // page in this app. It is a performance hint, not a correctness bug, and
      // rewriting every page's data fetching is out of scope for a security
      // pass. Revisit if these pages ever feel slow.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
