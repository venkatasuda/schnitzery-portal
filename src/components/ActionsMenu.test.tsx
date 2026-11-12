import { afterEach, describe, expect, it, vi } from "vitest";
import ActionsMenu from "./ActionsMenu";

const state = vi.hoisted(() => ({ root: null as HTMLDetailsElement | null, effects: [] as (() => (() => void))[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useRef: () => ({ current: state.root }),
  useEffect: (effect: () => (() => void)) => { state.effects.push(effect); },
}));
afterEach(() => { state.root = null; state.effects = []; vi.unstubAllGlobals(); });

describe("optional action disclosure", () => {
  it("closes on Escape and returns focus to its summary", () => {
    const focus = vi.fn();
    const details = { open: true, querySelector: () => ({ focus }) };
    const tree = ActionsMenu({ label: "More actions", children: null });
    tree.props.onKeyDown({ key: "Escape", currentTarget: details });
    expect(details.open).toBe(false); expect(focus).toHaveBeenCalledOnce();
  });
  it("dismisses outside clicks and removes its listener when unmounted", () => {
    const inside = {}, root = { open: true, contains: (target: unknown) => target === inside };
    state.root = root as unknown as HTMLDetailsElement;
    const add = vi.fn(), remove = vi.fn();
    vi.stubGlobal("document", { addEventListener: add, removeEventListener: remove });
    ActionsMenu({ label: "More actions", children: null });
    const cleanup = state.effects[0]();
    const handler = add.mock.calls[0][1];
    handler({ target: inside }); expect(root.open).toBe(true);
    handler({ target: {} }); expect(root.open).toBe(false);
    cleanup(); expect(remove).toHaveBeenCalledWith("pointerdown", handler);
  });
  it("keeps an open disclosure inside either viewport edge", () => {
    vi.stubGlobal("window", { innerWidth: 390 });
    const style = { transform: "" };
    let bounds = { left: 180, right: 500 };
    const items = { style, getBoundingClientRect: () => bounds };
    const details = { open: true, querySelector: () => items };
    const tree = ActionsMenu({ label: "More actions", children: null });
    tree.props.onToggle({ currentTarget: details }); expect(style.transform).toBe("translateX(-122px)");
    bounds = { left: -24, right: 296 };
    tree.props.onToggle({ currentTarget: details }); expect(style.transform).toBe("translateX(36px)");
  });
});
