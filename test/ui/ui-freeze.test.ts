import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UiNode } from "@aperture-engine/render";
import {
  createExtractionApp,
  withTransform,
  withUiNode,
  withUiPanel,
  withUiScreen,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  UiFreezeLayout,
  installYogaUiLayout,
  loadLayoutModule,
  withUiFlex,
  withUiFreezeLayout,
  type InstalledUiLayout,
  type Yoga,
} from "@aperture-engine/ui";

let yoga: Yoga;
let app: ExtractionApp | null = null;
let installed: InstalledUiLayout | null = null;

beforeEach(async () => {
  yoga = await loadLayoutModule();
});

afterEach(() => {
  installed?.uninstall();
  installed = null;
  app = null;
});

function widthOf(target: ExtractionApp, index: number): number | undefined {
  const nodes = target.extract(0).uiNodes ?? [];
  return nodes.find((n) => n.entity.index === index)?.rect.width;
}

describe("UiFreezeLayout", () => {
  it("preserves layout while frozen and resumes when unfrozen", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 10, y: 10, width: 80, height: 80 }),
      withUiFlex({ flexDirection: "column" }),
      withUiFreezeLayout(),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);

    expect(widthOf(app, panel.index)).toBe(80);

    // Change the width while frozen — layout must not move.
    panel.setValue(UiNode, "width", 150);
    expect(widthOf(app, panel.index)).toBe(80);

    // Unfreeze — the pending change now applies.
    panel.setValue(UiFreezeLayout, "enabled", false);
    expect(widthOf(app, panel.index)).toBe(150);
  });

  it("does not freeze when the flag is disabled from the start", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 10, y: 10, width: 80, height: 80 }),
      withUiFlex({ flexDirection: "column" }),
      withUiFreezeLayout({ enabled: false }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    expect(widthOf(app, panel.index)).toBe(80);
    panel.setValue(UiNode, "width", 150);
    expect(widthOf(app, panel.index)).toBe(150);
  });
});
