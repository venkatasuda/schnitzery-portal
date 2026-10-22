import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./src/lib/sentryScrub";

// Options and PII scrubbing live in src/lib/sentryScrub.ts.
Sentry.init(sentryOptions);
