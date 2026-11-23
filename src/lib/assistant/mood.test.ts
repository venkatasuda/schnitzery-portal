import { describe, it, expect } from "vitest";
import { robotMood } from "./mood";

const base = { totalUnits: 3, openBreaches: [], openingMissing: 0, closingMissing: 3 };

describe("robotMood", () => {
  it("alerts on a reading that is still out of range, with the fridge name", () => {
    const r = robotMood({ ...base, openBreaches: [{ name: "Fridge 2", temp: 9 }] }, 10, false);
    expect(r.mood).toBe("alert");
    expect(r.message).toBe("Fridge 2 is at 9 °C. Needs action now.");
  });
  it("flags opening checks only after 14:00 and closing checks only after 21:00", () => {
    expect(robotMood({ ...base, openingMissing: 2 }, 13, false).mood).toBe("idle");
    expect(robotMood({ ...base, openingMissing: 2 }, 14, false)).toMatchObject({ mood: "problem", message: "2 temperature checks are overdue." });
    expect(robotMood(base, 20, false).mood).toBe("idle");
    expect(robotMood(base, 21, true)).toMatchObject({ mood: "problem", message: "3 Temperaturkontrollen sind überfällig." });
  });
  it("is happy when every check is done, sleeps at night, idles without units", () => {
    expect(robotMood({ ...base, closingMissing: 0 }, 22, false).mood).toBe("done");
    expect(robotMood({ ...base, totalUnits: 0 }, 3, false).mood).toBe("sleep");
    expect(robotMood(null, 12, false).mood).toBe("idle");
  });
  it("keeps the same key while nothing changes, so the bubble shows once", () => {
    const a = robotMood({ ...base, openingMissing: 1 }, 15, false).key, b = robotMood({ ...base, openingMissing: 1 }, 16, false).key;
    expect(a).toBe(b);
  });
});
