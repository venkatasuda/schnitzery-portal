import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./src/lib/sentryScrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://9939073d8a5196257e3bfdcd3dbdce79@o4511715606724608.ingest.de.sentry.io/4511715615113296",
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
