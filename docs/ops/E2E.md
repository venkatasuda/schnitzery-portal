# Browser tests (daily flows)

`e2e/daily-flows.e2e.ts` drives a real browser through the five flows the restaurants use
every day:

| Test | Who | What it proves |
| --- | --- | --- |
| clock in / out | staff A | buttons work end to end, status flips back |
| stock count | manager A | new catalogue product → count saved → shows "Below target" → removed |
| roster save | manager A | next week: add shift → save → survives reload → remove → save |
| transfer | managers A + B | request → mark sent → confirm received across two branches |
| payroll approval | manager A | seeded closed month → approve → reopen |

## Safety
- Runs **only** against local staging. `e2e/local.ts` refuses any host that is not
  `localhost`, `127.0.0.1`, `[::1]` or `*.localhost`, and the seeding client refuses any
  Supabase URL other than `127.0.0.1:55321`.
- Uses the six synthetic `@example.test` accounts. Every test removes what it created.
- Reports and traces go to `.audit-db/` (ignored by git).

## Run (Windows, from the repo root)
```powershell
npm ci                                            # once, after pulling
node scripts/ops/start-local-staging.mjs --fast   # terminal 1, leave running
npm run e2e                                       # terminal 2
```
Uses your installed Chrome. To use Playwright's own browser instead:
`npx playwright install chromium` then `$env:E2E_CHANNEL=""; npm run e2e`.
Failure report: `npx playwright show-report .audit-db/e2e-report`.

Not in CI yet: it needs the local Supabase stack. Once a CI database exists, add a job that
starts it and runs `npm run e2e`.
