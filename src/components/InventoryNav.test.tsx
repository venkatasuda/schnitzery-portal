import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement, type ReactElement } from "react";
import InventoryNav from "./InventoryNav";
import { ManagementLocation } from "./ManagementNav";

const context = vi.hoisted(() => ({ path: "/inventory/valuation", locale: "en", nav: null as HTMLElement|null, effects: [] as (()=>void|(()=>void))[] }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useRef: () => ({current:context.nav}), useEffect: (effect:()=>void|(()=>void)) => { context.effects.push(effect); } }));
vi.mock("next/navigation", () => ({ usePathname: () => context.path }));
vi.mock("@/components/LanguageProvider", () => ({ useLang: () => ({ locale: context.locale, t: (key: string) => key }) }));

function link(tree: ReactElement, href: string): ReactElement<Record<string, unknown>> | undefined {
  if (tree.props && (tree.props as Record<string, unknown>).href === href) return tree as ReactElement<Record<string, unknown>>;
  for (const child of Children.toArray((tree.props as { children?: React.ReactNode }).children)) {
    if (isValidElement(child)) { const found = link(child, href); if (found) return found; }
  }
}

describe("inventory navigation", () => {
  it("reveals a clipped current task horizontally and responds to resize", () => {
    const current = {offsetLeft:650,offsetWidth:120};
    const nav = {scrollLeft:0,scrollWidth:800,clientWidth:300,querySelector:()=>current};
    const addEventListener=vi.fn(),removeEventListener=vi.fn();
    vi.stubGlobal("window",{addEventListener,removeEventListener});
    context.nav=nav as unknown as HTMLElement;context.effects=[];
    InventoryNav({active:"kitchen"});
    const cleanup=context.effects[0]();
    expect(nav.scrollLeft).toBe(470);
    current.offsetLeft=10;
    addEventListener.mock.calls[0][1]();
    expect(nav.scrollLeft).toBe(10);
    if(cleanup)cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("resize",addEventListener.mock.calls[0][1]);
    context.nav=null;vi.unstubAllGlobals();
  });
  it("marks the overview as the current page when there is no task navigation", () => {
    context.path = "/inventory";
    const html = renderToStaticMarkup(<InventoryNav active="overview" currentView="overview" />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-current="location"');
  });
  it("keeps report siblings and a deterministic back link on a deep page", () => {
    context.path = "/inventory/valuation";
    const html = renderToStaticMarkup(<InventoryNav active="reports" />);
    expect(html).toContain('class="inventory-back"');
    expect(html).toContain("Back to");
    expect(link(InventoryNav({ active: "reports" }), "/inventory/valuation")?.props["aria-current"]).toBe("page");
    expect(html).not.toContain('/inventory/connections');
  });
  it("groups recipes and sales consumption with kitchen tasks", () => {
    context.path = "/inventory/recipes";
    const html = renderToStaticMarkup(<InventoryNav active="kitchen" />);
    expect(html).toContain('/inventory/preparation');
    expect(html).toContain('/inventory/consumption');
    expect(html).not.toContain('/inventory/connections');
    expect(html).not.toContain('/settings/integrations');
    expect(html).not.toContain('/inventory/valuation');
  });
  it("shows suppliers and returns as Purchasing tasks with the right current marker", () => {
    context.path = "/inventory/purchasing";
    const tree = InventoryNav({ active: "purchasing", purchasingTab: "returns" });
    expect(link(tree, "/inventory/purchasing?tab=returns")?.props["aria-current"]).toBe("page");
    expect(link(tree, "/inventory/purchasing?tab=suppliers")).toBeDefined();
    expect(link(tree, "/inventory/purchasing")?.props["aria-current"]).not.toBe("page");
  });
  it("groups quick count and label tools under their stock workflow instead of separate tabs", () => {
    context.path = "/inventory";
    let tree = InventoryNav({ active: "stock", currentView: "count" });
    expect(link(tree, "/inventory?view=count")).toBeUndefined();
    expect(link(tree, "/inventory/counts")?.props.className).toBe("inventory-back");
    context.path = "/labels";
    tree = InventoryNav({ active: "stock" });
    expect(link(tree, "/labels")).toBeUndefined();
    expect(link(tree, "/inventory?view=catalog")?.props.className).toBe("inventory-back");
  });
  it("classifies integrations as Settings and sales imports as business reports", () => {
    context.path = "/settings/integrations";
    expect(renderToStaticMarkup(<ManagementLocation role="manager" />)).toContain("home.settings");
    context.path = "/sales/imports";
    expect(renderToStaticMarkup(<ManagementLocation role="manager" />)).toContain("workspace.reports");
  });
  it("applies the unsaved guard to the back link and preserves modified clicks", () => {
    context.path = "/inventory/valuation";
    const canLeave = vi.fn(() => false), onNavigate = vi.fn(), preventDefault = vi.fn();
    const tree = InventoryNav({ active: "reports", canLeave, onNavigate });
    const back = link(tree, "/inventory/insights")!;
    const click = back.props.onClick as (event: unknown) => void;
    click({ button: 0, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
    click({ button: 0, ctrlKey: true, preventDefault });
    expect(canLeave).toHaveBeenCalledOnce();
  });
});
