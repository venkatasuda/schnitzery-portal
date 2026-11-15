import { beforeEach, expect, it } from "vitest";
import { saveDraft, readDraft, clearDraft } from "./localDraft";

const store = new Map<string, string>();
const setStorage = (value: unknown) => Object.defineProperty(globalThis, "localStorage", { value, configurable: true, writable: true });
beforeEach(() => {
  store.clear();
  setStorage({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});

it("keeps, returns and clears a draft", () => {
  saveDraft("k", { a: "1" });
  expect(readDraft("k")).toEqual({ a: "1" });
  clearDraft("k");
  expect(readDraft("k")).toBeNull();
});
it("drops drafts older than 7 days and unreadable ones", () => {
  store.set("old", JSON.stringify({ at: Date.now() - 8 * 864e5, value: 1 }));
  expect(readDraft("old")).toBeNull();
  expect(store.has("old")).toBe(false);
  store.set("bad", "{not json");
  expect(readDraft("bad")).toBeNull();
});
it("never throws when storage is blocked", () => {
  setStorage({ getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("full"); }, removeItem: () => { throw Error("blocked"); } });
  expect(() => saveDraft("k", 1)).not.toThrow();
  expect(readDraft("k")).toBeNull();
});
