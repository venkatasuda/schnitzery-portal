import { describe, expect, it, vi } from "vitest";
import { scrubEvent, sentryOptions } from "./sentryScrub";

describe("Sentry PII scrubbing", () => {
  it("removes personal data from errors", () => {
    const e = scrubEvent({
      type: undefined,
      user: { id: "u1", email: "anna@example.test", ip_address: "1.2.3.4" },
      message: "Failed for anna@example.test +49 170 1234567",
      request: { cookies: { sb: "x" }, headers: { authorization: "Bearer t", accept: "*/*" }, url: "https://x/staff?email=anna@example.test", data: { full_name: "Anna", hours: 8 } },
      extra: { staffPhone: "0170", nested: { note: "call bob@example.test" } },
      exception: { values: [{ value: "anna@example.test", stacktrace: { frames: [{ vars: { password: "p", n: 1 } }] } }] },
    } as never)!;
    const s = JSON.stringify(e);
    expect(s).not.toMatch(/anna|bob|1234567|Bearer|1\.2\.3\.4/);
    expect(e.user).toEqual({ id: "u1" });
    expect(e.request?.headers).toEqual({ accept: "*/*" });
    expect((e.request?.data as Record<string, unknown>).hours).toBe(8);
  });

  it("scrubs performance traces too", () => {
    const tx = sentryOptions.beforeSendTransaction({ transaction: "/staff/anna@example.test", spans: [{ description: "GET /x?email=anna@example.test", data: { "user.email": "a@b.de" } }] } as never) as never as { transaction: string; spans: { description: string; data: Record<string, unknown> }[] };
    expect(JSON.stringify(tx)).not.toMatch(/anna|a@b\.de/);
  });

  it("an empty DSN (local staging) disables reporting instead of using production", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SENTRY_DSN = "";
    expect((await import("./sentryScrub")).sentryOptions.dsn).toBe("");
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });
});
