import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// ============================================================================
// SENTRY PII SCRUBBING
//
// This app handles employee records for a German employer: names, emails,
// phone numbers, contract hours, document expiry. Under GDPR none of that
// should be leaving for a third-party error tracker as a side effect of a
// stack trace. Sentry captures request data, breadcrumbs and local variables
// by default, all of which routinely contain it.
//
// This runs on every event, client and server. It is deliberately blunt:
// over-redacting costs a little debuggability, under-redacting is a breach.
// ============================================================================

// Keys whose values are replaced wholesale, matched case-insensitively as a
// substring so `full_name`, `userEmail`, `staffPhone` etc. are all caught.
const SENSITIVE_KEYS = [
  "email", "phone", "full_name", "fullname", "name", "password", "token",
  "authorization", "cookie", "apikey", "api_key", "secret", "employee_code",
  "avatar_url", "file_path", "address", "iban", "dob", "birth",
];

const REDACTED = "[redacted]";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// German mobile/landline shapes plus generic long digit runs.
const PHONE_RE = /(\+?\d[\d\s()-]{7,}\d)/g;

function scrubString(s: string): string {
  return s.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED);
}

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

// Walks an arbitrary structure, redacting sensitive keys and scrubbing free
// text. Depth-capped and cycle-safe so a pathological object can't hang the
// beforeSend hook.
function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : scrub(v, depth + 1, seen);
  }
  return out;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  try {
    // Identify the user by id only — never by email, name or IP.
    if (event.user) {
      event.user = { id: event.user.id };
    }

    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        for (const h of Object.keys(event.request.headers)) {
          if (isSensitiveKey(h)) delete event.request.headers[h];
        }
      }
      // Query strings routinely carry emails and ids.
      if (typeof event.request.query_string === "string") {
        event.request.query_string = scrubString(event.request.query_string);
      }
      if (event.request.data) event.request.data = scrub(event.request.data);
      if (typeof event.request.url === "string") event.request.url = scrubString(event.request.url);
    }

    if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
    if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;

    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        message: typeof b.message === "string" ? scrubString(b.message) : b.message,
        data: b.data ? (scrub(b.data) as Record<string, unknown>) : b.data,
      }));
    }

    if (typeof event.message === "string") event.message = scrubString(event.message);

    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (typeof ex.value === "string") ex.value = scrubString(ex.value);
        // Local variables captured in stack frames are a common leak path.
        if (ex.stacktrace?.frames) {
          for (const frame of ex.stacktrace.frames) {
            if (frame.vars) frame.vars = scrub(frame.vars) as Record<string, unknown>;
          }
        }
      }
    }

    return event;
  } catch {
    // If scrubbing itself fails, drop the event rather than risk sending
    // unscrubbed personal data.
    return null;
  }
}
