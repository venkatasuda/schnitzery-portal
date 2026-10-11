import { expect, it } from "vitest";
import { readAll } from "./readAll";

it("reads beyond the response cap and discards partial results on failure", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const query = { range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }) };
  expect((await readAll(query)).data).toHaveLength(1001);
  const failed = await readAll({ range: async (from: number) => from === 0
    ? { data: rows.slice(0, 1000), error: null }
    : { data: null, error: { message: "Unavailable" } } });
  expect(failed.data).toBeNull();
  expect(failed.error?.message).toBe("Unavailable");
});
