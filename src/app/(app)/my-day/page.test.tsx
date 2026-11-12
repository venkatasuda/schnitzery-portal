import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import MyDayPage from "./page";

const state = vi.hoisted(() => ({ query: "", push: vi.fn(), visited: null as string[] | null }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: string[]) => [state.visited ?? initial, (update: string[] | ((previous: string[]) => string[])) => { state.visited = typeof update === "function" ? update(state.visited ?? initial) : update; }] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({ push: state.push }) }));
vi.mock("@/components/LanguageProvider", () => ({ useLang: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/Icon", () => ({ default: () => null }));
vi.mock("@/components/AvailabilityForm", () => ({ default: () => "AVAILABILITY_VIEW" }));
vi.mock("../leave/page", () => ({ default: () => "LEAVE_VIEW" }));
vi.mock("../hours/page", () => ({ default: () => "HOURS_VIEW" }));
vi.mock("../checklist/page", () => ({ default: () => "WORK_VIEW" }));
afterEach(() => { state.query = ""; state.push.mockClear(); state.visited = null; });

it("opens the requested My Day view and safely defaults unknown values", () => {
  state.query = "tab=hours";
  expect(renderToStaticMarkup(<MyDayPage />)).toContain("HOURS_VIEW");
  state.query = "tab=unrecognised";
  expect(renderToStaticMarkup(<MyDayPage />)).toContain("AVAILABILITY_VIEW");
});
it("keeps other query context when changing views without scrolling", () => {
  state.query = "week=2026-11-16&tab=hours";
  const child = MyDayPage().props.children;
  const tree = child.type(child.props);
  function click(node: ReactNode): boolean {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return false;
    if (node.type === "button" && Children.toArray(node.props.children).includes("myday.tabTimeOff")) { node.props.onClick?.(); return true; }
    return Children.toArray(node.props.children).some(click);
  }
  expect(click(tree)).toBe(true);
  expect(state.push).toHaveBeenCalledWith("/my-day?week=2026-11-16&tab=timeoff", { scroll: false });
});

it("keeps visited forms mounted but hides inactive views", () => {
  state.query = "tab=hours";
  state.visited = ["avail", "hours"];
  const markup = renderToStaticMarkup(<MyDayPage />);
  expect(markup).toContain("AVAILABILITY_VIEW");
  expect(markup).toContain("HOURS_VIEW");
  expect(markup).toMatch(/class="hub-tab-panel" hidden=""/);
  expect(markup).not.toContain("LEAVE_VIEW");
});

it("remembers a view reached through browser history rather than a tab click", () => {
  state.query = "tab=work";
  state.visited = ["hours"];
  renderToStaticMarkup(<MyDayPage />);
  expect(state.visited).toEqual(["hours", "work"]);
});
