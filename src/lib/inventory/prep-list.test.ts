import { describe, expect, it } from "vitest";
import { addDays, containers, defaultLine, shareText, toPrepare, weekdayIndex, type PrepItem } from "./prep-list";

const chicken: PrepItem = { id: "c", name: "Chicken", name_de: "Hähnchen", unit: "kg", container_size: 20, container_label: "containers",
  target_min: [100, 100, 100, 100, 140, 180, 140], target_max: [120, 120, 120, 120, 160, 220, 150], reserve: [40, 40, 40, 40, 40, 40, 40], sort: 0, is_active: true, yield_id: null };

describe("prep list", () => {
  it("uses the weekday target and subtracts last night's leftover", () => {
    expect(weekdayIndex("2026-11-13")).toBe(4); // Friday
    expect(weekdayIndex("2026-11-15")).toBe(6); // Sunday
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    const fri = defaultLine(chicken, "2026-11-13", 35);
    expect(fri).toMatchObject({ target: 160, reserve: 40, leftover: 35 });
    expect(toPrepare(fri)).toBe(125);
    expect(containers(125, 20)).toBe(7);
    expect(containers(120, 20)).toBe(6);
    expect(containers(10, null)).toBeNull();
  });
  it("treats a missing count as nothing left and lets an override win", () => {
    expect(toPrepare({ target: 160, leftover: null, override: null })).toBe(160);
    expect(toPrepare({ target: 160, leftover: 200, override: null })).toBe(0);
    expect(toPrepare({ target: 160, leftover: 35, override: 150 })).toBe(150);
  });
  it("writes a chat message with reserve and uncounted items separately", () => {
    const text = shareText("2026-11-13", [chicken], [{ ...defaultLine(chicken, "2026-11-13", null) }], "en");
    expect(text).toContain("Chicken: 160 kg (8 containers)");
    expect(text).toContain("Reserve if busy: Chicken +40 kg");
    expect(text).toContain("Leftover not counted: Chicken");
    expect(shareText("2026-11-13", [chicken], [defaultLine(chicken, "2026-11-13", 35)], "de")).toContain("Hähnchen: 125 kg (7 containers)");
  });
});
