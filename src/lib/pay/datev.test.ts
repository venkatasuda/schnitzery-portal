import { describe, expect, it } from "vitest";
import { buildLodas, datevSettingsError } from "./datev";

const s = { beraterNr: "1234567", mandantNr: "54321", lohnarten: { regular: "100", overtime: "200", night: "300", sunday: "310", holiday: "320" } };

describe("DATEV LODAS export", () => {
  it("writes hours per Lohnart and reports what it left out", () => {
    const out = buildLodas(s, "2026-11", [
      { name: "Anna", code: "1001", regularH: 80.5, overtimeH: 0, nightH: 6, sundayH: 8, holidayH: 0 },
      { name: "Ben", code: "KIT-020", regularH: 40 }, // not a DATEV Personalnummer
    ]);
    expect(out.text.includes("BeraterNr=1234567\r\nMandantenNr=54321")).toBe(true);
    expect(out.text.includes("1;1001;01.11.2026;80,50;1;100;\r\n1;1001;01.11.2026;6,00;1;300;\r\n1;1001;01.11.2026;8,00;1;310;\r\n")).toBe(true);
    expect(out.bookings).toBe(3); // zero overtime/holiday hours are not booked
    expect(out.missingPnr).toEqual(["Ben"]);
    // an older approved snapshot without Sunday hours: say so, don't book 0
    expect(buildLodas(s, "2026-10", [{ name: "Anna", code: "1001", regularH: 10, nightH: 0, holidayH: 0, overtimeH: 0 }]).notInSnapshot).toEqual(["sunday"]);
  });

  it("validates the settings", () => {
    expect(datevSettingsError(s)).toBeNull();
    expect(datevSettingsError({ ...s, beraterNr: "12" })).toMatch(/Berater/);
    expect(datevSettingsError({ ...s, lohnarten: { night: "300" } })).toMatch(/regular/);
    expect(datevSettingsError({ ...s, lohnarten: { regular: "1;2" } })).toMatch(/Lohnart/);
    expect(() => buildLodas(s, "2026-13", [])).toThrow();
  });
});
