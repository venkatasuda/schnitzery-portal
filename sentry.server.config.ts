import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./src/lib/sentryScrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://9939073d8a5196257e3bfdcd3dbdce79@o4511715606724608.ingest.de.sentry.io/4511715615113296",
  // capture 10% of transactions for performance data (raise later if you want more)
  tracesSampleRate: 0.1,
  // don't send noise from local dev; flip on to test locally
  enabled: process.env.NODE_ENV === "production",
  // Never attach IP / cookies / headers automatically. This app handles
  // employee records — see src/lib/sentryScrub.ts.
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
