# Adopting generated database types — gradually

`src/lib/database.types.ts` is generated from the live schema:

```
npx supabase gen types typescript --project-id vxwtmtlkwvwcdegtcjuz | Out-File -FilePath src/lib/database.types.ts -Encoding utf8
```

Regenerate it whenever you change the schema (add a column, table, etc.).

## Why it isn't applied globally

Typing the shared Supabase clients with `<Database>` (in `src/lib/supabase/*.ts`)
was tried on 2026-07-18 and surfaced **243 pre-existing type errors across 35
files** in one go. Almost all are the same shape:

- `branchId` is `string | null` (from `profile?.branch_id ?? null`) but
  `.eq("branch_id", branchId)` now expects `string`;
- nullable columns (`full_name`, `duration_mins`, `user_id`) used as object keys
  or passed to functions expecting non-null.

None are new bugs — they are places the old code assumed a value that the schema
says can be null. Fixing all 243 at once, unverified, is high-risk. So the global
generic was reverted and the types are adopted incrementally instead.

## How to adopt incrementally

New code already does this — `src/lib/pay/wages.ts` and `src/lib/push/*` take a
typed client or import types directly. For a query file you're actively editing,
you can type just that file's client:

```ts
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// inside your factory:
createServerClient<Database>(url, key, { ... });
```

Then fix the handful of null errors that file surfaces (usually: guard
`branchId` with an early `if (!branchId) return ...`, and coalesce nullable
columns with `?? ""` / `?? 0`). Do one file per PR, keep the build green.

## The common fix patterns

- **`branchId` is null** → add `if (!branchId) return { ok: false, error: "No branch." }`
  near the top; after that guard, TypeScript narrows it to `string`.
- **nullable column as an object key** (`map[u.user_id]`) → guard `if (!u.user_id) continue;`
- **nullable passed to a `string` param** → widen the receiving function's
  parameter to `string | null` if it already handles null (many `fmt*` helpers
  do), or coalesce at the call site.

## Payoff

Once a file is typed, TypeScript catches "column doesn't exist" and
"forgot this can be null" as you type — the exact class of bug that broke the
build repeatedly on 2026-07-18. No rush; do it as you touch each file.
