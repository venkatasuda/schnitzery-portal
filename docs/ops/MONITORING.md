# Error monitoring (Sentry)

## What the code does
- One config for browser, server and edge: `sentryOptions` in `src/lib/sentryScrub.ts`.
- Reports only from production builds; tagged `environment` = `production` / `preview` (Vercel) or `local`.
- Personal data is removed before anything leaves the app — errors **and** performance traces:
  user reduced to its id, cookies and auth headers dropped, emails/phone numbers masked in
  messages, URLs, breadcrumbs, span descriptions; keys like `name`, `email`, `phone`, `iban`,
  `password`, `token` redacted. If scrubbing fails the event is dropped.
- An empty `NEXT_PUBLIC_SENTRY_DSN` disables reporting (local staging sets it empty).
- Tested in `src/lib/sentryScrub.test.ts`.
- Browser reports go through our own `/monitoring` route (ad blockers on staff phones block
  sentry.io). That route skips the login redirect in `src/proxy.ts`, so errors on the sign-in page
  are reported too. `@sentry/nextjs` must stay ≥ 10.75.2 (tunnel-route security fix).

## One-off setup in sentry.io (owner, ~10 minutes)
1. **Data region / privacy:** project is on the EU (`ingest.de.sentry.io`) region. In
   *Settings → Security & Privacy* turn on **Data Scrubber** and **Prevent storing IP addresses**
   (server-side backup for the code above).
2. **Alerts → Create alert → Issues**, environment `production`:
   - *A new issue is created* → email the owner.
   - *Number of events in an issue > 20 in 1 hour* → email (something is broken for many people).
3. **Alerts → Metric alert:** *Crash free session rate < 98 % over 1 hour*, environment `production`.
4. **Vercel → Project → Settings → Environment Variables:** `SENTRY_AUTH_TOKEN` (Production
   only) so source maps upload and stack traces show real file names.
5. Check: after the next production deploy, *Issues* should show the release and
   `environment: production`; preview deploys show `preview` and do not trigger alerts.
