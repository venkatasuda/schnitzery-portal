import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PosWorkspace from "./PosWorkspace";

vi.mock("@/components/LanguageProvider", () => ({ useLang: () => ({ locale: "en", t: (key: string) => key }) }));
vi.mock("@/lib/queries/pos-pipeline", () => ({ configurePosConnection: vi.fn(), getPosPipeline: vi.fn(), reviewPosImport: vi.fn() }));
vi.mock("@/lib/queries/inventory-pos-stock", () => ({ importPosExport: vi.fn() }));
const initial = { ok: true as const, branchId: "branch", branch: "Test branch", connections: [], imports: [] };

it("keeps connection setup in Settings without sales approval forms", () => {
  const html = renderToStaticMarkup(<PosWorkspace initial={initial} section="connections" />);
  expect(html).toContain("Connection name");
  expect(html).toContain('href="/settings"');
  expect(html).not.toContain("Recent imports");
  expect(html).not.toContain("Normalized export JSON");
  expect(html).not.toContain("inventory-area-nav");
});

it("keeps export intake and approval in business reporting without connection setup", () => {
  const html = renderToStaticMarkup(<PosWorkspace initial={initial} section="imports" />);
  expect(html).toContain("Sales imports &amp; approval");
  expect(html).toContain("Normalized export JSON");
  expect(html).toContain("Recent imports");
  expect(html).toContain('href="/labor"');
  expect(html).not.toContain("Connection name");
  expect(html).not.toContain("Create disabled connection");
});
