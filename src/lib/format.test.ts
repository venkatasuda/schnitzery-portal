import { describe, expect, it } from "vitest";
import { formatEur } from "./format";

describe("EUR display", () => {
  it("preserves cents and follows the app language", () => {
    expect(formatEur(1234.56, "en", 2)).toBe("€1,234.56");
    expect(formatEur(1234.56, "de", 2).replace(/\s/g, " ")).toBe("1.234,56 €");
    expect(formatEur(0, "en", 2)).toBe("€0.00");
    expect(formatEur(null, "en", 2)).toBe("—");
    expect(formatEur(NaN, "en", 2)).toBe("—");
  });
  it("preserves fractional unit prices without changing total rounding", () => {
    expect(formatEur(0.0125, "en", 4)).toBe("€0.0125");
    expect(formatEur(0.0125, "en", 2)).toBe("€0.01");
    expect(formatEur(12, "en", 4)).toBe("€12.00");
    expect(formatEur(12, "en")).toBe("€12");
  });
});
