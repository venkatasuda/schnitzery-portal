import { describe, expect, it } from "vitest";
import { onboardingSteps } from "./onboarding";

describe("onboarding checklist", () => {
  it("is only done when the data really exists", () => {
    const empty = onboardingSteps({ contractType: null, contractHours: null, code: "KIT-020", wage: null, approvedDocs: new Set(), availability: false, firstShift: false, loggedIn: false });
    expect(empty.filter((s) => s.done).length).toBe(0); // KIT-020 is no DATEV Personalnummer
    const full = onboardingSteps({ contractType: "Mini Job", contractHours: 40, code: "1001", wage: 14.6, approvedDocs: new Set(["contract", "tax_id", "health_certificate"]), availability: true, firstShift: true, loggedIn: true });
    expect(full.every((s) => s.done)).toBe(true);
    expect(onboardingSteps({ contractType: "Part Time", contractHours: null, code: "1", wage: 0, approvedDocs: new Set(), availability: false, firstShift: false, loggedIn: false })
      .filter((s) => s.done).map((s) => s.key)).toEqual(["pnr", "wage"]); // hours missing → contract open; wage 0 is a set wage
  });
});
