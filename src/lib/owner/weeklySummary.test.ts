import { describe, expect, it } from "vitest";
import { pushText, summarise } from "./weeklySummary";

describe("weekly owner summary", () => {
  it("sums branches and compares sales only where both weeks are known", () => {
    const p = summarise("2026-10-12", [
      { sales: 10000, salesPrev: 9000, hours: 300.25, purchases: 2500, open: 2 },
      { sales: 5000, salesPrev: null, hours: 120, purchases: 1000.5, open: 1 },
    ]);
    expect(p).toEqual({ week: "2026-10-12", branches: 2, sales: 15000, salesPrev: 9000, hours: 420.3, purchases: 3500.5, open: 3, salesMissing: 0 });
  });

  it("never turns missing sales into zero", () => {
    const p = summarise("2026-10-12", [{ sales: null, salesPrev: 8000, hours: 200, purchases: 0, open: 0 }]);
    expect(p.sales).toBeNull();
    expect(pushText(p, "en").body).toBe("sales not entered · 200 h worked · €0 purchases · nothing waiting");
  });

  it("marks partial sales as a minimum and shows the change in German", () => {
    const p = summarise("2026-10-12", [
      { sales: 11000, salesPrev: 10000, hours: 10, purchases: 0, open: 4 },
      { sales: null, salesPrev: null, hours: 5, purchases: 0, open: 0 },
    ]);
    const de = pushText(p, "de");
    expect(de.title).toBe("Deine Woche in Zahlen · 2 Filialen");
    expect(de.body).toMatch(/Umsatz ≥ 11\.000\s€ \(▲10%\)/); // Intl uses a no-break space before €
    expect(de.body).toContain("4 Punkt(e) warten auf dich");
  });
});
