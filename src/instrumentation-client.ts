import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryScrub";

// Options and PII scrubbing live in src/lib/sentryScrub.ts.
Sentry.init(sentryOptions);

// lets Sentry tie errors to the page navigation that caused them
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
